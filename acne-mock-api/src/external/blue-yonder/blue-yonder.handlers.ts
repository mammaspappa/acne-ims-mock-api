import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';
import type { SOStatus, SOStatusHistory, POReceipt } from '../../store/types.js';

// ─── IN-MEMORY OUTBOUND ORDERS ───────────────────────

interface OutboundOrder {
  OutboundOrderId: string;
  SalesOrderId: string;
  SalesOrderNumber: string;
  WarehouseId: string;
  WarehouseName: string;
  Status: 'CREATED' | 'PICKING' | 'PACKED' | 'SHIPPED';
  Lines: OutboundLine[];
  CreatedAt: string;
  UpdatedAt: string;
  ShippedAt: string | null;
  TrackingNumber: string | null;
  Carrier: string | null;
}

interface OutboundLine {
  LineId: string;
  SkuId: string;
  SkuCode: string;
  ProductName: string;
  Colour: string;
  Size: string;
  QuantityOrdered: number;
  QuantityPicked: number;
  QuantityShipped: number;
}

const outboundOrders = new Map<string, OutboundOrder>();

// ─── HELPERS ──────────────────────────────────────────

function byOk<T>(result: T) {
  return { Result: result, Status: 'OK' };
}

function byError(message: string, code: number = 400) {
  return { Result: null, Status: 'ERROR', ErrorCode: code, ErrorMessage: message };
}

function isWarehouse(loc: typeof store.locations[0]): boolean {
  const t = loc.type.toUpperCase();
  return t === 'WAREHOUSE' || t === 'DC' || t === 'DISTRIBUTION_CENTER';
}

function mapInboundOrder(po: typeof store.purchaseOrders[0]) {
  const lines = store.findByField(store.poLines, 'purchaseOrderId', po.id);
  const supplier = store.findById(store.suppliers, po.supplierId);
  const location = po.deliveryLocationId ? store.findById(store.locations, po.deliveryLocationId) : null;

  return {
    InboundOrderId: po.id,
    PoNumber: po.poNumber,
    SupplierId: po.supplierId,
    SupplierName: supplier?.name || null,
    WarehouseId: po.deliveryLocationId,
    WarehouseName: location?.name || null,
    Status: po.status,
    Currency: po.currency,
    TotalAmount: po.totalAmount,
    ExpectedDelivery: po.expectedDelivery,
    ActualDelivery: po.actualDelivery,
    Season: `${po.season}${po.seasonYear}`,
    Lines: lines.map(line => {
      const sku = store.findById(store.skus, line.skuId);
      const product = sku ? store.findById(store.products, sku.productId) : undefined;
      return {
        LineId: line.id,
        SkuId: line.skuId,
        SkuCode: sku?.sku || null,
        ProductName: product?.name || null,
        Colour: sku?.colour || null,
        Size: sku?.size || null,
        QuantityOrdered: line.quantityOrdered,
        QuantityReceived: line.quantityReceived,
        UnitCost: line.unitCost,
        LineTotal: line.lineTotal,
      };
    }),
    CreatedAt: po.createdAt,
    UpdatedAt: po.updatedAt,
  };
}

// ─── HANDLERS ─────────────────────────────────────────

// GET /inbound-orders
export async function listInboundOrdersHandler(
  request: FastifyRequest<{
    Querystring: { warehouseId?: string; status?: string; limit?: string };
  }>,
  reply: FastifyReply,
) {
  const { warehouseId, status, limit: limitStr } = request.query;
  const limit = parseInt(limitStr || '50', 10);

  // Get warehouse location IDs
  const warehouseIds = warehouseId
    ? [warehouseId]
    : store.locations.filter(isWarehouse).map(l => l.id);

  let orders = store.purchaseOrders.filter(
    po => po.deliveryLocationId && warehouseIds.includes(po.deliveryLocationId),
  );

  if (status) {
    orders = orders.filter(po => po.status === status);
  }

  orders = orders.slice(0, limit);

  return reply.send(byOk({
    InboundOrders: orders.map(mapInboundOrder),
    Total: orders.length,
  }));
}

// GET /inbound-orders/:id
export async function getInboundOrderHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const po = store.findById(store.purchaseOrders, request.params.id);
  if (!po) {
    return reply.status(404).send(byError('Inbound order not found', 404));
  }

  const receipts = store.poReceipts.filter(r => {
    const line = store.findById(store.poLines, r.poLineId);
    return line?.purchaseOrderId === po.id;
  });

  return reply.send(byOk({
    ...mapInboundOrder(po),
    Receipts: receipts.map(r => ({
      ReceiptId: r.id,
      PoLineId: r.poLineId,
      QuantityReceived: r.quantityReceived,
      ReceivedAt: r.receivedAt,
      LocationId: r.locationId,
      QualityStatus: r.qualityStatus,
      DamagedQuantity: r.damagedQuantity,
      Notes: r.notes,
    })),
  }));
}

// POST /inbound-orders/:id/receive
export async function receiveInboundOrderHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      lines?: Array<{
        poLineId: string;
        quantityReceived: number;
        qualityStatus?: string;
        damagedQuantity?: number;
        notes?: string;
      }>;
    };
  }>,
  reply: FastifyReply,
) {
  const po = store.findById(store.purchaseOrders, request.params.id);
  if (!po) {
    return reply.status(404).send(byError('Inbound order not found', 404));
  }

  const poLines = store.findByField(store.poLines, 'purchaseOrderId', po.id);
  const receivedLines = request.body?.lines || poLines.map(l => ({
    poLineId: l.id,
    quantityReceived: l.quantityOrdered - l.quantityReceived,
    qualityStatus: 'PASSED',
    damagedQuantity: 0,
  }));

  const receipts: POReceipt[] = [];
  const locationId = po.deliveryLocationId || store.locations.filter(isWarehouse)[0]?.id || '';

  for (const receiveLine of receivedLines) {
    const poLine = store.findById(store.poLines, receiveLine.poLineId);
    if (!poLine || poLine.purchaseOrderId !== po.id) continue;

    const qty = receiveLine.quantityReceived;
    poLine.quantityReceived += qty;
    poLine.updatedAt = now().toISOString();

    const receipt: POReceipt = {
      id: generateId(),
      poLineId: poLine.id,
      quantityReceived: qty,
      receivedAt: now().toISOString(),
      receivedById: store.users[0]?.id || 'system',
      locationId,
      qualityStatus: receiveLine.qualityStatus || 'PASSED',
      damagedQuantity: receiveLine.damagedQuantity || 0,
      notes: ('notes' in receiveLine ? receiveLine.notes : null) || null,
    };
    store.insert(store.poReceipts, receipt);
    receipts.push(receipt);

    // Update stock levels
    const existingStock = store.stockLevels.find(
      sl => sl.skuId === poLine.skuId && sl.locationId === locationId,
    );
    if (existingStock) {
      existingStock.quantityOnHand += qty - (receiveLine.damagedQuantity || 0);
      existingStock.updatedAt = now().toISOString();
    } else {
      store.insert(store.stockLevels, {
        id: generateId(),
        skuId: poLine.skuId,
        locationId,
        quantityOnHand: qty - (receiveLine.damagedQuantity || 0),
        quantityAllocated: 0,
        quantityInTransit: 0,
        quantityOnOrder: 0,
        reorderPoint: null,
        reorderQuantity: null,
        lastCountedAt: null,
        updatedAt: now().toISOString(),
      });
    }
  }

  // Check if all lines fully received
  const allReceived = poLines.every(l => l.quantityReceived >= l.quantityOrdered);
  const anyReceived = poLines.some(l => l.quantityReceived > 0);

  if (allReceived) {
    po.status = 'RECEIVED';
    po.actualDelivery = now().toISOString();
  } else if (anyReceived) {
    po.status = 'PARTIALLY_RECEIVED';
  }
  po.updatedAt = now().toISOString();

  return reply.send(byOk({
    InboundOrderId: po.id,
    PoNumber: po.poNumber,
    Status: po.status,
    Receipts: receipts.map(r => ({
      ReceiptId: r.id,
      PoLineId: r.poLineId,
      QuantityReceived: r.quantityReceived,
      QualityStatus: r.qualityStatus,
      DamagedQuantity: r.damagedQuantity,
    })),
    ReceivedAt: now().toISOString(),
  }));
}

// GET /stock-on-hand
export async function stockOnHandHandler(
  request: FastifyRequest<{
    Querystring: { sku?: string; warehouseId?: string };
  }>,
  reply: FastifyReply,
) {
  const { sku, warehouseId } = request.query;

  // Get warehouse IDs
  const warehouseIds = warehouseId
    ? [warehouseId]
    : store.locations.filter(isWarehouse).map(l => l.id);

  let stockLevels = store.stockLevels.filter(sl => warehouseIds.includes(sl.locationId));

  if (sku) {
    // Match by skuId or sku code
    stockLevels = stockLevels.filter(sl => {
      if (sl.skuId === sku) return true;
      const skuObj = store.findById(store.skus, sl.skuId);
      return skuObj?.sku === sku;
    });
  }

  const result = stockLevels.map(sl => {
    const skuObj = store.findById(store.skus, sl.skuId);
    const product = skuObj ? store.findById(store.products, skuObj.productId) : undefined;
    const location = store.findById(store.locations, sl.locationId);

    return {
      SkuId: sl.skuId,
      SkuCode: skuObj?.sku || null,
      ProductName: product?.name || null,
      Colour: skuObj?.colour || null,
      Size: skuObj?.size || null,
      WarehouseId: sl.locationId,
      WarehouseName: location?.name || null,
      QuantityOnHand: sl.quantityOnHand,
      QuantityAllocated: sl.quantityAllocated,
      QuantityAvailable: sl.quantityOnHand - sl.quantityAllocated,
      QuantityInTransit: sl.quantityInTransit,
      LastCountedAt: sl.lastCountedAt,
      UpdatedAt: sl.updatedAt,
    };
  });

  return reply.send(byOk({
    StockOnHand: result,
    Total: result.length,
  }));
}

// POST /outbound-orders
export async function createOutboundOrderHandler(
  request: FastifyRequest<{
    Body: {
      salesOrderId: string;
      warehouseId?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const { salesOrderId, warehouseId } = request.body;

  const so = store.findById(store.salesOrders, salesOrderId);
  if (!so) {
    return reply.status(404).send(byError('Sales order not found', 404));
  }

  // Determine warehouse
  let whId = warehouseId || so.locationId;
  if (!whId) {
    const warehouses = store.locations.filter(isWarehouse);
    whId = warehouses[0]?.id || store.locations[0]?.id || '';
  }
  const warehouse = store.findById(store.locations, whId);

  const soLines = store.findByField(store.soLines, 'salesOrderId', so.id);

  const outboundId = generateId();
  const outbound: OutboundOrder = {
    OutboundOrderId: outboundId,
    SalesOrderId: so.id,
    SalesOrderNumber: so.soNumber,
    WarehouseId: whId,
    WarehouseName: warehouse?.name || 'Unknown',
    Status: 'CREATED',
    Lines: soLines.map(line => {
      const sku = store.findById(store.skus, line.skuId);
      const product = sku ? store.findById(store.products, sku.productId) : undefined;
      return {
        LineId: generateId(),
        SkuId: line.skuId,
        SkuCode: sku?.sku || '',
        ProductName: product?.name || 'Unknown',
        Colour: sku?.colour || '',
        Size: sku?.size || '',
        QuantityOrdered: line.quantityOrdered,
        QuantityPicked: 0,
        QuantityShipped: 0,
      };
    }),
    CreatedAt: now().toISOString(),
    UpdatedAt: now().toISOString(),
    ShippedAt: null,
    TrackingNumber: null,
    Carrier: null,
  };

  outboundOrders.set(outboundId, outbound);

  // Transition SO to PICKING if it's in ALLOCATED
  if (so.status === 'ALLOCATED' || so.status === 'CONFIRMED') {
    const prev = so.status;
    so.status = 'PICKING';
    so.updatedAt = now().toISOString();
    const entry: SOStatusHistory = {
      id: generateId(),
      salesOrderId: so.id,
      fromStatus: prev,
      toStatus: 'PICKING',
      changedById: store.users[0]?.id || 'system',
      reason: 'Outbound order created in Blue Yonder WMS',
      changedAt: now().toISOString(),
    };
    store.insert(store.soStatusHistory, entry);
  }

  return reply.status(201).send(byOk(outbound));
}

// GET /outbound-orders
export async function listOutboundOrdersHandler(
  request: FastifyRequest<{
    Querystring: { warehouseId?: string; status?: string; limit?: string };
  }>,
  reply: FastifyReply,
) {
  const { warehouseId, status, limit: limitStr } = request.query;
  const limit = parseInt(limitStr || '50', 10);

  let orders = Array.from(outboundOrders.values());

  if (warehouseId) {
    orders = orders.filter(o => o.WarehouseId === warehouseId);
  }
  if (status) {
    orders = orders.filter(o => o.Status === status);
  }

  // Also include IMS SOs in pick/pack/ship states as virtual outbound orders
  const activeStatuses: SOStatus[] = ['PICKING', 'PACKED', 'SHIPPED'];
  let imsOrders = store.salesOrders.filter(so => activeStatuses.includes(so.status));

  if (warehouseId) {
    imsOrders = imsOrders.filter(so => so.locationId === warehouseId);
  }

  // Build virtual outbound orders for IMS SOs not already tracked
  const trackedSoIds = new Set(orders.map(o => o.SalesOrderId));
  for (const so of imsOrders) {
    if (trackedSoIds.has(so.id)) continue;

    const soLines = store.findByField(store.soLines, 'salesOrderId', so.id);
    const wh = so.locationId ? store.findById(store.locations, so.locationId) : null;

    const statusMap: Record<string, OutboundOrder['Status']> = {
      PICKING: 'PICKING',
      PACKED: 'PACKED',
      SHIPPED: 'SHIPPED',
    };

    orders.push({
      OutboundOrderId: `virt-${so.id}`,
      SalesOrderId: so.id,
      SalesOrderNumber: so.soNumber,
      WarehouseId: so.locationId || '',
      WarehouseName: wh?.name || 'Unknown',
      Status: statusMap[so.status] || 'CREATED',
      Lines: soLines.map(line => {
        const sku = store.findById(store.skus, line.skuId);
        const product = sku ? store.findById(store.products, sku.productId) : undefined;
        return {
          LineId: line.id,
          SkuId: line.skuId,
          SkuCode: sku?.sku || '',
          ProductName: product?.name || 'Unknown',
          Colour: sku?.colour || '',
          Size: sku?.size || '',
          QuantityOrdered: line.quantityOrdered,
          QuantityPicked: line.quantityAllocated,
          QuantityShipped: line.quantityShipped,
        };
      }),
      CreatedAt: so.createdAt,
      UpdatedAt: so.updatedAt,
      ShippedAt: so.actualShipDate,
      TrackingNumber: null,
      Carrier: null,
    });
  }

  if (status) {
    orders = orders.filter(o => o.Status === status);
  }

  orders = orders.slice(0, limit);

  return reply.send(byOk({
    OutboundOrders: orders,
    Total: orders.length,
  }));
}

// GET /outbound-orders/:id
export async function getOutboundOrderHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const outbound = outboundOrders.get(request.params.id);
  if (!outbound) {
    return reply.status(404).send(byError('Outbound order not found', 404));
  }
  return reply.send(byOk(outbound));
}

// POST /outbound-orders/:id/ship
export async function shipOutboundOrderHandler(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      trackingNumber?: string;
      carrier?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const outbound = outboundOrders.get(request.params.id);
  if (!outbound) {
    return reply.status(404).send(byError('Outbound order not found', 404));
  }

  if (outbound.Status === 'SHIPPED') {
    return reply.status(400).send(byError('Outbound order already shipped'));
  }

  outbound.Status = 'SHIPPED';
  outbound.ShippedAt = now().toISOString();
  outbound.TrackingNumber = request.body?.trackingNumber || `BY-${Date.now()}`;
  outbound.Carrier = request.body?.carrier || 'Blue Yonder Logistics';
  outbound.UpdatedAt = now().toISOString();

  // Mark all lines as shipped
  for (const line of outbound.Lines) {
    line.QuantityPicked = line.QuantityOrdered;
    line.QuantityShipped = line.QuantityOrdered;
  }

  // Update IMS sales order to SHIPPED
  const so = store.findById(store.salesOrders, outbound.SalesOrderId);
  if (so && so.status !== 'SHIPPED' && so.status !== 'DELIVERED') {
    const prev = so.status;
    so.status = 'SHIPPED';
    so.actualShipDate = now().toISOString();
    so.updatedAt = now().toISOString();

    // Mark SO lines as shipped
    const soLines = store.findByField(store.soLines, 'salesOrderId', so.id);
    for (const line of soLines) {
      line.quantityShipped = line.quantityOrdered;
      line.updatedAt = now().toISOString();
    }

    // Create shipment record
    store.insert(store.shipments, {
      id: generateId(),
      salesOrderId: so.id,
      trackingNumber: outbound.TrackingNumber,
      carrier: outbound.Carrier,
      shippedAt: now().toISOString(),
      deliveredAt: null,
      createdAt: now().toISOString(),
    });

    // Add status history
    const entry: SOStatusHistory = {
      id: generateId(),
      salesOrderId: so.id,
      fromStatus: prev,
      toStatus: 'SHIPPED',
      changedById: store.users[0]?.id || 'system',
      reason: 'Shipped via Blue Yonder WMS',
      changedAt: now().toISOString(),
    };
    store.insert(store.soStatusHistory, entry);
  }

  return reply.send(byOk({
    OutboundOrderId: outbound.OutboundOrderId,
    SalesOrderId: outbound.SalesOrderId,
    Status: outbound.Status,
    TrackingNumber: outbound.TrackingNumber,
    Carrier: outbound.Carrier,
    ShippedAt: outbound.ShippedAt,
  }));
}

// GET /pick-tasks
export async function listPickTasksHandler(
  request: FastifyRequest<{
    Querystring: { warehouseId?: string; status?: string; assignedTo?: string; limit?: string };
  }>,
  reply: FastifyReply,
) {
  const { warehouseId, status, assignedTo, limit: limitStr } = request.query;
  const limit = parseInt(limitStr || '50', 10);

  // Get warehouse IDs
  const warehouseIds = warehouseId
    ? [warehouseId]
    : store.locations.filter(isWarehouse).map(l => l.id);

  // Find SOs in PICKING or ALLOCATED status at warehouses
  const pickableStatuses: SOStatus[] = ['PICKING', 'ALLOCATED'];
  const pickableSOs = store.salesOrders.filter(
    so => pickableStatuses.includes(so.status) && so.locationId && warehouseIds.includes(so.locationId),
  );

  // Seeded RNG for deterministic bin locations and assignments
  function seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  const workerNames = [
    'Erik Svensson', 'Maria Holm', 'Anders Dahl', 'Kristina Berg',
    'Johan Lindberg', 'Anna Forsberg', 'Lars Nyström', 'Sara Ekström',
  ];

  const taskStatuses = ['Assigned', 'InProgress', 'Completed'] as const;
  const priorities = ['HIGH', 'MEDIUM', 'LOW'] as const;

  const pickTasks: Array<Record<string, unknown>> = [];

  for (const so of pickableSOs) {
    const rng = seededRandom(so.id.charCodeAt(0) + so.id.charCodeAt(2) * 256);
    const soLines = store.findByField(store.soLines, 'salesOrderId', so.id);
    const wh = so.locationId ? store.findById(store.locations, so.locationId) : null;

    const taskStatus = so.status === 'PICKING'
      ? taskStatuses[Math.floor(rng() * 2)]  // Assigned or InProgress
      : 'Assigned';

    const worker = workerNames[Math.floor(rng() * workerNames.length)];
    const priority = priorities[Math.floor(rng() * priorities.length)];

    const items = soLines.map(line => {
      const sku = store.findById(store.skus, line.skuId);
      // Generate realistic bin location: Aisle-Bay-Shelf-Position
      const aisle = String.fromCharCode(65 + Math.floor(rng() * 8)); // A-H
      const bay = String(Math.floor(rng() * 12) + 1).padStart(2, '0');
      const shelf = String(Math.floor(rng() * 5) + 1).padStart(2, '0');
      const position = String(Math.floor(rng() * 4) + 1).padStart(2, '0');

      const pickedQty = taskStatus === 'Completed'
        ? line.quantityOrdered
        : taskStatus === 'InProgress'
        ? Math.floor(rng() * (line.quantityOrdered + 1))
        : 0;

      return {
        Sku: sku?.sku || line.skuId,
        Quantity: line.quantityOrdered,
        BinLocation: `${aisle}-${bay}-${shelf}-${position}`,
        PickedQuantity: pickedQty,
      };
    });

    pickTasks.push({
      PickTaskId: `PT-${so.soNumber.replace('SO-', '')}`,
      OrderNumber: so.soNumber,
      WarehouseId: so.locationId,
      WarehouseName: wh?.name || 'Unknown',
      Priority: priority,
      Status: taskStatus,
      Items: items,
      AssignedTo: worker,
      CreatedAt: so.updatedAt,
    });
  }

  // Also generate completed tasks from recently shipped SOs to enrich the dataset
  const shippedSOs = store.salesOrders
    .filter(so => so.status === 'SHIPPED' && so.locationId && warehouseIds.includes(so.locationId))
    .slice(0, 15);

  for (const so of shippedSOs) {
    const rng = seededRandom(so.id.charCodeAt(0) + so.id.charCodeAt(3) * 256);
    const soLines = store.findByField(store.soLines, 'salesOrderId', so.id);
    const wh = so.locationId ? store.findById(store.locations, so.locationId) : null;
    const worker = workerNames[Math.floor(rng() * workerNames.length)];
    const priority = priorities[Math.floor(rng() * priorities.length)];

    const items = soLines.map(line => {
      const sku = store.findById(store.skus, line.skuId);
      const aisle = String.fromCharCode(65 + Math.floor(rng() * 8));
      const bay = String(Math.floor(rng() * 12) + 1).padStart(2, '0');
      const shelf = String(Math.floor(rng() * 5) + 1).padStart(2, '0');
      const position = String(Math.floor(rng() * 4) + 1).padStart(2, '0');
      return {
        Sku: sku?.sku || line.skuId,
        Quantity: line.quantityOrdered,
        BinLocation: `${aisle}-${bay}-${shelf}-${position}`,
        PickedQuantity: line.quantityOrdered,
      };
    });

    pickTasks.push({
      PickTaskId: `PT-${so.soNumber.replace('SO-', '')}`,
      OrderNumber: so.soNumber,
      WarehouseId: so.locationId,
      WarehouseName: wh?.name || 'Unknown',
      Priority: priority,
      Status: 'Completed',
      Items: items,
      AssignedTo: worker,
      CreatedAt: so.createdAt,
    });
  }

  // Apply filters
  let result = pickTasks;
  if (status) {
    result = result.filter(t => t.Status === status);
  }
  if (assignedTo) {
    result = result.filter(t => String(t.AssignedTo).toLowerCase().includes(assignedTo.toLowerCase()));
  }

  result = result.slice(0, limit);

  return reply.send(byOk({
    PickTasks: result,
    Total: result.length,
  }));
}

// GET /warehouses
export async function listWarehousesHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const warehouses = store.locations.filter(isWarehouse);

  const result = warehouses.map(wh => {
    // Count stock at this warehouse
    const stockAtWarehouse = store.stockLevels.filter(sl => sl.locationId === wh.id);
    const totalOnHand = stockAtWarehouse.reduce((sum, sl) => sum + sl.quantityOnHand, 0);
    const totalAllocated = stockAtWarehouse.reduce((sum, sl) => sum + sl.quantityAllocated, 0);
    const skuCount = new Set(stockAtWarehouse.map(sl => sl.skuId)).size;

    return {
      WarehouseId: wh.id,
      Name: wh.name,
      Type: wh.type,
      Address: wh.address,
      City: wh.city,
      Country: wh.country,
      CountryCode: wh.countryCode,
      Region: wh.region,
      Timezone: wh.timezone,
      IsActive: wh.isActive,
      TotalSkus: skuCount,
      TotalOnHand: totalOnHand,
      TotalAllocated: totalAllocated,
      TotalAvailable: totalOnHand - totalAllocated,
    };
  });

  return reply.send(byOk({
    Warehouses: result,
    Total: result.length,
  }));
}
