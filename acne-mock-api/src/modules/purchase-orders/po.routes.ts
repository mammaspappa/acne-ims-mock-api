import type { FastifyInstance } from 'fastify';
import { requireRoles } from '../../plugins/auth.plugin.js';
import {
  createPO, listPOs, getPO, updatePO,
  addLine, updateLine, deleteLine,
  submitPO, approvePO, rejectPO, sendPO, confirmPO, receivePO, cancelPO,
  getHistory,
} from './po.handlers.js';
import {
  createPOSchema, listPOsSchema, getPOSchema, updatePOSchema,
  addLineSchema, updateLineSchema, deleteLineSchema,
  submitPOSchema, approvePOSchema, rejectPOSchema,
  sendPOSchema, confirmPOSchema, receivePOSchema, cancelPOSchema,
  getHistorySchema,
} from './po.schemas.js';

export async function purchaseOrderRoutes(fastify: FastifyInstance): Promise<void> {
  // ─── CRUD ──────────────────────────────────────────────

  fastify.post('/purchase-orders', {
    schema: {
      ...createPOSchema,
      tags: ['Purchase Orders'],
      summary: 'Create a new purchase order',
      description: 'Creates a new PO in DRAFT status. Requires supplierId, season, seasonYear, and currency. ' +
        'Generates a sequential PO number in the format PO-{SEASON}{YEAR}-{SEQUENTIAL}.',
    },
    preHandler: [requireRoles('BUYER', 'PLANNER', 'ADMIN')],
  }, createPO as any);

  fastify.get('/purchase-orders', {
    schema: {
      ...listPOsSchema,
      tags: ['Purchase Orders'],
      summary: 'List purchase orders',
      description: 'List all purchase orders with optional filters for season, status, supplierId. ' +
        'Supports pagination via page and limit query parameters.',
    },
  }, listPOs as any);

  fastify.get('/purchase-orders/:id', {
    schema: {
      ...getPOSchema,
      tags: ['Purchase Orders'],
      summary: 'Get purchase order details',
      description: 'Returns the full purchase order including all line items.',
    },
  }, getPO as any);

  fastify.patch('/purchase-orders/:id', {
    schema: {
      ...updatePOSchema,
      tags: ['Purchase Orders'],
      summary: 'Update a purchase order',
      description: 'Update PO header fields (delivery, shipping terms, notes). ' +
        'Only allowed while the PO is in DRAFT status.',
    },
    preHandler: [requireRoles('BUYER', 'PLANNER', 'ADMIN')],
  }, updatePO as any);

  // ─── LINE ITEMS ────────────────────────────────────────

  fastify.post('/purchase-orders/:id/lines', {
    schema: {
      ...addLineSchema,
      tags: ['Purchase Orders'],
      summary: 'Add a line item',
      description: 'Add a new line item to the PO. Only allowed in DRAFT status. ' +
        'Automatically recalculates the PO totalAmount.',
    },
    preHandler: [requireRoles('BUYER', 'PLANNER', 'ADMIN')],
  }, addLine as any);

  fastify.patch('/purchase-orders/:id/lines/:lineId', {
    schema: {
      ...updateLineSchema,
      tags: ['Purchase Orders'],
      summary: 'Update a line item',
      description: 'Update quantity, unit cost, or notes on an existing PO line. ' +
        'Only allowed in DRAFT status. Automatically recalculates lineTotal and PO totalAmount.',
    },
    preHandler: [requireRoles('BUYER', 'PLANNER', 'ADMIN')],
  }, updateLine as any);

  fastify.delete('/purchase-orders/:id/lines/:lineId', {
    schema: {
      ...deleteLineSchema,
      tags: ['Purchase Orders'],
      summary: 'Remove a line item',
      description: 'Remove a line item from the PO. Only allowed in DRAFT status. ' +
        'Automatically recalculates the PO totalAmount.',
    },
    preHandler: [requireRoles('BUYER', 'PLANNER', 'ADMIN')],
  }, deleteLine as any);

  // ─── LIFECYCLE ACTIONS ─────────────────────────────────

  fastify.post('/purchase-orders/:id/submit', {
    schema: {
      ...submitPOSchema,
      tags: ['Purchase Orders'],
      summary: 'Submit PO for approval',
      description: 'Transitions PO from DRAFT to PENDING_APPROVAL. ' +
        'The PO must have at least one line item.',
    },
    preHandler: [requireRoles('BUYER', 'PLANNER', 'ADMIN')],
  }, submitPO as any);

  fastify.post('/purchase-orders/:id/approve', {
    schema: {
      ...approvePOSchema,
      tags: ['Purchase Orders'],
      summary: 'Approve a purchase order',
      description: 'Transitions PO from PENDING_APPROVAL to APPROVED. ' +
        'Records the approver and approval timestamp.',
    },
    preHandler: [requireRoles('EXEC', 'FINANCE', 'ADMIN')],
  }, approvePO as any);

  fastify.post('/purchase-orders/:id/reject', {
    schema: {
      ...rejectPOSchema,
      tags: ['Purchase Orders'],
      summary: 'Reject a purchase order',
      description: 'Rejects PO and sends it back to DRAFT status. ' +
        'A reason is required and recorded in the status history.',
    },
    preHandler: [requireRoles('EXEC', 'FINANCE', 'ADMIN')],
  }, rejectPO as any);

  fastify.post('/purchase-orders/:id/send', {
    schema: {
      ...sendPOSchema,
      tags: ['Purchase Orders'],
      summary: 'Send PO to supplier',
      description: 'Transitions PO from APPROVED to SENT_TO_SUPPLIER. ' +
        'Records the sentToSupplierAt timestamp.',
    },
    preHandler: [requireRoles('BUYER', 'PLANNER', 'ADMIN')],
  }, sendPO as any);

  fastify.post('/purchase-orders/:id/confirm', {
    schema: {
      ...confirmPOSchema,
      tags: ['Purchase Orders'],
      summary: 'Supplier confirms PO',
      description: 'Transitions PO from SENT_TO_SUPPLIER to CONFIRMED_BY_SUPPLIER. ' +
        'Typically called by a user with the SUPPLIER role.',
    },
    preHandler: [requireRoles('SUPPLIER', 'BUYER', 'ADMIN')],
  }, confirmPO as any);

  fastify.post('/purchase-orders/:id/receive', {
    schema: {
      ...receivePOSchema,
      tags: ['Purchase Orders'],
      summary: 'Record goods receipt',
      description: 'Record receipt of goods against PO lines. Creates POReceipt records, ' +
        'updates quantityReceived on each line, and transitions the PO status to ' +
        'PARTIALLY_RECEIVED or RECEIVED based on total quantities.',
    },
    preHandler: [requireRoles('WAREHOUSE', 'BUYER', 'ADMIN')],
  }, receivePO as any);

  fastify.post('/purchase-orders/:id/cancel', {
    schema: {
      ...cancelPOSchema,
      tags: ['Purchase Orders'],
      summary: 'Cancel a purchase order',
      description: 'Cancel the PO. Allowed from any status except RECEIVED and CLOSED. ' +
        'An optional reason can be provided.',
    },
    preHandler: [requireRoles('BUYER', 'EXEC', 'ADMIN')],
  }, cancelPO as any);

  // ─── HISTORY ───────────────────────────────────────────

  fastify.get('/purchase-orders/:id/history', {
    schema: {
      ...getHistorySchema,
      tags: ['Purchase Orders'],
      summary: 'Get PO status history',
      description: 'Returns the full status transition history for a purchase order, ' +
        'sorted chronologically.',
    },
  }, getHistory as any);
}
