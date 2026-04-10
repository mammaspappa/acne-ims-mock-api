import type { FastifyInstance } from 'fastify';
import {
  listInboundOrdersHandler,
  getInboundOrderHandler,
  receiveInboundOrderHandler,
  stockOnHandHandler,
  createOutboundOrderHandler,
  listOutboundOrdersHandler,
  getOutboundOrderHandler,
  shipOutboundOrderHandler,
  listPickTasksHandler,
  listWarehousesHandler,
} from './blue-yonder.handlers.js';

export async function blueYonderRoutes(fastify: FastifyInstance): Promise<void> {

  // ─── INBOUND ORDERS ──────────────────────────────────

  fastify.get('/inbound-orders', {
    schema: {
      tags: ['External: Blue Yonder'],
      summary: 'List inbound purchase orders',
      description:
        'Lists purchase orders destined for warehouse locations. ' +
        'Maps from IMS POs where deliveryLocationId is a warehouse or DC. ' +
        'Uses Blue Yonder PascalCase response format.',
      querystring: {
        type: 'object',
        properties: {
          warehouseId: { type: 'string', description: 'Filter by warehouse location ID' },
          status: { type: 'string', description: 'Filter by PO status (e.g. SHIPPED, RECEIVED)' },
          limit: { type: 'string', description: 'Max results (default 50)' },
        },
      },
    },
  }, listInboundOrdersHandler);

  fastify.get('/inbound-orders/:id', {
    schema: {
      tags: ['External: Blue Yonder'],
      summary: 'Get inbound order detail',
      description:
        'Returns full inbound order details including line items and receipt history. ' +
        'Maps from an IMS purchase order.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, getInboundOrderHandler);

  fastify.post('/inbound-orders/:id/receive', {
    schema: {
      tags: ['External: Blue Yonder'],
      summary: 'Record receipt of goods',
      description:
        'Records receipt of goods for an inbound PO. Creates POReceipt records in the IMS store, ' +
        'updates PO line quantities, and adjusts stock levels at the warehouse. ' +
        'If no lines are specified, receives all remaining quantities.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          lines: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                poLineId: { type: 'string' },
                quantityReceived: { type: 'number' },
                qualityStatus: { type: 'string', description: 'PASSED or FAILED (default PASSED)' },
                damagedQuantity: { type: 'number', description: 'Number of damaged units (default 0)' },
                notes: { type: 'string' },
              },
              required: ['poLineId', 'quantityReceived'],
            },
          },
        },
      },
    },
  }, receiveInboundOrderHandler);

  // ─── STOCK ON HAND ───────────────────────────────────

  fastify.get('/stock-on-hand', {
    schema: {
      tags: ['External: Blue Yonder'],
      summary: 'Query stock levels at warehouses',
      description:
        'Returns stock on hand at warehouse locations. ' +
        'Filter by SKU ID/code and/or warehouse ID.',
      querystring: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'SKU ID or SKU code to look up' },
          warehouseId: { type: 'string', description: 'Filter by warehouse location ID' },
        },
      },
    },
  }, stockOnHandHandler);

  // ─── OUTBOUND ORDERS ─────────────────────────────────

  fastify.post('/outbound-orders', {
    schema: {
      tags: ['External: Blue Yonder'],
      summary: 'Create pick/pack/ship order from SO',
      description:
        'Creates an outbound order for warehouse fulfillment from an IMS sales order. ' +
        'Transitions the SO to PICKING status. Lines are created from the SO line items.',
      body: {
        type: 'object',
        properties: {
          salesOrderId: { type: 'string', description: 'IMS sales order ID' },
          warehouseId: { type: 'string', description: 'Override warehouse (defaults to SO locationId)' },
        },
        required: ['salesOrderId'],
      },
    },
  }, createOutboundOrderHandler);

  fastify.get('/outbound-orders', {
    schema: {
      tags: ['External: Blue Yonder'],
      summary: 'List outbound orders',
      description:
        'Lists outbound orders including both explicitly created ones and ' +
        'virtual orders mapped from IMS SOs in PICKING/PACKED/SHIPPED status.',
      querystring: {
        type: 'object',
        properties: {
          warehouseId: { type: 'string', description: 'Filter by warehouse ID' },
          status: { type: 'string', description: 'Filter by status (CREATED, PICKING, PACKED, SHIPPED)' },
          limit: { type: 'string', description: 'Max results (default 50)' },
        },
      },
    },
  }, listOutboundOrdersHandler);

  fastify.get('/outbound-orders/:id', {
    schema: {
      tags: ['External: Blue Yonder'],
      summary: 'Get outbound order detail',
      description:
        'Returns full details for an outbound order including all lines.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
    },
  }, getOutboundOrderHandler);

  fastify.post('/outbound-orders/:id/ship', {
    schema: {
      tags: ['External: Blue Yonder'],
      summary: 'Confirm shipment',
      description:
        'Confirms shipment of an outbound order. Updates the outbound order to SHIPPED, ' +
        'creates a shipment record in the IMS store, and transitions the sales order to SHIPPED.',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        properties: {
          trackingNumber: { type: 'string', description: 'Shipment tracking number' },
          carrier: { type: 'string', description: 'Shipping carrier name' },
        },
      },
    },
  }, shipOutboundOrderHandler);

  // ─── PICK TASKS ──────────────────────────────────────

  fastify.get('/pick-tasks', {
    schema: {
      tags: ['External: Blue Yonder'],
      summary: 'List active pick tasks',
      description:
        'Returns pick tasks for warehouse workers generated from IMS sales orders ' +
        'in PICKING/ALLOCATED status. Each task includes bin locations, picked quantities, ' +
        'and assigned worker. Also includes recently completed pick tasks from shipped orders.',
      querystring: {
        type: 'object',
        properties: {
          warehouseId: { type: 'string', description: 'Filter by warehouse location ID' },
          status: { type: 'string', description: 'Filter by status: Assigned, InProgress, Completed' },
          assignedTo: { type: 'string', description: 'Filter by worker name (partial match)' },
          limit: { type: 'string', description: 'Max results (default 50)' },
        },
      },
    },
  }, listPickTasksHandler);

  // ─── WAREHOUSES ──────────────────────────────────────

  fastify.get('/warehouses', {
    schema: {
      tags: ['External: Blue Yonder'],
      summary: 'List warehouse locations',
      description:
        'Returns all warehouse and DC locations with stock summary information ' +
        'including total SKU count, on-hand quantities, and available inventory.',
    },
  }, listWarehousesHandler);
}
