import type { Store } from '../Store.js';
import type { SOPOMatch, MatchingRun, MatchStatus } from '../types.js';
import { generateId } from '../../utils/id.js';
import { daysAgo, daysFromNow, now } from '../../utils/date.js';

export function seedMatching(store: Store): void {
  const ts = now().toISOString();
  const plannerUser = store.users.find(u => u.role === 'PLANNER')!;
  const buyerUser = store.users.find(u => u.role === 'BUYER')!;

  // Get all SO lines and PO lines for matching
  const soLines = store.soLines;
  const poLines = store.poLines;
  const salesOrders = store.salesOrders;
  const purchaseOrders = store.purchaseOrders;
  const locations = store.locations;

  if (soLines.length === 0 || poLines.length === 0) return;

  // Build matches that make business sense — try to match same SKU where possible
  const skuToSOLines = new Map<string, typeof soLines>();
  const skuToPOLines = new Map<string, typeof poLines>();

  for (const sl of soLines) {
    const arr = skuToSOLines.get(sl.skuId) || [];
    arr.push(sl);
    skuToSOLines.set(sl.skuId, arr);
  }
  for (const pl of poLines) {
    const arr = skuToPOLines.get(pl.skuId) || [];
    arr.push(pl);
    skuToPOLines.set(pl.skuId, arr);
  }

  // ── CONFIRMED matches (20) — high-quality, human-reviewed ──────
  let matchCount = 0;
  for (const [skuId, soLinesForSku] of skuToSOLines) {
    if (matchCount >= 20) break;
    const poLinesForSku = skuToPOLines.get(skuId);
    if (!poLinesForSku || poLinesForSku.length === 0) continue;

    for (const soLine of soLinesForSku) {
      if (matchCount >= 20) break;
      const poLine = poLinesForSku[matchCount % poLinesForSku.length];
      const so = salesOrders.find(s => s.id === soLine.salesOrderId)!;
      const po = purchaseOrders.find(p => p.id === poLine.purchaseOrderId)!;
      if (!so || !po) continue;

      const soLoc = locations.find(l => l.id === so.locationId);
      const poLoc = locations.find(l => l.id === po.deliveryLocationId);

      // Score factors based on actual data
      const skuMatch = 1.0; // Same SKU
      const timingScore = computeTimingScore(po.expectedDelivery, so.requestedShipDate);
      const locationScore = computeLocationScore(soLoc?.region, poLoc?.region, soLoc?.id === poLoc?.id);
      const qtyScore = poLine.quantityOrdered >= soLine.quantityOrdered ? 1.0 : soLine.quantityOrdered > 0 ? poLine.quantityOrdered / soLine.quantityOrdered : 0;
      const channelScore = getChannelScore(so.channel, so.priority);
      const seasonScore = po.season === 'AW' && so.createdAt > daysAgo(180).toISOString() ? 1.0 : 0.5;
      const supplierScore = 0.80 + Math.random() * 0.18;
      const marginScore = so.channel === 'WHOLESALE' ? 0.6 : 0.85;

      const totalScore = 0.30 * skuMatch + 0.25 * timingScore + 0.15 * locationScore + 0.10 * qtyScore + 0.08 * channelScore + 0.05 * seasonScore + 0.04 * supplierScore + 0.03 * marginScore;

      store.sopoMatches.push({
        id: generateId(),
        salesOrderId: so.id,
        salesOrderLineId: soLine.id,
        purchaseOrderId: po.id,
        purchaseOrderLineId: poLine.id,
        skuId,
        quantityMatched: Math.min(soLine.quantityOrdered, poLine.quantityOrdered - poLine.quantityReceived + 5),
        matchScore: Math.round(totalScore * 100) / 100,
        matchFactors: {
          skuExactMatch: round(skuMatch),
          timingAlignment: round(timingScore),
          locationProximity: round(locationScore),
          quantityFit: round(qtyScore),
          channelPriority: round(channelScore),
          seasonAlignment: round(seasonScore),
          supplierReliability: round(supplierScore),
          marginContribution: round(marginScore),
        },
        status: 'CONFIRMED',
        proposedBy: 'AI_MODEL',
        confirmedById: matchCount % 3 === 0 ? plannerUser.id : buyerUser.id,
        confirmedAt: daysAgo(2 + Math.floor(Math.random() * 8)).toISOString(),
        rejectedReason: null,
        expectedFulfillDate: daysFromNow(7 + Math.floor(Math.random() * 30)).toISOString(),
        createdAt: daysAgo(5 + Math.floor(Math.random() * 15)).toISOString(),
        updatedAt: daysAgo(1 + Math.floor(Math.random() * 5)).toISOString(),
      });
      matchCount++;
    }
  }

  // ── AUTO_CONFIRMED matches (10) — score ≥ 0.85 ────────
  let autoCount = 0;
  for (const soLine of soLines) {
    if (autoCount >= 10) break;
    const poLinesForSku = skuToPOLines.get(soLine.skuId);
    if (!poLinesForSku) continue;

    const poLine = poLinesForSku[autoCount % poLinesForSku.length];
    const so = salesOrders.find(s => s.id === soLine.salesOrderId)!;
    const po = purchaseOrders.find(p => p.id === poLine.purchaseOrderId)!;
    if (!so || !po) continue;

    const score = 0.85 + Math.random() * 0.13; // 0.85 to 0.98

    store.sopoMatches.push({
      id: generateId(),
      salesOrderId: so.id,
      salesOrderLineId: soLine.id,
      purchaseOrderId: po.id,
      purchaseOrderLineId: poLine.id,
      skuId: soLine.skuId,
      quantityMatched: Math.min(soLine.quantityOrdered, 10),
      matchScore: round(score),
      matchFactors: {
        skuExactMatch: 1.0,
        timingAlignment: 0.9 + Math.random() * 0.1,
        locationProximity: 0.85 + Math.random() * 0.15,
        quantityFit: 0.9 + Math.random() * 0.1,
        channelPriority: getChannelScore(so.channel, so.priority),
        seasonAlignment: 1.0,
        supplierReliability: 0.88 + Math.random() * 0.1,
        marginContribution: 0.8 + Math.random() * 0.2,
      },
      status: 'AUTO_CONFIRMED',
      proposedBy: 'SYSTEM',
      confirmedById: null,
      confirmedAt: daysAgo(Math.floor(Math.random() * 5)).toISOString(),
      rejectedReason: null,
      expectedFulfillDate: daysFromNow(5 + Math.floor(Math.random() * 20)).toISOString(),
      createdAt: daysAgo(3 + Math.floor(Math.random() * 10)).toISOString(),
      updatedAt: ts,
    });
    autoCount++;
  }

  // ── PROPOSED matches (12) — awaiting human review ─────
  for (let i = 0; i < 12; i++) {
    const soLine = soLines[(i * 3 + 7) % soLines.length];
    const poLine = poLines[(i * 2 + 5) % poLines.length];
    const so = salesOrders.find(s => s.id === soLine.salesOrderId)!;
    const po = purchaseOrders.find(p => p.id === poLine.purchaseOrderId)!;
    if (!so || !po) continue;

    const score = 0.50 + Math.random() * 0.34; // 0.50 to 0.84

    store.sopoMatches.push({
      id: generateId(),
      salesOrderId: so.id,
      salesOrderLineId: soLine.id,
      purchaseOrderId: po.id,
      purchaseOrderLineId: poLine.id,
      skuId: soLine.skuId,
      quantityMatched: Math.min(soLine.quantityOrdered, 5 + Math.floor(Math.random() * 15)),
      matchScore: round(score),
      matchFactors: {
        skuExactMatch: soLine.skuId === poLine.skuId ? 1.0 : 0.0,
        timingAlignment: 0.3 + Math.random() * 0.5,
        locationProximity: 0.4 + Math.random() * 0.4,
        quantityFit: 0.5 + Math.random() * 0.4,
        channelPriority: getChannelScore(so.channel, so.priority),
        seasonAlignment: Math.random() > 0.5 ? 1.0 : 0.5,
        supplierReliability: 0.6 + Math.random() * 0.3,
        marginContribution: 0.4 + Math.random() * 0.4,
      },
      status: 'PROPOSED',
      proposedBy: 'AI_MODEL',
      confirmedById: null,
      confirmedAt: null,
      rejectedReason: null,
      expectedFulfillDate: daysFromNow(10 + Math.floor(Math.random() * 40)).toISOString(),
      createdAt: daysAgo(1 + Math.floor(Math.random() * 5)).toISOString(),
      updatedAt: ts,
    });
  }

  // ── REJECTED matches (6) — with detailed reasons ──────
  const rejectionReasons = [
    'Timing misalignment — PO delivery 3 weeks after SO deadline. Would cause wholesale penalty.',
    'Better PO available from Nordic Textile with shorter lead time. Reassigned.',
    'Quantity insufficient — PO line covers only 30% of SO demand. Waiting for larger batch.',
    'Wrong delivery location — PO routed to APAC warehouse, SO needs EU fulfillment. Transfer cost prohibitive.',
    'Customer cancelled original order. Match no longer needed.',
    'Supplier flagged quality concerns on this batch. Holding allocation until QA inspection.',
  ];

  for (let i = 0; i < 6; i++) {
    const soLine = soLines[(i * 5 + 2) % soLines.length];
    const poLine = poLines[(i * 4 + 1) % poLines.length];
    const so = salesOrders.find(s => s.id === soLine.salesOrderId)!;
    const po = purchaseOrders.find(p => p.id === poLine.purchaseOrderId)!;
    if (!so || !po) continue;

    store.sopoMatches.push({
      id: generateId(),
      salesOrderId: so.id,
      salesOrderLineId: soLine.id,
      purchaseOrderId: po.id,
      purchaseOrderLineId: poLine.id,
      skuId: soLine.skuId,
      quantityMatched: Math.min(soLine.quantityOrdered, 5),
      matchScore: 0.30 + Math.random() * 0.3,
      matchFactors: {
        skuExactMatch: Math.random() > 0.5 ? 1.0 : 0.0,
        timingAlignment: 0.1 + Math.random() * 0.4,
        locationProximity: 0.2 + Math.random() * 0.5,
        quantityFit: 0.3 + Math.random() * 0.4,
        channelPriority: getChannelScore(so.channel, so.priority),
        seasonAlignment: 0.5,
        supplierReliability: 0.5 + Math.random() * 0.3,
        marginContribution: 0.3 + Math.random() * 0.4,
      },
      status: 'REJECTED',
      proposedBy: 'AI_MODEL',
      confirmedById: plannerUser.id,
      confirmedAt: null,
      rejectedReason: rejectionReasons[i],
      expectedFulfillDate: null,
      createdAt: daysAgo(10 + Math.floor(Math.random() * 20)).toISOString(),
      updatedAt: daysAgo(5 + Math.floor(Math.random() * 10)).toISOString(),
    });
  }

  // ── FULFILLED matches (7) — completed end-to-end ──────
  for (let i = 0; i < 7; i++) {
    const soLine = soLines[(i * 7 + 3) % soLines.length];
    const poLine = poLines[(i * 6 + 2) % poLines.length];
    const so = salesOrders.find(s => s.id === soLine.salesOrderId)!;
    const po = purchaseOrders.find(p => p.id === poLine.purchaseOrderId)!;
    if (!so || !po) continue;

    store.sopoMatches.push({
      id: generateId(),
      salesOrderId: so.id,
      salesOrderLineId: soLine.id,
      purchaseOrderId: po.id,
      purchaseOrderLineId: poLine.id,
      skuId: soLine.skuId,
      quantityMatched: soLine.quantityOrdered,
      matchScore: 0.82 + Math.random() * 0.16,
      matchFactors: {
        skuExactMatch: 1.0,
        timingAlignment: 0.85 + Math.random() * 0.15,
        locationProximity: 0.7 + Math.random() * 0.3,
        quantityFit: 1.0,
        channelPriority: getChannelScore(so.channel, so.priority),
        seasonAlignment: 1.0,
        supplierReliability: 0.85 + Math.random() * 0.13,
        marginContribution: 0.7 + Math.random() * 0.3,
      },
      status: 'FULFILLED',
      proposedBy: 'SYSTEM',
      confirmedById: plannerUser.id,
      confirmedAt: daysAgo(20 + Math.floor(Math.random() * 30)).toISOString(),
      rejectedReason: null,
      expectedFulfillDate: daysAgo(10 + Math.floor(Math.random() * 20)).toISOString(),
      createdAt: daysAgo(30 + Math.floor(Math.random() * 40)).toISOString(),
      updatedAt: daysAgo(5 + Math.floor(Math.random() * 15)).toISOString(),
    });
  }

  // ── Matching Runs (5 historical) ───────────────────────
  const runs: Array<{ trigger: string; daysAgo: number; proposed: number; auto: number; review: number; unmatched: number; avgScore: number; timeMs: number }> = [
    { trigger: 'SCHEDULED', daysAgo: 1, proposed: 55, auto: 10, review: 12, unmatched: 8, avgScore: 0.74, timeMs: 1840 },
    { trigger: 'PO_RECEIVED', daysAgo: 3, proposed: 18, auto: 5, review: 4, unmatched: 2, avgScore: 0.81, timeMs: 620 },
    { trigger: 'SO_CREATED', daysAgo: 5, proposed: 8, auto: 3, review: 2, unmatched: 1, avgScore: 0.78, timeMs: 340 },
    { trigger: 'SCHEDULED', daysAgo: 8, proposed: 48, auto: 12, review: 10, unmatched: 6, avgScore: 0.72, timeMs: 2100 },
    { trigger: 'MANUAL', daysAgo: 12, proposed: 30, auto: 8, review: 8, unmatched: 4, avgScore: 0.76, timeMs: 980 },
  ];

  for (const run of runs) {
    store.matchingRuns.push({
      id: generateId(),
      triggeredBy: run.trigger,
      matchesProposed: run.proposed,
      matchesAutoConfirmed: run.auto,
      matchesRequiringReview: run.review,
      unmatched: run.unmatched,
      avgMatchScore: run.avgScore,
      executionTimeMs: run.timeMs,
      modelVersion: '1.0.0',
      startedAt: daysAgo(run.daysAgo).toISOString(),
      completedAt: daysAgo(run.daysAgo).toISOString(),
    });
  }
}

function computeTimingScore(poDelivery: string | null, soRequestedShip: string | null): number {
  if (!poDelivery || !soRequestedShip) return 0.5;
  const poDate = new Date(poDelivery).getTime();
  const soDate = new Date(soRequestedShip).getTime();
  const diffDays = (soDate - poDate) / (1000 * 60 * 60 * 24);

  if (diffDays >= 7) return 1.0; // PO arrives 7+ days before SO needed
  if (diffDays >= 0) return 0.7 + diffDays * 0.043; // 0-7 days: 0.7-1.0
  if (diffDays >= -30) return Math.max(0, 1 + diffDays / 30); // 0-30 days late: 1.0-0.0
  return 0;
}

function computeLocationScore(soRegion?: string, poRegion?: string, sameLocation?: boolean): number {
  if (sameLocation) return 1.0;
  if (soRegion === poRegion) return 0.7;
  if (soRegion && poRegion) return 0.4;
  return 0.5;
}

function getChannelScore(channel: string, priority: number): number {
  if (channel === 'WHOLESALE') return 1.0;
  if (priority >= 2) return 0.9; // VIC
  if (channel === 'ECOMMERCE') return 0.7;
  if (channel === 'RETAIL_STORE') return 0.6;
  if (channel === 'MARKETPLACE') return 0.65;
  if (channel === 'CLIENTELING') return 0.85;
  return 0.5;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
