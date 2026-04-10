import type { FastifyInstance } from 'fastify';
import {
  listStyles,
  getStyle,
  listStyleBoms,
  listSeasons,
  getSeason,
  listMaterials,
  getMaterial,
  listColorways,
  listCollections,
  getCollection,
  listSuppliers,
  listSizeRanges,
} from './centric.handlers.js';

export async function centricRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── Styles ────────────────────────────────────────────

  fastify.get('/styles', {
    schema: {
      tags: ['External: Centric'],
      summary: 'List styles',
      description:
        'List styles with PLM-specific attributes including tech pack status and sample status. ' +
        'Maps from IMS products. Supports Centric v2 query params: skip, limit, modified_after.',
      querystring: {
        type: 'object',
        properties: {
          season: { type: 'string', description: 'Filter by season (e.g. AW2026, SS)' },
          category: { type: 'string', description: 'Filter by category' },
          limit: { type: 'string', description: 'Max results per page (default 10, max 100)' },
          skip: { type: 'string', description: 'Number of records to skip (default 0)' },
          modified_after: { type: 'string', description: 'ISO timestamp — return items modified after this date' },
        },
      },
    },
  }, listStyles);

  fastify.get('/styles/:id', {
    schema: {
      tags: ['External: Centric'],
      summary: 'Get style detail',
      description:
        'Get style detail with materials, colorways, size range, and PLM workflow status. ' +
        'Includes material composition and image references.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, getStyle);

  // ─── Style BOMs ────────────────────────────────────────

  fastify.get('/style_boms', {
    schema: {
      tags: ['External: Centric'],
      summary: 'List style BOMs (Bill of Materials)',
      description:
        'Returns the bill of materials for all styles. Each entry includes the full BOM ' +
        'with materials, quantities, unit costs, and total material cost. ' +
        'Supports filtering by season and category.',
      querystring: {
        type: 'object',
        properties: {
          season: { type: 'string', description: 'Filter by season (e.g. AW2026, SS)' },
          category: { type: 'string', description: 'Filter by category' },
          limit: { type: 'string', description: 'Max results per page (default 100, max 200)' },
          skip: { type: 'string', description: 'Number of records to skip (default 0)' },
        },
      },
    },
  }, listStyleBoms);

  // ─── Seasons ───────────────────────────────────────────

  fastify.get('/seasons', {
    schema: {
      tags: ['External: Centric'],
      summary: 'List seasons',
      description:
        'List seasons derived from IMS product season/year combinations. ' +
        'Includes status (PLANNING, DEVELOPMENT, PRODUCTION, IN_SEASON, ARCHIVED) and style count.',
    },
  }, listSeasons);

  fastify.get('/seasons/:id', {
    schema: {
      tags: ['External: Centric'],
      summary: 'Get season detail',
      description:
        'Get season detail with style count, timeline dates (design through markdown), ' +
        'and list of styles. Season ID format: AW2026, SS2026.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, getSeason);

  // ─── Materials ─────────────────────────────────────────

  fastify.get('/materials', {
    schema: {
      tags: ['External: Centric'],
      summary: 'List materials',
      description:
        'List materials used across products. Generated from product categories ' +
        '(denim, wool, leather, cotton, mohair, etc). Includes composition and certifications.',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', description: 'Max results per page (default 10, max 100)' },
          skip: { type: 'string', description: 'Number of records to skip (default 0)' },
        },
      },
    },
  }, listMaterials);

  fastify.get('/materials/:id', {
    schema: {
      tags: ['External: Centric'],
      summary: 'Get material detail',
      description:
        'Get material detail with supplier info, composition, certifications, ' +
        'and quality test results.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, getMaterial);

  // ─── Colorways ─────────────────────────────────────────

  fastify.get('/colorways', {
    schema: {
      tags: ['External: Centric'],
      summary: 'List colorways',
      description:
        'List colorways (colors) mapped from acne-colors.json. ' +
        'Includes hex values and associated style counts.',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', description: 'Max results per page (default 10, max 100)' },
          skip: { type: 'string', description: 'Number of records to skip (default 0)' },
        },
      },
    },
  }, listColorways);

  // ─── Collections ───────────────────────────────────────

  fastify.get('/collections', {
    schema: {
      tags: ['External: Centric'],
      summary: 'List collections',
      description:
        'List collections derived from IMS product collection field. ' +
        'Groups styles by collection name (Main Collection, Face Collection, etc).',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', description: 'Max results per page (default 10, max 100)' },
          skip: { type: 'string', description: 'Number of records to skip (default 0)' },
        },
      },
    },
  }, listCollections);

  fastify.get('/collections/:id', {
    schema: {
      tags: ['External: Centric'],
      summary: 'Get collection detail',
      description:
        'Get collection detail with list of styles, categories, and seasons. ' +
        'Collection ID format: COL-MAIN-COLLECTION, COL-FACE-COLLECTION, etc.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, getCollection);

  // ─── Suppliers ─────────────────────────────────────────

  fastify.get('/suppliers', {
    schema: {
      tags: ['External: Centric'],
      summary: 'List suppliers',
      description:
        'List suppliers with PLM-specific data including factory audit status, ' +
        'compliance status, and sustainability certifications.',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', description: 'Max results per page (default 10, max 100)' },
          skip: { type: 'string', description: 'Number of records to skip (default 0)' },
        },
      },
    },
  }, listSuppliers);

  // ─── Size Ranges ───────────────────────────────────────

  fastify.get('/size_ranges', {
    schema: {
      tags: ['External: Centric'],
      summary: 'List size ranges',
      description:
        'List size ranges used across products. Includes alpha sizes, denim waist sizes, ' +
        'footwear EU sizes, and one-size-fits-all.',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', description: 'Max results per page (default 10, max 100)' },
          skip: { type: 'string', description: 'Number of records to skip (default 0)' },
        },
      },
    },
  }, listSizeRanges);
}
