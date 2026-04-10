import type { FastifyInstance } from 'fastify';
import {
  createSO,
  listSOs,
  getSO,
  updateSO,
  addLines,
  confirmSO,
  allocateSO,
  pickSO,
  packSO,
  shipSO,
  deliverSO,
  returnSO,
  cancelSO,
  holdSO,
  releaseSO,
  getSOHistory,
} from './so.handlers.js';
import {
  createSOSchema,
  listSOsSchema,
  getSOSchema,
  updateSOSchema,
  addLinesSchema,
  confirmSOSchema,
  allocateSOSchema,
  pickSOSchema,
  packSOSchema,
  shipSOSchema,
  deliverSOSchema,
  returnSOSchema,
  cancelSOSchema,
  holdSOSchema,
  releaseSOSchema,
  getSOHistorySchema,
} from './so.schemas.js';

export async function salesOrderRoutes(fastify: FastifyInstance): Promise<void> {

  // ─── CRUD ──────────────────────────────────────────────

  fastify.post('/sales-orders', {
    schema: {
      ...createSOSchema,
      tags: ['Sales Orders'],
      summary: 'Create sales order',
      description:
        'Create a new sales order in DRAFT status. ' +
        'The SO number is generated automatically based on the channel ' +
        '(e.g. SO-RT-{STORE_CODE}-{SEQ} for retail).',
    },
  }, createSO);

  fastify.get('/sales-orders', {
    schema: {
      ...listSOsSchema,
      tags: ['Sales Orders'],
      summary: 'List sales orders',
      description:
        'List all sales orders with optional filters for channel, status, type, locationId. ' +
        'Supports text search across SO number, customer name, and customer email.',
    },
  }, listSOs);

  fastify.get('/sales-orders/:id', {
    schema: {
      ...getSOSchema,
      tags: ['Sales Orders'],
      summary: 'Get sales order by ID',
      description:
        'Returns full sales order details including all line items and shipments.',
    },
  }, getSO);

  fastify.patch('/sales-orders/:id', {
    schema: {
      ...updateSOSchema,
      tags: ['Sales Orders'],
      summary: 'Update sales order',
      description:
        'Update editable fields on a sales order. ' +
        'Only allowed when the order is in DRAFT or CONFIRMED status.',
    },
  }, updateSO);

  // ─── LINE ITEMS ────────────────────────────────────────

  fastify.post('/sales-orders/:id/lines', {
    schema: {
      ...addLinesSchema,
      tags: ['Sales Orders'],
      summary: 'Add line items',
      description:
        'Add one or more line items to a sales order. ' +
        'Automatically recalculates subtotal, tax (25% VAT), and total. ' +
        'Only allowed when the order is in DRAFT or CONFIRMED status.',
    },
  }, addLines);

  // ─── LIFECYCLE TRANSITIONS ─────────────────────────────

  fastify.post('/sales-orders/:id/confirm', {
    schema: {
      ...confirmSOSchema,
      tags: ['Sales Orders'],
      summary: 'Confirm sales order',
      description:
        'Transition the order from DRAFT to CONFIRMED. ' +
        'Records a status history entry.',
    },
  }, confirmSO);

  fastify.post('/sales-orders/:id/allocate', {
    schema: {
      ...allocateSOSchema,
      tags: ['Sales Orders'],
      summary: 'Allocate stock for sales order',
      description:
        'Transition the order from CONFIRMED to ALLOCATED. ' +
        'Sets quantityAllocated on all line items to match quantityOrdered.',
    },
  }, allocateSO);

  fastify.post('/sales-orders/:id/pick', {
    schema: {
      ...pickSOSchema,
      tags: ['Sales Orders'],
      summary: 'Start picking for sales order',
      description:
        'Transition the order from ALLOCATED to PICKING. ' +
        'Indicates warehouse has begun the pick process.',
    },
  }, pickSO);

  fastify.post('/sales-orders/:id/pack', {
    schema: {
      ...packSOSchema,
      tags: ['Sales Orders'],
      summary: 'Mark sales order as packed',
      description:
        'Transition the order from PICKING to PACKED. ' +
        'Indicates all items have been picked and packed, ready for shipment.',
    },
  }, packSO);

  fastify.post('/sales-orders/:id/ship', {
    schema: {
      ...shipSOSchema,
      tags: ['Sales Orders'],
      summary: 'Record shipment for sales order',
      description:
        'Transition the order from PACKED to SHIPPED. ' +
        'Creates a Shipment record with optional tracking number and carrier. ' +
        'Updates actualShipDate and marks all line items as shipped.',
    },
  }, shipSO);

  fastify.post('/sales-orders/:id/deliver', {
    schema: {
      ...deliverSOSchema,
      tags: ['Sales Orders'],
      summary: 'Mark sales order as delivered',
      description:
        'Transition the order from SHIPPED to DELIVERED. ' +
        'Sets deliveredAt on the order and associated shipments.',
    },
  }, deliverSO);

  fastify.post('/sales-orders/:id/return', {
    schema: {
      ...returnSOSchema,
      tags: ['Sales Orders'],
      summary: 'Initiate return for sales order',
      description:
        'Transition the order to RETURNED (valid from any post-SHIPPED state). ' +
        'Marks all shipped line items as returned.',
    },
  }, returnSO);

  fastify.post('/sales-orders/:id/cancel', {
    schema: {
      ...cancelSOSchema,
      tags: ['Sales Orders'],
      summary: 'Cancel sales order',
      description:
        'Transition the order to CANCELLED (valid from any pre-SHIPPED state). ' +
        'A reason should be provided for audit purposes.',
    },
  }, cancelSO);

  // ─── HOLD / RELEASE ────────────────────────────────────

  fastify.post('/sales-orders/:id/hold', {
    schema: {
      ...holdSOSchema,
      tags: ['Sales Orders'],
      summary: 'Put sales order on hold',
      description:
        'Transition the order to ON_HOLD from any state. ' +
        'The previous status is remembered so the order can be released back to it.',
    },
  }, holdSO);

  fastify.post('/sales-orders/:id/release', {
    schema: {
      ...releaseSOSchema,
      tags: ['Sales Orders'],
      summary: 'Release sales order from hold',
      description:
        'Release the order from ON_HOLD, restoring it to the status it had before being put on hold.',
    },
  }, releaseSO);

  // ─── HISTORY ───────────────────────────────────────────

  fastify.get('/sales-orders/:id/history', {
    schema: {
      ...getSOHistorySchema,
      tags: ['Sales Orders'],
      summary: 'Get status history',
      description:
        'Returns the complete status transition history for a sales order, ' +
        'ordered chronologically.',
    },
  }, getSOHistory);
}
