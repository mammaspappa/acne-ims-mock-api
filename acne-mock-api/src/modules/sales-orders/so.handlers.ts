import type { FastifyRequest, FastifyReply } from 'fastify';
import type {
  SalesOrder, SOLine, SOStatusHistory, SOStatus, SOChannel, SOType,
  Currency, Shipment,
} from '../../store/types.js';
import { store } from '../../store/Store.js';
import { paginate, parsePagination } from '../../utils/pagination.js';
import { filterItems } from '../../utils/filter.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';
import { nextSequence } from '../../utils/number-sequence.js';
import { canTransition } from './so.state-machine.js';

// ─── HELPERS ───────────────────────────────────────────

/**
 * Build the SO number prefix based on channel and the caller-supplied code.
 *
 *   RETAIL_STORE  -> SO-RT-{STORE_CODE}
 *   ECOMMERCE     -> SO-EC-{REGION}
 *   WHOLESALE     -> SO-WH-{BUYER_CODE}
 *   MARKETPLACE   -> SO-MP-{PLATFORM}
 *   CLIENTELING   -> SO-CL-{STORE_CODE}
 */
function soNumberPrefix(
  channel: SOChannel,
  codes: { storeCode?: string; region?: string; buyerCode?: string; platform?: string },
): string {
  switch (channel) {
    case 'RETAIL_STORE':
      return `SO-RT-${codes.storeCode || 'STORE'}`;
    case 'ECOMMERCE':
      return `SO-EC-${codes.region || 'GL'}`;
    case 'WHOLESALE':
      return `SO-WH-${codes.buyerCode || 'BUYER'}`;
    case 'MARKETPLACE':
      return `SO-MP-${codes.platform || 'MKT'}`;
    case 'CLIENTELING':
      return `SO-CL-${codes.storeCode || 'STORE'}`;
  }
}

function recalcTotals(so: SalesOrder): void {
  const lines = store.findByField(store.soLines, 'salesOrderId', so.id) as SOLine[];
  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);
  so.subtotal = subtotal;
  so.taxAmount = Math.round(subtotal * 0.25 * 100) / 100; // 25% Swedish VAT
  so.totalAmount = so.subtotal + so.taxAmount - so.discountAmount;
  so.updatedAt = now().toISOString();
}

function addStatusHistory(
  salesOrderId: string,
  fromStatus: SOStatus | null,
  toStatus: SOStatus,
  changedById: string,
  reason?: string | null,
): SOStatusHistory {
  const entry: SOStatusHistory = {
    id: generateId(),
    salesOrderId,
    fromStatus,
    toStatus,
    changedById,
    reason: reason ?? null,
    changedAt: now().toISOString(),
  };
  store.insert(store.soStatusHistory, entry);
  return entry;
}

/**
 * Shared logic for simple status transitions.
 * Returns the updated SO or sends an error reply.
 */
function performTransition(
  so: SalesOrder,
  targetStatus: SOStatus,
  userId: string,
  reason?: string | null,
): SalesOrder | { error: string; message: string } {
  // For ON_HOLD release we need the previousStatus stored on the SO.
  // We stash it in the SO notes field prefix (see holdSO handler).
  const previousStatus = extractPreviousStatus(so);

  if (!canTransition(so.status, targetStatus, previousStatus)) {
    return {
      error: 'Conflict',
      message: `Cannot transition from ${so.status} to ${targetStatus}`,
    };
  }

  const fromStatus = so.status;
  so.status = targetStatus;
  so.updatedAt = now().toISOString();

  addStatusHistory(so.id, fromStatus, targetStatus, userId, reason);
  return so;
}

// We store the previous status as a hidden prefix in a dedicated field on the
// SalesOrder at hold-time. Because the SalesOrder type does not have a
// dedicated `previousStatus` field, we use a convention:  we keep a Map
// in-memory keyed by SO id.
const previousStatusMap = new Map<string, SOStatus>();

function extractPreviousStatus(so: SalesOrder): SOStatus | null {
  return previousStatusMap.get(so.id) ?? null;
}

// ─── CREATE ────────────────────────────────────────────

interface CreateSOBody {
  channel: SOChannel;
  type: SOType;
  currency: Currency;
  locationId?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  wholesaleBuyerId?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingCountry?: string;
  requestedShipDate?: string;
  notes?: string;
  priority?: number;
  storeCode?: string;
  region?: string;
  buyerCode?: string;
  platform?: string;
}

export async function createSO(
  request: FastifyRequest<{ Body: CreateSOBody }>,
  reply: FastifyReply,
) {
  const body = request.body;
  const userId = request.currentUser?.userId ?? 'system';

  const prefix = soNumberPrefix(body.channel, {
    storeCode: body.storeCode,
    region: body.region,
    buyerCode: body.buyerCode,
    platform: body.platform,
  });
  const soNumber = nextSequence(prefix, 5);

  const ts = now().toISOString();

  const so: SalesOrder = {
    id: generateId(),
    soNumber,
    channel: body.channel,
    type: body.type,
    status: 'DRAFT',
    locationId: body.locationId ?? null,
    customerId: body.customerId ?? null,
    customerName: body.customerName ?? null,
    customerEmail: body.customerEmail ?? null,
    wholesaleBuyerId: body.wholesaleBuyerId ?? null,
    currency: body.currency,
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    shippingAddress: body.shippingAddress ?? null,
    shippingCity: body.shippingCity ?? null,
    shippingCountry: body.shippingCountry ?? null,
    requestedShipDate: body.requestedShipDate ?? null,
    actualShipDate: null,
    deliveredAt: null,
    notes: body.notes ?? null,
    priority: body.priority ?? 0,
    createdById: userId,
    createdAt: ts,
    updatedAt: ts,
  };

  store.insert(store.salesOrders, so);

  // Record initial status history
  addStatusHistory(so.id, null, 'DRAFT', userId);

  return reply.status(201).send(so);
}

// ─── LIST ──────────────────────────────────────────────

export async function listSOs(
  request: FastifyRequest<{
    Querystring: {
      channel?: SOChannel;
      status?: SOStatus;
      type?: SOType;
      locationId?: string;
      search?: string;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply,
) {
  const { channel, status, type, locationId, search } = request.query;

  let orders = store.salesOrders as SalesOrder[];

  if (search) {
    const q = search.toLowerCase();
    orders = orders.filter(
      (so) =>
        so.soNumber.toLowerCase().includes(q) ||
        (so.customerName && so.customerName.toLowerCase().includes(q)) ||
        (so.customerEmail && so.customerEmail.toLowerCase().includes(q)),
    );
  }

  orders = filterItems(orders as unknown as Record<string, unknown>[], {
    ...(channel && { channel }),
    ...(status && { status }),
    ...(type && { type }),
    ...(locationId && { locationId }),
  }) as unknown as SalesOrder[];

  const pagination = parsePagination(request.query);
  return reply.send(paginate(orders, pagination));
}

// ─── GET ───────────────────────────────────────────────

export async function getSO(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) {
    return reply.status(404).send({ error: 'Sales order not found' });
  }

  const lines = store.findByField(store.soLines, 'salesOrderId', so.id);
  const shipments = store.findByField(store.shipments, 'salesOrderId', so.id);

  return reply.send({ ...so, lines, shipments });
}

// ─── UPDATE ────────────────────────────────────────────

interface UpdateSOBody {
  customerName?: string;
  customerEmail?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingCountry?: string;
  requestedShipDate?: string;
  notes?: string;
  priority?: number;
}

export async function updateSO(
  request: FastifyRequest<{ Params: { id: string }; Body: UpdateSOBody }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) {
    return reply.status(404).send({ error: 'Sales order not found' });
  }

  // Only allow updates when SO is in DRAFT or CONFIRMED
  if (!['DRAFT', 'CONFIRMED'].includes(so.status)) {
    return reply.status(409).send({
      error: 'Conflict',
      message: `Cannot update a sales order in ${so.status} status`,
    });
  }

  const patch: Partial<SalesOrder> = { updatedAt: now().toISOString() };

  if (request.body.customerName !== undefined) patch.customerName = request.body.customerName;
  if (request.body.customerEmail !== undefined) patch.customerEmail = request.body.customerEmail;
  if (request.body.shippingAddress !== undefined) patch.shippingAddress = request.body.shippingAddress;
  if (request.body.shippingCity !== undefined) patch.shippingCity = request.body.shippingCity;
  if (request.body.shippingCountry !== undefined) patch.shippingCountry = request.body.shippingCountry;
  if (request.body.requestedShipDate !== undefined) patch.requestedShipDate = request.body.requestedShipDate;
  if (request.body.notes !== undefined) patch.notes = request.body.notes;
  if (request.body.priority !== undefined) patch.priority = request.body.priority;

  const updated = store.update(store.salesOrders, so.id, patch);
  return reply.send(updated);
}

// ─── ADD LINE ITEMS ────────────────────────────────────

interface AddLinesBody {
  lines: Array<{
    skuId: string;
    quantityOrdered: number;
    unitPrice: number;
    discountPercent?: number;
    notes?: string;
  }>;
}

export async function addLines(
  request: FastifyRequest<{ Params: { id: string }; Body: AddLinesBody }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) {
    return reply.status(404).send({ error: 'Sales order not found' });
  }

  if (!['DRAFT', 'CONFIRMED'].includes(so.status)) {
    return reply.status(409).send({
      error: 'Conflict',
      message: `Cannot add lines to a sales order in ${so.status} status`,
    });
  }

  const ts = now().toISOString();
  const newLines: SOLine[] = [];

  for (const line of request.body.lines) {
    const discount = line.discountPercent ?? 0;
    const lineTotal = line.quantityOrdered * line.unitPrice * (1 - discount / 100);

    const soLine: SOLine = {
      id: generateId(),
      salesOrderId: so.id,
      skuId: line.skuId,
      quantityOrdered: line.quantityOrdered,
      quantityAllocated: 0,
      quantityShipped: 0,
      quantityReturned: 0,
      unitPrice: line.unitPrice,
      discountPercent: discount,
      lineTotal: Math.round(lineTotal * 100) / 100,
      notes: line.notes ?? null,
      createdAt: ts,
      updatedAt: ts,
    };

    store.insert(store.soLines, soLine);
    newLines.push(soLine);
  }

  recalcTotals(so);

  const allLines = store.findByField(store.soLines, 'salesOrderId', so.id);
  return reply.send({ ...so, lines: allLines });
}

// ─── CONFIRM ───────────────────────────────────────────

export async function confirmSO(
  request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) return reply.status(404).send({ error: 'Sales order not found' });

  const result = performTransition(so, 'CONFIRMED', request.currentUser?.userId ?? 'system', request.body?.reason);
  if ('error' in result) return reply.status(409).send(result);

  return reply.send(result);
}

// ─── ALLOCATE ──────────────────────────────────────────

export async function allocateSO(
  request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) return reply.status(404).send({ error: 'Sales order not found' });

  const result = performTransition(so, 'ALLOCATED', request.currentUser?.userId ?? 'system', request.body?.reason);
  if ('error' in result) return reply.status(409).send(result);

  // Mark all lines as fully allocated
  const lines = store.findByField(store.soLines, 'salesOrderId', so.id) as SOLine[];
  const ts = now().toISOString();
  for (const line of lines) {
    store.update(store.soLines, line.id, {
      quantityAllocated: line.quantityOrdered,
      updatedAt: ts,
    });
  }

  return reply.send(result);
}

// ─── PICK ──────────────────────────────────────────────

export async function pickSO(
  request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) return reply.status(404).send({ error: 'Sales order not found' });

  const result = performTransition(so, 'PICKING', request.currentUser?.userId ?? 'system', request.body?.reason);
  if ('error' in result) return reply.status(409).send(result);

  return reply.send(result);
}

// ─── PACK ──────────────────────────────────────────────

export async function packSO(
  request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) return reply.status(404).send({ error: 'Sales order not found' });

  const result = performTransition(so, 'PACKED', request.currentUser?.userId ?? 'system', request.body?.reason);
  if ('error' in result) return reply.status(409).send(result);

  return reply.send(result);
}

// ─── SHIP ──────────────────────────────────────────────

interface ShipBody {
  reason?: string;
  trackingNumber?: string;
  carrier?: string;
}

export async function shipSO(
  request: FastifyRequest<{ Params: { id: string }; Body: ShipBody }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) return reply.status(404).send({ error: 'Sales order not found' });

  const result = performTransition(so, 'SHIPPED', request.currentUser?.userId ?? 'system', request.body?.reason);
  if ('error' in result) return reply.status(409).send(result);

  // Record shipment
  const ts = now().toISOString();
  const shipment: Shipment = {
    id: generateId(),
    salesOrderId: so.id,
    trackingNumber: request.body?.trackingNumber ?? null,
    carrier: request.body?.carrier ?? null,
    shippedAt: ts,
    deliveredAt: null,
    createdAt: ts,
  };
  store.insert(store.shipments, shipment);

  // Update actualShipDate and mark lines as shipped
  so.actualShipDate = ts;

  const lines = store.findByField(store.soLines, 'salesOrderId', so.id) as SOLine[];
  for (const line of lines) {
    store.update(store.soLines, line.id, {
      quantityShipped: line.quantityOrdered,
      updatedAt: ts,
    });
  }

  return reply.send(result);
}

// ─── DELIVER ───────────────────────────────────────────

export async function deliverSO(
  request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) return reply.status(404).send({ error: 'Sales order not found' });

  const result = performTransition(so, 'DELIVERED', request.currentUser?.userId ?? 'system', request.body?.reason);
  if ('error' in result) return reply.status(409).send(result);

  // Update deliveredAt on SO and its shipments
  const ts = now().toISOString();
  so.deliveredAt = ts;

  const shipments = store.findByField(store.shipments, 'salesOrderId', so.id) as Shipment[];
  for (const shipment of shipments) {
    if (!shipment.deliveredAt) {
      store.update(store.shipments, shipment.id, { deliveredAt: ts });
    }
  }

  return reply.send(result);
}

// ─── RETURN ────────────────────────────────────────────

export async function returnSO(
  request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) return reply.status(404).send({ error: 'Sales order not found' });

  const result = performTransition(so, 'RETURNED', request.currentUser?.userId ?? 'system', request.body?.reason);
  if ('error' in result) return reply.status(409).send(result);

  // Mark all lines as returned
  const lines = store.findByField(store.soLines, 'salesOrderId', so.id) as SOLine[];
  const ts = now().toISOString();
  for (const line of lines) {
    store.update(store.soLines, line.id, {
      quantityReturned: line.quantityShipped,
      updatedAt: ts,
    });
  }

  return reply.send(result);
}

// ─── CANCEL ────────────────────────────────────────────

export async function cancelSO(
  request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) return reply.status(404).send({ error: 'Sales order not found' });

  const result = performTransition(so, 'CANCELLED', request.currentUser?.userId ?? 'system', request.body?.reason);
  if ('error' in result) return reply.status(409).send(result);

  return reply.send(result);
}

// ─── HOLD ──────────────────────────────────────────────

export async function holdSO(
  request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) return reply.status(404).send({ error: 'Sales order not found' });

  if (so.status === 'ON_HOLD') {
    return reply.status(409).send({ error: 'Conflict', message: 'Sales order is already on hold' });
  }

  // Remember the current status so we can restore it on release
  previousStatusMap.set(so.id, so.status);

  const result = performTransition(so, 'ON_HOLD', request.currentUser?.userId ?? 'system', request.body?.reason);
  if ('error' in result) return reply.status(409).send(result);

  return reply.send(result);
}

// ─── RELEASE ───────────────────────────────────────────

export async function releaseSO(
  request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) return reply.status(404).send({ error: 'Sales order not found' });

  if (so.status !== 'ON_HOLD') {
    return reply.status(409).send({ error: 'Conflict', message: 'Sales order is not on hold' });
  }

  const prev = previousStatusMap.get(so.id);
  if (!prev) {
    return reply.status(409).send({
      error: 'Conflict',
      message: 'No previous status recorded; cannot release',
    });
  }

  const result = performTransition(so, prev, request.currentUser?.userId ?? 'system', request.body?.reason);
  if ('error' in result) return reply.status(409).send(result);

  // Clean up
  previousStatusMap.delete(so.id);

  return reply.send(result);
}

// ─── HISTORY ───────────────────────────────────────────

export async function getSOHistory(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) {
    return reply.status(404).send({ error: 'Sales order not found' });
  }

  const history = store.findByField(store.soStatusHistory, 'salesOrderId', so.id);
  return reply.send({ data: history });
}
