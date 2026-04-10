import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import type { MatchStatus } from '../../store/types.js';
import { paginate, parsePagination } from '../../utils/pagination.js';
import { now } from '../../utils/date.js';
import { runMatching } from './matching.engine.js';

// ─── POST /matching/run ─────────────────────────────────

export async function runMatchingHandler(
  request: FastifyRequest<{
    Body: {
      season?: string;
      seasonYear?: number;
      skuId?: string;
      triggeredBy?: string;
    };
  }>,
  reply: FastifyReply
) {
  const { season, seasonYear, skuId, triggeredBy } = request.body ?? {};

  const result = runMatching({ season, seasonYear, skuId, triggeredBy });

  return reply.send(result);
}

// ─── GET /matching/proposals ────────────────────────────

export async function listProposals(
  request: FastifyRequest<{
    Querystring: {
      status?: string;
      skuId?: string;
      salesOrderId?: string;
      purchaseOrderId?: string;
      minScore?: number;
      maxScore?: number;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { status, skuId, salesOrderId, purchaseOrderId, minScore, maxScore } = request.query;

  let matches = store.sopoMatches;

  if (status) {
    matches = matches.filter(m => m.status === status);
  }
  if (skuId) {
    matches = matches.filter(m => m.skuId === skuId);
  }
  if (salesOrderId) {
    matches = matches.filter(m => m.salesOrderId === salesOrderId);
  }
  if (purchaseOrderId) {
    matches = matches.filter(m => m.purchaseOrderId === purchaseOrderId);
  }
  if (minScore !== undefined) {
    matches = matches.filter(m => m.matchScore >= minScore);
  }
  if (maxScore !== undefined) {
    matches = matches.filter(m => m.matchScore <= maxScore);
  }

  // Sort by score descending
  matches = [...matches].sort((a, b) => b.matchScore - a.matchScore);

  const pagination = parsePagination(request.query);
  return reply.send(paginate(matches, pagination));
}

// ─── GET /matching/proposals/:id ────────────────────────

export async function getProposal(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const match = store.findById(store.sopoMatches, request.params.id);
  if (!match) {
    return reply.status(404).send({ error: 'Match proposal not found' });
  }

  const salesOrder = store.findById(store.salesOrders, match.salesOrderId);
  const purchaseOrder = store.findById(store.purchaseOrders, match.purchaseOrderId);
  const soLine = match.salesOrderLineId
    ? store.findById(store.soLines, match.salesOrderLineId)
    : null;
  const poLine = match.purchaseOrderLineId
    ? store.findById(store.poLines, match.purchaseOrderLineId)
    : null;
  const sku = store.findById(store.skus, match.skuId) ?? null;

  return reply.send({
    ...match,
    salesOrder,
    purchaseOrder,
    soLine,
    poLine,
    sku,
  });
}

// ─── POST /matching/proposals/:id/confirm ───────────────

export async function confirmProposal(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { confirmedById?: string };
  }>,
  reply: FastifyReply
) {
  const match = store.findById(store.sopoMatches, request.params.id);
  if (!match) {
    return reply.status(404).send({ error: 'Match proposal not found' });
  }

  if (match.status !== 'PROPOSED') {
    return reply.status(400).send({
      error: `Cannot confirm match in status '${match.status}'. Only PROPOSED matches can be confirmed.`,
    });
  }

  const ts = now().toISOString();
  const confirmedById = request.body?.confirmedById ?? 'MANUAL';

  const updated = store.update(store.sopoMatches, match.id, {
    status: 'CONFIRMED' as MatchStatus,
    confirmedById,
    confirmedAt: ts,
    updatedAt: ts,
  });

  return reply.send(updated);
}

// ─── POST /matching/proposals/:id/reject ────────────────

export async function rejectProposal(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { reason: string; rejectedBy?: string };
  }>,
  reply: FastifyReply
) {
  const match = store.findById(store.sopoMatches, request.params.id);
  if (!match) {
    return reply.status(404).send({ error: 'Match proposal not found' });
  }

  if (match.status !== 'PROPOSED') {
    return reply.status(400).send({
      error: `Cannot reject match in status '${match.status}'. Only PROPOSED matches can be rejected.`,
    });
  }

  const ts = now().toISOString();

  const updated = store.update(store.sopoMatches, match.id, {
    status: 'REJECTED' as MatchStatus,
    rejectedReason: request.body.reason,
    updatedAt: ts,
  });

  return reply.send(updated);
}

// ─── POST /matching/bulk-confirm ────────────────────────

export async function bulkConfirm(
  request: FastifyRequest<{
    Body: { minScore?: number; confirmedById?: string };
  }>,
  reply: FastifyReply
) {
  const minScore = request.body?.minScore ?? 0.85;
  const confirmedById = request.body?.confirmedById ?? 'BULK';
  const ts = now().toISOString();

  const eligible = store.sopoMatches.filter(
    m => m.status === 'PROPOSED' && m.matchScore >= minScore
  );

  const confirmed = [];
  for (const match of eligible) {
    const updated = store.update(store.sopoMatches, match.id, {
      status: 'CONFIRMED' as MatchStatus,
      confirmedById,
      confirmedAt: ts,
      updatedAt: ts,
    });
    if (updated) confirmed.push(updated);
  }

  return reply.send({
    confirmed: confirmed.length,
    matches: confirmed,
  });
}

// ─── GET /matching/unmatched-sos ────────────────────────

export async function unmatchedSOs(
  request: FastifyRequest<{
    Querystring: {
      season?: string;
      seasonYear?: number;
      channel?: string;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { season, seasonYear, channel } = request.query;

  const excludedStatuses = new Set(['CANCELLED', 'DELIVERED', 'RETURNED', 'SHIPPED']);

  let results = store.soLines
    .map(line => {
      const so = store.salesOrders.find(s => s.id === line.salesOrderId);
      if (!so || excludedStatuses.has(so.status)) return null;

      const remaining = line.quantityOrdered - line.quantityAllocated;
      if (remaining <= 0) return null;

      // Check for active matches
      const activeMatch = store.sopoMatches.find(
        m => m.salesOrderLineId === line.id &&
          (m.status === 'PROPOSED' || m.status === 'CONFIRMED' || m.status === 'AUTO_CONFIRMED')
      );
      if (activeMatch) return null;

      const sku = store.findById(store.skus, line.skuId) ?? null;

      return {
        soLine: line,
        salesOrder: so,
        sku,
        unmatched: remaining,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Apply filters
  if (channel) {
    results = results.filter(r => r.salesOrder.channel === channel);
  }

  if (season || seasonYear) {
    results = results.filter(r => {
      if (!r.sku) return false;
      const product = store.findById(store.products, r.sku.productId);
      if (!product) return false;
      if (season && product.season !== season) return false;
      if (seasonYear && product.seasonYear !== seasonYear) return false;
      return true;
    });
  }

  const pagination = parsePagination(request.query);
  return reply.send(paginate(results, pagination));
}

// ─── GET /matching/unmatched-po-capacity ────────────────

export async function unmatchedPOCapacity(
  request: FastifyRequest<{
    Querystring: {
      season?: string;
      seasonYear?: number;
      supplierId?: string;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { season, seasonYear, supplierId } = request.query;

  const eligibleStatuses = new Set([
    'CONFIRMED_BY_SUPPLIER', 'IN_PRODUCTION', 'SHIPPED',
    'PARTIALLY_RECEIVED', 'APPROVED', 'SENT_TO_SUPPLIER',
  ]);

  let results = store.poLines
    .map(line => {
      const po = store.purchaseOrders.find(p => p.id === line.purchaseOrderId);
      if (!po || !eligibleStatuses.has(po.status)) return null;

      const matchedQty = store.sopoMatches
        .filter(m =>
          m.purchaseOrderLineId === line.id &&
          (m.status === 'CONFIRMED' || m.status === 'AUTO_CONFIRMED' || m.status === 'PROPOSED')
        )
        .reduce((sum, m) => sum + m.quantityMatched, 0);

      const available = line.quantityOrdered - line.quantityReceived - matchedQty;
      if (available <= 0) return null;

      const sku = store.findById(store.skus, line.skuId) ?? null;

      return {
        poLine: line,
        purchaseOrder: po,
        sku,
        available,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  // Apply filters
  if (supplierId) {
    results = results.filter(r => r.purchaseOrder.supplierId === supplierId);
  }
  if (season) {
    results = results.filter(r => r.purchaseOrder.season === season);
  }
  if (seasonYear) {
    results = results.filter(r => r.purchaseOrder.seasonYear === seasonYear);
  }

  const pagination = parsePagination(request.query);
  return reply.send(paginate(results, pagination));
}

// ─── GET /matching/health ───────────────────────────────

export async function matchingHealth(
  request: FastifyRequest<{
    Querystring: {
      season?: string;
      seasonYear?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { season, seasonYear } = request.query;

  // Get all relevant SO lines
  let soLines = store.soLines;

  if (season || seasonYear) {
    soLines = soLines.filter(l => {
      const sku = store.findById(store.skus, l.skuId);
      if (!sku) return false;
      const product = store.findById(store.products, sku.productId);
      if (!product) return false;
      if (season && product.season !== season) return false;
      if (seasonYear && product.seasonYear !== seasonYear) return false;
      return true;
    });
  }

  // Get all matches for these SO lines
  const soLineIds = new Set(soLines.map(l => l.id));
  const relevantMatches = store.sopoMatches.filter(
    m => m.salesOrderLineId && soLineIds.has(m.salesOrderLineId)
  );

  const activelyMatched = new Set(
    relevantMatches
      .filter(m => ['PROPOSED', 'CONFIRMED', 'AUTO_CONFIRMED', 'FULFILLED'].includes(m.status))
      .map(m => m.salesOrderLineId)
  );

  const totalSOLines = soLines.length;
  const matchedSOLines = activelyMatched.size;
  const unmatchedSOLines = totalSOLines - matchedSOLines;

  const activeMatches = relevantMatches.filter(
    m => ['PROPOSED', 'CONFIRMED', 'AUTO_CONFIRMED', 'FULFILLED'].includes(m.status)
  );
  const totalScore = activeMatches.reduce((sum, m) => sum + m.matchScore, 0);

  // Count by status
  const autoConfirmedCount = relevantMatches.filter(m => m.status === 'AUTO_CONFIRMED').length;
  const proposedCount = relevantMatches.filter(m => m.status === 'PROPOSED').length;
  const confirmedCount = relevantMatches.filter(m => m.status === 'CONFIRMED').length;
  const rejectedCount = relevantMatches.filter(m => m.status === 'REJECTED').length;

  // By channel
  const byChannel: Record<string, { total: number; matched: number; matchRate: number }> = {};
  for (const line of soLines) {
    const so = store.salesOrders.find(s => s.id === line.salesOrderId);
    if (!so) continue;
    const ch = so.channel;
    if (!byChannel[ch]) byChannel[ch] = { total: 0, matched: 0, matchRate: 0 };
    byChannel[ch].total++;
    if (activelyMatched.has(line.id)) byChannel[ch].matched++;
  }
  for (const ch of Object.keys(byChannel)) {
    byChannel[ch].matchRate = byChannel[ch].total > 0
      ? Math.round((byChannel[ch].matched / byChannel[ch].total) * 100) / 100
      : 0;
  }

  return reply.send({
    totalSOLines,
    matchedSOLines,
    unmatchedSOLines,
    matchRate: totalSOLines > 0 ? Math.round((matchedSOLines / totalSOLines) * 100) / 100 : 0,
    avgMatchScore: activeMatches.length > 0 ? Math.round((totalScore / activeMatches.length) * 100) / 100 : null,
    autoConfirmedCount,
    proposedCount,
    confirmedCount,
    rejectedCount,
    byChannel,
  });
}

// ─── GET /matching/timeline ─────────────────────────────

export async function matchingTimeline(
  request: FastifyRequest<{
    Querystring: {
      season?: string;
      seasonYear?: number;
      days?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { season, seasonYear } = request.query;
  const days = request.query.days ?? 60;
  const today = now();

  // Build a date-indexed map for the next N days
  const timeline: { date: string; poArrivals: number; soDeadlines: number; gapUnits: number }[] = [];

  for (let d = 0; d < days; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    const dateStr = date.toISOString().slice(0, 10);

    // Count PO arrivals on this date
    let poArrivals = 0;
    for (const poLine of store.poLines) {
      const arrivalDate = poLine.expectedDate;
      if (!arrivalDate) continue;

      const po = store.purchaseOrders.find(p => p.id === poLine.purchaseOrderId);
      if (!po) continue;
      if (season && po.season !== season) continue;
      if (seasonYear && po.seasonYear !== seasonYear) continue;

      if (arrivalDate.slice(0, 10) === dateStr) {
        poArrivals += poLine.quantityOrdered - poLine.quantityReceived;
      }
    }

    // Also check PO-level expected delivery
    for (const po of store.purchaseOrders) {
      if (!po.expectedDelivery) continue;
      if (season && po.season !== season) continue;
      if (seasonYear && po.seasonYear !== seasonYear) continue;

      if (po.expectedDelivery.slice(0, 10) === dateStr) {
        // Sum lines without their own expected date
        const linesWithoutDate = store.poLines.filter(
          l => l.purchaseOrderId === po.id && !l.expectedDate
        );
        for (const line of linesWithoutDate) {
          poArrivals += line.quantityOrdered - line.quantityReceived;
        }
      }
    }

    // Count SO deadlines on this date
    let soDeadlines = 0;
    for (const so of store.salesOrders) {
      if (!so.requestedShipDate) continue;
      if (so.requestedShipDate.slice(0, 10) !== dateStr) continue;

      if (season || seasonYear) {
        const soLineForFilter = store.soLines.find(l => l.salesOrderId === so.id);
        if (soLineForFilter) {
          const sku = store.findById(store.skus, soLineForFilter.skuId);
          const product = sku ? store.findById(store.products, sku.productId) : null;
          if (product) {
            if (season && product.season !== season) continue;
            if (seasonYear && product.seasonYear !== seasonYear) continue;
          }
        }
      }

      const lines = store.soLines.filter(l => l.salesOrderId === so.id);
      for (const line of lines) {
        soDeadlines += line.quantityOrdered - line.quantityShipped;
      }
    }

    timeline.push({
      date: dateStr,
      poArrivals,
      soDeadlines,
      gapUnits: soDeadlines - poArrivals,
    });
  }

  return reply.send({ timeline });
}

// ─── GET /matching/runs ─────────────────────────────────

export async function listRuns(
  request: FastifyRequest<{
    Querystring: { page?: number; limit?: number };
  }>,
  reply: FastifyReply
) {
  const runs = [...store.matchingRuns].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );

  const pagination = parsePagination(request.query);
  return reply.send(paginate(runs, pagination));
}
