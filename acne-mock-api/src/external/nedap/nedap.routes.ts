import type { FastifyInstance } from 'fastify';
import {
  listArticles,
  getArticle,
  listEpcObservations,
  submitStockCount,
  listStockCounts,
  getStockCount,
  getStockAccuracy,
  listLocations,
} from './nedap.handlers.js';

export async function nedapRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── Articles (Products) ────────────────────────────────

  fastify.get('/articles', {
    schema: {
      tags: ['External: Nedap'],
      summary: 'List articles',
      description:
        'List articles (products) with RFID-relevant fields. ' +
        'Maps products from IMS store with GTIN barcodes. ' +
        'Follows GS1 EPCIS 1.2 standard.',
      querystring: {
        type: 'object',
        properties: {
          gtin: { type: 'string', description: 'Filter by GTIN barcode' },
          limit: { type: 'string', description: 'Max results (default 50, max 100)' },
        },
      },
    },
  }, listArticles);

  fastify.get('/articles/:gtin', {
    schema: {
      tags: ['External: Nedap'],
      summary: 'Get article by GTIN',
      description: 'Get a single article by its GTIN/barcode. Returns RFID tag and EPC data.',
      params: {
        type: 'object',
        properties: { gtin: { type: 'string' } },
        required: ['gtin'],
      },
    },
  }, getArticle);

  // ─── EPC Observations ──────────────────────────────────

  fastify.get('/epc-observations', {
    schema: {
      tags: ['External: Nedap'],
      summary: 'List EPC tag observations',
      description:
        'List RFID tag read observations. Returns EPC, timestamp, zone, and location. ' +
        'Generated from real SKU rfidTag fields in IMS store data.',
      querystring: {
        type: 'object',
        properties: {
          locationId: { type: 'string', description: 'Filter by location ID' },
          since: { type: 'string', description: 'ISO timestamp — return observations after this time' },
          limit: { type: 'string', description: 'Max results (default 50, max 500)' },
        },
      },
    },
  }, listEpcObservations);

  // ─── Stock Counts ──────────────────────────────────────

  fastify.post('/stock-counts', {
    schema: {
      tags: ['External: Nedap'],
      summary: 'Submit stock count',
      description:
        'Submit a stock count from a store. Compares with system stock, ' +
        'flags discrepancies, and creates RFID_RECONCILIATION movements in IMS. ' +
        'Includes deliberate 2-5% discrepancies for reconciliation testing.',
      body: {
        type: 'object',
        required: ['locationId', 'countedAt', 'items'],
        properties: {
          locationId: { type: 'string' },
          countedAt: { type: 'string', format: 'date-time' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['gtin', 'epc', 'quantity'],
              properties: {
                gtin: { type: 'string' },
                epc: { type: 'string' },
                quantity: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, submitStockCount);

  fastify.get('/stock-counts', {
    schema: {
      tags: ['External: Nedap'],
      summary: 'List stock counts',
      description: 'List previous stock count results with summary data. Supports filtering by location.',
      querystring: {
        type: 'object',
        properties: {
          locationId: { type: 'string', description: 'Filter by location ID' },
          limit: { type: 'string', description: 'Max results (default 50, max 100)' },
        },
      },
    },
  }, listStockCounts);

  fastify.get('/stock-counts/:id', {
    schema: {
      tags: ['External: Nedap'],
      summary: 'Get stock count detail',
      description: 'Get a single stock count with per-item results and discrepancy breakdown.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, getStockCount);

  // ─── Stock Accuracy KPIs ───────────────────────────────

  fastify.get('/stock-accuracy', {
    schema: {
      tags: ['External: Nedap'],
      summary: 'Stock accuracy KPIs',
      description:
        'Stock accuracy KPIs per location. Returns accuracy percentage, ' +
        'total items, matched items, and discrepancies for RFID-enabled stores.',
      querystring: {
        type: 'object',
        properties: {
          locationId: { type: 'string', description: 'Filter to a specific location' },
        },
      },
    },
  }, getStockAccuracy);

  // ─── Locations ─────────────────────────────────────────

  fastify.get('/locations', {
    schema: {
      tags: ['External: Nedap'],
      summary: 'List RFID-enabled locations',
      description:
        'List all RFID-enabled locations (stores only from IMS). ' +
        'Includes reader count, zone count, and last sync timestamp.',
    },
  }, listLocations);
}
