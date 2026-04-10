import type { Store } from '../Store.js';
import type { DemandForecast, AIRecommendation, AnomalyAlert, ModelRegistry, Season } from '../types.js';
import { generateId } from '../../utils/id.js';
import { now, daysFromNow, daysAgo } from '../../utils/date.js';

export function seedAI(store: Store): void {
  const ts = now().toISOString();
  const plannerUser = store.users.find(u => u.role === 'PLANNER')!;
  const buyerUser = store.users.find(u => u.role === 'BUYER')!;

  // ─── 1. Demand Forecasts: 12 weeks × top 50 SKUs × key locations ───
  const forecastSkus = store.skus.slice(0, 50);
  const forecastLocations = store.locations.filter(l => l.type === 'STORE').slice(0, 5);

  for (const sku of forecastSkus) {
    const product = store.products.find(p => p.id === sku.productId);
    if (!product) continue;

    // Category-based base demand
    const catDemand: Record<string, number> = {
      'T-shirts': 8, 'Denim': 5, 'Knitwear': 4, 'Trousers': 3,
      'Outerwear': 2, 'Accessories': 3, 'Footwear': 2,
    };
    const baseDemand = catDemand[product.category] || 3;

    // Global forecast (locationId = null)
    for (let week = 1; week <= 12; week++) {
      const seasonalMod = getSeasonalModifier(product.category, week);
      const predicted = Math.max(1, Math.round(baseDemand * seasonalMod * (0.8 + Math.random() * 0.4)));
      const uncertainty = Math.max(1, Math.round(predicted * 0.25));

      store.demandForecasts.push({
        id: generateId(),
        skuId: sku.id,
        locationId: null,
        season: 'AW' as Season,
        seasonYear: 2026,
        forecastDate: daysFromNow(week * 7).toISOString(),
        predictedDemand: predicted,
        confidenceLow: Math.max(0, predicted - uncertainty - Math.floor(Math.random() * 3)),
        confidenceHigh: predicted + uncertainty + Math.floor(Math.random() * 5),
        modelVersion: '1.2.0',
        features: {
          historicalWeeks: 52,
          seasonalityScore: seasonalMod,
          trendDirection: Math.random() > 0.5 ? 'up' : 'stable',
          trendStrength: Math.round(Math.random() * 100) / 100,
          priceElasticity: -1.2 + Math.random() * 0.5,
          competitorIndex: 0.7 + Math.random() * 0.3,
        },
        createdAt: daysAgo(1).toISOString(),
      });
    }

    // Per-location forecasts for top locations
    for (const loc of forecastLocations) {
      for (let week = 1; week <= 12; week += 2) { // Every other week to reduce volume
        const locMod = 0.15 + Math.random() * 0.3; // Location gets 15-45% of global demand
        const predicted = Math.max(0, Math.round(baseDemand * locMod * getSeasonalModifier(product.category, week)));

        store.demandForecasts.push({
          id: generateId(),
          skuId: sku.id,
          locationId: loc.id,
          season: 'AW' as Season,
          seasonYear: 2026,
          forecastDate: daysFromNow(week * 7).toISOString(),
          predictedDemand: predicted,
          confidenceLow: Math.max(0, predicted - 2),
          confidenceHigh: predicted + 3,
          modelVersion: '1.2.0',
          features: null,
          createdAt: daysAgo(1).toISOString(),
        });
      }
    }
  }

  // ─── 2. AI Recommendations: 25 richly detailed recommendations ─────

  const recommendations = buildRecommendations(store, plannerUser.id, buyerUser.id);
  store.aiRecommendations.push(...recommendations);

  // ─── 3. Anomaly Alerts: 15 detailed alerts ─────────────

  const anomalies = buildAnomalyAlerts(store, plannerUser.id);
  store.anomalyAlerts.push(...anomalies);

  // ─── 4. Model Registry: 5 models with full metadata ────

  store.modelRegistry.push(...buildModelRegistry());
}

function getSeasonalModifier(category: string, weekFromNow: number): number {
  // Current month is ~April, so weeks from now map to Apr-Jul
  const futureMonth = new Date().getMonth() + Math.floor(weekFromNow / 4);
  const month = futureMonth % 12;

  const mods: Record<string, number[]> = {
    'Outerwear':  [0.6, 0.5, 0.3, 0.2, 0.2, 0.1, 0.2, 0.5, 1.0, 1.4, 1.6, 1.8],
    'Knitwear':   [0.8, 0.7, 0.4, 0.2, 0.1, 0.1, 0.1, 0.3, 0.8, 1.2, 1.5, 1.8],
    'T-shirts':   [0.5, 0.5, 0.8, 1.2, 1.5, 1.8, 1.6, 1.2, 0.8, 0.6, 0.5, 0.4],
    'Denim':      [0.8, 0.8, 0.9, 1.0, 1.0, 0.9, 0.8, 0.9, 1.1, 1.1, 1.0, 0.9],
    'Trousers':   [0.7, 0.7, 0.9, 1.0, 1.1, 1.0, 0.9, 0.9, 1.1, 1.1, 1.0, 0.8],
    'Accessories': [0.9, 0.8, 0.9, 1.0, 1.1, 1.0, 0.9, 0.9, 1.0, 1.1, 1.3, 1.8],
    'Footwear':   [0.6, 0.6, 0.8, 1.0, 1.0, 0.9, 0.7, 0.8, 1.2, 1.3, 1.2, 1.0],
  };
  return (mods[category] || mods['Trousers'])[month];
}

function buildRecommendations(store: Store, plannerId: string, buyerId: string): AIRecommendation[] {
  const recs: AIRecommendation[] = [];
  const products = store.products;
  const locations = store.locations;
  const suppliers = store.suppliers;
  const pos = store.purchaseOrders;

  // REORDER recommendations
  const reorderProducts = [
    { idx: 0, loc: 'Stockholm Norrmalmstorg', weeks: 2, qty: 150 },
    { idx: 8, loc: 'Paris Froissart', weeks: 3, qty: 80 },
    { idx: 28, loc: 'Tokyo Aoyama', weeks: 1, qty: 200 },
    { idx: 30, loc: 'New York Greene Street', weeks: 4, qty: 120 },
    { idx: 18, loc: 'London Dover Street', weeks: 2, qty: 60 },
  ];
  for (const r of reorderProducts) {
    const p = products[r.idx % products.length];
    const loc = locations.find(l => l.name === r.loc) || locations[3];
    const sku = store.skus.find(s => s.productId === p.id) || store.skus[0];
    const supplier = suppliers.find(s => {
      const sd = store.suppliers;
      return s.id === sd[0].id; // Default
    }) || suppliers[0];

    recs.push({
      id: generateId(),
      type: 'REORDER',
      targetEntity: 'SKU',
      targetId: sku.id,
      recommendation: `${p.name} (${sku.colour}, ${sku.size}) is forecasted to stockout in ${r.weeks} weeks at ${r.loc}. Current stock: ${3 + Math.floor(Math.random() * 5)} units. Weekly velocity: ${(2 + Math.random() * 4).toFixed(1)} units/week. Recommended: create PO for ${r.qty} units from ${supplier.name}. Estimated lead time: ${supplier.leadTimeDays} days.`,
      confidence: 0.82 + Math.random() * 0.15,
      reasoning: {
        primaryFactor: 'stockout_risk',
        currentStock: 3 + Math.floor(Math.random() * 5),
        weeklyVelocity: Math.round((2 + Math.random() * 4) * 10) / 10,
        stockCoverWeeks: Math.round((0.5 + Math.random() * 2) * 10) / 10,
        forecastedDemand12w: r.qty,
        historicalSellThrough: 0.75 + Math.random() * 0.2,
        supplierLeadTime: supplier.leadTimeDays,
      },
      impact: {
        revenueAtRisk: Math.round(r.qty * sku.retailPrice * 0.7),
        revenueRecoverable: Math.round(r.qty * sku.retailPrice * 0.7 * 0.85),
        costOfReorder: Math.round(r.qty * p.costPrice),
        expectedROI: Math.round(((r.qty * sku.retailPrice * 0.7 * 0.85) / (r.qty * p.costPrice) - 1) * 100),
      },
      status: recs.length < 3 ? 'PENDING' : 'ACCEPTED',
      acceptedById: recs.length >= 3 ? plannerId : null,
      acceptedAt: recs.length >= 3 ? daysAgo(2).toISOString() : null,
      createdAt: daysAgo(1 + Math.floor(Math.random() * 5)).toISOString(),
    });
  }

  // TRANSFER recommendations
  const transfers = [
    { from: 'Tokyo Aoyama', to: 'Seoul Cheongdam', pIdx: 18, qty: 20, fromVelocity: 0.3, toVelocity: 4.2 },
    { from: 'Central Warehouse EU', to: 'Paris Froissart', pIdx: 0, qty: 15, fromVelocity: 0, toVelocity: 2.8 },
    { from: 'Stockholm Norrmalmstorg', to: 'London Dover Street', pIdx: 8, qty: 10, fromVelocity: 0.5, toVelocity: 3.1 },
    { from: 'New York Greene Street', to: 'Warehouse NA', pIdx: 38, qty: 25, fromVelocity: 0.2, toVelocity: 0 },
  ];
  for (const t of transfers) {
    const p = products[t.pIdx % products.length];
    const sku = store.skus.find(s => s.productId === p.id) || store.skus[0];
    const fromLoc = locations.find(l => l.name === t.from) || locations[0];
    const toLoc = locations.find(l => l.name === t.to) || locations[1];

    recs.push({
      id: generateId(),
      type: 'TRANSFER',
      targetEntity: 'SKU',
      targetId: sku.id,
      recommendation: `${t.from} has ${30 + Math.floor(Math.random() * 20)} units of ${p.name} with slow sell-through (${t.fromVelocity}/week). ${t.to} is selling ${t.toVelocity}/week and has ${Math.floor(Math.random() * 5)} weeks of cover. Recommend transfer of ${t.qty} units. Estimated transfer time: ${t.from.includes('Tokyo') ? '5-7 days' : '2-3 days'}.`,
      confidence: 0.72 + Math.random() * 0.18,
      reasoning: {
        primaryFactor: 'demand_imbalance',
        sourceVelocity: t.fromVelocity,
        destVelocity: t.toVelocity,
        sourceStockCover: Math.round((30 / Math.max(t.fromVelocity, 0.1)) * 10) / 10,
        destStockCover: Math.round((3 / Math.max(t.toVelocity, 0.1)) * 10) / 10,
        transferCost: t.from.includes('Tokyo') ? 'international' : 'domestic',
      },
      impact: {
        revenueGain: Math.round(t.qty * sku.retailPrice * 0.6),
        transferCost: t.from.includes('Tokyo') ? 15000 : 3000,
        netBenefit: Math.round(t.qty * sku.retailPrice * 0.6 - (t.from.includes('Tokyo') ? 15000 : 3000)),
      },
      status: 'PENDING',
      acceptedById: null,
      acceptedAt: null,
      createdAt: daysAgo(Math.floor(Math.random() * 7)).toISOString(),
    });
  }

  // MARKDOWN recommendations
  const markdowns = [
    { pIdx: 20, coverWeeks: 18, suggestDiscount: 25 },
    { pIdx: 22, coverWeeks: 22, suggestDiscount: 30 },
    { pIdx: 5, coverWeeks: 16, suggestDiscount: 20 },
    { pIdx: 14, coverWeeks: 20, suggestDiscount: 25 },
  ];
  for (const md of markdowns) {
    const p = products[md.pIdx % products.length];
    const totalStock = 40 + Math.floor(Math.random() * 80);

    recs.push({
      id: generateId(),
      type: 'MARKDOWN',
      targetEntity: 'SKU',
      targetId: store.skus.find(s => s.productId === p.id)?.id || store.skus[0].id,
      recommendation: `${p.name} has ${md.coverWeeks} weeks of stock cover across all locations (${totalStock} units). Sell-through rate is declining (−${10 + Math.floor(Math.random() * 20)}% month-over-month). Recommend ${md.suggestDiscount}% markdown to clear before SS2026 floor set in stores. Projected clearance: ${Math.floor(totalStock * 0.7)} units in 4 weeks at ${md.suggestDiscount}% off.`,
      confidence: 0.68 + Math.random() * 0.2,
      reasoning: {
        primaryFactor: 'overstock',
        stockCoverWeeks: md.coverWeeks,
        totalUnitsRemaining: totalStock,
        sellThroughTrend: 'declining',
        monthOverMonthChange: -(10 + Math.floor(Math.random() * 20)),
        seasonEndWeeks: 8 + Math.floor(Math.random() * 4),
        competitorPricing: 'at_or_below_current',
      },
      impact: {
        revenueAtFullPrice: Math.round(totalStock * p.costPrice * 2),
        revenueAtMarkdown: Math.round(totalStock * p.costPrice * 2 * (1 - md.suggestDiscount / 100) * 0.7),
        inventoryCarryCostSaved: Math.round(totalStock * p.costPrice * 0.02 * md.coverWeeks),
        markdownLoss: Math.round(totalStock * p.costPrice * 2 * (md.suggestDiscount / 100) * 0.7),
      },
      status: 'PENDING',
      acceptedById: null,
      acceptedAt: null,
      createdAt: daysAgo(3).toISOString(),
    });
  }

  // CANCEL_PO recommendations
  for (let i = 0; i < 3; i++) {
    const po = pos[i % pos.length];
    if (!po) continue;
    const p = products[i * 7 % products.length];

    recs.push({
      id: generateId(),
      type: 'CANCEL_PO',
      targetEntity: 'PO',
      targetId: po.id,
      recommendation: `${po.poNumber} for ${p.name}: demand forecast has dropped ${50 + Math.floor(Math.random() * 20)}% since PO creation on ${new Date(po.createdAt).toLocaleDateString()}. Current open SO demand covers only ${20 + Math.floor(Math.random() * 30)}% of ordered quantity. Recommend reducing from ${100 + Math.floor(Math.random() * 200)} to ${30 + Math.floor(Math.random() * 50)} units, or cancelling entirely to avoid overstock.`,
      confidence: 0.60 + Math.random() * 0.2,
      reasoning: {
        primaryFactor: 'demand_decline',
        demandDropPercent: 50 + Math.floor(Math.random() * 20),
        openSOCoverage: (20 + Math.floor(Math.random() * 30)) / 100,
        currentStockCover: 12 + Math.floor(Math.random() * 10),
        poStatus: po.status,
      },
      impact: {
        costSaving: Math.round(po.totalAmount * 0.6),
        overstockRiskReduction: 0.7 + Math.random() * 0.2,
        cancellationPenalty: po.status === 'IN_PRODUCTION' ? Math.round(po.totalAmount * 0.15) : 0,
      },
      status: i === 0 ? 'DISMISSED' : 'PENDING',
      acceptedById: null,
      acceptedAt: null,
      createdAt: daysAgo(5 + Math.floor(Math.random() * 10)).toISOString(),
    });
  }

  // EXPEDITE_PO recommendations
  for (let i = 0; i < 3; i++) {
    const po = pos[(i + 5) % pos.length];
    if (!po) continue;
    const supplier = store.suppliers.find(s => s.id === po.supplierId);

    recs.push({
      id: generateId(),
      type: 'EXPEDITE_PO',
      targetEntity: 'PO',
      targetId: po.id,
      recommendation: `${po.poNumber} from ${supplier?.name || 'Unknown'} is tracking ${7 + Math.floor(Math.random() * 14)} days behind schedule. ${80 + Math.floor(Math.random() * 300)} wholesale pre-orders and ${10 + Math.floor(Math.random() * 30)} e-commerce back-orders depend on this delivery. Recommend: (1) contact supplier for expedite, (2) consider air freight (est. SEK ${30000 + Math.floor(Math.random() * 50000)} additional cost), (3) partial shipment of top-priority SKUs.`,
      confidence: 0.75 + Math.random() * 0.15,
      reasoning: {
        primaryFactor: 'delivery_delay',
        daysLate: 7 + Math.floor(Math.random() * 14),
        dependentWholesaleOrders: 80 + Math.floor(Math.random() * 300),
        dependentEcomOrders: 10 + Math.floor(Math.random() * 30),
        supplierOnTimeRate: supplier ? 0.78 + Math.random() * 0.15 : 0.85,
        airFreightCostEstimate: 30000 + Math.floor(Math.random() * 50000),
      },
      impact: {
        revenueAtRisk: Math.round(po.totalAmount * 1.8), // Retail value of dependent SOs
        penaltyRisk: Math.round(po.totalAmount * 0.05), // Wholesale late delivery penalties
        expediteCost: 30000 + Math.floor(Math.random() * 50000),
        riskReduction: 0.7 + Math.random() * 0.2,
      },
      status: i === 0 ? 'ACCEPTED' : 'PENDING',
      acceptedById: i === 0 ? buyerId : null,
      acceptedAt: i === 0 ? daysAgo(1).toISOString() : null,
      createdAt: daysAgo(2 + Math.floor(Math.random() * 5)).toISOString(),
    });
  }

  return recs;
}

function buildAnomalyAlerts(store: Store, plannerId: string): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  const products = store.products;
  const skus = store.skus;
  const suppliers = store.suppliers;
  const locations = store.locations;

  const anomalies: Array<{
    type: string; severity: string; entityType: string;
    getEntityId: () => string; getDesc: () => string;
    value: number; rangeLow: number; rangeHigh: number;
    resolved: boolean;
  }> = [
    {
      type: 'DEMAND_SPIKE', severity: 'CRITICAL',
      entityType: 'SKU', getEntityId: () => skus[0].id,
      getDesc: () => `${products[0].name} (${skus[0].colour}) went viral on TikTok — selling at 5.2x normal rate across all channels. Stockholm sold out in 48 hours. Paris and London running critically low. Immediate reorder needed.`,
      value: 52, rangeLow: 8, rangeHigh: 15, resolved: false,
    },
    {
      type: 'DEMAND_SPIKE', severity: 'HIGH',
      entityType: 'SKU', getEntityId: () => skus[30].id,
      getDesc: () => `${products.find(p => p.id === skus[30].productId)?.name || 'Unknown'} demand up 3.1x at Tokyo Aoyama following celebrity sighting. Regional APAC demand trending 2.4x above forecast.`,
      value: 31, rangeLow: 8, rangeHigh: 12, resolved: false,
    },
    {
      type: 'DEMAND_DROP', severity: 'MEDIUM',
      entityType: 'SKU', getEntityId: () => skus[80].id,
      getDesc: () => `${products.find(p => p.id === skus[80].productId)?.name || 'Unknown'} sell-through dropped 65% week-over-week across all EU stores. Possible cause: competitor launched similar product at lower price point. Current stock cover: 22 weeks. Markdown may be needed.`,
      value: 0.35, rangeLow: 0.8, rangeHigh: 1.2, resolved: false,
    },
    {
      type: 'DEMAND_DROP', severity: 'LOW',
      entityType: 'SKU', getEntityId: () => skus[100].id,
      getDesc: () => `${products.find(p => p.id === skus[100].productId)?.name || 'Unknown'} in Dusty Pink colourway showing 40% lower velocity than other colours. Consider reducing future orders for this colourway.`,
      value: 0.6, rangeLow: 0.9, rangeHigh: 1.1, resolved: false,
    },
    {
      type: 'SUPPLIER_DELAY', severity: 'HIGH',
      entityType: 'SUPPLIER', getEntityId: () => suppliers[2].id,
      getDesc: () => `${suppliers[2].name} (Turkey) — last 3 POs trending 12 days behind schedule. Root cause: raw material shortage affecting Turkish denim mills. Impact: ${150 + Math.floor(Math.random() * 200)} wholesale pre-orders at risk. Supplier has acknowledged and proposed air freight for critical items.`,
      value: 12, rangeLow: -3, rangeHigh: 5, resolved: false,
    },
    {
      type: 'SUPPLIER_DELAY', severity: 'MEDIUM',
      entityType: 'SUPPLIER', getEntityId: () => suppliers[3].id,
      getDesc: () => `${suppliers[3].name} (China) — quality issues reported on latest batch. 2-week re-inspection delay expected. Affects Face Collection tees for AW26.`,
      value: 14, rangeLow: 0, rangeHigh: 5, resolved: false,
    },
    {
      type: 'STOCK_DISCREPANCY', severity: 'HIGH',
      entityType: 'LOCATION', getEntityId: () => locations.find(l => l.name === 'Paris Froissart')?.id || locations[4].id,
      getDesc: () => `RFID cycle count at Paris Froissart shows discrepancies on 23 SKUs (total: -34 units vs system). Largest gaps: Musubi Mini Bag BLK (-5 units), 1996 Straight Leg NVY-30 (-4 units). Possible shrinkage or receiving errors. Investigation recommended.`,
      value: 34, rangeLow: 0, rangeHigh: 5, resolved: false,
    },
    {
      type: 'STOCK_DISCREPANCY', severity: 'MEDIUM',
      entityType: 'LOCATION', getEntityId: () => locations.find(l => l.name === 'London Dover Street')?.id || locations[5].id,
      getDesc: () => `London Dover Street RFID count shows +12 units above system for Edlund Logo Tee. Likely unreported transfer receipt. Needs reconciliation.`,
      value: 12, rangeLow: -2, rangeHigh: 2, resolved: true,
    },
    {
      type: 'MARGIN_EROSION', severity: 'MEDIUM',
      entityType: 'SKU', getEntityId: () => skus[10].id,
      getDesc: () => `${products.find(p => p.id === skus[10].productId)?.name || 'Unknown'} — average realised selling price trending 18% below target across wholesale channel. Driven by increased discount requests from 3 key accounts. Current blended margin: 48% (target: 58%).`,
      value: 0.48, rangeLow: 0.55, rangeHigh: 0.65, resolved: false,
    },
    {
      type: 'MARGIN_EROSION', severity: 'LOW',
      entityType: 'SKU', getEntityId: () => skus[145].id,
      getDesc: () => `${products.find(p => p.id === skus[145].productId)?.name || 'Unknown'} — exchange rate impact: EUR/SEK movement has eroded margin by 3.2pp on EU wholesale orders since PO was placed. Consider hedging for next season.`,
      value: 0.032, rangeLow: 0, rangeHigh: 0.015, resolved: false,
    },
    {
      type: 'DEMAND_SPIKE', severity: 'MEDIUM',
      entityType: 'SKU', getEntityId: () => skus[165].id,
      getDesc: () => `${products.find(p => p.id === skus[165].productId)?.name || 'Unknown'} — steady upward trend in Seoul Cheongdam: +15% WoW for 4 consecutive weeks. Current trajectory suggests stockout in 3 weeks. Monitor and consider proactive reorder.`,
      value: 1.6, rangeLow: 0.9, rangeHigh: 1.2, resolved: false,
    },
    // Resolved anomalies (historical)
    {
      type: 'DEMAND_SPIKE', severity: 'HIGH',
      entityType: 'SKU', getEntityId: () => skus[28].id,
      getDesc: () => `[RESOLVED] Face Patch Tee — fashion week demand spike (2x). Additional stock allocated from warehouse. Normal levels resumed.`,
      value: 2.0, rangeLow: 0.8, rangeHigh: 1.3, resolved: true,
    },
    {
      type: 'SUPPLIER_DELAY', severity: 'HIGH',
      entityType: 'SUPPLIER', getEntityId: () => suppliers[0].id,
      getDesc: () => `[RESOLVED] ${suppliers[0].name} — week 8 delay due to Italian public holiday scheduling. PO arrived 5 days late. Stock allocated to priority SOs within 24h of receipt.`,
      value: 5, rangeLow: -2, rangeHigh: 3, resolved: true,
    },
    {
      type: 'STOCK_DISCREPANCY', severity: 'MEDIUM',
      entityType: 'LOCATION', getEntityId: () => locations.find(l => l.name === 'Stockholm Norrmalmstorg')?.id || locations[3].id,
      getDesc: () => `[RESOLVED] Stockholm cycle count discrepancy (8 units). Root cause: transfer from warehouse not scanned at receipt. System reconciled.`,
      value: 8, rangeLow: 0, rangeHigh: 3, resolved: true,
    },
    {
      type: 'MARGIN_EROSION', severity: 'LOW',
      entityType: 'SKU', getEntityId: () => skus[50].id,
      getDesc: () => `[RESOLVED] End-of-season markdown cleared overstock successfully. 85% of excess inventory sold at 25% discount. Final season margin: 52% (above break-even target of 45%).`,
      value: 0.52, rangeLow: 0.45, rangeHigh: 0.60, resolved: true,
    },
  ];

  for (const a of anomalies) {
    alerts.push({
      id: generateId(),
      type: a.type,
      severity: a.severity,
      entityType: a.entityType,
      entityId: a.getEntityId(),
      description: a.getDesc(),
      detectedValue: a.value,
      expectedRange: { low: a.rangeLow, high: a.rangeHigh },
      modelVersion: '1.2.0',
      isResolved: a.resolved,
      resolvedById: a.resolved ? plannerId : null,
      resolvedAt: a.resolved ? daysAgo(2 + Math.floor(Math.random() * 10)).toISOString() : null,
      createdAt: daysAgo(a.resolved ? 10 + Math.floor(Math.random() * 20) : Math.floor(Math.random() * 7)).toISOString(),
    });
  }

  return alerts;
}

function buildModelRegistry(): ModelRegistry[] {
  return [
    {
      id: generateId(),
      modelName: 'demand_forecast',
      version: '1.2.0',
      status: 'ACTIVE',
      metrics: { mae: 2.8, rmse: 4.1, mape: 0.18, r2: 0.89, mse: 16.8 },
      hyperparameters: { lstmUnits: [128, 64], dropout: 0.2, learningRate: 0.001, batchSize: 64, epochs: 150, lookbackWeeks: 52, optimizer: 'adam' },
      trainingDataRange: { from: daysAgo(730).toISOString(), to: daysAgo(7).toISOString(), recordCount: 85000, skuCount: 200, locationCount: 10 },
      artifactPath: 's3://acne-ml-models/demand_forecast/v1.2.0/model.onnx',
      trainedAt: daysAgo(5).toISOString(),
      activatedAt: daysAgo(4).toISOString(),
      createdAt: daysAgo(5).toISOString(),
    },
    {
      id: generateId(),
      modelName: 'demand_forecast',
      version: '1.1.0',
      status: 'RETIRED',
      metrics: { mae: 3.4, rmse: 5.0, mape: 0.22, r2: 0.85, mse: 25.0 },
      hyperparameters: { lstmUnits: [64, 32], dropout: 0.2, learningRate: 0.001, batchSize: 32, epochs: 100, lookbackWeeks: 26, optimizer: 'adam' },
      trainingDataRange: { from: daysAgo(900).toISOString(), to: daysAgo(60).toISOString(), recordCount: 62000, skuCount: 150, locationCount: 8 },
      artifactPath: 's3://acne-ml-models/demand_forecast/v1.1.0/model.onnx',
      trainedAt: daysAgo(65).toISOString(),
      activatedAt: daysAgo(64).toISOString(),
      createdAt: daysAgo(65).toISOString(),
    },
    {
      id: generateId(),
      modelName: 'match_scorer',
      version: '1.0.0',
      status: 'ACTIVE',
      metrics: { accuracy: 0.89, precision: 0.91, recall: 0.87, f1Score: 0.89, auc: 0.94, logloss: 0.28 },
      hyperparameters: { layers: [64, 32, 16], activation: 'relu', dropout: 0.3, learningRate: 0.0005, batchSize: 128, epochs: 200, ruleBlend: 0.7 },
      trainingDataRange: { from: daysAgo(365).toISOString(), to: daysAgo(14).toISOString(), recordCount: 12000, confirmedMatches: 8500, rejectedMatches: 3500 },
      artifactPath: 's3://acne-ml-models/match_scorer/v1.0.0/model.onnx',
      trainedAt: daysAgo(10).toISOString(),
      activatedAt: daysAgo(9).toISOString(),
      createdAt: daysAgo(10).toISOString(),
    },
    {
      id: generateId(),
      modelName: 'anomaly_detector',
      version: '1.1.0',
      status: 'ACTIVE',
      metrics: { precision: 0.84, recall: 0.92, f1Score: 0.88, falsePositiveRate: 0.08, avgDetectionLatencyHours: 2.3 },
      hyperparameters: { encoderLayers: [64, 32, 8], decoderLayers: [32, 64], reconstructionThreshold: 0.15, anomalyTypes: 5, trainingEpochs: 300 },
      trainingDataRange: { from: daysAgo(730).toISOString(), to: daysAgo(7).toISOString(), recordCount: 45000, anomalousRecords: 1200 },
      artifactPath: 's3://acne-ml-models/anomaly_detector/v1.1.0/model.onnx',
      trainedAt: daysAgo(7).toISOString(),
      activatedAt: daysAgo(6).toISOString(),
      createdAt: daysAgo(7).toISOString(),
    },
    {
      id: generateId(),
      modelName: 'allocation_optimizer',
      version: '0.9.0',
      status: 'TRAINING',
      metrics: { avgReward: 7.8, maxReward: 12.3, episodesCompleted: 25000, convergenceEpoch: null, validationReward: 6.9 },
      hyperparameters: { algorithm: 'DQN', hiddenLayers: [128, 64], epsilon: 0.15, gamma: 0.99, replayBufferSize: 50000, targetUpdateFreq: 1000 },
      trainingDataRange: { from: daysAgo(730).toISOString(), to: daysAgo(1).toISOString(), recordCount: 30000, simulatedEpisodes: 25000 },
      artifactPath: 's3://acne-ml-models/allocation_optimizer/v0.9.0/checkpoint/',
      trainedAt: daysAgo(1).toISOString(),
      activatedAt: null,
      createdAt: daysAgo(14).toISOString(),
    },
  ];
}
