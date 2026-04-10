import type { FastifyInstance } from 'fastify';
import {
  listOrdersHandler,
  getOrderHandler,
  fulfillOrderHandler,
  cancelOrderHandler,
  listLocationsHandler,
  getLocationHandler,
  inventoryLookupHandler,
  routeOrderHandler,
  listTransactionsHandler,
} from './teamwork.handlers.js';

export async function teamworkRoutes(fastify: FastifyInstance): Promise<void> {

  // ─── ORDERS ──────────────────────────────────────────

  fastify.get('/orders', {
    schema: {
      tags: ['External: Teamwork'],
      summary: 'List orders',
      description:
        'List all orders with optional filters for status and location. ' +
        'Maps from IMS sales orders. Returns Teamwork camelCase format.',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by order status (e.g. CONFIRMED, SHIPPED)' },
          locationId: { type: 'string', description: 'Filter by fulfillment location ID' },
          limit: { type: 'string', description: 'Max results (default 50)' },
        },
      },
    },
  }, listOrdersHandler);

  fastify.get('/orders/:id', {
    schema: {
      tags: ['External: Teamwork'],
      summary: 'Get order detail',
      description:
        'Returns full order details including line items with SKU info. ' +
        'Maps from IMS sales order data.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, getOrderHandler);

  fastify.post('/orders/:id/fulfill', {
    schema: {
      tags: ['External: Teamwork'],
      summary: 'Mark order as fulfilled',
      description:
        'Transitions the order to SHIPPED status in the IMS store. ' +
        'Creates a shipment record and marks all line items as shipped. ' +
        'Valid from ALLOCATED, PICKING, or PACKED status.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, fulfillOrderHandler);

  fastify.post('/orders/:id/cancel', {
    schema: {
      tags: ['External: Teamwork'],
      summary: 'Cancel order',
      description:
        'Cancels an order by transitioning it to CANCELLED status. ' +
        'Not allowed for orders that have already been SHIPPED, DELIVERED, or RETURNED.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, cancelOrderHandler);

  fastify.post('/orders/:id/route', {
    schema: {
      tags: ['External: Teamwork'],
      summary: 'Route order to optimal fulfillment location',
      description:
        'Analyzes stock availability across all locations and routes the order ' +
        'to the location that can fulfill the most line items. ' +
        'Updates the order locationId in the IMS store.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, routeOrderHandler);

  // ─── LOCATIONS ───────────────────────────────────────

  fastify.get('/locations', {
    schema: {
      tags: ['External: Teamwork'],
      summary: 'List all locations',
      description:
        'Returns all locations from the IMS store including stores, warehouses, and DCs.',
    },
  }, listLocationsHandler);

  fastify.get('/locations/:id', {
    schema: {
      tags: ['External: Teamwork'],
      summary: 'Get location detail',
      description:
        'Returns full details for a specific location.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, getLocationHandler);

  // ─── TRANSACTIONS ────────────────────────────────────

  fastify.get('/transactions', {
    schema: {
      tags: ['External: Teamwork'],
      summary: 'List POS transactions',
      description:
        'Returns POS transaction records across stores for the last 30 days. ' +
        'Generated from IMS retail sales orders plus synthetic transactions. ' +
        'Each transaction includes store, terminal, cashier, items, payment method, and total.',
      querystring: {
        type: 'object',
        properties: {
          storeId: { type: 'string', description: 'Filter by store location ID' },
          transactionType: { type: 'string', description: 'Filter by type: sale, return, exchange' },
          paymentMethod: { type: 'string', description: 'Filter by payment: card, cash, klarna' },
          limit: { type: 'string', description: 'Max results (default 100)' },
        },
      },
    },
  }, listTransactionsHandler);

  // ─── INVENTORY ───────────────────────────────────────

  fastify.get('/inventory', {
    schema: {
      tags: ['External: Teamwork'],
      summary: 'Inventory lookup',
      description:
        'Query stock levels by SKU ID and/or location ID. ' +
        'Maps from IMS stock level data with computed available quantity.',
      querystring: {
        type: 'object',
        properties: {
          skuId: { type: 'string', description: 'Filter by SKU ID' },
          locationId: { type: 'string', description: 'Filter by location ID' },
        },
      },
    },
  }, inventoryLookupHandler);
}
