import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { generateId } from '../../utils/id.js';
import { now, daysAgo } from '../../utils/date.js';

// ─── In-memory state ────────────────────────────────────

interface StockCountItem {
  gtin: string;
  epc: string;
  quantity: number;
}

interface StockCountResult {
  id: string;
  locationId: string;
  countedAt: string;
  status: 'COMPLETED' | 'IN_PROGRESS';
  totalItems: number;
  matchedItems: number;
  discrepancies: number;
  accuracyPercent: number;
  items: Array<StockCountItem & { expected: number; variance: number; status: 'MATCH' | 'OVER' | 'SHORT' }>;
  createdAt: string;
}

const stockCounts: StockCountResult[] = [];
let stockCountsSeeded = false;

function seedStockCounts(): void {
  if (stockCountsSeeded) return;
  stockCountsSeeded = true;

  // Pick RFID-enabled store locations
  const storeLocations = store.locations.filter(l => l.type === 'STORE' && l.isActive);
  if (storeLocations.length === 0) return;

  // Create 12 stock counts — one per store per week for the past 2 weeks, with 40-60 items each
  const countConfigs = [
    // Week 1 (recent) — 6 stores
    { locationIdx: 0, daysBack: 1,  itemCount: 52, accuracyTarget: 97.1 },
    { locationIdx: 1, daysBack: 2,  itemCount: 48, accuracyTarget: 96.4 },
    { locationIdx: 2, daysBack: 2,  itemCount: 55, accuracyTarget: 98.5 },
    { locationIdx: 3, daysBack: 3,  itemCount: 45, accuracyTarget: 95.8 },
    { locationIdx: 4, daysBack: 4,  itemCount: 60, accuracyTarget: 97.3 },
    { locationIdx: 5, daysBack: 5,  itemCount: 50, accuracyTarget: 94.6 },
    // Week 2 (previous) — same 6 stores
    { locationIdx: 0, daysBack: 8,  itemCount: 50, accuracyTarget: 95.0 },
    { locationIdx: 1, daysBack: 9,  itemCount: 43, accuracyTarget: 96.8 },
    { locationIdx: 2, daysBack: 9,  itemCount: 58, accuracyTarget: 99.0 },
    { locationIdx: 3, daysBack: 10, itemCount: 46, accuracyTarget: 94.3 },
    { locationIdx: 4, daysBack: 11, itemCount: 54, accuracyTarget: 97.5 },
    { locationIdx: 5, daysBack: 13, itemCount: 40, accuracyTarget: 98.2 },
  ];

  for (const cfg of countConfigs) {
    const location = storeLocations[cfg.locationIdx % storeLocations.length];
    const stockLevels = store.stockLevels.filter(
      sl => sl.locationId === location.id && sl.quantityOnHand > 0,
    );
    if (stockLevels.length === 0) continue;

    const resultItems: StockCountResult['items'] = [];
    let matchedItems = 0;
    let discrepancies = 0;
    let totalItems = 0;

    // Pick up to itemCount stock-level entries for this count
    const selected = stockLevels.slice(0, cfg.itemCount);

    for (const sl of selected) {
      const sku = store.findById(store.skus, sl.skuId);
      if (!sku || !sku.barcode) continue;

      const expected = sl.quantityOnHand;
      // Introduce 2-5% discrepancy rate among items
      const shouldDiscrepancy = Math.random() < 0.04; // ~4% of items get a discrepancy
      let counted = expected;
      let variance = 0;

      if (shouldDiscrepancy) {
        // Random variance of +/-1 or +/-2
        const delta = (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 2) + 1);
        counted = Math.max(0, expected + delta);
        variance = counted - expected;
      }

      totalItems += counted;
      const status = variance === 0 ? 'MATCH' as const : variance > 0 ? 'OVER' as const : 'SHORT' as const;
      if (status === 'MATCH') matchedItems++;
      else discrepancies++;

      const serial = `${sku.id.slice(0, 4)}0000`;
      resultItems.push({
        gtin: sku.barcode!,
        epc: buildEpc(sku.barcode!, serial),
        quantity: counted,
        expected,
        variance,
        status,
      });
    }

    // Compute accuracy — use target as guide but base it on actual data
    const computedAccuracy = (matchedItems + discrepancies) > 0
      ? Math.round((matchedItems / (matchedItems + discrepancies)) * 10000) / 100
      : 100;

    const countedAt = daysAgo(cfg.daysBack);

    const result: StockCountResult = {
      id: generateId(),
      locationId: location.id,
      countedAt: countedAt.toISOString(),
      status: 'COMPLETED',
      totalItems,
      matchedItems,
      discrepancies,
      accuracyPercent: computedAccuracy,
      items: resultItems,
      createdAt: countedAt.toISOString(),
    };

    stockCounts.push(result);
  }
}

// ─── Helpers ────────────────────────────────────────────

function nedapPaginate<T>(items: T[], offset: number, limit: number) {
  const total = items.length;
  const data = items.slice(offset, offset + limit);
  return { data, pagination: { offset, limit, total } };
}

function buildEpc(barcode: string, serial: string): string {
  // product_ref from barcode (last 7 digits), serial from id
  const productRef = barcode.slice(-7).padStart(7, '0');
  const ser = serial.slice(0, 6).replace(/[^0-9]/g, '0').padStart(6, '0');
  return `urn:epc:tag:sgtin-96:1.0614141.${productRef}.${ser}`;
}

// ─── GET /articles ──────────────────────────────────────

export async function listArticles(
  request: FastifyRequest<{ Querystring: { gtin?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const { gtin, limit: limitStr } = request.query;
  const offset = Math.max(0, parseInt((request.query as any).offset || '0', 10));
  const limit = Math.min(5000, Math.max(1, parseInt(limitStr || '200', 10)));

  let skus = store.skus.filter(s => s.barcode);

  if (gtin) {
    skus = skus.filter(s => s.barcode === gtin);
  }

  const articles = skus.map(sku => {
    const product = store.findById(store.products, sku.productId);
    return {
      gtin: sku.barcode,
      sku: sku.sku,
      styleName: product?.name ?? null,
      styleNumber: product?.styleNumber ?? null,
      colour: sku.colour,
      colourCode: sku.colourCode,
      size: sku.size,
      category: product?.category ?? null,
      season: product ? `${product.season}${product.seasonYear}` : null,
      epc: buildEpc(sku.barcode!, sku.id),
      rfidTag: sku.rfidTag,
      isActive: sku.isActive,
    };
  });

  return reply.send(nedapPaginate(articles, offset, limit));
}

// ─── GET /articles/:gtin ────────────────────────────────

export async function getArticle(
  request: FastifyRequest<{ Params: { gtin: string } }>,
  reply: FastifyReply,
) {
  const sku = store.skus.find(s => s.barcode === request.params.gtin);
  if (!sku) {
    return reply.status(404).send({ error: 'Article not found', gtin: request.params.gtin });
  }

  const product = store.findById(store.products, sku.productId);
  return reply.send({
    data: {
      gtin: sku.barcode,
      sku: sku.sku,
      styleName: product?.name ?? null,
      styleNumber: product?.styleNumber ?? null,
      colour: sku.colour,
      colourCode: sku.colourCode,
      size: sku.size,
      category: product?.category ?? null,
      season: product ? `${product.season}${product.seasonYear}` : null,
      epc: buildEpc(sku.barcode!, sku.id),
      rfidTag: sku.rfidTag,
      retailPrice: sku.retailPrice,
      wholesalePrice: sku.wholesalePrice,
      priceCurrency: sku.priceCurrency,
      isActive: sku.isActive,
    },
  });
}

// ─── GET /epc-observations ──────────────────────────────

export async function listEpcObservations(
  request: FastifyRequest<{ Querystring: { locationId?: string; since?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  const { locationId, since, limit: limitStr } = request.query;
  const offset = Math.max(0, parseInt((request.query as any).offset || '0', 10));
  const limit = Math.min(5000, Math.max(1, parseInt(limitStr || '1000', 10)));

  // Generate observations from stock levels + SKU rfid tags
  let stockLevels = store.stockLevels.filter(sl => sl.quantityOnHand > 0);

  if (locationId) {
    stockLevels = stockLevels.filter(sl => sl.locationId === locationId);
  }

  const observations: Array<{
    epc: string;
    gtin: string;
    rfidTag: string | null;
    locationId: string;
    locationName: string;
    zone: string;
    timestamp: string;
    readCount: number;
  }> = [];

  const zones = ['SALES_FLOOR', 'STOCKROOM', 'FITTING_ROOM', 'WINDOW_DISPLAY', 'SALES_FLOOR', 'STOCKROOM'];

  for (const sl of stockLevels) {
    const sku = store.findById(store.skus, sl.skuId);
    if (!sku || !sku.barcode) continue;
    const location = store.findById(store.locations, sl.locationId);
    if (!location) continue;

    // Generate one observation per unit on hand (up to 5 per SKU for richer data)
    const count = Math.min(sl.quantityOnHand, 5);
    for (let i = 0; i < count; i++) {
      const serial = `${sku.id.slice(0, 4)}${String(i).padStart(4, '0')}`;
      const obsTime = daysAgo(Math.random() * 7);
      if (since && obsTime.toISOString() < since) continue;

      observations.push({
        epc: buildEpc(sku.barcode!, serial),
        gtin: sku.barcode!,
        rfidTag: sku.rfidTag,
        locationId: sl.locationId,
        locationName: location.name,
        zone: zones[Math.floor(Math.random() * zones.length)],
        timestamp: obsTime.toISOString(),
        readCount: Math.floor(Math.random() * 20) + 1,
      });
    }
  }

  // Sort by timestamp desc
  observations.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return reply.send(nedapPaginate(observations, offset, limit));
}

// ─── POST /stock-counts ─────────────────────────────────

export async function submitStockCount(
  request: FastifyRequest<{
    Body: {
      locationId: string;
      countedAt: string;
      items: Array<{ gtin: string; epc: string; quantity: number }>;
    };
  }>,
  reply: FastifyReply,
) {
  const { locationId, countedAt, items } = request.body;

  const location = store.findById(store.locations, locationId);
  if (!location) {
    return reply.status(404).send({ error: 'Location not found', locationId });
  }

  const resultItems: StockCountResult['items'] = [];
  let matchedItems = 0;
  let discrepancies = 0;
  let totalItems = 0;

  for (const item of items) {
    // Find expected stock at this location for the given GTIN
    const sku = store.skus.find(s => s.barcode === item.gtin);
    if (!sku) {
      resultItems.push({
        ...item,
        expected: 0,
        variance: item.quantity,
        status: 'OVER',
      });
      discrepancies++;
      totalItems += item.quantity;
      continue;
    }

    const stockLevel = store.stockLevels.find(
      sl => sl.skuId === sku.id && sl.locationId === locationId,
    );
    const expected = stockLevel ? stockLevel.quantityOnHand : 0;
    const variance = item.quantity - expected;
    totalItems += item.quantity;

    // Introduce deliberate 2-5% discrepancy for realism
    const discrepancyThreshold = 0.02 + Math.random() * 0.03; // 2-5%
    const hasDiscrepancy = Math.random() < discrepancyThreshold || variance !== 0;
    const adjustedVariance = hasDiscrepancy && variance === 0
      ? (Math.random() > 0.5 ? 1 : -1) * (Math.floor(Math.random() * 2) + 1)
      : variance;

    const status = adjustedVariance === 0 ? 'MATCH' : adjustedVariance > 0 ? 'OVER' : 'SHORT';

    if (status === 'MATCH') {
      matchedItems++;
    } else {
      discrepancies++;

      // Create RFID_RECONCILIATION movement in IMS
      if (stockLevel && adjustedVariance !== 0) {
        store.stockMovements.push({
          id: generateId(),
          skuId: sku.id,
          type: 'RFID_RECONCILIATION',
          quantity: adjustedVariance,
          fromLocationId: adjustedVariance < 0 ? locationId : null,
          toLocationId: adjustedVariance > 0 ? locationId : null,
          referenceType: 'STOCK_COUNT',
          referenceId: null, // will be set after we have the count ID
          reason: `RFID stock count discrepancy: counted ${item.quantity}, expected ${expected}, variance ${adjustedVariance}`,
          performedById: store.users[0].id,
          performedAt: now().toISOString(),
        });
      }
    }

    resultItems.push({
      ...item,
      expected,
      variance: adjustedVariance,
      status,
    });
  }

  const accuracyPercent = totalItems > 0
    ? Math.round((matchedItems / (matchedItems + discrepancies)) * 10000) / 100
    : 100;

  const countId = generateId();

  // Update referenceId on movements we just created
  const recentMovements = store.stockMovements.filter(
    m => m.type === 'RFID_RECONCILIATION' && m.referenceId === null,
  );
  for (const m of recentMovements) {
    m.referenceId = countId;
  }

  const result: StockCountResult = {
    id: countId,
    locationId,
    countedAt: countedAt || now().toISOString(),
    status: 'COMPLETED',
    totalItems,
    matchedItems,
    discrepancies,
    accuracyPercent,
    items: resultItems,
    createdAt: now().toISOString(),
  };

  stockCounts.push(result);

  return reply.status(201).send({ data: result });
}

// ─── GET /stock-counts ──────────────────────────────────

export async function listStockCounts(
  request: FastifyRequest<{ Querystring: { locationId?: string; limit?: string } }>,
  reply: FastifyReply,
) {
  seedStockCounts();
  const { locationId, limit: limitStr } = request.query;
  const limit = Math.min(100, Math.max(1, parseInt(limitStr || '50', 10)));

  let counts = [...stockCounts];

  if (locationId) {
    counts = counts.filter(c => c.locationId === locationId);
  }

  counts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const summaries = counts.map(({ items: _items, ...rest }) => rest);

  return reply.send(nedapPaginate(summaries, 0, limit));
}

// ─── GET /stock-counts/:id ──────────────────────────────

export async function getStockCount(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  seedStockCounts();
  const count = stockCounts.find(c => c.id === request.params.id);
  if (!count) {
    return reply.status(404).send({ error: 'Stock count not found' });
  }

  return reply.send({ data: count });
}

// ─── GET /stock-accuracy ────────────────────────────────

export async function getStockAccuracy(
  request: FastifyRequest<{ Querystring: { locationId?: string } }>,
  reply: FastifyReply,
) {
  seedStockCounts();
  const { locationId } = request.query;

  // Calculate accuracy from existing stock counts, or generate from stock data
  const storeLocations = store.locations.filter(l => l.type === 'STORE');
  const targetLocations = locationId
    ? storeLocations.filter(l => l.id === locationId)
    : storeLocations;

  const accuracyData = targetLocations.map(location => {
    const locationCounts = stockCounts.filter(c => c.locationId === location.id);

    if (locationCounts.length > 0) {
      const latest = locationCounts[locationCounts.length - 1];
      return {
        locationId: location.id,
        locationName: location.name,
        accuracyPercent: latest.accuracyPercent,
        totalItems: latest.totalItems,
        matchedItems: latest.matchedItems,
        discrepancies: latest.discrepancies,
        lastCountAt: latest.countedAt,
      };
    }

    // Generate realistic accuracy from stock levels
    const stockLevels = store.stockLevels.filter(sl => sl.locationId === location.id);
    const totalItems = stockLevels.reduce((sum, sl) => sum + sl.quantityOnHand, 0);
    const discrepancyRate = 0.02 + Math.random() * 0.03; // 2-5%
    const discrepancies = Math.max(1, Math.round(totalItems * discrepancyRate));
    const matchedItems = totalItems - discrepancies;
    const accuracyPercent = totalItems > 0
      ? Math.round((matchedItems / totalItems) * 10000) / 100
      : 100;

    return {
      locationId: location.id,
      locationName: location.name,
      accuracyPercent,
      totalItems,
      matchedItems,
      discrepancies,
      lastCountAt: daysAgo(Math.floor(Math.random() * 7) + 1).toISOString(),
    };
  });

  return reply.send({ data: accuracyData, pagination: { offset: 0, limit: accuracyData.length, total: accuracyData.length } });
}

// ─── GET /locations ─────────────────────────────────────

export async function listLocations(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const storeLocations = store.locations
    .filter(l => l.type === 'STORE' && l.isActive)
    .map(l => ({
      id: l.id,
      name: l.name,
      type: 'RFID_ENABLED_STORE',
      address: l.address,
      city: l.city,
      country: l.country,
      countryCode: l.countryCode,
      region: l.region,
      timezone: l.timezone,
      rfidEnabled: true,
      zoneCount: Math.floor(Math.random() * 3) + 3,
      readerCount: Math.floor(Math.random() * 8) + 4,
      lastSyncAt: daysAgo(Math.random() * 0.5).toISOString(),
    }));

  return reply.send(nedapPaginate(storeLocations, 0, storeLocations.length));
}
