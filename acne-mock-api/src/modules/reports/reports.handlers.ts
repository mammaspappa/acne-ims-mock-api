import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import type { Season } from '../../store/types.js';
import { now } from '../../utils/date.js';

// ─── Helpers ────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function getProductForSku(skuId: string) {
  const sku = store.findById(store.skus, skuId);
  if (!sku) return undefined;
  return store.findById(store.products, sku.productId);
}

// ─── GET /reports/seasonal-buy-summary ──────────────────

export async function seasonalBuySummary(
  request: FastifyRequest<{
    Querystring: {
      season?: string;
      seasonYear?: number;
      category?: string;
      supplierId?: string;
    };
  }>,
  reply: FastifyReply
) {
  const { season, seasonYear, category, supplierId } = request.query;

  let pos = store.purchaseOrders;

  if (season) pos = pos.filter(po => po.season === season);
  if (seasonYear) pos = pos.filter(po => po.seasonYear === Number(seasonYear));
  if (supplierId) pos = pos.filter(po => po.supplierId === supplierId);

  // If category is specified, filter POs that contain lines with SKUs in that category
  if (category) {
    const skuIdsInCategory = new Set(
      store.skus
        .filter(s => {
          const product = store.findById(store.products, s.productId);
          return product?.category === category;
        })
        .map(s => s.id)
    );

    const poIdsWithCategory = new Set(
      store.poLines
        .filter(line => skuIdsInCategory.has(line.skuId))
        .map(line => line.purchaseOrderId)
    );

    pos = pos.filter(po => poIdsWithCategory.has(po.id));
  }

  const totalSpend = round2(pos.reduce((sum, po) => sum + po.totalAmount, 0));
  // Simulated budget: 130% of current spend to show some remaining
  const totalBudget = round2(totalSpend * 1.3);
  const remainingBudget = round2(totalBudget - totalSpend);
  const utilizationPercent = totalBudget > 0 ? round2((totalSpend / totalBudget) * 100) : 0;

  // By category
  const categoryMap = new Map<string, number>();
  for (const po of pos) {
    const lines = store.poLines.filter(l => l.purchaseOrderId === po.id);
    for (const line of lines) {
      const product = getProductForSku(line.skuId);
      const cat = product?.category ?? 'Unknown';
      categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + line.lineTotal);
    }
  }
  const byCategory = Array.from(categoryMap.entries())
    .map(([cat, spend]) => ({
      category: cat,
      spend: round2(spend),
      percentOfTotal: totalSpend > 0 ? round2((spend / totalSpend) * 100) : 0,
    }))
    .sort((a, b) => b.spend - a.spend);

  // By supplier
  const supplierMap = new Map<string, number>();
  for (const po of pos) {
    supplierMap.set(po.supplierId, (supplierMap.get(po.supplierId) ?? 0) + po.totalAmount);
  }
  const bySupplier = Array.from(supplierMap.entries())
    .map(([sid, spend]) => {
      const supplier = store.findById(store.suppliers, sid);
      return {
        supplierId: sid,
        supplierName: supplier?.name ?? 'Unknown',
        spend: round2(spend),
        percentOfTotal: totalSpend > 0 ? round2((spend / totalSpend) * 100) : 0,
      };
    })
    .sort((a, b) => b.spend - a.spend);

  // By status
  const byStatus: Record<string, { count: number; amount: number }> = {};
  for (const po of pos) {
    if (!byStatus[po.status]) byStatus[po.status] = { count: 0, amount: 0 };
    byStatus[po.status].count++;
    byStatus[po.status].amount = round2(byStatus[po.status].amount + po.totalAmount);
  }

  return reply.send({
    season: season ?? 'ALL',
    seasonYear: seasonYear ?? null,
    totalBudget,
    totalSpend,
    remainingBudget,
    utilizationPercent,
    byCategory,
    bySupplier,
    byStatus,
  });
}

// ─── GET /reports/open-to-buy ───────────────────────────

export async function openToBuy(
  request: FastifyRequest<{
    Querystring: { season?: string; seasonYear?: number };
  }>,
  reply: FastifyReply
) {
  const { season, seasonYear } = request.query;

  let pos = store.purchaseOrders;
  if (season) pos = pos.filter(po => po.season === season);
  if (seasonYear) pos = pos.filter(po => po.seasonYear === Number(seasonYear));

  // Active POs only (not cancelled or closed)
  const activePOs = pos.filter(po => !['CANCELLED', 'CLOSED'].includes(po.status));

  // Build category-level committed spend
  const categoryCommitted = new Map<string, number>();
  const allCategories = new Set<string>();

  for (const po of activePOs) {
    const lines = store.poLines.filter(l => l.purchaseOrderId === po.id);
    for (const line of lines) {
      const product = getProductForSku(line.skuId);
      const cat = product?.category ?? 'Unknown';
      allCategories.add(cat);
      categoryCommitted.set(cat, (categoryCommitted.get(cat) ?? 0) + line.lineTotal);
    }
  }

  // Also collect categories from all products for completeness
  for (const product of store.products) {
    allCategories.add(product.category);
  }

  const categories = Array.from(allCategories).map(cat => {
    const committed = round2(categoryCommitted.get(cat) ?? 0);
    // Simulated budget per category
    const budget = round2(committed * (1.1 + Math.random() * 0.4));
    const remaining = round2(budget - committed);
    const utilizationPercent = budget > 0 ? round2((committed / budget) * 100) : 0;

    return { category: cat, budget, committed, remaining, utilizationPercent };
  }).sort((a, b) => b.committed - a.committed);

  const totalBudget = round2(categories.reduce((s, c) => s + c.budget, 0));
  const totalCommitted = round2(categories.reduce((s, c) => s + c.committed, 0));
  const totalRemaining = round2(totalBudget - totalCommitted);

  return reply.send({
    season: season ?? 'ALL',
    seasonYear: seasonYear ?? null,
    categories,
    total: {
      budget: totalBudget,
      committed: totalCommitted,
      remaining: totalRemaining,
      utilizationPercent: totalBudget > 0 ? round2((totalCommitted / totalBudget) * 100) : 0,
    },
  });
}

// ─── GET /reports/sell-through ──────────────────────────

export async function sellThrough(
  request: FastifyRequest<{
    Querystring: { channel?: string; category?: string; season?: string };
  }>,
  reply: FastifyReply
) {
  const { channel, category, season } = request.query;

  // Units received = sum of PO receipt quantities
  let receipts = store.poReceipts;
  let soLines = store.soLines;

  // Shipped units from SO lines
  if (channel) {
    const soIds = new Set(
      store.salesOrders.filter(so => so.channel === channel).map(so => so.id)
    );
    soLines = soLines.filter(l => soIds.has(l.salesOrderId));
  }

  if (category) {
    const skuIdsInCategory = new Set(
      store.skus
        .filter(s => {
          const product = store.findById(store.products, s.productId);
          return product?.category === category;
        })
        .map(s => s.id)
    );
    soLines = soLines.filter(l => skuIdsInCategory.has(l.skuId));

    const poLineIdsInCategory = new Set(
      store.poLines.filter(l => skuIdsInCategory.has(l.skuId)).map(l => l.id)
    );
    receipts = receipts.filter(r => poLineIdsInCategory.has(r.poLineId));
  }

  if (season) {
    const poIdsForSeason = new Set(
      store.purchaseOrders.filter(po => po.season === season).map(po => po.id)
    );
    const poLineIdsForSeason = new Set(
      store.poLines.filter(l => poIdsForSeason.has(l.purchaseOrderId)).map(l => l.id)
    );
    receipts = receipts.filter(r => poLineIdsForSeason.has(r.poLineId));
  }

  const unitsSold = soLines.reduce((sum, l) => sum + l.quantityShipped, 0);
  const unitsReceived = receipts.reduce((sum, r) => sum + r.quantityReceived, 0);
  const sellThroughRate = unitsReceived > 0 ? round2((unitsSold / unitsReceived) * 100) : 0;

  // By channel
  const channelMap = new Map<string, { sold: number; received: number }>();
  for (const so of store.salesOrders) {
    if (!channelMap.has(so.channel)) {
      channelMap.set(so.channel, { sold: 0, received: 0 });
    }
    const lines = store.soLines.filter(l => l.salesOrderId === so.id);
    const entry = channelMap.get(so.channel)!;
    entry.sold += lines.reduce((s, l) => s + l.quantityShipped, 0);
  }
  // Distribute received across channels proportionally
  const totalSold = Array.from(channelMap.values()).reduce((s, e) => s + e.sold, 0);
  for (const entry of channelMap.values()) {
    entry.received = totalSold > 0
      ? Math.round(unitsReceived * (entry.sold / totalSold))
      : 0;
  }

  const byChannel = Array.from(channelMap.entries())
    .map(([ch, data]) => ({
      channel: ch,
      unitsSold: data.sold,
      unitsReceived: data.received,
      sellThroughRate: data.received > 0 ? round2((data.sold / data.received) * 100) : 0,
    }))
    .sort((a, b) => b.unitsSold - a.unitsSold);

  // By category
  const catSold = new Map<string, number>();
  const catReceived = new Map<string, number>();
  for (const line of store.soLines) {
    const product = getProductForSku(line.skuId);
    const cat = product?.category ?? 'Unknown';
    catSold.set(cat, (catSold.get(cat) ?? 0) + line.quantityShipped);
  }
  for (const receipt of store.poReceipts) {
    const poLine = store.findById(store.poLines, receipt.poLineId);
    if (poLine) {
      const product = getProductForSku(poLine.skuId);
      const cat = product?.category ?? 'Unknown';
      catReceived.set(cat, (catReceived.get(cat) ?? 0) + receipt.quantityReceived);
    }
  }
  const allCats = new Set([...catSold.keys(), ...catReceived.keys()]);
  const byCategory = Array.from(allCats)
    .map(cat => {
      const sold = catSold.get(cat) ?? 0;
      const received = catReceived.get(cat) ?? 0;
      return {
        category: cat,
        unitsSold: sold,
        unitsReceived: received,
        sellThroughRate: received > 0 ? round2((sold / received) * 100) : 0,
      };
    })
    .sort((a, b) => b.unitsSold - a.unitsSold);

  return reply.send({
    overall: { unitsSold, unitsReceived, sellThroughRate },
    byChannel,
    byCategory,
  });
}

// ─── GET /reports/fulfillment-sla ───────────────────────

export async function fulfillmentSla(
  request: FastifyRequest<{
    Querystring: { channel?: string; targetDays?: number };
  }>,
  reply: FastifyReply
) {
  const { channel, targetDays = 3 } = request.query;
  const target = Number(targetDays);

  let salesOrders = store.salesOrders.filter(
    so => so.status === 'SHIPPED' || so.status === 'DELIVERED' || so.status === 'PARTIALLY_SHIPPED'
  );

  if (channel) {
    salesOrders = salesOrders.filter(so => so.channel === channel);
  }

  // Only count orders with both creation and ship dates
  const ordersWithShipDate = salesOrders.filter(so => so.actualShipDate);

  let withinSla = 0;
  let totalDays = 0;

  for (const so of ordersWithShipDate) {
    const created = new Date(so.createdAt).getTime();
    const shipped = new Date(so.actualShipDate!).getTime();
    const daysDiff = (shipped - created) / (1000 * 60 * 60 * 24);
    totalDays += daysDiff;
    if (daysDiff <= target) withinSla++;
  }

  const totalOrders = ordersWithShipDate.length;
  const outsideSla = totalOrders - withinSla;
  const slaPercent = totalOrders > 0 ? round2((withinSla / totalOrders) * 100) : 0;
  const avgFulfillmentDays = totalOrders > 0 ? round2(totalDays / totalOrders) : 0;

  // By channel
  const channelStats = new Map<string, { total: number; withinSla: number; totalDays: number }>();
  for (const so of ordersWithShipDate) {
    if (!channelStats.has(so.channel)) {
      channelStats.set(so.channel, { total: 0, withinSla: 0, totalDays: 0 });
    }
    const entry = channelStats.get(so.channel)!;
    entry.total++;
    const daysDiff = (new Date(so.actualShipDate!).getTime() - new Date(so.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    entry.totalDays += daysDiff;
    if (daysDiff <= target) entry.withinSla++;
  }

  const byChannel = Array.from(channelStats.entries())
    .map(([ch, data]) => ({
      channel: ch,
      totalOrders: data.total,
      withinSla: data.withinSla,
      outsideSla: data.total - data.withinSla,
      slaPercent: data.total > 0 ? round2((data.withinSla / data.total) * 100) : 0,
      avgFulfillmentDays: data.total > 0 ? round2(data.totalDays / data.total) : 0,
    }))
    .sort((a, b) => b.totalOrders - a.totalOrders);

  return reply.send({
    targetDays: target,
    totalOrders,
    withinSla,
    outsideSla,
    slaPercent,
    avgFulfillmentDays,
    byChannel,
  });
}

// ─── GET /reports/gross-margin ──────────────────────────

export async function grossMargin(
  request: FastifyRequest<{
    Querystring: { channel?: string; category?: string };
  }>,
  reply: FastifyReply
) {
  const { channel, category } = request.query;

  let salesOrders = store.salesOrders;
  if (channel) salesOrders = salesOrders.filter(so => so.channel === channel);

  // Revenue from SO lines
  let totalRevenue = 0;
  let totalCogs = 0;

  const channelMargin = new Map<string, { revenue: number; cogs: number }>();
  const categoryMargin = new Map<string, { revenue: number; cogs: number }>();

  for (const so of salesOrders) {
    const lines = store.soLines.filter(l => l.salesOrderId === so.id);
    for (const line of lines) {
      const sku = store.findById(store.skus, line.skuId);
      const product = sku ? store.findById(store.products, sku.productId) : undefined;
      const cat = product?.category ?? 'Unknown';

      if (category && cat !== category) continue;

      const lineRevenue = line.lineTotal;
      const lineCogs = (product?.costPrice ?? 0) * line.quantityShipped;

      totalRevenue += lineRevenue;
      totalCogs += lineCogs;

      // By channel
      if (!channelMargin.has(so.channel)) {
        channelMargin.set(so.channel, { revenue: 0, cogs: 0 });
      }
      const chEntry = channelMargin.get(so.channel)!;
      chEntry.revenue += lineRevenue;
      chEntry.cogs += lineCogs;

      // By category
      if (!categoryMargin.has(cat)) {
        categoryMargin.set(cat, { revenue: 0, cogs: 0 });
      }
      const catEntry = categoryMargin.get(cat)!;
      catEntry.revenue += lineRevenue;
      catEntry.cogs += lineCogs;
    }
  }

  const grossMarginVal = round2(totalRevenue - totalCogs);
  const marginPercent = totalRevenue > 0 ? round2(((totalRevenue - totalCogs) / totalRevenue) * 100) : 0;

  const byChannel = Array.from(channelMargin.entries())
    .map(([ch, data]) => ({
      channel: ch,
      revenue: round2(data.revenue),
      cogs: round2(data.cogs),
      grossMargin: round2(data.revenue - data.cogs),
      marginPercent: data.revenue > 0 ? round2(((data.revenue - data.cogs) / data.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const byCategory = Array.from(categoryMargin.entries())
    .map(([cat, data]) => ({
      category: cat,
      revenue: round2(data.revenue),
      cogs: round2(data.cogs),
      grossMargin: round2(data.revenue - data.cogs),
      marginPercent: data.revenue > 0 ? round2(((data.revenue - data.cogs) / data.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  return reply.send({
    overall: {
      revenue: round2(totalRevenue),
      cogs: round2(totalCogs),
      grossMargin: grossMarginVal,
      marginPercent,
    },
    byChannel,
    byCategory,
  });
}

// ─── GET /reports/supplier-performance ──────────────────

export async function supplierPerformance(
  request: FastifyRequest<{
    Querystring: { supplierId?: string };
  }>,
  reply: FastifyReply
) {
  const { supplierId } = request.query;

  let suppliers = store.suppliers;
  if (supplierId) suppliers = suppliers.filter(s => s.id === supplierId);

  const result = suppliers.map(supplier => {
    const pos = store.purchaseOrders.filter(po => po.supplierId === supplier.id);
    const totalPOs = pos.length;

    // On-time delivery: POs that have actualDelivery <= expectedDelivery
    let onTimeCount = 0;
    let deliveredCount = 0;
    let totalLeadDays = 0;

    for (const po of pos) {
      if (po.actualDelivery && po.expectedDelivery) {
        deliveredCount++;
        const actual = new Date(po.actualDelivery).getTime();
        const expected = new Date(po.expectedDelivery).getTime();
        if (actual <= expected) onTimeCount++;
        const leadDays = (actual - new Date(po.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        totalLeadDays += leadDays;
      }
    }

    const onTimeDeliveryRate = deliveredCount > 0
      ? round2((onTimeCount / deliveredCount) * 100)
      : 100; // Default to 100% if no deliveries yet
    const avgLeadTimeDays = deliveredCount > 0
      ? round2(totalLeadDays / deliveredCount)
      : supplier.leadTimeDays;

    // Units ordered/received from PO lines
    const poIds = new Set(pos.map(po => po.id));
    const lines = store.poLines.filter(l => poIds.has(l.purchaseOrderId));
    const totalUnitsOrdered = lines.reduce((sum, l) => sum + l.quantityOrdered, 0);
    const totalUnitsReceived = lines.reduce((sum, l) => sum + l.quantityReceived, 0);

    // Defect rate from receipts
    const poLineIds = new Set(lines.map(l => l.id));
    const receipts = store.poReceipts.filter(r => poLineIds.has(r.poLineId));
    const totalReceived = receipts.reduce((sum, r) => sum + r.quantityReceived, 0);
    const totalDamaged = receipts.reduce((sum, r) => sum + r.damagedQuantity, 0);
    const defectRate = totalReceived > 0 ? round2((totalDamaged / totalReceived) * 100) : 0;

    const totalSpend = round2(pos.reduce((sum, po) => sum + po.totalAmount, 0));

    return {
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierCode: supplier.code,
      totalPOs,
      onTimeDeliveryRate,
      avgLeadTimeDays,
      defectRate,
      totalUnitsOrdered,
      totalUnitsReceived,
      totalSpend,
      currency: supplier.currency,
    };
  }).sort((a, b) => b.totalSpend - a.totalSpend);

  return reply.send({ suppliers: result });
}

// ─── GET /reports/stock-aging ───────────────────────────

export async function stockAging(
  request: FastifyRequest<{
    Querystring: { locationId?: string; category?: string };
  }>,
  reply: FastifyReply
) {
  const { locationId, category } = request.query;
  const currentDate = now();

  let stockLevels = store.stockLevels.filter(sl => sl.quantityOnHand > 0);

  if (locationId) {
    stockLevels = stockLevels.filter(sl => sl.locationId === locationId);
  }

  if (category) {
    const skuIdsInCategory = new Set(
      store.skus
        .filter(s => {
          const product = store.findById(store.products, s.productId);
          return product?.category === category;
        })
        .map(s => s.id)
    );
    stockLevels = stockLevels.filter(sl => skuIdsInCategory.has(sl.skuId));
  }

  // Determine age of stock by looking at the most recent PO receipt for each SKU/location
  const buckets: Record<string, { skuCount: number; totalUnits: number; totalValue: number }> = {
    '0-30 days': { skuCount: 0, totalUnits: 0, totalValue: 0 },
    '31-60 days': { skuCount: 0, totalUnits: 0, totalValue: 0 },
    '61-90 days': { skuCount: 0, totalUnits: 0, totalValue: 0 },
    '91-180 days': { skuCount: 0, totalUnits: 0, totalValue: 0 },
    '180+ days': { skuCount: 0, totalUnits: 0, totalValue: 0 },
  };

  const topAging: Array<{
    skuId: string;
    sku: string;
    productName: string;
    locationId: string;
    locationName: string;
    quantityOnHand: number;
    ageDays: number;
    value: number;
  }> = [];

  for (const sl of stockLevels) {
    const sku = store.findById(store.skus, sl.skuId);
    if (!sku) continue;

    // Find the latest receipt for this SKU at this location
    const poLineIds = store.poLines.filter(l => l.skuId === sl.skuId).map(l => l.id);
    const receipts = store.poReceipts
      .filter(r => poLineIds.includes(r.poLineId) && r.locationId === sl.locationId)
      .sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());

    // Use the last receipt date, or fall back to the SKU creation date
    const receiptDate = receipts.length > 0
      ? new Date(receipts[0].receivedAt)
      : new Date(sku.createdAt);

    const ageDays = Math.floor((currentDate.getTime() - receiptDate.getTime()) / (1000 * 60 * 60 * 24));
    const value = round2(sl.quantityOnHand * sku.retailPrice);

    let bucketKey: string;
    if (ageDays <= 30) bucketKey = '0-30 days';
    else if (ageDays <= 60) bucketKey = '31-60 days';
    else if (ageDays <= 90) bucketKey = '61-90 days';
    else if (ageDays <= 180) bucketKey = '91-180 days';
    else bucketKey = '180+ days';

    buckets[bucketKey].skuCount++;
    buckets[bucketKey].totalUnits += sl.quantityOnHand;
    buckets[bucketKey].totalValue += value;

    const product = store.findById(store.products, sku.productId);
    const location = store.findById(store.locations, sl.locationId);

    topAging.push({
      skuId: sl.skuId,
      sku: sku.sku,
      productName: product?.name ?? 'Unknown',
      locationId: sl.locationId,
      locationName: location?.name ?? 'Unknown',
      quantityOnHand: sl.quantityOnHand,
      ageDays,
      value,
    });
  }

  // Sort topAging by age descending and take top 20
  topAging.sort((a, b) => b.ageDays - a.ageDays);
  const topAgingResult = topAging.slice(0, 20);

  const agingBuckets = Object.entries(buckets).map(([bucket, data]) => ({
    bucket,
    skuCount: data.skuCount,
    totalUnits: data.totalUnits,
    totalValue: round2(data.totalValue),
  }));

  return reply.send({ agingBuckets, topAging: topAgingResult });
}

// ─── GET /reports/match-health ──────────────────────────

export async function matchHealth(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const matches = store.sopoMatches;
  const totalMatches = matches.length;

  // SO-PO match rate: how many SO lines have at least one match
  const totalSOLines = store.soLines.length;
  const matchedSOLineIds = new Set(matches.map(m => m.salesOrderLineId).filter(Boolean));
  const matchRate = totalSOLines > 0
    ? round2((matchedSOLineIds.size / totalSOLines) * 100)
    : 0;

  // Auto-confirm rate
  const autoConfirmed = matches.filter(m => m.status === 'AUTO_CONFIRMED').length;
  const autoConfirmRate = totalMatches > 0 ? round2((autoConfirmed / totalMatches) * 100) : 0;

  // Average match score
  const avgMatchScore = totalMatches > 0
    ? round2(matches.reduce((sum, m) => sum + m.matchScore, 0) / totalMatches)
    : 0;

  // By status
  const byStatus: Record<string, number> = {};
  for (const match of matches) {
    byStatus[match.status] = (byStatus[match.status] ?? 0) + 1;
  }

  // Recent matching runs
  const recentRuns = store.matchingRuns
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 5)
    .map(run => ({
      id: run.id,
      triggeredBy: run.triggeredBy,
      matchesProposed: run.matchesProposed,
      matchesAutoConfirmed: run.matchesAutoConfirmed,
      matchesRequiringReview: run.matchesRequiringReview,
      unmatched: run.unmatched,
      avgMatchScore: run.avgMatchScore,
      executionTimeMs: run.executionTimeMs,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    }));

  return reply.send({
    totalMatches,
    matchRate,
    autoConfirmRate,
    avgMatchScore,
    byStatus,
    recentRuns,
  });
}

// ─── GET /reports/executive-kpis ────────────────────────

export async function executiveKpis(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const ts = now();

  // Revenue
  const totalRevenue = round2(store.salesOrders.reduce((sum, so) => sum + so.totalAmount, 0));
  const shippedRevenue = round2(
    store.salesOrders
      .filter(so => ['SHIPPED', 'DELIVERED', 'PARTIALLY_SHIPPED'].includes(so.status))
      .reduce((sum, so) => sum + so.totalAmount, 0)
  );

  // Channel split
  const channelRevenue: Record<string, number> = {};
  for (const so of store.salesOrders) {
    channelRevenue[so.channel] = round2((channelRevenue[so.channel] ?? 0) + so.totalAmount);
  }

  // Inventory
  const totalOnHand = store.stockLevels.reduce((sum, sl) => sum + sl.quantityOnHand, 0);
  const totalAllocated = store.stockLevels.reduce((sum, sl) => sum + sl.quantityAllocated, 0);
  const totalInTransit = store.stockLevels.reduce((sum, sl) => sum + sl.quantityInTransit, 0);

  // Inventory value
  let inventoryValue = 0;
  for (const sl of store.stockLevels) {
    const sku = store.findById(store.skus, sl.skuId);
    if (sku) {
      inventoryValue += sl.quantityOnHand * sku.retailPrice;
    }
  }

  // Active SKUs
  const activeSkus = store.skus.filter(s => s.isActive).length;
  const skusWithStock = new Set(
    store.stockLevels.filter(sl => sl.quantityOnHand > 0).map(sl => sl.skuId)
  ).size;

  // Orders
  const totalPOs = store.purchaseOrders.length;
  const totalSOs = store.salesOrders.length;
  const openPOs = store.purchaseOrders.filter(
    po => !['RECEIVED', 'CLOSED', 'CANCELLED'].includes(po.status)
  ).length;
  const openSOs = store.salesOrders.filter(
    so => !['DELIVERED', 'CANCELLED', 'RETURNED'].includes(so.status)
  ).length;

  // PO spend
  const totalPOSpend = round2(store.purchaseOrders.reduce((sum, po) => sum + po.totalAmount, 0));

  // Supply chain
  const pendingRecommendations = store.aiRecommendations.filter(r => r.status === 'PENDING').length;
  const unresolvedAnomalies = store.anomalyAlerts.filter(a => !a.isResolved).length;

  // Match health
  const matches = store.sopoMatches;
  const avgMatchScore = matches.length > 0
    ? round2(matches.reduce((sum, m) => sum + m.matchScore, 0) / matches.length)
    : 0;
  const autoConfirmed = matches.filter(m => m.status === 'AUTO_CONFIRMED').length;
  const autoConfirmRate = matches.length > 0
    ? round2((autoConfirmed / matches.length) * 100)
    : 0;

  return reply.send({
    revenue: {
      totalOrderValue: totalRevenue,
      shippedRevenue,
      byChannel: channelRevenue,
    },
    inventory: {
      totalOnHand,
      totalAllocated,
      totalInTransit,
      inventoryValue: round2(inventoryValue),
      activeSkus,
      skusWithStock,
    },
    orders: {
      totalPOs,
      openPOs,
      totalSOs,
      openSOs,
      totalPOSpend,
    },
    supply: {
      suppliersActive: store.suppliers.filter(s => s.isActive).length,
      locationsActive: store.locations.filter(l => l.isActive).length,
    },
    aiHealth: {
      pendingRecommendations,
      unresolvedAnomalies,
      avgMatchScore,
      autoConfirmRate,
      modelsActive: store.modelRegistry.filter(m => m.status === 'ACTIVE').length,
    },
    generatedAt: ts.toISOString(),
  });
}
