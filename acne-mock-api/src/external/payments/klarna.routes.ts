import type { FastifyInstance } from 'fastify';
import {
  createSession,
  getSession,
  updateSession,
  createOrderFromAuth,
  listOrders,
  getOrder,
  captureOrder,
  refundOrder,
  seedKlarnaData,
} from './klarna.handlers.js';

export async function klarnaRoutes(fastify: FastifyInstance): Promise<void> {
  // Ensure data is seeded on registration
  seedKlarnaData();

  // ─── Sessions ───────────────────────────────────────────

  fastify.post('/sessions', {
    schema: {
      tags: ['External: Payments'],
      summary: 'Create Klarna payment session',
      description:
        'Create a new Klarna payment session. Returns a session_id and client_token for the Klarna widget. ' +
        'Sessions expire after 48 hours. Based on Klarna Payments API V1.',
      body: {
        type: 'object',
        required: ['purchase_country', 'purchase_currency', 'order_amount', 'order_lines'],
        properties: {
          purchase_country: { type: 'string', description: 'ISO 3166-1 alpha-2 country code (e.g. SE, DE)' },
          purchase_currency: { type: 'string', description: 'ISO 4217 currency code' },
          locale: { type: 'string', description: 'Locale string (e.g. sv-SE). Auto-detected from country if omitted.' },
          order_amount: { type: 'number', description: 'Total order amount in minor units (e.g. 10000 = 100.00 SEK)' },
          order_lines: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'quantity', 'unit_price', 'total_amount'],
              properties: {
                name: { type: 'string', description: 'Product name' },
                quantity: { type: 'number', description: 'Quantity' },
                unit_price: { type: 'number', description: 'Unit price in minor units' },
                total_amount: { type: 'number', description: 'Total line amount in minor units' },
                reference: { type: 'string', description: 'SKU or product reference' },
              },
            },
          },
        },
      },
    },
  }, createSession);

  fastify.get('/sessions/:sessionId', {
    schema: {
      tags: ['External: Payments'],
      summary: 'Get Klarna session',
      description:
        'Get the current status and details of a Klarna payment session. ' +
        'Expired sessions (>48h) will show status "expired".',
      params: {
        type: 'object',
        properties: { sessionId: { type: 'string', description: 'Klarna session ID (e.g. ks_...)' } },
        required: ['sessionId'],
      },
    },
  }, getSession);

  fastify.put('/sessions/:sessionId', {
    schema: {
      tags: ['External: Payments'],
      summary: 'Update Klarna session',
      description:
        'Update an existing Klarna payment session with new amount or order lines. ' +
        'Cannot update expired sessions.',
      params: {
        type: 'object',
        properties: { sessionId: { type: 'string', description: 'Klarna session ID' } },
        required: ['sessionId'],
      },
      body: {
        type: 'object',
        properties: {
          order_amount: { type: 'number', description: 'Updated order amount in minor units' },
          order_lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' },
                unit_price: { type: 'number' },
                total_amount: { type: 'number' },
                reference: { type: 'string' },
              },
            },
          },
          purchase_currency: { type: 'string', description: 'Updated currency' },
        },
      },
    },
  }, updateSession);

  // ─── Authorizations ─────────────────────────────────────

  fastify.post('/authorizations/:authorizationToken/order', {
    schema: {
      tags: ['External: Payments'],
      summary: 'Create Klarna order from authorization',
      description:
        'Create a Klarna order from an authorized payment session. ' +
        'Authorization tokens are valid for 60 minutes. Returns order_id and fraud_status. ' +
        'Based on Klarna Payments API V1.',
      params: {
        type: 'object',
        properties: { authorizationToken: { type: 'string', description: 'Authorization token (e.g. ka_...)' } },
        required: ['authorizationToken'],
      },
      body: {
        type: 'object',
        required: ['purchase_country', 'purchase_currency', 'order_amount', 'order_lines'],
        properties: {
          purchase_country: { type: 'string' },
          purchase_currency: { type: 'string' },
          order_amount: { type: 'number' },
          order_lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                quantity: { type: 'number' },
                unit_price: { type: 'number' },
                total_amount: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, createOrderFromAuth);

  // ─── Orders ─────────────────────────────────────────────

  fastify.get('/orders', {
    schema: {
      tags: ['External: Payments'],
      summary: 'List all Klarna orders',
      description:
        'List all Klarna orders with optional filtering by status or purchase country. ' +
        'Returns seeded orders linked to Nordic/EU e-commerce sales orders from IMS.',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status (AUTHORIZED, CAPTURED, REFUNDED, etc.)' },
          purchase_country: { type: 'string', description: 'Filter by purchase country code (e.g. SE, DE)' },
          limit: { type: 'string', description: 'Max results (default 50, max 100)' },
          offset: { type: 'string', description: 'Offset for pagination (default 0)' },
        },
      },
    },
  }, listOrders);

  fastify.get('/orders/:orderId', {
    schema: {
      tags: ['External: Payments'],
      summary: 'Get Klarna order',
      description:
        'Get full Klarna order details including status, captures, and refunds.',
      params: {
        type: 'object',
        properties: { orderId: { type: 'string', description: 'Klarna order ID (e.g. KO-...)' } },
        required: ['orderId'],
      },
    },
  }, getOrder);

  fastify.post('/orders/:orderId/captures', {
    schema: {
      tags: ['External: Payments'],
      summary: 'Capture Klarna order',
      description:
        'Capture a Klarna order (full or partial). Only AUTHORIZED or PART_CAPTURED orders can be captured.',
      params: {
        type: 'object',
        properties: { orderId: { type: 'string', description: 'Klarna order ID' } },
        required: ['orderId'],
      },
      body: {
        type: 'object',
        required: ['captured_amount'],
        properties: {
          captured_amount: { type: 'number', description: 'Amount to capture in minor units' },
          description: { type: 'string', description: 'Capture description' },
        },
      },
    },
  }, captureOrder);

  fastify.post('/orders/:orderId/refunds', {
    schema: {
      tags: ['External: Payments'],
      summary: 'Refund Klarna order',
      description:
        'Refund a captured Klarna order (full or partial). Refund amount cannot exceed captured minus already-refunded.',
      params: {
        type: 'object',
        properties: { orderId: { type: 'string', description: 'Klarna order ID' } },
        required: ['orderId'],
      },
      body: {
        type: 'object',
        required: ['refunded_amount'],
        properties: {
          refunded_amount: { type: 'number', description: 'Amount to refund in minor units' },
          description: { type: 'string', description: 'Refund reason/description' },
        },
      },
    },
  }, refundOrder);
}
