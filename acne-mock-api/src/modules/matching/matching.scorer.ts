import type { SOLine, POLine, SalesOrder, PurchaseOrder, Location, Supplier, Product, SKU } from '../../store/types.js';

// ─── TYPES ──────────────────────────────────────────────

export interface MatchContext {
  salesOrder: SalesOrder;
  purchaseOrder: PurchaseOrder;
  soLocation: Location | undefined;
  poLocation: Location | undefined;
  supplier: Supplier | undefined;
  soSku: SKU | undefined;
  poSku: SKU | undefined;
  soProduct: Product | undefined;
  poProduct: Product | undefined;
}

export interface MatchResult {
  score: number;
  factors: Record<string, number>;
}

// ─── WEIGHTS ────────────────────────────────────────────

const WEIGHTS = {
  skuExactMatch:       0.30,
  timingAlignment:     0.25,
  locationProximity:   0.15,
  quantityFit:         0.10,
  channelPriority:     0.08,
  seasonAlignment:     0.05,
  supplierReliability: 0.04,
  marginContribution:  0.03,
} as const;

// ─── FACTOR SCORERS ─────────────────────────────────────

function skuExactMatch(soLine: SOLine, poLine: POLine): number {
  return soLine.skuId === poLine.skuId ? 1.0 : 0.0;
}

/**
 * 1.0 if PO arrives >= 7 days before SO needed.
 * Linear decay to 0.0 at 30 days late.
 */
function timingAlignment(soLine: SOLine, poLine: POLine, ctx: MatchContext): number {
  const soNeeded = ctx.salesOrder.requestedShipDate;
  const poArrival = poLine.expectedDate ?? ctx.purchaseOrder.expectedDelivery;

  if (!soNeeded || !poArrival) return 0.5; // Unknown timing — neutral

  const soDate = new Date(soNeeded).getTime();
  const poDate = new Date(poArrival).getTime();
  const diffDays = (soDate - poDate) / (1000 * 60 * 60 * 24); // positive = PO arrives before SO needed

  if (diffDays >= 7) return 1.0;
  if (diffDays >= 0) return 0.7 + (diffDays / 7) * 0.3; // 0.7 → 1.0
  // PO arrives late — linear decay from 0.7 at 0 days late to 0.0 at 30 days late
  const lateDays = Math.abs(diffDays);
  if (lateDays >= 30) return 0.0;
  return 0.7 * (1 - lateDays / 30);
}

/**
 * 1.0 = same location
 * 0.7 = same region
 * 0.4 = different region
 * 0.0 = impossible (no location data)
 */
function locationProximity(_soLine: SOLine, _poLine: POLine, ctx: MatchContext): number {
  if (!ctx.soLocation || !ctx.poLocation) return 0.0;

  if (ctx.soLocation.id === ctx.poLocation.id) return 1.0;
  if (ctx.soLocation.region === ctx.poLocation.region) return 0.7;
  return 0.4;
}

/**
 * 1.0 if PO qty >= SO qty; proportional below.
 */
function quantityFit(soLine: SOLine, poLine: POLine): number {
  const soQty = soLine.quantityOrdered - soLine.quantityAllocated;
  const poQty = poLine.quantityOrdered - poLine.quantityReceived;

  if (soQty <= 0) return 1.0;
  if (poQty <= 0) return 0.0;
  if (poQty >= soQty) return 1.0;
  return poQty / soQty;
}

/**
 * Wholesale: 1.0; VIC (CLIENTELING): 0.9; E-com: 0.7; Retail: 0.6; Replenishment: 0.4
 */
function channelPriority(_soLine: SOLine, _poLine: POLine, ctx: MatchContext): number {
  const channel = ctx.salesOrder.channel;
  const type = ctx.salesOrder.type;

  if (type === 'REPLENISHMENT') return 0.4;

  switch (channel) {
    case 'WHOLESALE':    return 1.0;
    case 'CLIENTELING':  return 0.9;
    case 'ECOMMERCE':    return 0.7;
    case 'MARKETPLACE':  return 0.7;
    case 'RETAIL_STORE': return 0.6;
    default:             return 0.5;
  }
}

/**
 * 1.0 = same season; 0.5 = adjacent; 0.0 = mismatch.
 */
function seasonAlignment(_soLine: SOLine, _poLine: POLine, ctx: MatchContext): number {
  if (!ctx.soProduct || !ctx.poProduct) return 0.5;

  const soSeason = ctx.soProduct.season;
  const poSeason = ctx.purchaseOrder.season;
  const soYear = ctx.soProduct.seasonYear;
  const poYear = ctx.purchaseOrder.seasonYear;

  if (soSeason === poSeason && soYear === poYear) return 1.0;

  // Adjacent: same year different season, or adjacent year
  const yearDiff = Math.abs(soYear - poYear);
  if (yearDiff === 0) return 0.5; // Same year, different season
  if (yearDiff === 1) return 0.5; // Adjacent year
  return 0.0;
}

/**
 * Based on supplier's on-time delivery rate.
 * Uses lead time as a proxy: shorter lead time = more reliable.
 * Score clamped to 0.7 - 1.0 range.
 */
function supplierReliability(_soLine: SOLine, _poLine: POLine, ctx: MatchContext): number {
  if (!ctx.supplier) return 0.7;

  // Use lead time as reliability proxy: 30 days = 1.0, 60+ days = 0.7
  const leadTime = ctx.supplier.leadTimeDays;
  if (leadTime <= 30) return 1.0;
  if (leadTime >= 60) return 0.7;
  return 1.0 - ((leadTime - 30) / 30) * 0.3;
}

/**
 * Higher margin SOs scored higher.
 * Uses discount percent inversely and unit price as margin proxy.
 */
function marginContribution(soLine: SOLine, _poLine: POLine, ctx: MatchContext): number {
  if (!ctx.soSku) return 0.5;

  // Margin proxy: (retailPrice - costPrice) / retailPrice
  const costPrice = ctx.soProduct?.costPrice ?? 0;
  const retailPrice = ctx.soSku.retailPrice;

  if (retailPrice <= 0) return 0.5;

  const marginRatio = (retailPrice - costPrice) / retailPrice;
  // Discount reduces effective margin
  const effectiveMargin = marginRatio * (1 - soLine.discountPercent / 100);

  // Clamp to 0.0 - 1.0
  return Math.max(0.0, Math.min(1.0, effectiveMargin));
}

// ─── MAIN SCORER (PURE FUNCTION) ────────────────────────

/**
 * Pure scoring function: takes an SO line, PO line, and context,
 * returns a weighted match score with individual factor breakdowns.
 */
export function scoreMatch(soLine: SOLine, poLine: POLine, ctx: MatchContext): MatchResult {
  const factors: Record<string, number> = {
    skuExactMatch:       round(skuExactMatch(soLine, poLine)),
    timingAlignment:     round(timingAlignment(soLine, poLine, ctx)),
    locationProximity:   round(locationProximity(soLine, poLine, ctx)),
    quantityFit:         round(quantityFit(soLine, poLine)),
    channelPriority:     round(channelPriority(soLine, poLine, ctx)),
    seasonAlignment:     round(seasonAlignment(soLine, poLine, ctx)),
    supplierReliability: round(supplierReliability(soLine, poLine, ctx)),
    marginContribution:  round(marginContribution(soLine, poLine, ctx)),
  };

  let score = 0;
  for (const [factor, weight] of Object.entries(WEIGHTS)) {
    score += weight * (factors[factor] ?? 0);
  }

  return {
    score: round(score),
    factors,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
