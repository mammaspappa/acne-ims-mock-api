import type { FastifyRequest, FastifyReply } from 'fastify';
import type { POStatus, Season, Currency } from '../../store/types.js';
import { store } from '../../store/Store.js';
import { paginate, parsePagination } from '../../utils/pagination.js';
import { filterItems } from '../../utils/filter.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';
import { nextSequence } from '../../utils/number-sequence.js';
import { canTransition, isCancellable } from './po.state-machine.js';

// ─── Helpers ───────────────────────────────────────────

function findPO(id: string) {
  return store.findById(store.purchaseOrders, id);
}

function getLinesForPO(poId: string) {
  return store.findByField(store.poLines, 'purchaseOrderId', poId);
}

function recalcTotal(poId: string): number {
  const lines = getLinesForPO(poId);
  return lines.reduce((sum, l) => sum + l.lineTotal, 0);
}

function addStatusHistory(
  poId: string,
  from: POStatus | null,
  to: POStatus,
  userId: string,
  reason: string | null = null,
) {
  store.insert(store.poStatusHistory, {
    id: generateId(),
    purchaseOrderId: poId,
    fromStatus: from,
    toStatus: to,
    changedById: userId,
    reason,
    changedAt: now().toISOString(),
  });
}

function transitionPO(
  po: ReturnType<typeof findPO>,
  toStatus: POStatus,
  userId: string,
  reason: string | null = null,
  reply: FastifyReply,
) {
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  if (!canTransition(po.status, toStatus)) {
    return reply.status(409).send({
      error: 'Invalid status transition',
      message: `Cannot transition from ${po.status} to ${toStatus}`,
      currentStatus: po.status,
    });
  }

  const fromStatus = po.status;
  const updated = store.update(store.purchaseOrders, po.id, {
    status: toStatus,
    updatedAt: now().toISOString(),
  });
  addStatusHistory(po.id, fromStatus, toStatus, userId, reason);
  return updated;
}

// ─── Handlers ──────────────────────────────────────────

/** POST /purchase-orders */
export async function createPO(
  request: FastifyRequest<{
    Body: {
      supplierId: string;
      season: Season;
      seasonYear: number;
      currency: Currency;
      expectedDelivery?: string;
      deliveryLocationId?: string;
      shippingTerms?: string;
      paymentTerms?: string;
      notes?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const { supplierId, season, seasonYear, currency, ...rest } = request.body;

  // Validate supplier exists
  const supplier = store.findById(store.suppliers, supplierId);
  if (!supplier) {
    return reply.status(400).send({ error: 'Supplier not found', supplierId });
  }

  const prefix = `PO-${season}${seasonYear}`;
  const poNumber = nextSequence(prefix);
  const timestamp = now().toISOString();
  const userId = request.currentUser.userId;

  const po = store.insert(store.purchaseOrders, {
    id: generateId(),
    poNumber,
    supplierId,
    season,
    seasonYear,
    status: 'DRAFT' as POStatus,
    currency,
    totalAmount: 0,
    expectedDelivery: rest.expectedDelivery ?? null,
    actualDelivery: null,
    deliveryLocationId: rest.deliveryLocationId ?? null,
    shippingTerms: rest.shippingTerms ?? null,
    paymentTerms: rest.paymentTerms ?? null,
    notes: rest.notes ?? null,
    createdById: userId,
    approvedById: null,
    approvedAt: null,
    sentToSupplierAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  addStatusHistory(po.id, null, 'DRAFT', userId);

  return reply.status(201).send(po);
}

/** GET /purchase-orders */
export async function listPOs(
  request: FastifyRequest<{
    Querystring: {
      season?: string;
      status?: string;
      supplierId?: string;
      search?: string;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply,
) {
  const { season, status, supplierId, search } = request.query;

  let pos = store.purchaseOrders;

  if (search) {
    const q = search.toLowerCase();
    pos = pos.filter(
      p =>
        p.poNumber.toLowerCase().includes(q) ||
        (p.notes && p.notes.toLowerCase().includes(q)),
    );
  }

  pos = filterItems(pos, {
    ...(season && { season }),
    ...(status && { status }),
    ...(supplierId && { supplierId }),
  });

  const pagination = parsePagination(request.query);
  return reply.send(paginate(pos, pagination));
}

/** GET /purchase-orders/:id */
export async function getPO(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const po = findPO(request.params.id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  const lines = getLinesForPO(po.id);
  return reply.send({ ...po, lines });
}

/** PATCH /purchase-orders/:id */
export async function updatePO(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      expectedDelivery?: string;
      deliveryLocationId?: string;
      shippingTerms?: string;
      paymentTerms?: string;
      notes?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const po = findPO(request.params.id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  if (po.status !== 'DRAFT') {
    return reply.status(409).send({
      error: 'Cannot update',
      message: 'Purchase order can only be updated while in DRAFT status',
      currentStatus: po.status,
    });
  }

  const updated = store.update(store.purchaseOrders, po.id, {
    ...request.body,
    updatedAt: now().toISOString(),
  });
  return reply.send(updated);
}

// ─── Line-item CRUD ────────────────────────────────────

/** POST /purchase-orders/:id/lines */
export async function addLine(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      skuId: string;
      quantityOrdered: number;
      unitCost: number;
      expectedDate?: string;
      notes?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const po = findPO(request.params.id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  if (po.status !== 'DRAFT') {
    return reply.status(409).send({
      error: 'Cannot add lines',
      message: 'Lines can only be added while PO is in DRAFT status',
      currentStatus: po.status,
    });
  }

  const { skuId, quantityOrdered, unitCost, expectedDate, notes } = request.body;

  // Validate SKU exists
  const sku = store.findById(store.skus, skuId);
  if (!sku) {
    return reply.status(400).send({ error: 'SKU not found', skuId });
  }

  const timestamp = now().toISOString();
  const lineTotal = quantityOrdered * unitCost;

  const line = store.insert(store.poLines, {
    id: generateId(),
    purchaseOrderId: po.id,
    skuId,
    quantityOrdered,
    quantityReceived: 0,
    unitCost,
    lineTotal,
    expectedDate: expectedDate ?? null,
    notes: notes ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  // Recalculate PO total
  const newTotal = recalcTotal(po.id);
  store.update(store.purchaseOrders, po.id, {
    totalAmount: newTotal,
    updatedAt: timestamp,
  });

  return reply.status(201).send(line);
}

/** PATCH /purchase-orders/:id/lines/:lineId */
export async function updateLine(
  request: FastifyRequest<{
    Params: { id: string; lineId: string };
    Body: {
      quantityOrdered?: number;
      unitCost?: number;
      expectedDate?: string;
      notes?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const po = findPO(request.params.id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  if (po.status !== 'DRAFT') {
    return reply.status(409).send({
      error: 'Cannot update lines',
      message: 'Lines can only be updated while PO is in DRAFT status',
      currentStatus: po.status,
    });
  }

  const line = store.findById(store.poLines, request.params.lineId);
  if (!line || line.purchaseOrderId !== po.id) {
    return reply.status(404).send({ error: 'PO line not found' });
  }

  const timestamp = now().toISOString();
  const qty = request.body.quantityOrdered ?? line.quantityOrdered;
  const cost = request.body.unitCost ?? line.unitCost;
  const lineTotal = qty * cost;

  const updated = store.update(store.poLines, line.id, {
    ...request.body,
    lineTotal,
    updatedAt: timestamp,
  });

  // Recalculate PO total
  const newTotal = recalcTotal(po.id);
  store.update(store.purchaseOrders, po.id, {
    totalAmount: newTotal,
    updatedAt: timestamp,
  });

  return reply.send(updated);
}

/** DELETE /purchase-orders/:id/lines/:lineId */
export async function deleteLine(
  request: FastifyRequest<{ Params: { id: string; lineId: string } }>,
  reply: FastifyReply,
) {
  const po = findPO(request.params.id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  if (po.status !== 'DRAFT') {
    return reply.status(409).send({
      error: 'Cannot remove lines',
      message: 'Lines can only be removed while PO is in DRAFT status',
      currentStatus: po.status,
    });
  }

  const line = store.findById(store.poLines, request.params.lineId);
  if (!line || line.purchaseOrderId !== po.id) {
    return reply.status(404).send({ error: 'PO line not found' });
  }

  store.remove(store.poLines, line.id);

  const timestamp = now().toISOString();
  const newTotal = recalcTotal(po.id);
  store.update(store.purchaseOrders, po.id, {
    totalAmount: newTotal,
    updatedAt: timestamp,
  });

  return reply.send({ message: 'Line removed' });
}

// ─── Status-transition actions ─────────────────────────

/** POST /purchase-orders/:id/submit */
export async function submitPO(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const po = findPO(request.params.id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  // Must have at least one line to submit
  const lines = getLinesForPO(po.id);
  if (lines.length === 0) {
    return reply.status(409).send({
      error: 'Cannot submit',
      message: 'Purchase order must have at least one line item before submitting',
    });
  }

  const result = transitionPO(po, 'PENDING_APPROVAL', request.currentUser.userId, null, reply);
  if (reply.sent) return;
  return reply.send(result);
}

/** POST /purchase-orders/:id/approve */
export async function approvePO(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const po = findPO(request.params.id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  const userId = request.currentUser.userId;
  const result = transitionPO(po, 'APPROVED', userId, null, reply);
  if (reply.sent) return;

  store.update(store.purchaseOrders, po.id, {
    approvedById: userId,
    approvedAt: now().toISOString(),
  });

  // Re-fetch to get approval fields
  const updated = findPO(po.id);
  return reply.send(updated);
}

/** POST /purchase-orders/:id/reject */
export async function rejectPO(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { reason: string };
  }>,
  reply: FastifyReply,
) {
  const po = findPO(request.params.id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  if (po.status !== 'PENDING_APPROVAL') {
    return reply.status(409).send({
      error: 'Invalid status transition',
      message: 'Can only reject a PO that is PENDING_APPROVAL',
      currentStatus: po.status,
    });
  }

  const userId = request.currentUser.userId;
  // Rejection sends PO back to DRAFT
  const result = transitionPO(po, 'DRAFT', userId, request.body.reason, reply);
  if (reply.sent) return;
  return reply.send(result);
}

/** POST /purchase-orders/:id/send */
export async function sendPO(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const po = findPO(request.params.id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  const userId = request.currentUser.userId;
  const result = transitionPO(po, 'SENT_TO_SUPPLIER', userId, null, reply);
  if (reply.sent) return;

  store.update(store.purchaseOrders, po.id, {
    sentToSupplierAt: now().toISOString(),
  });

  const updated = findPO(po.id);
  return reply.send(updated);
}

/** POST /purchase-orders/:id/confirm */
export async function confirmPO(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const po = findPO(request.params.id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  const result = transitionPO(po, 'CONFIRMED_BY_SUPPLIER', request.currentUser.userId, null, reply);
  if (reply.sent) return;
  return reply.send(result);
}

/** POST /purchase-orders/:id/receive */
export async function receivePO(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      lines: Array<{
        poLineId: string;
        quantityReceived: number;
        qualityStatus?: string;
        damagedQuantity?: number;
        notes?: string;
      }>;
      locationId?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const po = findPO(request.params.id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  // Valid receive states: SHIPPED, PARTIALLY_RECEIVED, CONFIRMED_BY_SUPPLIER, IN_PRODUCTION
  const validReceiveStates: POStatus[] = [
    'SHIPPED',
    'PARTIALLY_RECEIVED',
    'CONFIRMED_BY_SUPPLIER',
    'IN_PRODUCTION',
  ];
  if (!validReceiveStates.includes(po.status)) {
    return reply.status(409).send({
      error: 'Cannot receive',
      message: `Cannot receive goods when PO is in ${po.status} status`,
      currentStatus: po.status,
    });
  }

  const userId = request.currentUser.userId;
  const locationId = request.body.locationId ?? po.deliveryLocationId ?? request.currentUser.locationId ?? '';
  const timestamp = now().toISOString();
  const receipts = [];

  for (const receiptLine of request.body.lines) {
    const poLine = store.findById(store.poLines, receiptLine.poLineId);
    if (!poLine || poLine.purchaseOrderId !== po.id) {
      return reply.status(400).send({
        error: 'PO line not found',
        poLineId: receiptLine.poLineId,
      });
    }

    // Create receipt record
    const receipt = store.insert(store.poReceipts, {
      id: generateId(),
      poLineId: poLine.id,
      quantityReceived: receiptLine.quantityReceived,
      receivedAt: timestamp,
      receivedById: userId,
      locationId,
      qualityStatus: receiptLine.qualityStatus ?? 'ACCEPTED',
      damagedQuantity: receiptLine.damagedQuantity ?? 0,
      notes: receiptLine.notes ?? null,
    });
    receipts.push(receipt);

    // Update line's quantityReceived
    const newQtyReceived = poLine.quantityReceived + receiptLine.quantityReceived;
    store.update(store.poLines, poLine.id, {
      quantityReceived: newQtyReceived,
      updatedAt: timestamp,
    });
  }

  // Determine new PO status based on total received vs. ordered
  const allLines = getLinesForPO(po.id);
  const totalOrdered = allLines.reduce((sum, l) => sum + l.quantityOrdered, 0);
  const totalReceived = allLines.reduce((sum, l) => sum + l.quantityReceived, 0);

  let newStatus: POStatus;
  if (totalReceived >= totalOrdered) {
    newStatus = 'RECEIVED';
  } else if (totalReceived > 0) {
    newStatus = 'PARTIALLY_RECEIVED';
  } else {
    newStatus = po.status; // No change
  }

  if (newStatus !== po.status) {
    const fromStatus = po.status;
    store.update(store.purchaseOrders, po.id, {
      status: newStatus,
      actualDelivery: newStatus === 'RECEIVED' ? timestamp : po.actualDelivery,
      updatedAt: timestamp,
    });
    addStatusHistory(po.id, fromStatus, newStatus, userId);
  }

  const updatedPO = findPO(po.id);
  return reply.send({ purchaseOrder: updatedPO, receipts });
}

/** POST /purchase-orders/:id/cancel */
export async function cancelPO(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { reason?: string };
  }>,
  reply: FastifyReply,
) {
  const po = findPO(request.params.id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  if (!isCancellable(po.status)) {
    return reply.status(409).send({
      error: 'Cannot cancel',
      message: `Cannot cancel a PO in ${po.status} status`,
      currentStatus: po.status,
    });
  }

  const userId = request.currentUser.userId;
  const reason = request.body?.reason ?? null;
  const result = transitionPO(po, 'CANCELLED', userId, reason, reply);
  if (reply.sent) return;
  return reply.send(result);
}

// ─── History ───────────────────────────────────────────

/** GET /purchase-orders/:id/history */
export async function getHistory(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const po = findPO(request.params.id);
  if (!po) return reply.status(404).send({ error: 'Purchase order not found' });

  const history = store
    .findByField(store.poStatusHistory, 'purchaseOrderId', po.id)
    .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());

  return reply.send(history);
}
