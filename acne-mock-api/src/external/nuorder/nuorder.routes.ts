import type { FastifyInstance } from 'fastify';
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrderStatus,
  listLineSheets,
  getLineSheet,
  listProducts,
  getProduct,
  listCompanies,
  getCompany,
} from './nuorder.handlers.js';

export async function nuorderRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── Orders ────────────────────────────────────────────

  fastify.get('/orders', {
    schema: {
      tags: ['External: NuORDER'],
      summary: 'List wholesale orders',
      description:
        'List wholesale orders. Maps from IMS wholesale sales orders. ' +
        'Uses OAuth 1.0 authentication (mock). Response uses snake_case flat JSON.',
      querystring: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['new', 'processing', 'shipped', 'cancelled'],
            description: 'Filter by order status',
          },
          buyer_code: { type: 'string', description: 'Filter by buyer company code' },
          limit: { type: 'string', description: 'Max results (default 50, max 100)' },
        },
      },
    },
  }, listOrders);

  fastify.get('/orders/:id', {
    schema: {
      tags: ['External: NuORDER'],
      summary: 'Get order detail',
      description: 'Get wholesale order detail with line items, buyer info, and ship-to address.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, getOrder);

  fastify.post('/orders', {
    schema: {
      tags: ['External: NuORDER'],
      summary: 'Create wholesale order',
      description:
        'Create a wholesale order. Creates a corresponding WHOLESALE sales order in IMS. ' +
        'Body requires buyer info, line items with SKU references, and ship-to address.',
      body: {
        type: 'object',
        required: ['buyer', 'items', 'ship_to'],
        properties: {
          buyer: {
            type: 'object',
            required: ['name', 'code', 'email'],
            properties: {
              name: { type: 'string' },
              code: { type: 'string' },
              email: { type: 'string' },
            },
          },
          items: {
            type: 'array',
            items: {
              type: 'object',
              required: ['sku', 'quantity'],
              properties: {
                sku: { type: 'string' },
                quantity: { type: 'number' },
              },
            },
          },
          ship_to: {
            type: 'object',
            required: ['address', 'city', 'country'],
            properties: {
              address: { type: 'string' },
              city: { type: 'string' },
              country: { type: 'string' },
            },
          },
        },
      },
    },
  }, createOrder);

  fastify.put('/orders/:id/status', {
    schema: {
      tags: ['External: NuORDER'],
      summary: 'Update order status',
      description:
        'Update a wholesale order status. Maps to IMS sales order state transitions. ' +
        'Valid statuses: new, processing, shipped, cancelled.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['new', 'processing', 'shipped', 'cancelled'],
          },
        },
      },
    },
  }, updateOrderStatus);

  // ─── Line Sheets ───────────────────────────────────────

  fastify.get('/line-sheets', {
    schema: {
      tags: ['External: NuORDER'],
      summary: 'List line sheets',
      description:
        'List line sheets (seasonal product catalogs). ' +
        'Generated from IMS products grouped by season.',
    },
  }, listLineSheets);

  fastify.get('/line-sheets/:seasonYear', {
    schema: {
      tags: ['External: NuORDER'],
      summary: 'Get line sheet',
      description:
        'Get line sheet for a specific season. Returns products with wholesale pricing, ' +
        'images, sizes, and color options. Format: AW2026 or SS2026.',
      params: {
        type: 'object',
        properties: { seasonYear: { type: 'string' } },
        required: ['seasonYear'],
      },
    },
  }, getLineSheet);

  // ─── Products ──────────────────────────────────────────

  fastify.get('/products', {
    schema: {
      tags: ['External: NuORDER'],
      summary: 'List products',
      description:
        'List products with wholesale details including pricing and size runs. ' +
        'Supports filtering by season and category.',
      querystring: {
        type: 'object',
        properties: {
          season: { type: 'string', description: 'Filter by season (e.g. AW2026, SS)' },
          category: { type: 'string', description: 'Filter by category' },
          limit: { type: 'string', description: 'Max results (default 50, max 100)' },
        },
      },
    },
  }, listProducts);

  fastify.get('/products/:styleNumber', {
    schema: {
      tags: ['External: NuORDER'],
      summary: 'Get product by style number',
      description:
        'Get product detail with wholesale pricing, size runs, and color options. ' +
        'Use the full style number (e.g. FN-WN-COAT000001).',
      params: {
        type: 'object',
        properties: { styleNumber: { type: 'string' } },
        required: ['styleNumber'],
      },
    },
  }, getProduct);

  // ─── Companies ─────────────────────────────────────────

  fastify.get('/companies', {
    schema: {
      tags: ['External: NuORDER'],
      summary: 'List buyer companies',
      description:
        'List wholesale buyer companies. Derived from wholesale sales orders\' customerName field.',
    },
  }, listCompanies);

  fastify.get('/companies/:code', {
    schema: {
      tags: ['External: NuORDER'],
      summary: 'Get buyer company detail',
      description:
        'Get buyer company detail with order history. ' +
        'Use the company code (e.g. NORDSTRO, SELFRIDG).',
      params: {
        type: 'object',
        properties: { code: { type: 'string' } },
        required: ['code'],
      },
    },
  }, getCompany);
}
