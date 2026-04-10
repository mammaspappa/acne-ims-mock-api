import type { FastifyInstance } from 'fastify';
import {
  listPassports, getPassport, createPassport,
  getPassportByNfc, verifyPassport,
  listEvents, addEvent,
  getComplianceStatus, listMaterials,
} from './temera.handlers.js';

export async function temeraRoutes(fastify: FastifyInstance): Promise<void> {
  // Digital Product Passports
  fastify.get('/passports', {
    schema: {
      tags: ['External: Temera DPP'],
      summary: 'List digital product passports',
      description: 'Returns all DPPs. Filter by productId, season, status. Temera DPP provides EU-regulation-compliant digital product passports for every garment, linked via NFC tags and QR codes.',
      querystring: {
        type: 'object',
        properties: {
          productId: { type: 'string' },
          season: { type: 'string' },
          status: { type: 'string', enum: ['draft', 'active', 'archived'] },
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 },
        },
      },
    },
  }, listPassports);

  fastify.get('/passports/:passportId', {
    schema: {
      tags: ['External: Temera DPP'],
      summary: 'Get digital product passport by ID',
      description: 'Returns full DPP with materials, supply chain events, sustainability data, care instructions, and compliance status.',
      params: { type: 'object', required: ['passportId'], properties: { passportId: { type: 'string' } } },
    },
  }, getPassport);

  fastify.post('/passports', {
    schema: {
      tags: ['External: Temera DPP'],
      summary: 'Create a new digital product passport',
      description: 'Creates a DPP for a product/SKU. Links to NFC tag and generates QR code URL.',
      body: {
        type: 'object',
        required: ['skuId'],
        properties: {
          skuId: { type: 'string' },
          serialNumber: { type: 'string' },
          nfcTagId: { type: 'string' },
        },
      },
    },
  }, createPassport);

  fastify.get('/passports/nfc/:nfcTagId', {
    schema: {
      tags: ['External: Temera DPP'],
      summary: 'Look up passport by NFC tag ID',
      description: 'Simulates scanning an NFC tag on a garment to retrieve its digital product passport.',
      params: { type: 'object', required: ['nfcTagId'], properties: { nfcTagId: { type: 'string' } } },
    },
  }, getPassportByNfc);

  fastify.get('/passports/:passportId/verify', {
    schema: {
      tags: ['External: Temera DPP'],
      summary: 'Verify passport authenticity',
      description: 'Blockchain-backed verification of product authenticity and ownership chain.',
      params: { type: 'object', required: ['passportId'], properties: { passportId: { type: 'string' } } },
    },
  }, verifyPassport);

  // Supply chain events
  fastify.get('/passports/:passportId/events', {
    schema: {
      tags: ['External: Temera DPP'],
      summary: 'List supply chain events for a passport',
      description: 'Returns traceability events: raw material sourcing, manufacturing, shipping, retail arrival.',
      params: { type: 'object', required: ['passportId'], properties: { passportId: { type: 'string' } } },
    },
  }, listEvents);

  fastify.post('/passports/:passportId/events', {
    schema: {
      tags: ['External: Temera DPP'],
      summary: 'Add supply chain event to passport',
      description: 'Record a new traceability event (e.g., garment shipped, arrived at store).',
      params: { type: 'object', required: ['passportId'], properties: { passportId: { type: 'string' } } },
      body: {
        type: 'object',
        required: ['eventType', 'location'],
        properties: {
          eventType: { type: 'string', enum: ['raw_material_sourced', 'manufacturing_started', 'manufacturing_completed', 'quality_check_passed', 'shipped', 'customs_cleared', 'warehouse_received', 'store_received', 'sold', 'returned', 'resold', 'recycled'] },
          location: { type: 'string' },
          details: { type: 'object' },
        },
      },
    },
  }, addEvent);

  // Compliance
  fastify.get('/compliance/status', {
    schema: {
      tags: ['External: Temera DPP'],
      summary: 'Get EU DPP compliance status',
      description: 'Returns overall compliance status for the EU Digital Product Passport regulation (ESPR). Shows which products have DPPs, which are pending, and compliance deadlines.',
    },
  }, getComplianceStatus);

  // Materials traceability
  fastify.get('/materials', {
    schema: {
      tags: ['External: Temera DPP'],
      summary: 'List materials with sustainability data',
      description: 'Returns materials used across products with origin, certifications, carbon footprint, and recyclability information.',
      querystring: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          certified: { type: 'boolean' },
          limit: { type: 'number', default: 50 },
        },
      },
    },
  }, listMaterials);
}
