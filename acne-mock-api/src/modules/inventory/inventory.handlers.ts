import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { paginate, parsePagination } from '../../utils/pagination.js';
import { filterItems } from '../../utils/filter.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';
import type { StockMovementType } from '../../store/types.js';

// ─── GET /inventory/availability ────────────────────────

export async function checkAvailability(
  request: FastifyRequest<{
    Querystring: {
      skuId?: string;
      locationId?: string;
      region?: string;
    };
  }>,
  reply: FastifyReply
) {
  const { skuId, locationId, region } = request.query;

  let levels = store.stockLevels;

  if (skuId) {
    levels = levels.filter(sl => sl.skuId === skuId);
  }

  if (locationId) {
    levels = levels.filter(sl => sl.locationId === locationId);
  }

  if (region) {
    const regionLocationIds = store.locations
      .filter(l => l.region.toLowerCase() === region.toLowerCase())
      .map(l => l.id);
    levels = levels.filter(sl => regionLocationIds.includes(sl.locationId));
  }

  const data = levels.map(sl => {
    const location = store.findById(store.locations, sl.locationId);
    const available = sl.quantityOnHand - sl.quantityAllocated + sl.quantityInTransit;

    return {
      skuId: sl.skuId,
      locationId: sl.locationId,
      locationName: location?.name ?? 'Unknown',
      region: location?.region ?? 'Unknown',
      quantityOnHand: sl.quantityOnHand,
      quantityAllocated: sl.quantityAllocated,
      quantityInTransit: sl.quantityInTransit,
      available: Math.max(0, available),
    };
  });

  return reply.send({ data });
}

// ─── GET /inventory/levels ──────────────────────────────

export async function listStockLevels(
  request: FastifyRequest<{
    Querystring: {
      skuId?: string;
      locationId?: string;
      belowReorderPoint?: boolean;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { skuId, locationId, belowReorderPoint } = request.query;

  let levels = store.stockLevels;

  levels = filterItems(levels, {
    ...(skuId && { skuId }),
    ...(locationId && { locationId }),
  });

  if (belowReorderPoint === true) {
    levels = levels.filter(
      sl => sl.reorderPoint !== null && sl.quantityOnHand <= sl.reorderPoint
    );
  }

  const pagination = parsePagination(request.query);
  return reply.send(paginate(levels, pagination));
}

// ─── POST /inventory/transfer ───────────────────────────

export async function transferStock(
  request: FastifyRequest<{
    Body: {
      skuId: string;
      fromLocationId: string;
      toLocationId: string;
      quantity: number;
      reason?: string;
    };
  }>,
  reply: FastifyReply
) {
  const { skuId, fromLocationId, toLocationId, quantity, reason } = request.body;

  // Validate locations exist
  const fromLocation = store.findById(store.locations, fromLocationId);
  if (!fromLocation) {
    return reply.status(404).send({ error: 'Source location not found' });
  }

  const toLocation = store.findById(store.locations, toLocationId);
  if (!toLocation) {
    return reply.status(404).send({ error: 'Destination location not found' });
  }

  if (fromLocationId === toLocationId) {
    return reply.status(400).send({ error: 'Source and destination locations must be different' });
  }

  // Find or validate source stock level
  const sourceLevel = store.stockLevels.find(
    sl => sl.skuId === skuId && sl.locationId === fromLocationId
  );

  if (!sourceLevel) {
    return reply.status(404).send({ error: 'No stock record found for SKU at source location' });
  }

  if (sourceLevel.quantityOnHand < quantity) {
    return reply.status(400).send({
      error: 'Insufficient stock',
      available: sourceLevel.quantityOnHand,
      requested: quantity,
    });
  }

  // Find or create destination stock level
  let destLevel = store.stockLevels.find(
    sl => sl.skuId === skuId && sl.locationId === toLocationId
  );

  if (!destLevel) {
    destLevel = {
      id: generateId(),
      skuId,
      locationId: toLocationId,
      quantityOnHand: 0,
      quantityAllocated: 0,
      quantityInTransit: 0,
      quantityOnOrder: 0,
      reorderPoint: null,
      reorderQuantity: null,
      lastCountedAt: null,
      updatedAt: now().toISOString(),
    };
    store.insert(store.stockLevels, destLevel);
  }

  const timestamp = now().toISOString();
  const performedById = request.currentUser?.userId ?? 'system';

  // Decrease quantity at source
  store.update(store.stockLevels, sourceLevel.id, {
    quantityOnHand: sourceLevel.quantityOnHand - quantity,
    updatedAt: timestamp,
  });

  // Increase in-transit at destination
  store.update(store.stockLevels, destLevel.id, {
    quantityInTransit: destLevel.quantityInTransit + quantity,
    updatedAt: timestamp,
  });

  // Create TRANSFER_OUT movement
  const transferOutMovement = {
    id: generateId(),
    skuId,
    type: 'TRANSFER_OUT' as StockMovementType,
    quantity,
    fromLocationId,
    toLocationId,
    referenceType: 'TRANSFER',
    referenceId: null,
    reason: reason ?? null,
    performedById,
    performedAt: timestamp,
  };
  store.insert(store.stockMovements, transferOutMovement);

  // Create TRANSFER_IN movement
  const transferInMovement = {
    id: generateId(),
    skuId,
    type: 'TRANSFER_IN' as StockMovementType,
    quantity,
    fromLocationId,
    toLocationId,
    referenceType: 'TRANSFER',
    referenceId: null,
    reason: reason ?? null,
    performedById,
    performedAt: timestamp,
  };
  store.insert(store.stockMovements, transferInMovement);

  return reply.send({
    status: 'ok',
    transfer: {
      skuId,
      fromLocationId,
      toLocationId,
      quantity,
      movements: [transferOutMovement, transferInMovement],
    },
  });
}

// ─── POST /inventory/adjust ─────────────────────────────

export async function adjustStock(
  request: FastifyRequest<{
    Body: {
      skuId: string;
      locationId: string;
      quantity: number;
      reason: string;
    };
  }>,
  reply: FastifyReply
) {
  const { skuId, locationId, quantity, reason } = request.body;

  if (quantity === 0) {
    return reply.status(400).send({ error: 'Adjustment quantity must be non-zero' });
  }

  // Find existing stock level
  let stockLevel = store.stockLevels.find(
    sl => sl.skuId === skuId && sl.locationId === locationId
  );

  if (!stockLevel) {
    // Create new stock level record if it does not exist
    stockLevel = {
      id: generateId(),
      skuId,
      locationId,
      quantityOnHand: 0,
      quantityAllocated: 0,
      quantityInTransit: 0,
      quantityOnOrder: 0,
      reorderPoint: null,
      reorderQuantity: null,
      lastCountedAt: null,
      updatedAt: now().toISOString(),
    };
    store.insert(store.stockLevels, stockLevel);
  }

  const newQuantityOnHand = stockLevel.quantityOnHand + quantity;
  if (newQuantityOnHand < 0) {
    return reply.status(400).send({
      error: 'Adjustment would result in negative on-hand quantity',
      currentOnHand: stockLevel.quantityOnHand,
      adjustment: quantity,
    });
  }

  const timestamp = now().toISOString();
  const performedById = request.currentUser?.userId ?? 'system';

  const movementType: StockMovementType =
    quantity > 0 ? 'ADJUSTMENT_POSITIVE' : 'ADJUSTMENT_NEGATIVE';

  // Update stock level
  const updatedLevel = store.update(store.stockLevels, stockLevel.id, {
    quantityOnHand: newQuantityOnHand,
    updatedAt: timestamp,
  });

  // Create movement record
  const movement = {
    id: generateId(),
    skuId,
    type: movementType,
    quantity: Math.abs(quantity),
    fromLocationId: quantity < 0 ? locationId : null,
    toLocationId: quantity > 0 ? locationId : null,
    referenceType: 'ADJUSTMENT',
    referenceId: null,
    reason,
    performedById,
    performedAt: timestamp,
  };
  store.insert(store.stockMovements, movement);

  return reply.send({
    status: 'ok',
    stockLevel: updatedLevel,
    movement,
  });
}

// ─── POST /inventory/reconcile ──────────────────────────

export async function reconcileStock(
  request: FastifyRequest<{
    Body: {
      locationId: string;
      counts: Array<{ skuId: string; countedQuantity: number }>;
    };
  }>,
  reply: FastifyReply
) {
  const { locationId, counts } = request.body;

  const location = store.findById(store.locations, locationId);
  if (!location) {
    return reply.status(404).send({ error: 'Location not found' });
  }

  const timestamp = now().toISOString();
  const performedById = request.currentUser?.userId ?? 'system';
  let discrepancyCount = 0;

  const results = counts.map(({ skuId, countedQuantity }) => {
    let stockLevel = store.stockLevels.find(
      sl => sl.skuId === skuId && sl.locationId === locationId
    );

    const systemQuantity = stockLevel?.quantityOnHand ?? 0;
    const difference = countedQuantity - systemQuantity;
    const hasDiscrepancy = difference !== 0;

    if (hasDiscrepancy) {
      discrepancyCount++;
    }

    let movementId: string | null = null;

    // Create or update stock level and record movement if discrepancy found
    if (!stockLevel) {
      stockLevel = {
        id: generateId(),
        skuId,
        locationId,
        quantityOnHand: countedQuantity,
        quantityAllocated: 0,
        quantityInTransit: 0,
        quantityOnOrder: 0,
        reorderPoint: null,
        reorderQuantity: null,
        lastCountedAt: timestamp,
        updatedAt: timestamp,
      };
      store.insert(store.stockLevels, stockLevel);

      if (hasDiscrepancy) {
        const movement = {
          id: generateId(),
          skuId,
          type: 'RFID_RECONCILIATION' as StockMovementType,
          quantity: Math.abs(difference),
          fromLocationId: difference < 0 ? locationId : null,
          toLocationId: difference > 0 ? locationId : null,
          referenceType: 'RFID_RECONCILIATION',
          referenceId: null,
          reason: `RFID count reconciliation: system=${systemQuantity}, counted=${countedQuantity}, diff=${difference}`,
          performedById,
          performedAt: timestamp,
        };
        store.insert(store.stockMovements, movement);
        movementId = movement.id;
      }
    } else {
      store.update(store.stockLevels, stockLevel.id, {
        quantityOnHand: countedQuantity,
        lastCountedAt: timestamp,
        updatedAt: timestamp,
      });

      if (hasDiscrepancy) {
        const movement = {
          id: generateId(),
          skuId,
          type: 'RFID_RECONCILIATION' as StockMovementType,
          quantity: Math.abs(difference),
          fromLocationId: difference < 0 ? locationId : null,
          toLocationId: difference > 0 ? locationId : null,
          referenceType: 'RFID_RECONCILIATION',
          referenceId: null,
          reason: `RFID count reconciliation: system=${systemQuantity}, counted=${countedQuantity}, diff=${difference}`,
          performedById,
          performedAt: timestamp,
        };
        store.insert(store.stockMovements, movement);
        movementId = movement.id;
      }
    }

    return {
      skuId,
      systemQuantity,
      countedQuantity,
      difference,
      hasDiscrepancy,
      movementId,
    };
  });

  return reply.send({
    status: 'ok',
    locationId,
    totalCounted: counts.length,
    discrepancies: discrepancyCount,
    results,
  });
}

// ─── GET /inventory/movements ───────────────────────────

export async function listMovements(
  request: FastifyRequest<{
    Querystring: {
      skuId?: string;
      type?: string;
      fromLocationId?: string;
      toLocationId?: string;
      referenceType?: string;
      referenceId?: string;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { skuId, type, fromLocationId, toLocationId, referenceType, referenceId } = request.query;

  let movements = store.stockMovements;

  movements = filterItems(movements, {
    ...(skuId && { skuId }),
    ...(type && { type }),
    ...(fromLocationId && { fromLocationId }),
    ...(toLocationId && { toLocationId }),
    ...(referenceType && { referenceType }),
    ...(referenceId && { referenceId }),
  });

  // Sort by most recent first
  movements = [...movements].sort(
    (a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
  );

  const pagination = parsePagination(request.query);
  return reply.send(paginate(movements, pagination));
}

// ─── GET /inventory/alerts ──────────────────────────────

export async function listAlerts(
  request: FastifyRequest<{
    Querystring: {
      locationId?: string;
      skuId?: string;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { locationId, skuId } = request.query;

  let alerts = store.stockLevels.filter(
    sl => sl.reorderPoint !== null && sl.quantityOnHand <= sl.reorderPoint
  );

  if (locationId) {
    alerts = alerts.filter(sl => sl.locationId === locationId);
  }

  if (skuId) {
    alerts = alerts.filter(sl => sl.skuId === skuId);
  }

  const data = alerts.map(sl => ({
    ...sl,
    alertType: sl.quantityOnHand === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
    deficit: (sl.reorderPoint ?? 0) - sl.quantityOnHand,
  }));

  const pagination = parsePagination(request.query);
  return reply.send(paginate(data, pagination));
}
