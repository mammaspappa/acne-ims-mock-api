import type { FastifyInstance } from 'fastify';
import {
  listInvoices,
  getInvoice,
  createInvoice,
  matchInvoice,
  approveInvoice,
  disputeInvoice,
  listPayments,
  getPayment,
  createPayment,
  getSupplierBalance,
  seedMediusData,
} from './medius.handlers.js';

export async function mediusRoutes(fastify: FastifyInstance): Promise<void> {
  // Ensure data is seeded on registration
  seedMediusData();

  // ─── Invoices ───────────────────────────────────────────

  fastify.get('/invoices', {
    schema: {
      tags: ['External: Medius'],
      summary: 'List invoices',
      description:
        'List all accounts-payable invoices. Filter by supplierId, status (pending/matched/approved/paid/disputed), and limit. ' +
        'Invoices are auto-generated from IMS purchase orders that are RECEIVED or CLOSED.',
      querystring: {
        type: 'object',
        properties: {
          supplierId: { type: 'string', description: 'Filter by supplier ID' },
          status: {
            type: 'string',
            enum: ['pending', 'matched', 'approved', 'paid', 'disputed'],
            description: 'Filter by invoice status',
          },
          limit: { type: 'string', description: 'Max results to return (default 50)' },
        },
      },
    },
  }, listInvoices);

  fastify.get('/invoices/:id', {
    schema: {
      tags: ['External: Medius'],
      summary: 'Get invoice by ID',
      description:
        'Returns full invoice detail including line items, PO reference, and three-way matching status.',
      params: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Invoice ID (e.g. MINV-000001)' } },
        required: ['id'],
      },
    },
  }, getInvoice);

  fastify.post('/invoices', {
    schema: {
      tags: ['External: Medius'],
      summary: 'Create invoice',
      description:
        'Create a new invoice from a supplier. Can reference a PO number for three-way matching. ' +
        'Created invoices start in "pending" status.',
      body: {
        type: 'object',
        required: ['supplierId', 'invoiceNumber', 'amount', 'currency', 'dueDate'],
        properties: {
          supplierId: { type: 'string', description: 'IMS supplier ID' },
          poNumber: { type: 'string', description: 'PO number to link for matching' },
          invoiceNumber: { type: 'string', description: 'Supplier invoice number' },
          amount: { type: 'number', description: 'Total invoice amount' },
          currency: { type: 'string', description: 'Currency code (EUR, SEK, USD, etc.)' },
          lineItems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                skuId: { type: 'string' },
                quantity: { type: 'number' },
                unitPrice: { type: 'number' },
              },
            },
            description: 'Invoice line items',
          },
          dueDate: { type: 'string', format: 'date-time', description: 'Payment due date' },
        },
      },
    },
  }, createInvoice);

  fastify.post('/invoices/:id/match', {
    schema: {
      tags: ['External: Medius'],
      summary: 'Three-way match invoice',
      description:
        'Performs a three-way match comparing the invoice against the purchase order and goods receipt. ' +
        'Returns match result with any discrepancies found. Successfully matched invoices move to "matched" status.',
      params: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Invoice ID' } },
        required: ['id'],
      },
    },
  }, matchInvoice);

  fastify.post('/invoices/:id/approve', {
    schema: {
      tags: ['External: Medius'],
      summary: 'Approve invoice for payment',
      description:
        'Approve a matched invoice for payment processing. Only invoices in "matched" status can be approved.',
      params: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Invoice ID' } },
        required: ['id'],
      },
    },
  }, approveInvoice);

  fastify.post('/invoices/:id/dispute', {
    schema: {
      tags: ['External: Medius'],
      summary: 'Dispute invoice',
      description:
        'Dispute an invoice with a reason. Moves the invoice to "disputed" status. Cannot dispute already-paid invoices.',
      params: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Invoice ID' } },
        required: ['id'],
      },
      body: {
        type: 'object',
        required: ['reason'],
        properties: {
          reason: { type: 'string', description: 'Reason for the dispute' },
        },
      },
    },
  }, disputeInvoice);

  // ─── Payments ───────────────────────────────────────────

  fastify.get('/payments', {
    schema: {
      tags: ['External: Medius'],
      summary: 'List payments',
      description:
        'List all payment records. Filter by supplierId, status (scheduled/processing/completed/failed), and limit.',
      querystring: {
        type: 'object',
        properties: {
          supplierId: { type: 'string', description: 'Filter by supplier ID' },
          status: {
            type: 'string',
            enum: ['scheduled', 'processing', 'completed', 'failed'],
            description: 'Filter by payment status',
          },
          limit: { type: 'string', description: 'Max results to return (default 50)' },
        },
      },
    },
  }, listPayments);

  fastify.get('/payments/:id', {
    schema: {
      tags: ['External: Medius'],
      summary: 'Get payment by ID',
      description: 'Returns full payment detail including bank reference and processing timestamps.',
      params: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Payment ID (e.g. MPAY-000001)' } },
        required: ['id'],
      },
    },
  }, getPayment);

  fastify.post('/payments', {
    schema: {
      tags: ['External: Medius'],
      summary: 'Schedule payment',
      description:
        'Schedule a payment for an approved invoice. Only invoices in "approved" status can have payments scheduled.',
      body: {
        type: 'object',
        required: ['invoiceId'],
        properties: {
          invoiceId: { type: 'string', description: 'Invoice ID to pay' },
          paymentMethod: {
            type: 'string',
            enum: ['bank_transfer', 'wire', 'sepa'],
            description: 'Payment method (default: bank_transfer)',
          },
          scheduledDate: { type: 'string', format: 'date-time', description: 'Date to process payment' },
        },
      },
    },
  }, createPayment);

  // ─── Supplier Balance ───────────────────────────────────

  fastify.get('/suppliers/:id/balance', {
    schema: {
      tags: ['External: Medius'],
      summary: 'Get supplier account balance',
      description:
        'Returns the supplier account balance summary including total outstanding, overdue amount, ' +
        'paid this month, and invoice counts.',
      params: {
        type: 'object',
        properties: { id: { type: 'string', description: 'IMS Supplier ID' } },
        required: ['id'],
      },
    },
  }, getSupplierBalance);
}
