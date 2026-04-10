import type { Store } from '../Store.js';
import type { StockMovement, AuditLog } from '../types.js';
import { generateId } from '../../utils/id.js';

// ─── Weekly Sales History (2 years) ────────────────────

export interface WeeklySalesRecord {
  skuId: string;
  locationId: string;
  weekStart: string; // YYYY-MM-DD
  weekNumber: number; // 1-52
  unitsSold: number;
  revenue: number;
  returns: number;
  discountRevenue: number; // Revenue lost to discounts
  fullPriceUnits: number;
  markdownUnits: number;
  avgSellingPrice: number;
  sellThroughRate: number; // units sold / units available at start of week
}

export interface DailyTrafficRecord {
  locationId: string;
  date: string; // YYYY-MM-DD
  footfall: number;
  transactions: number;
  conversionRate: number;
  avgBasketSize: number;
  avgTransactionValue: number;
}

export interface SupplierPerformanceRecord {
  supplierId: string;
  month: string; // YYYY-MM
  posDelivered: number;
  posOnTime: number;
  onTimeRate: number;
  avgLeadTimeDays: number;
  defectRate: number;
  totalUnitsOrdered: number;
  totalUnitsReceived: number;
  totalUnitsDamaged: number;
}

export interface SeasonalSummary {
  season: string;
  year: number;
  totalRevenue: number;
  totalUnits: number;
  grossMarginPercent: number;
  sellThroughPercent: number;
  markdownPercent: number;
  stockoutEvents: number;
  topSellers: Array<{ skuId: string; productName: string; unitsSold: number }>;
  bottomSellers: Array<{ skuId: string; productName: string; unitsSold: number }>;
}

let _weeklySales: WeeklySalesRecord[] = [];
let _dailyTraffic: DailyTrafficRecord[] = [];
let _supplierPerformance: SupplierPerformanceRecord[] = [];
let _seasonalSummaries: SeasonalSummary[] = [];
let _historicalMovements: StockMovement[] = [];
let _historicalAuditLogs: AuditLog[] = [];

export function getHistoricalSales(): WeeklySalesRecord[] { return _weeklySales; }
export function getDailyTraffic(): DailyTrafficRecord[] { return _dailyTraffic; }
export function getSupplierPerformance(): SupplierPerformanceRecord[] { return _supplierPerformance; }
export function getSeasonalSummaries(): SeasonalSummary[] { return _seasonalSummaries; }
export function getHistoricalMovements(): StockMovement[] { return _historicalMovements; }
export function getHistoricalAuditLogs(): AuditLog[] { return _historicalAuditLogs; }

// ─── Category demand profiles ──────────────────────────
// Defines how demand varies by month for each category
// Values are multipliers on base velocity
const CATEGORY_SEASONALITY: Record<string, number[]> = {
  // Jan  Feb  Mar  Apr  May  Jun  Jul  Aug  Sep  Oct  Nov  Dec
  'Outerwear':  [0.6, 0.5, 0.3, 0.2, 0.2, 0.1, 0.2, 0.5, 1.0, 1.4, 1.6, 1.8],
  'Denim':      [0.8, 0.8, 0.9, 1.0, 1.0, 0.9, 0.8, 0.9, 1.1, 1.1, 1.0, 0.9],
  'Knitwear':   [0.8, 0.7, 0.4, 0.2, 0.1, 0.1, 0.1, 0.3, 0.8, 1.2, 1.5, 1.8],
  'T-shirts':   [0.5, 0.5, 0.8, 1.2, 1.5, 1.8, 1.6, 1.2, 0.8, 0.6, 0.5, 0.4],
  'Trousers':   [0.7, 0.7, 0.9, 1.0, 1.1, 1.0, 0.9, 0.9, 1.1, 1.1, 1.0, 0.8],
  'Accessories': [0.9, 0.8, 0.9, 1.0, 1.1, 1.0, 0.9, 0.9, 1.0, 1.1, 1.3, 1.8],
  'Footwear':   [0.6, 0.6, 0.8, 1.0, 1.0, 0.9, 0.7, 0.8, 1.2, 1.3, 1.2, 1.0],
};

// Location demand profiles (relative to EU base)
const LOCATION_PROFILES: Record<string, { demandMultiplier: number; peakMonths: number[]; footfallBase: number }> = {
  'Stockholm Norrmalmstorg': { demandMultiplier: 1.0, peakMonths: [6, 7, 11, 12], footfallBase: 350 },
  'Paris Rue Saint-Honoré':  { demandMultiplier: 1.4, peakMonths: [1, 3, 6, 9, 10], footfallBase: 520 },
  'London Dover Street':     { demandMultiplier: 1.2, peakMonths: [3, 6, 9, 11, 12], footfallBase: 480 },
  'New York Madison Ave':    { demandMultiplier: 1.5, peakMonths: [3, 5, 9, 11, 12], footfallBase: 600 },
  'Tokyo Aoyama':            { demandMultiplier: 1.3, peakMonths: [1, 3, 7, 10], footfallBase: 400 },
  'Seoul Gangnam':           { demandMultiplier: 1.1, peakMonths: [3, 4, 9, 10], footfallBase: 450 },
  'Milan Via della Spiga':   { demandMultiplier: 1.0, peakMonths: [2, 6, 9, 12], footfallBase: 380 },
};

export function seedHistory(store: Store): void {
  _weeklySales = [];
  _dailyTraffic = [];
  _supplierPerformance = [];
  _seasonalSummaries = [];
  _historicalMovements = [];
  _historicalAuditLogs = [];

  const today = new Date();
  const storeLocations = store.locations.filter(l => l.type === 'STORE');
  const warehouseUser = store.users.find(u => u.role === 'WAREHOUSE')!;

  // ─── 1. Weekly Sales: 104 weeks × ~50% of SKUs × stores that carry them ───
  for (const sku of store.skus) {
    const product = store.products.find(p => p.id === sku.productId);
    if (!product) continue;

    // Not all SKUs sell at all stores — use a deterministic assignment
    const skuHash = hashString(sku.id);
    const sellingStoreCount = 2 + (skuHash % 4); // 2-5 stores
    const sellingStores = storeLocations
      .map((s, i) => ({ store: s, score: hashString(sku.id + s.id) }))
      .sort((a, b) => a.score - b.score)
      .slice(0, sellingStoreCount);

    // Base velocity depends on price point and category
    const priceBasedVelocity = sku.retailPrice < 2000 ? 4.5 : sku.retailPrice < 5000 ? 2.5 : sku.retailPrice < 10000 ? 1.2 : 0.6;
    const isCarryOver = product.isCarryOver;

    for (const { store: location } of sellingStores) {
      const locProfile = LOCATION_PROFILES[location.name] || { demandMultiplier: 1.0, peakMonths: [], footfallBase: 300 };
      const categorySeason = CATEGORY_SEASONALITY[product.category] || CATEGORY_SEASONALITY['Trousers'];

      for (let week = 104; week >= 1; week--) {
        const weekDate = new Date(today);
        weekDate.setDate(weekDate.getDate() - week * 7);
        const month = weekDate.getMonth(); // 0-based
        const weekNumber = Math.ceil((weekDate.getTime() - new Date(weekDate.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));

        // Seasonal factor
        const seasonFactor = categorySeason[month];

        // Location factor
        const isPeakMonth = locProfile.peakMonths.includes(month + 1);
        const locationFactor = locProfile.demandMultiplier * (isPeakMonth ? 1.3 : 1.0);

        // Year-over-year growth (3% annual)
        const yearFactor = week > 52 ? 0.97 : 1.0;

        // Carry-over items have steadier demand
        const carryOverFactor = isCarryOver ? 0.85 : 1.0;

        // Random noise (log-normal distribution for realistic spikes)
        const noise = Math.exp((Math.random() - 0.5) * 0.6);

        const unitsSold = Math.max(0, Math.round(
          priceBasedVelocity * seasonFactor * locationFactor * yearFactor * carryOverFactor * noise
        ));

        if (unitsSold === 0 && Math.random() > 0.3) continue; // Skip many zero weeks to save memory

        // Markdown simulation: end-of-season sales (Jan-Feb for AW, Jul-Aug for SS)
        const isMarkdownPeriod = (month === 0 || month === 1 || month === 6 || month === 7);
        const markdownUnits = isMarkdownPeriod ? Math.floor(unitsSold * (0.2 + Math.random() * 0.3)) : 0;
        const fullPriceUnits = unitsSold - markdownUnits;
        const markdownDiscount = 0.3; // 30% off
        const revenue = fullPriceUnits * sku.retailPrice + markdownUnits * sku.retailPrice * (1 - markdownDiscount);
        const discountRevenue = markdownUnits * sku.retailPrice * markdownDiscount;
        const returns = Math.random() > 0.85 ? Math.floor(Math.random() * Math.max(1, Math.floor(unitsSold * 0.1))) : 0;
        const available = 5 + Math.floor(Math.random() * 20);

        _weeklySales.push({
          skuId: sku.id,
          locationId: location.id,
          weekStart: weekDate.toISOString().split('T')[0],
          weekNumber,
          unitsSold,
          revenue: Math.round(revenue),
          returns,
          discountRevenue: Math.round(discountRevenue),
          fullPriceUnits,
          markdownUnits,
          avgSellingPrice: unitsSold > 0 ? Math.round(revenue / unitsSold) : 0,
          sellThroughRate: available > 0 ? Math.round((unitsSold / available) * 100) / 100 : 0,
        });
      }
    }
  }

  // ─── 2. Daily Store Traffic: 90 days × 7 stores ───────
  for (const location of storeLocations) {
    const profile = LOCATION_PROFILES[location.name] || { demandMultiplier: 1.0, peakMonths: [], footfallBase: 300 };

    for (let day = 90; day >= 1; day--) {
      const date = new Date(today);
      date.setDate(date.getDate() - day);
      const dow = date.getDay(); // 0=Sun
      const month = date.getMonth();

      // Weekend boost
      const dowFactor = dow === 0 ? 1.3 : dow === 6 ? 1.5 : dow === 5 ? 1.2 : 1.0;
      const isPeak = profile.peakMonths.includes(month + 1);
      const noise = 0.8 + Math.random() * 0.4;

      const footfall = Math.round(profile.footfallBase * dowFactor * (isPeak ? 1.25 : 1.0) * noise);
      const conversionRate = 0.12 + Math.random() * 0.08; // 12-20%
      const transactions = Math.round(footfall * conversionRate);
      const avgBasketSize = 1.3 + Math.random() * 0.5;
      const avgTransactionValue = 2500 + Math.random() * 3000; // SEK

      _dailyTraffic.push({
        locationId: location.id,
        date: date.toISOString().split('T')[0],
        footfall,
        transactions,
        conversionRate: Math.round(conversionRate * 1000) / 1000,
        avgBasketSize: Math.round(avgBasketSize * 10) / 10,
        avgTransactionValue: Math.round(avgTransactionValue),
      });
    }
  }

  // ─── 3. Supplier Performance: 24 months × 5 suppliers ──
  for (const supplier of store.suppliers) {
    // Each supplier has a reliability profile
    const baseOnTimeRate = supplier.code === 'SUP-NT' ? 0.95 // Nordic Textile — very reliable
      : supplier.code === 'SUP-TI' ? 0.88  // Tessuti — good
      : supplier.code === 'SUP-DC' ? 0.78  // Denim Craft — some delays
      : supplier.code === 'SUP-EF' ? 0.82  // East Fashion — decent
      : 0.90; // Lisboa — reliable

    const baseDefectRate = supplier.code === 'SUP-TI' ? 0.008  // Italian — very low
      : supplier.code === 'SUP-NT' ? 0.005  // Nordic — excellent
      : supplier.code === 'SUP-DC' ? 0.025  // Denim — higher
      : supplier.code === 'SUP-EF' ? 0.018  // East — moderate
      : 0.012; // Lisboa — good

    for (let m = 24; m >= 1; m--) {
      const monthDate = new Date(today);
      monthDate.setMonth(monthDate.getMonth() - m);
      const monthStr = monthDate.toISOString().slice(0, 7);

      const posDelivered = 1 + Math.floor(Math.random() * 4);
      const noise = 0.9 + Math.random() * 0.2;
      const onTimeRate = Math.min(1, Math.max(0.5, baseOnTimeRate * noise));
      const posOnTime = Math.round(posDelivered * onTimeRate);

      const unitsOrdered = 200 + Math.floor(Math.random() * 800);
      const unitsReceived = Math.round(unitsOrdered * (0.95 + Math.random() * 0.05));
      const defectNoise = 0.5 + Math.random();
      const unitsDamaged = Math.round(unitsReceived * baseDefectRate * defectNoise);

      _supplierPerformance.push({
        supplierId: supplier.id,
        month: monthStr,
        posDelivered,
        posOnTime,
        onTimeRate: Math.round(onTimeRate * 1000) / 1000,
        avgLeadTimeDays: supplier.leadTimeDays + Math.floor((Math.random() - 0.3) * 10),
        defectRate: Math.round((unitsDamaged / unitsReceived) * 10000) / 10000,
        totalUnitsOrdered: unitsOrdered,
        totalUnitsReceived: unitsReceived,
        totalUnitsDamaged: unitsDamaged,
      });
    }
  }

  // ─── 4. Seasonal Summaries (last 4 seasons) ───────────
  const seasons: Array<{ season: string; year: number }> = [
    { season: 'AW', year: 2025 },
    { season: 'SS', year: 2025 },
    { season: 'AW', year: 2024 },
    { season: 'SS', year: 2026 },
  ];

  for (const s of seasons) {
    const isAW = s.season === 'AW';
    const baseRevenue = 450_000_000 + Math.floor(Math.random() * 100_000_000); // ~SEK 450-550M per season
    const units = 25000 + Math.floor(Math.random() * 10000);

    // Pick actual seeded SKUs for top/bottom sellers
    const shuffledSkus = [...store.skus].sort(() => Math.random() - 0.5);
    const topSellers = shuffledSkus.slice(0, 5).map((sku, i) => ({
      skuId: sku.id,
      productName: store.products.find(p => p.id === sku.productId)?.name || 'Unknown',
      unitsSold: 800 - i * 120 + Math.floor(Math.random() * 50),
    }));
    const bottomSellers = shuffledSkus.slice(-5).map((sku, i) => ({
      skuId: sku.id,
      productName: store.products.find(p => p.id === sku.productId)?.name || 'Unknown',
      unitsSold: 5 + Math.floor(Math.random() * 10),
    }));

    _seasonalSummaries.push({
      season: s.season,
      year: s.year,
      totalRevenue: baseRevenue,
      totalUnits: units,
      grossMarginPercent: 58 + Math.random() * 8, // 58-66%
      sellThroughPercent: isAW ? 72 + Math.random() * 12 : 68 + Math.random() * 15,
      markdownPercent: isAW ? 12 + Math.random() * 8 : 15 + Math.random() * 10,
      stockoutEvents: 30 + Math.floor(Math.random() * 40),
      topSellers,
      bottomSellers,
    });
  }

  // ─── 5. Historical Stock Movements (last 60 days) ─────
  const movementTypes: Array<{ type: StockMovement['type']; refType: string }> = [
    { type: 'PO_RECEIPT', refType: 'PO' },
    { type: 'SO_ALLOCATION', refType: 'SO' },
    { type: 'SO_SHIPMENT', refType: 'SO' },
    { type: 'TRANSFER_OUT', refType: 'TRANSFER' },
    { type: 'TRANSFER_IN', refType: 'TRANSFER' },
    { type: 'RETURN_RECEIPT', refType: 'SO' },
    { type: 'ADJUSTMENT_POSITIVE', refType: 'ADJUSTMENT' },
    { type: 'ADJUSTMENT_NEGATIVE', refType: 'ADJUSTMENT' },
    { type: 'RFID_RECONCILIATION', refType: 'ADJUSTMENT' },
  ];

  for (let day = 60; day >= 1; day--) {
    // 10-30 movements per day
    const movementsToday = 10 + Math.floor(Math.random() * 20);
    for (let m = 0; m < movementsToday; m++) {
      const sku = store.skus[Math.floor(Math.random() * store.skus.length)];
      const mt = movementTypes[Math.floor(Math.random() * movementTypes.length)];
      const fromLoc = store.locations[Math.floor(Math.random() * store.locations.length)];
      const toLoc = store.locations[Math.floor(Math.random() * store.locations.length)];

      const qty = mt.type === 'PO_RECEIPT' ? 10 + Math.floor(Math.random() * 50)
        : mt.type === 'SO_SHIPMENT' ? -(1 + Math.floor(Math.random() * 3))
        : mt.type === 'SO_ALLOCATION' ? -(1 + Math.floor(Math.random() * 3))
        : mt.type === 'TRANSFER_OUT' ? -(3 + Math.floor(Math.random() * 10))
        : mt.type === 'TRANSFER_IN' ? 3 + Math.floor(Math.random() * 10)
        : mt.type === 'RETURN_RECEIPT' ? 1 + Math.floor(Math.random() * 2)
        : mt.type === 'ADJUSTMENT_POSITIVE' ? 1 + Math.floor(Math.random() * 5)
        : mt.type === 'ADJUSTMENT_NEGATIVE' ? -(1 + Math.floor(Math.random() * 3))
        : Math.floor(Math.random() * 5) - 2; // RFID reconciliation can be ±

      const date = new Date(today);
      date.setDate(date.getDate() - day);
      date.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));

      _historicalMovements.push({
        id: generateId(),
        skuId: sku.id,
        type: mt.type,
        quantity: qty,
        fromLocationId: ['TRANSFER_OUT', 'SO_SHIPMENT', 'SO_ALLOCATION'].includes(mt.type) ? fromLoc.id : null,
        toLocationId: ['TRANSFER_IN', 'PO_RECEIPT', 'RETURN_RECEIPT'].includes(mt.type) ? toLoc.id : null,
        referenceType: mt.refType,
        referenceId: generateId(), // Reference to the original PO/SO
        reason: mt.type === 'ADJUSTMENT_NEGATIVE' ? 'Damaged item removed from shelf' : mt.type === 'RFID_RECONCILIATION' ? 'RFID cycle count adjustment' : null,
        performedById: warehouseUser.id,
        performedAt: date.toISOString(),
      });
    }
  }

  // Also add these to the main store for the movements endpoint
  store.stockMovements.push(..._historicalMovements.slice(-500)); // Last 500 in main store

  // ─── 6. Audit Logs (last 30 days) ─────────────────────
  const actions = ['CREATE', 'UPDATE', 'STATUS_CHANGE', 'DELETE'];
  const entityTypes = ['PO', 'SO', 'INVENTORY', 'USER', 'MATCH', 'RECOMMENDATION'];
  const allUsers = store.users.filter(u => u.isActive);

  for (let day = 30; day >= 1; day--) {
    const logsToday = 20 + Math.floor(Math.random() * 40);
    for (let l = 0; l < logsToday; l++) {
      const user = allUsers[Math.floor(Math.random() * allUsers.length)];
      const action = actions[Math.floor(Math.random() * actions.length)];
      const entityType = entityTypes[Math.floor(Math.random() * entityTypes.length)];

      const date = new Date(today);
      date.setDate(date.getDate() - day);
      date.setHours(7 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));

      _historicalAuditLogs.push({
        id: generateId(),
        userId: user.id,
        action,
        entityType,
        entityId: generateId(),
        oldValue: action === 'UPDATE' || action === 'STATUS_CHANGE' ? { status: 'DRAFT' } : null,
        newValue: action === 'UPDATE' || action === 'STATUS_CHANGE' ? { status: 'CONFIRMED' } : action === 'CREATE' ? { created: true } : null,
        ipAddress: `10.0.${Math.floor(Math.random() * 5)}.${Math.floor(Math.random() * 255)}`,
        timestamp: date.toISOString(),
      });
    }
  }

  store.auditLogs.push(..._historicalAuditLogs.slice(-200)); // Last 200 in main store
}

// Simple deterministic hash for consistent assignments
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}
