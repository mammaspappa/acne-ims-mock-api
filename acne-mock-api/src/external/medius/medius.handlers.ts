import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { generateId } from '../../utils/id.js';
import { daysAgo, daysFromNow, now } from '../../utils/date.js';

// ─── Types ────────────────────────────────────────────

type InvoiceStatus = 'pending' | 'matched' | 'approved' | 'paid' | 'disputed';
type PaymentStatus = 'scheduled' | 'processing' | 'completed' | 'failed';

interface InvoiceLineItem {
  lineNumber: number;
  description: string;
  skuId: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  poLineId: string | null;
}

interface MediusInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  poNumber: string | null;
  purchaseOrderId: string | null;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  lineItems: InvoiceLineItem[];
  matchResult: { matched: boolean; discrepancies: string[] } | null;
  dueDate: string;
  receivedDate: string;
  approvedAt: string | null;
  approvedBy: string | null;
  disputeReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MediusPayment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: PaymentStatus;
  scheduledDate: string;
  processedAt: string | null;
  completedAt: string | null;
  bankReference: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── In-memory stores ─────────────────────────────────

const invoices: MediusInvoice[] = [];
const payments: MediusPayment[] = [];
let seeded = false;

function randomHex(len: number): string {
  const chars = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function wrap<T>(data: T) {
  return { data, success: true };
}

function wrapError(message: string, statusCode: number = 400) {
  return { data: null, success: false, error: { message, statusCode } };
}

// ─── Seed ─────────────────────────────────────────────

export function seedMediusData(): void {
  if (seeded) return;
  seeded = true;

  invoices.length = 0;
  payments.length = 0;

  // Find POs that have progressed to receiving/closing — each generates an invoice
  const eligiblePOs = store.purchaseOrders.filter(
    po => ['RECEIVED', 'CLOSED', 'PARTIALLY_RECEIVED', 'SHIPPED'].includes(po.status)
  );

  const invoiceStatuses: InvoiceStatus[] = [
    'paid', 'paid', 'paid', 'paid', 'paid',
    'approved', 'approved', 'approved',
    'matched', 'matched', 'matched',
    'pending', 'pending', 'pending',
    'disputed', 'disputed',
    'paid', 'paid', 'paid', 'paid',
    'approved', 'matched', 'pending',
    'paid', 'paid',
  ];

  for (let i = 0; i < eligiblePOs.length; i++) {
    const po = eligiblePOs[i % eligiblePOs.length];
    const supplier = store.findById(store.suppliers, po.supplierId);
    const poLines = store.findByField(store.poLines, 'purchaseOrderId', po.id);
    const status = invoiceStatuses[i] || 'pending';

    const lineItems: InvoiceLineItem[] = poLines.map((pl, li) => {
      const sku = store.findById(store.skus, pl.skuId);
      const product = sku ? store.findById(store.products, sku.productId) : null;
      return {
        lineNumber: li + 1,
        description: product ? `${product.name} — ${sku?.colour} ${sku?.size}` : `Line item ${li + 1}`,
        skuId: pl.skuId,
        quantity: pl.quantityReceived > 0 ? pl.quantityReceived : pl.quantityOrdered,
        unitPrice: pl.unitCost,
        lineTotal: (pl.quantityReceived > 0 ? pl.quantityReceived : pl.quantityOrdered) * pl.unitCost,
        poLineId: pl.id,
      };
    });

    const amount = lineItems.reduce((sum, li) => sum + li.lineTotal, 0);
    const daysOffset = 85 - i * 5;
    const receivedDate = daysAgo(daysOffset).toISOString();

    const inv: MediusInvoice = {
      id: `MINV-${String(i + 1).padStart(6, '0')}`,
      invoiceNumber: `INV-${supplier?.code || 'SUP'}-${String(2026000 + i + 1)}`,
      supplierId: po.supplierId,
      supplierName: supplier?.name || 'Unknown Supplier',
      poNumber: po.poNumber,
      purchaseOrderId: po.id,
      amount: Math.round(amount * 100) / 100,
      currency: po.currency,
      status,
      lineItems,
      matchResult: ['matched', 'approved', 'paid'].includes(status)
        ? { matched: true, discrepancies: [] }
        : status === 'disputed'
          ? { matched: false, discrepancies: ['Quantity mismatch on line 2: invoice 85, receipt 80'] }
          : null,
      dueDate: daysFromNow(30 - i * 2).toISOString(),
      receivedDate,
      approvedAt: ['approved', 'paid'].includes(status) ? daysAgo(daysOffset - 5).toISOString() : null,
      approvedBy: ['approved', 'paid'].includes(status) ? 'finance-user-01' : null,
      disputeReason: status === 'disputed' ? 'Quantity does not match goods receipt' : null,
      createdAt: receivedDate,
      updatedAt: now().toISOString(),
    };

    invoices.push(inv);
  }

  // Pad to 25 if not enough POs
  while (invoices.length < 25) {
    const idx = invoices.length;
    const supplier = store.suppliers[idx % store.suppliers.length];
    const paddedStatus: InvoiceStatus = idx % 3 === 0 ? 'pending' : idx % 3 === 1 ? 'matched' : 'approved';
    const inv: MediusInvoice = {
      id: `MINV-${String(idx + 1).padStart(6, '0')}`,
      invoiceNumber: `INV-${supplier?.code || 'SUP'}-${String(2026100 + idx)}`,
      supplierId: supplier.id,
      supplierName: supplier.name,
      poNumber: null,
      purchaseOrderId: null,
      amount: Math.round((5000 + Math.random() * 50000) * 100) / 100,
      currency: supplier.currency,
      status: paddedStatus,
      lineItems: [
        {
          lineNumber: 1,
          description: `Miscellaneous goods — ${supplier.name}`,
          skuId: null,
          quantity: Math.floor(10 + Math.random() * 100),
          unitPrice: Math.round((50 + Math.random() * 200) * 100) / 100,
          lineTotal: 0,
          poLineId: null,
        },
      ],
      matchResult: paddedStatus === 'matched' || paddedStatus === 'approved'
        ? { matched: true, discrepancies: [] }
        : null,
      dueDate: daysFromNow(30).toISOString(),
      receivedDate: daysAgo(10 + idx).toISOString(),
      approvedAt: paddedStatus === 'approved' ? daysAgo(5).toISOString() : null,
      approvedBy: paddedStatus === 'approved' ? 'finance-user-01' : null,
      disputeReason: null,
      createdAt: daysAgo(10 + idx).toISOString(),
      updatedAt: now().toISOString(),
    };
    inv.lineItems[0].lineTotal = inv.lineItems[0].quantity * inv.lineItems[0].unitPrice;
    inv.amount = inv.lineItems[0].lineTotal;
    invoices.push(inv);
  }

  // Add 4 credit notes for returned/disputed items
  const creditNoteReasons = [
    { reason: 'Defective goods returned — batch quality issue', pct: 1.0 },
    { reason: 'Short shipment — 5 units missing from delivery', pct: 0.15 },
    { reason: 'Pricing dispute resolved — overcharge on line 3', pct: 0.08 },
    { reason: 'Damaged in transit — 3 cartons water damage', pct: 0.22 },
  ];
  const paidInvoices = invoices.filter(inv => inv.status === 'paid');
  for (let c = 0; c < Math.min(creditNoteReasons.length, paidInvoices.length); c++) {
    const sourceInv = paidInvoices[c];
    const cn = creditNoteReasons[c];
    const creditAmount = Math.round(sourceInv.amount * cn.pct * 100) / 100;
    const cnIdx = invoices.length;
    const creditNote: MediusInvoice = {
      id: `MINV-CN-${String(c + 1).padStart(4, '0')}`,
      invoiceNumber: `CN-${sourceInv.invoiceNumber}`,
      supplierId: sourceInv.supplierId,
      supplierName: sourceInv.supplierName,
      poNumber: sourceInv.poNumber,
      purchaseOrderId: sourceInv.purchaseOrderId,
      amount: -creditAmount,
      currency: sourceInv.currency,
      status: c < 2 ? 'approved' : 'matched',
      lineItems: [{
        lineNumber: 1,
        description: `CREDIT NOTE: ${cn.reason}`,
        skuId: sourceInv.lineItems[0]?.skuId || null,
        quantity: -1,
        unitPrice: creditAmount,
        lineTotal: -creditAmount,
        poLineId: null,
      }],
      matchResult: { matched: true, discrepancies: [] },
      dueDate: daysFromNow(15).toISOString(),
      receivedDate: daysAgo(5 + c * 3).toISOString(),
      approvedAt: c < 2 ? daysAgo(3 + c).toISOString() : null,
      approvedBy: c < 2 ? 'finance-user-01' : null,
      disputeReason: null,
      createdAt: daysAgo(5 + c * 3).toISOString(),
      updatedAt: now().toISOString(),
    };
    invoices.push(creditNote);
  }

  // Seed payments from all paid/approved invoices
  const payableInvoices = invoices.filter(inv => inv.status === 'paid' || inv.status === 'approved');
  const paymentStatuses: PaymentStatus[] = [
    'completed', 'completed', 'completed', 'completed',
    'completed', 'completed', 'completed', 'completed',
    'processing', 'processing',
    'scheduled', 'scheduled', 'scheduled',
    'completed', 'completed', 'completed',
  ];
  const paymentMethods = [
    'bank_transfer', 'wire', 'bank_transfer', 'sepa', 'wire',
    'bank_transfer', 'sepa', 'wire', 'bank_transfer', 'sepa',
    'wire', 'bank_transfer', 'sepa', 'wire', 'bank_transfer', 'sepa',
  ];

  for (let i = 0; i < payableInvoices.length; i++) {
    const inv = payableInvoices[i];
    const status = paymentStatuses[i % paymentStatuses.length];
    const daysOffset = 80 - i * 4;

    const pmt: MediusPayment = {
      id: `MPAY-${String(i + 1).padStart(6, '0')}`,
      invoiceId: inv.id,
      invoiceNumber: inv.invoiceNumber,
      supplierId: inv.supplierId,
      supplierName: inv.supplierName,
      amount: inv.amount,
      currency: inv.currency,
      paymentMethod: paymentMethods[i % paymentMethods.length],
      status,
      scheduledDate: daysAgo(Math.max(1, daysOffset)).toISOString(),
      processedAt: ['processing', 'completed'].includes(status) ? daysAgo(Math.max(1, daysOffset - 1)).toISOString() : null,
      completedAt: status === 'completed' ? daysAgo(Math.max(1, daysOffset - 3)).toISOString() : null,
      bankReference: status === 'completed' ? `BNK-${randomHex(12).toUpperCase()}` : null,
      createdAt: daysAgo(Math.max(1, daysOffset + 1)).toISOString(),
      updatedAt: now().toISOString(),
    };
    payments.push(pmt);
  }
}

// ─── Helpers ─────────────────────────────────────────

function withAging(inv: MediusInvoice) {
  const dueDate = new Date(inv.dueDate);
  const today = now();
  const diffMs = today.getTime() - dueDate.getTime();
  const daysSinceDue = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return {
    ...inv,
    aging: {
      daysSinceDue,
      isOverdue: daysSinceDue > 0 && !['paid'].includes(inv.status),
      bucket: daysSinceDue <= 0 ? 'NOT_DUE'
        : daysSinceDue <= 30 ? '1_30_DAYS'
        : daysSinceDue <= 60 ? '31_60_DAYS'
        : daysSinceDue <= 90 ? '61_90_DAYS'
        : 'OVER_90_DAYS',
    },
  };
}

// ─── Handlers ─────────────────────────────────────────

// GET /invoices
export async function listInvoices(
  request: FastifyRequest<{
    Querystring: { supplierId?: string; status?: InvoiceStatus; limit?: string };
  }>,
  reply: FastifyReply
) {
  seedMediusData();
  const { supplierId, status, limit } = request.query;
  let result = [...invoices];

  if (supplierId) result = result.filter(inv => inv.supplierId === supplierId);
  if (status) result = result.filter(inv => inv.status === status);

  const max = limit ? parseInt(limit, 10) : 50;
  result = result.slice(0, max);

  return reply.send(wrap(result.map(withAging)));
}

// GET /invoices/:id
export async function getInvoice(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  seedMediusData();
  const inv = invoices.find(i => i.id === request.params.id);
  if (!inv) return reply.status(404).send(wrapError('Invoice not found', 404));
  return reply.send(wrap(withAging(inv)));
}

// POST /invoices
export async function createInvoice(
  request: FastifyRequest<{
    Body: {
      supplierId: string;
      poNumber?: string;
      invoiceNumber: string;
      amount: number;
      currency: string;
      lineItems?: Array<{
        description: string;
        skuId?: string;
        quantity: number;
        unitPrice: number;
      }>;
      dueDate: string;
    };
  }>,
  reply: FastifyReply
) {
  seedMediusData();
  const body = request.body;
  const supplier = store.findById(store.suppliers, body.supplierId);

  // Look up PO by number if provided
  let purchaseOrderId: string | null = null;
  if (body.poNumber) {
    const po = store.purchaseOrders.find(p => p.poNumber === body.poNumber);
    if (po) purchaseOrderId = po.id;
  }

  const lineItems: InvoiceLineItem[] = (body.lineItems || []).map((li, idx) => ({
    lineNumber: idx + 1,
    description: li.description,
    skuId: li.skuId || null,
    quantity: li.quantity,
    unitPrice: li.unitPrice,
    lineTotal: li.quantity * li.unitPrice,
    poLineId: null,
  }));

  const inv: MediusInvoice = {
    id: `MINV-${String(invoices.length + 1).padStart(6, '0')}`,
    invoiceNumber: body.invoiceNumber,
    supplierId: body.supplierId,
    supplierName: supplier?.name || 'Unknown Supplier',
    poNumber: body.poNumber || null,
    purchaseOrderId,
    amount: body.amount,
    currency: body.currency,
    status: 'pending',
    lineItems,
    matchResult: null,
    dueDate: body.dueDate,
    receivedDate: now().toISOString(),
    approvedAt: null,
    approvedBy: null,
    disputeReason: null,
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
  };

  invoices.push(inv);
  return reply.status(201).send(wrap(inv));
}

// POST /invoices/:id/match
export async function matchInvoice(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  seedMediusData();
  const inv = invoices.find(i => i.id === request.params.id);
  if (!inv) return reply.status(404).send(wrapError('Invoice not found', 404));

  if (inv.status !== 'pending') {
    return reply.status(400).send(wrapError(`Invoice is already ${inv.status}, cannot match`));
  }

  const discrepancies: string[] = [];

  if (inv.purchaseOrderId) {
    const po = store.findById(store.purchaseOrders, inv.purchaseOrderId);
    if (!po) {
      discrepancies.push('Referenced PO not found in system');
    } else {
      // Compare totals
      const poDelta = Math.abs(po.totalAmount - inv.amount);
      if (poDelta > 0.01) {
        discrepancies.push(
          `Amount mismatch: invoice ${inv.amount} ${inv.currency}, PO total ${po.totalAmount} ${po.currency}`
        );
      }

      // Check line-level quantities against receipts
      const poLines = store.findByField(store.poLines, 'purchaseOrderId', po.id);
      for (const invLine of inv.lineItems) {
        if (invLine.poLineId) {
          const poLine = poLines.find(pl => pl.id === invLine.poLineId);
          if (poLine && poLine.quantityReceived !== invLine.quantity) {
            discrepancies.push(
              `Line ${invLine.lineNumber}: invoice qty ${invLine.quantity}, received qty ${poLine.quantityReceived}`
            );
          }
        }
      }
    }
  } else {
    discrepancies.push('No PO reference — cannot perform three-way match');
  }

  const matched = discrepancies.length === 0;
  inv.matchResult = { matched, discrepancies };
  inv.status = matched ? 'matched' : 'pending';
  inv.updatedAt = now().toISOString();

  return reply.send(wrap({ matched, discrepancies }));
}

// POST /invoices/:id/approve
export async function approveInvoice(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  seedMediusData();
  const inv = invoices.find(i => i.id === request.params.id);
  if (!inv) return reply.status(404).send(wrapError('Invoice not found', 404));

  if (inv.status !== 'matched') {
    return reply.status(400).send(wrapError(`Invoice must be in "matched" status to approve. Current: ${inv.status}`));
  }

  inv.status = 'approved';
  inv.approvedAt = now().toISOString();
  inv.approvedBy = 'finance-user-mock';
  inv.updatedAt = now().toISOString();

  return reply.send(wrap(inv));
}

// POST /invoices/:id/dispute
export async function disputeInvoice(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { reason: string };
  }>,
  reply: FastifyReply
) {
  seedMediusData();
  const inv = invoices.find(i => i.id === request.params.id);
  if (!inv) return reply.status(404).send(wrapError('Invoice not found', 404));

  if (inv.status === 'paid') {
    return reply.status(400).send(wrapError('Cannot dispute a paid invoice'));
  }

  inv.status = 'disputed';
  inv.disputeReason = request.body.reason;
  inv.updatedAt = now().toISOString();

  return reply.send(wrap(inv));
}

// GET /payments
export async function listPayments(
  request: FastifyRequest<{
    Querystring: { supplierId?: string; status?: PaymentStatus; limit?: string };
  }>,
  reply: FastifyReply
) {
  seedMediusData();
  const { supplierId, status, limit } = request.query;
  let result = [...payments];

  if (supplierId) result = result.filter(p => p.supplierId === supplierId);
  if (status) result = result.filter(p => p.status === status);

  const max = limit ? parseInt(limit, 10) : 50;
  result = result.slice(0, max);

  return reply.send(wrap(result));
}

// GET /payments/:id
export async function getPayment(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  seedMediusData();
  const pmt = payments.find(p => p.id === request.params.id);
  if (!pmt) return reply.status(404).send(wrapError('Payment not found', 404));
  return reply.send(wrap(pmt));
}

// POST /payments
export async function createPayment(
  request: FastifyRequest<{
    Body: {
      invoiceId: string;
      paymentMethod?: string;
      scheduledDate?: string;
    };
  }>,
  reply: FastifyReply
) {
  seedMediusData();
  const body = request.body;
  const inv = invoices.find(i => i.id === body.invoiceId);
  if (!inv) return reply.status(404).send(wrapError('Invoice not found', 404));

  if (inv.status !== 'approved') {
    return reply.status(400).send(wrapError(`Invoice must be approved before scheduling payment. Current: ${inv.status}`));
  }

  const pmt: MediusPayment = {
    id: `MPAY-${String(payments.length + 1).padStart(6, '0')}`,
    invoiceId: inv.id,
    invoiceNumber: inv.invoiceNumber,
    supplierId: inv.supplierId,
    supplierName: inv.supplierName,
    amount: inv.amount,
    currency: inv.currency,
    paymentMethod: body.paymentMethod || 'bank_transfer',
    status: 'scheduled',
    scheduledDate: body.scheduledDate || daysFromNow(3).toISOString(),
    processedAt: null,
    completedAt: null,
    bankReference: null,
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
  };

  payments.push(pmt);
  return reply.status(201).send(wrap(pmt));
}

// GET /suppliers/:id/balance
export async function getSupplierBalance(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  seedMediusData();
  const supplierId = request.params.id;
  const supplier = store.findById(store.suppliers, supplierId);
  if (!supplier) return reply.status(404).send(wrapError('Supplier not found', 404));

  const supplierInvoices = invoices.filter(i => i.supplierId === supplierId);
  const supplierPayments = payments.filter(p => p.supplierId === supplierId);

  const totalOutstanding = supplierInvoices
    .filter(i => ['pending', 'matched', 'approved'].includes(i.status))
    .reduce((sum, i) => sum + i.amount, 0);

  const overdue = supplierInvoices
    .filter(i =>
      ['pending', 'matched', 'approved'].includes(i.status) &&
      new Date(i.dueDate) < now()
    )
    .reduce((sum, i) => sum + i.amount, 0);

  const thisMonth = now();
  const startOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1);
  const paidThisMonth = supplierPayments
    .filter(p => p.status === 'completed' && p.completedAt && new Date(p.completedAt) >= startOfMonth)
    .reduce((sum, p) => sum + p.amount, 0);

  const totalPaid = supplierPayments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  return reply.send(wrap({
    supplierId,
    supplierName: supplier.name,
    currency: supplier.currency,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    overdue: Math.round(overdue * 100) / 100,
    paidThisMonth: Math.round(paidThisMonth * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    invoiceCount: supplierInvoices.length,
    pendingInvoices: supplierInvoices.filter(i => i.status === 'pending').length,
    disputedInvoices: supplierInvoices.filter(i => i.status === 'disputed').length,
  }));
}
