import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { generateId } from '../../utils/id.js';
import { now, daysAgo } from '../../utils/date.js';
import type { SOStatus, SOStatusHistory } from '../../store/types.js';

// ─── HELPERS ──────────────────────────────────────────

function teamworkSuccess<T>(data: T) {
  return { success: true, data };
}

function teamworkError(message: string, code: number = 400) {
  return { success: false, error: { code, message } };
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function mapOrderToTeamwork(so: typeof store.salesOrders[0]) {
  const lines = store.findByField(store.soLines, 'salesOrderId', so.id);
  const location = so.locationId ? store.findById(store.locations, so.locationId) : null;

  // Generate deterministic POS transaction data for retail channel orders
  const isRetail = so.channel === 'RETAIL_STORE';
  const paymentMethods = ['VISA', 'MASTERCARD', 'AMEX', 'CASH', 'KLARNA', 'APPLE_PAY'];
  const rng = seededRandom(so.id.charCodeAt(0) + so.id.charCodeAt(1) * 256);
  const posTransactions = isRetail ? {
    transactionId: `TXN-${so.soNumber.replace('SO-', '')}`,
    terminalId: `TERM-${String(Math.floor(rng() * 8) + 1).padStart(2, '0')}`,
    storeCode: location?.name?.replace(/\s+/g, '-').toUpperCase().slice(0, 12) || 'STORE-001',
    cashierId: store.users.find(u => u.role === 'STORE_ASSOC')?.id || 'CASHIER-001',
    paymentMethod: paymentMethods[Math.floor(rng() * paymentMethods.length)],
    timestamp: so.createdAt,
  } : null;

  return {
    orderId: so.id,
    orderNumber: so.soNumber,
    channel: so.channel,
    type: so.type,
    status: so.status,
    locationId: so.locationId,
    locationName: location?.name || null,
    customerId: so.customerId,
    customerName: so.customerName,
    customerEmail: so.customerEmail,
    currency: so.currency,
    subtotal: so.subtotal,
    taxAmount: so.taxAmount,
    discountAmount: so.discountAmount,
    totalAmount: so.totalAmount,
    shippingAddress: so.shippingAddress,
    shippingCity: so.shippingCity,
    shippingCountry: so.shippingCountry,
    requestedShipDate: so.requestedShipDate,
    actualShipDate: so.actualShipDate,
    priority: so.priority,
    posTransactions,
    lineItems: lines.map(line => {
      const sku = store.findById(store.skus, line.skuId);
      const product = sku ? store.findById(store.products, sku.productId) : undefined;
      return {
        lineId: line.id,
        skuId: line.skuId,
        skuCode: sku?.sku || null,
        productName: product?.name || null,
        colour: sku?.colour || null,
        size: sku?.size || null,
        quantityOrdered: line.quantityOrdered,
        quantityAllocated: line.quantityAllocated,
        quantityShipped: line.quantityShipped,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      };
    }),
    createdAt: so.createdAt,
    updatedAt: so.updatedAt,
  };
}

function mapLocationToTeamwork(loc: typeof store.locations[0]) {
  return {
    locationId: loc.id,
    name: loc.name,
    type: loc.type,
    address: loc.address,
    city: loc.city,
    country: loc.country,
    countryCode: loc.countryCode,
    region: loc.region,
    timezone: loc.timezone,
    isActive: loc.isActive,
  };
}

function addSOStatusHistory(
  salesOrderId: string,
  fromStatus: SOStatus | null,
  toStatus: SOStatus,
  reason?: string,
): void {
  const entry: SOStatusHistory = {
    id: generateId(),
    salesOrderId,
    fromStatus,
    toStatus,
    changedById: store.users[0]?.id || 'system',
    reason: reason || null,
    changedAt: now().toISOString(),
  };
  store.insert(store.soStatusHistory, entry);
}

// ─── HANDLERS ─────────────────────────────────────────

// GET /orders
export async function listOrdersHandler(
  request: FastifyRequest<{
    Querystring: { status?: string; locationId?: string; limit?: string };
  }>,
  reply: FastifyReply,
) {
  const { status, locationId, limit: limitStr } = request.query;
  const limit = parseInt(limitStr || '50', 10);

  let orders = [...store.salesOrders];

  if (status) {
    orders = orders.filter(o => o.status === status);
  }
  if (locationId) {
    orders = orders.filter(o => o.locationId === locationId);
  }

  orders = orders.slice(0, limit);

  return reply.send(teamworkSuccess({
    orders: orders.map(mapOrderToTeamwork),
    total: orders.length,
  }));
}

// GET /orders/:id
export async function getOrderHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) {
    return reply.status(404).send(teamworkError('Order not found', 404));
  }
  return reply.send(teamworkSuccess(mapOrderToTeamwork(so)));
}

// POST /orders/:id/fulfill
export async function fulfillOrderHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) {
    return reply.status(404).send(teamworkError('Order not found', 404));
  }

  const validFrom: SOStatus[] = ['ALLOCATED', 'PICKING', 'PACKED'];
  if (!validFrom.includes(so.status)) {
    return reply.status(400).send(
      teamworkError(`Cannot fulfill order in status ${so.status}. Must be ALLOCATED, PICKING, or PACKED.`),
    );
  }

  const previousStatus = so.status;
  so.status = 'SHIPPED';
  so.actualShipDate = now().toISOString();
  so.updatedAt = now().toISOString();

  // Mark all lines as shipped
  const lines = store.findByField(store.soLines, 'salesOrderId', so.id);
  for (const line of lines) {
    line.quantityShipped = line.quantityOrdered;
    line.updatedAt = now().toISOString();
  }

  // Create shipment record
  store.insert(store.shipments, {
    id: generateId(),
    salesOrderId: so.id,
    trackingNumber: `TW-${Date.now()}`,
    carrier: 'Teamwork Fulfillment',
    shippedAt: now().toISOString(),
    deliveredAt: null,
    createdAt: now().toISOString(),
  });

  addSOStatusHistory(so.id, previousStatus, 'SHIPPED', 'Fulfilled via Teamwork Commerce');

  return reply.send(teamworkSuccess({
    orderId: so.id,
    orderNumber: so.soNumber,
    status: so.status,
    fulfilledAt: so.actualShipDate,
  }));
}

// POST /orders/:id/cancel
export async function cancelOrderHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) {
    return reply.status(404).send(teamworkError('Order not found', 404));
  }

  const nonCancellable: SOStatus[] = ['SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED'];
  if (nonCancellable.includes(so.status)) {
    return reply.status(400).send(
      teamworkError(`Cannot cancel order in status ${so.status}.`),
    );
  }

  const previousStatus = so.status;
  so.status = 'CANCELLED';
  so.updatedAt = now().toISOString();

  addSOStatusHistory(so.id, previousStatus, 'CANCELLED', 'Cancelled via Teamwork Commerce');

  return reply.send(teamworkSuccess({
    orderId: so.id,
    orderNumber: so.soNumber,
    status: so.status,
    cancelledAt: so.updatedAt,
  }));
}

// GET /locations
export async function listLocationsHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const locations = store.locations.map(mapLocationToTeamwork);
  return reply.send(teamworkSuccess({
    locations,
    total: locations.length,
  }));
}

// GET /locations/:id
export async function getLocationHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const loc = store.findById(store.locations, request.params.id);
  if (!loc) {
    return reply.status(404).send(teamworkError('Location not found', 404));
  }
  return reply.send(teamworkSuccess(mapLocationToTeamwork(loc)));
}

// GET /inventory
export async function inventoryLookupHandler(
  request: FastifyRequest<{
    Querystring: { skuId?: string; locationId?: string };
  }>,
  reply: FastifyReply,
) {
  let stockLevels = [...store.stockLevels];

  if (request.query.skuId) {
    stockLevels = stockLevels.filter(sl => sl.skuId === request.query.skuId);
  }
  if (request.query.locationId) {
    stockLevels = stockLevels.filter(sl => sl.locationId === request.query.locationId);
  }

  const inventory = stockLevels.map(sl => {
    const sku = store.findById(store.skus, sl.skuId);
    const product = sku ? store.findById(store.products, sku.productId) : undefined;
    const location = store.findById(store.locations, sl.locationId);
    return {
      stockLevelId: sl.id,
      skuId: sl.skuId,
      skuCode: sku?.sku || null,
      productName: product?.name || null,
      colour: sku?.colour || null,
      size: sku?.size || null,
      locationId: sl.locationId,
      locationName: location?.name || null,
      quantityOnHand: sl.quantityOnHand,
      quantityAllocated: sl.quantityAllocated,
      quantityAvailable: sl.quantityOnHand - sl.quantityAllocated,
      quantityInTransit: sl.quantityInTransit,
      quantityOnOrder: sl.quantityOnOrder,
      lastCountedAt: sl.lastCountedAt,
      updatedAt: sl.updatedAt,
    };
  });

  return reply.send(teamworkSuccess({
    inventory,
    total: inventory.length,
  }));
}

// GET /transactions
export async function listTransactionsHandler(
  request: FastifyRequest<{
    Querystring: { storeId?: string; transactionType?: string; paymentMethod?: string; limit?: string };
  }>,
  reply: FastifyReply,
) {
  const { storeId, transactionType, paymentMethod, limit: limitStr } = request.query;
  const limit = parseInt(limitStr || '100', 10);

  // Generate seeded POS transactions from retail channel SOs over the last 30 days
  const retailOrders = store.salesOrders.filter(so => so.channel === 'RETAIL_STORE');
  const storeLocations = store.locations.filter(l =>
    l.type.toUpperCase() === 'STORE' || l.type.toUpperCase() === 'FLAGSHIP',
  );

  const transactionTypes = ['sale', 'sale', 'sale', 'sale', 'return', 'exchange'] as const;
  const paymentMethods = ['card', 'card', 'card', 'cash', 'klarna', 'card'] as const;
  const cashierNames = ['Emma Lindqvist', 'Oscar Bergström', 'Saga Johansson', 'Axel Eriksson', 'Wilma Karlsson', 'Hugo Nilsson', 'Alma Andersson', 'Liam Pettersson'];
  const terminalIds = ['T01', 'T02', 'T03', 'T04'];

  const transactions: Array<Record<string, unknown>> = [];
  const rng = seededRandom(42);

  // Generate from retail SOs first
  for (const so of retailOrders) {
    const loc = so.locationId ? store.findById(store.locations, so.locationId) : storeLocations[0];
    if (!loc) continue;

    const lines = store.findByField(store.soLines, 'salesOrderId', so.id);
    const items = lines.map(line => {
      const sku = store.findById(store.skus, line.skuId);
      const product = sku ? store.findById(store.products, sku.productId) : undefined;
      return {
        sku: sku?.sku || null,
        productName: product?.name || null,
        colour: sku?.colour || null,
        size: sku?.size || null,
        quantity: line.quantityOrdered,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
      };
    });

    const txnType = transactionTypes[Math.floor(rng() * transactionTypes.length)];
    const pmtMethod = paymentMethods[Math.floor(rng() * paymentMethods.length)];

    transactions.push({
      id: `TXN-${so.soNumber.replace('SO-', '')}`,
      storeId: loc.id,
      storeName: loc.name,
      terminalId: terminalIds[Math.floor(rng() * terminalIds.length)],
      cashierName: cashierNames[Math.floor(rng() * cashierNames.length)],
      transactionType: txnType,
      items,
      paymentMethod: pmtMethod,
      total: so.totalAmount,
      currency: so.currency,
      timestamp: so.createdAt,
    });
  }

  // Pad with synthetic transactions to reach 50+ across stores over last 30 days
  const padCount = Math.max(0, 55 - transactions.length);
  for (let i = 0; i < padCount; i++) {
    const loc = storeLocations[Math.floor(rng() * storeLocations.length)] || storeLocations[0];
    if (!loc) break;

    const dayOffset = Math.floor(rng() * 30);
    const hour = 10 + Math.floor(rng() * 10);
    const minute = Math.floor(rng() * 60);
    const ts = daysAgo(dayOffset);
    ts.setHours(hour, minute, 0, 0);

    const txnType = transactionTypes[Math.floor(rng() * transactionTypes.length)];
    const pmtMethod = paymentMethods[Math.floor(rng() * paymentMethods.length)];
    const cashier = cashierNames[Math.floor(rng() * cashierNames.length)];

    // Pick a random SKU for the synthetic transaction
    const skuIdx = Math.floor(rng() * store.skus.length);
    const sku = store.skus[skuIdx];
    const product = sku ? store.findById(store.products, sku.productId) : undefined;
    const qty = 1 + Math.floor(rng() * 3);
    const lineTotal = qty * (sku?.retailPrice || 2000);

    transactions.push({
      id: `TXN-SYN-${String(i + 1).padStart(4, '0')}`,
      storeId: loc.id,
      storeName: loc.name,
      terminalId: terminalIds[Math.floor(rng() * terminalIds.length)],
      cashierName: cashier,
      transactionType: txnType,
      items: [{
        sku: sku?.sku || null,
        productName: product?.name || null,
        colour: sku?.colour || null,
        size: sku?.size || null,
        quantity: qty,
        unitPrice: sku?.retailPrice || 2000,
        lineTotal,
      }],
      paymentMethod: pmtMethod,
      total: txnType === 'return' ? -lineTotal : lineTotal,
      currency: sku?.priceCurrency || 'SEK',
      timestamp: ts.toISOString(),
    });
  }

  // Sort by timestamp descending
  transactions.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));

  // Apply filters
  let result = transactions;
  if (storeId) {
    result = result.filter(t => t.storeId === storeId);
  }
  if (transactionType) {
    result = result.filter(t => t.transactionType === transactionType);
  }
  if (paymentMethod) {
    result = result.filter(t => t.paymentMethod === paymentMethod);
  }

  result = result.slice(0, limit);

  return reply.send(teamworkSuccess({
    transactions: result,
    total: result.length,
  }));
}

// POST /orders/:id/route
export async function routeOrderHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const so = store.findById(store.salesOrders, request.params.id);
  if (!so) {
    return reply.status(404).send(teamworkError('Order not found', 404));
  }

  const lines = store.findByField(store.soLines, 'salesOrderId', so.id);

  // Find optimal fulfillment location based on stock availability
  const locationScores = new Map<string, number>();

  for (const line of lines) {
    const stockLevels = store.findByField(store.stockLevels, 'skuId', line.skuId);
    for (const sl of stockLevels) {
      const available = sl.quantityOnHand - sl.quantityAllocated;
      if (available >= line.quantityOrdered) {
        const current = locationScores.get(sl.locationId) || 0;
        locationScores.set(sl.locationId, current + 1);
      }
    }
  }

  // Pick location that can fulfill the most lines
  let bestLocationId: string | null = null;
  let bestScore = 0;
  for (const [locId, score] of locationScores) {
    if (score > bestScore) {
      bestScore = score;
      bestLocationId = locId;
    }
  }

  if (!bestLocationId) {
    // Fallback: pick any warehouse location
    const warehouses = store.locations.filter(l => l.type === 'WAREHOUSE' || l.type === 'DC');
    bestLocationId = warehouses.length > 0 ? warehouses[0].id : store.locations[0]?.id || null;
  }

  // Update SO location
  if (bestLocationId) {
    so.locationId = bestLocationId;
    so.updatedAt = now().toISOString();
  }

  const location = bestLocationId ? store.findById(store.locations, bestLocationId) : null;

  return reply.send(teamworkSuccess({
    orderId: so.id,
    orderNumber: so.soNumber,
    routedToLocationId: bestLocationId,
    routedToLocationName: location?.name || null,
    fulfillableLines: bestScore,
    totalLines: lines.length,
    routedAt: now().toISOString(),
  }));
}
