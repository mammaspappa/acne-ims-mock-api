import { store } from '../../store/Store.js';
import type { SOPOMatch, MatchingRun, SOLine, POLine, MatchStatus } from '../../store/types.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';
import { scoreMatch } from './matching.scorer.js';
import type { MatchContext } from './matching.scorer.js';

// ─── TYPES ──────────────────────────────────────────────

export interface MatchingOptions {
  season?: string;
  seasonYear?: number;
  skuId?: string;
  triggeredBy?: string;
}

export interface MatchingRunResult {
  run: MatchingRun;
  matches: SOPOMatch[];
}

// ─── THRESHOLDS ─────────────────────────────────────────

const AUTO_CONFIRM_THRESHOLD = 0.85;
const PROPOSAL_THRESHOLD = 0.50;

// ─── HELPERS ────────────────────────────────────────────

function buildContext(soLine: SOLine, poLine: POLine): MatchContext {
  const salesOrder = store.salesOrders.find(so => so.id === soLine.salesOrderId)!;
  const purchaseOrder = store.purchaseOrders.find(po => po.id === poLine.purchaseOrderId)!;

  const soLocation = salesOrder.locationId
    ? store.findById(store.locations, salesOrder.locationId)
    : undefined;
  const poLocation = purchaseOrder.deliveryLocationId
    ? store.findById(store.locations, purchaseOrder.deliveryLocationId)
    : undefined;

  const supplier = store.findById(store.suppliers, purchaseOrder.supplierId);

  const soSku = store.findById(store.skus, soLine.skuId);
  const poSku = store.findById(store.skus, poLine.skuId);

  const soProduct = soSku ? store.findById(store.products, soSku.productId) : undefined;
  const poProduct = poSku ? store.findById(store.products, poSku.productId) : undefined;

  return {
    salesOrder,
    purchaseOrder,
    soLocation,
    poLocation,
    supplier,
    soSku,
    poSku,
    soProduct,
    poProduct,
  };
}

/**
 * Returns SO lines that have unallocated quantity and are eligible for matching.
 * Filters out cancelled, delivered, and returned SOs.
 */
function getUnmatchedSOLines(options: MatchingOptions): SOLine[] {
  const excludedStatuses = new Set(['CANCELLED', 'DELIVERED', 'RETURNED', 'SHIPPED']);

  let soLines = store.soLines.filter(line => {
    const remaining = line.quantityOrdered - line.quantityAllocated;
    if (remaining <= 0) return false;

    const so = store.salesOrders.find(s => s.id === line.salesOrderId);
    if (!so || excludedStatuses.has(so.status)) return false;

    // Check if this SO line already has an active match
    const activeMatch = store.sopoMatches.find(
      m => m.salesOrderLineId === line.id &&
        (m.status === 'PROPOSED' || m.status === 'CONFIRMED' || m.status === 'AUTO_CONFIRMED')
    );
    if (activeMatch) return false;

    return true;
  });

  // Apply filters
  if (options.skuId) {
    soLines = soLines.filter(l => l.skuId === options.skuId);
  }

  if (options.season || options.seasonYear) {
    soLines = soLines.filter(l => {
      const sku = store.findById(store.skus, l.skuId);
      if (!sku) return false;
      const product = store.findById(store.products, sku.productId);
      if (!product) return false;
      if (options.season && product.season !== options.season) return false;
      if (options.seasonYear && product.seasonYear !== options.seasonYear) return false;
      return true;
    });
  }

  return soLines;
}

/**
 * Returns PO lines that have available (unmatched) quantity.
 * Only includes POs in production-forward statuses.
 */
function getCandidatePOLines(options: MatchingOptions): POLine[] {
  const eligibleStatuses = new Set([
    'CONFIRMED_BY_SUPPLIER', 'IN_PRODUCTION', 'SHIPPED',
    'PARTIALLY_RECEIVED', 'APPROVED', 'SENT_TO_SUPPLIER',
  ]);

  let poLines = store.poLines.filter(line => {
    const po = store.purchaseOrders.find(p => p.id === line.purchaseOrderId);
    if (!po || !eligibleStatuses.has(po.status)) return false;

    // Available qty = ordered - received - already matched (confirmed/auto)
    const matchedQty = store.sopoMatches
      .filter(m =>
        m.purchaseOrderLineId === line.id &&
        (m.status === 'CONFIRMED' || m.status === 'AUTO_CONFIRMED' || m.status === 'PROPOSED')
      )
      .reduce((sum, m) => sum + m.quantityMatched, 0);

    const available = line.quantityOrdered - line.quantityReceived - matchedQty;
    return available > 0;
  });

  if (options.skuId) {
    poLines = poLines.filter(l => l.skuId === options.skuId);
  }

  if (options.season || options.seasonYear) {
    poLines = poLines.filter(l => {
      const po = store.purchaseOrders.find(p => p.id === l.purchaseOrderId);
      if (!po) return false;
      if (options.season && po.season !== options.season) return false;
      if (options.seasonYear && po.seasonYear !== options.seasonYear) return false;
      return true;
    });
  }

  return poLines;
}

/**
 * Calculate available PO line quantity (not yet matched or received).
 */
function availablePOQty(poLine: POLine): number {
  const matchedQty = store.sopoMatches
    .filter(m =>
      m.purchaseOrderLineId === poLine.id &&
      (m.status === 'CONFIRMED' || m.status === 'AUTO_CONFIRMED' || m.status === 'PROPOSED')
    )
    .reduce((sum, m) => sum + m.quantityMatched, 0);

  return Math.max(0, poLine.quantityOrdered - poLine.quantityReceived - matchedQty);
}

// ─── MAIN ENGINE ────────────────────────────────────────

/**
 * Run the SO-PO matching engine.
 *
 * 1. Gather unmatched SO lines and candidate PO lines
 * 2. For each SO line, score all candidate PO lines
 * 3. Select the best match per SO line (greedy, highest score first)
 * 4. Apply auto-confirm/propose thresholds
 * 5. Create SOPOMatch records and a MatchingRun summary
 */
export function runMatching(options: MatchingOptions = {}): MatchingRunResult {
  const startTime = Date.now();
  const ts = now().toISOString();

  const soLines = getUnmatchedSOLines(options);
  const candidatePOLines = getCandidatePOLines(options);

  // Score all pairs
  interface ScoredPair {
    soLine: SOLine;
    poLine: POLine;
    score: number;
    factors: Record<string, number>;
  }

  const scoredPairs: ScoredPair[] = [];

  for (const soLine of soLines) {
    for (const poLine of candidatePOLines) {
      const ctx = buildContext(soLine, poLine);
      const result = scoreMatch(soLine, poLine, ctx);

      if (result.score >= PROPOSAL_THRESHOLD) {
        scoredPairs.push({
          soLine,
          poLine,
          score: result.score,
          factors: result.factors,
        });
      }
    }
  }

  // Sort by score descending — greedy best-match-first
  scoredPairs.sort((a, b) => b.score - a.score);

  // Greedy assignment: each SO line gets at most one match,
  // and PO line capacity is consumed as matches are assigned
  const matchedSOLineIds = new Set<string>();
  const poCapacityUsed = new Map<string, number>(); // poLineId -> qty consumed in this run
  const newMatches: SOPOMatch[] = [];

  for (const pair of scoredPairs) {
    if (matchedSOLineIds.has(pair.soLine.id)) continue;

    const usedAlready = poCapacityUsed.get(pair.poLine.id) ?? 0;
    const poAvailable = availablePOQty(pair.poLine) - usedAlready;
    if (poAvailable <= 0) continue;

    const soNeed = pair.soLine.quantityOrdered - pair.soLine.quantityAllocated;
    const qtyMatched = Math.min(soNeed, poAvailable);

    const status: MatchStatus = pair.score >= AUTO_CONFIRM_THRESHOLD
      ? 'AUTO_CONFIRMED'
      : 'PROPOSED';

    const so = store.salesOrders.find(s => s.id === pair.soLine.salesOrderId)!;
    const po = store.purchaseOrders.find(p => p.id === pair.poLine.purchaseOrderId)!;

    const match: SOPOMatch = {
      id: generateId(),
      salesOrderId: so.id,
      salesOrderLineId: pair.soLine.id,
      purchaseOrderId: po.id,
      purchaseOrderLineId: pair.poLine.id,
      skuId: pair.soLine.skuId,
      quantityMatched: qtyMatched,
      matchScore: pair.score,
      matchFactors: pair.factors,
      status,
      proposedBy: options.triggeredBy ?? 'SYSTEM',
      confirmedById: status === 'AUTO_CONFIRMED' ? 'SYSTEM' : null,
      confirmedAt: status === 'AUTO_CONFIRMED' ? ts : null,
      rejectedReason: null,
      expectedFulfillDate: pair.poLine.expectedDate ?? po.expectedDelivery,
      createdAt: ts,
      updatedAt: ts,
    };

    newMatches.push(match);
    store.sopoMatches.push(match);
    matchedSOLineIds.add(pair.soLine.id);
    poCapacityUsed.set(pair.poLine.id, usedAlready + qtyMatched);
  }

  const executionTimeMs = Date.now() - startTime;

  const autoConfirmed = newMatches.filter(m => m.status === 'AUTO_CONFIRMED').length;
  const proposed = newMatches.filter(m => m.status === 'PROPOSED').length;
  const totalScores = newMatches.reduce((sum, m) => sum + m.matchScore, 0);

  const run: MatchingRun = {
    id: generateId(),
    triggeredBy: options.triggeredBy ?? 'MANUAL',
    matchesProposed: newMatches.length,
    matchesAutoConfirmed: autoConfirmed,
    matchesRequiringReview: proposed,
    unmatched: soLines.length - matchedSOLineIds.size,
    avgMatchScore: newMatches.length > 0 ? Math.round((totalScores / newMatches.length) * 100) / 100 : null,
    executionTimeMs,
    modelVersion: '1.0.0',
    startedAt: ts,
    completedAt: now().toISOString(),
  };

  store.matchingRuns.push(run);

  return { run, matches: newMatches };
}
