import { store } from '../../store/Store.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';
import { faker } from '@faker-js/faker';
import type { SalesOrder, SOLine } from '../../store/types.js';

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

// Local SimEvent definition to avoid circular import with simulation.ts
interface SimEvent {
  id: string;
  timestamp: string;
  system: string;
  type: string;
  summary: string;
  entityId: string | null;
  details: Record<string, unknown>;
}

export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ScenarioCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  affects: string;
  exampleTrigger: string;
  defaultDurationMinutes: number;
  defaultSeverity: Severity;
  configurableParams: string[];
}

export interface ActiveScenarioInfo {
  instanceId: string;
  scenarioId: string;
  name: string;
  severity: Severity;
  activatedAt: string;
  expiresAt: string;
  status: 'ACTIVE' | 'RESOLVED';
  resolvedAt: string | null;
  eventsGenerated: number;
  context: Record<string, unknown>;
}

interface ActiveScenarioInternal extends ActiveScenarioInfo {
  generateTick: () => SimEvent[];
}

// ═══════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════

const activeScenarios: ActiveScenarioInternal[] = [];

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function chance(pct: number): boolean {
  return Math.random() * 100 < Math.min(pct, 95); // cap at 95% — nothing is certain
}

function sevMult(s: Severity): number {
  return { LOW: 0.4, MEDIUM: 1, HIGH: 1.8, CRITICAL: 3 }[s];
}

function sEvt(
  system: string, type: string, summary: string,
  entityId: string | null, details: Record<string, unknown>,
  ctx: { id: string; name: string },
): SimEvent {
  return {
    id: generateId(),
    timestamp: now().toISOString(),
    system,
    type,
    summary: `[SCENARIO] ${summary}`,
    entityId,
    details: { ...details, _scenario: ctx },
  };
}

const MARKETS = ['US', 'SE', 'FR', 'GB', 'DE', 'JP', 'KR', 'AU', 'CN', 'IT', 'DK', 'SG', 'HK'];
const REGIONS = ['EU', 'NA', 'APAC'];
const currencyFor: Record<string, string> = { US: 'USD', SE: 'SEK', FR: 'EUR', GB: 'GBP', DE: 'EUR', JP: 'JPY', KR: 'KRW', AU: 'AUD', CN: 'CNY', IT: 'EUR', DK: 'EUR', SG: 'SGD', HK: 'HKD' };

function rProduct() { return store.products[Math.floor(Math.random() * store.products.length)]; }
function rSupplier() { return store.suppliers[Math.floor(Math.random() * store.suppliers.length)]; }
function rStore() { const s = store.locations.filter(l => l.type === 'STORE'); return s[Math.floor(Math.random() * s.length)]; }
function rWarehouse() { const w = store.locations.filter(l => l.type === 'WAREHOUSE'); return w[Math.floor(Math.random() * w.length)]; }
function rMarket() { return faker.helpers.arrayElement(MARKETS); }

function storesIn(cc: string) { return store.locations.filter(l => l.type === 'STORE' && l.countryCode === cc); }
function storesInRegion(region: string) { return store.locations.filter(l => l.type === 'STORE' && l.region === region); }
function skusFor(productId: string) { return store.skus.filter(s => s.productId === productId); }
function nameFor(sku: { productId: string }) { return store.products.find(p => p.id === sku.productId)?.name || '?'; }

function createScenarioOrder(sku: { id: string; retailPrice: number; productId: string }, market: string, discount = 0): { soId: string; soNumber: string } {
  const soId = generateId();
  const soNumber = `SO-EC-SCN-${generateId().slice(0, 6).toUpperCase()}`;
  const currency = (currencyFor[market] || 'EUR') as any;
  const qty = 1 + Math.floor(Math.random() * 2);
  const unitPrice = Math.round(sku.retailPrice * (1 - discount / 100));
  const lineTotal = qty * unitPrice;
  const ecomUser = store.users.find(u => u.role === 'ECOM')!;

  const soLine: SOLine = {
    id: generateId(), salesOrderId: soId, skuId: sku.id,
    quantityOrdered: qty, quantityAllocated: 0, quantityShipped: 0, quantityReturned: 0,
    unitPrice, discountPercent: discount, lineTotal,
    notes: '[SCENARIO]', createdAt: now().toISOString(), updatedAt: now().toISOString(),
  };
  const so: SalesOrder = {
    id: soId, soNumber, channel: 'ECOMMERCE', type: 'STANDARD', status: 'CONFIRMED',
    locationId: store.locations[0].id, customerId: generateId(),
    customerName: faker.person.fullName(), customerEmail: faker.internet.email(),
    wholesaleBuyerId: null, currency,
    subtotal: Math.round(lineTotal), taxAmount: Math.round(lineTotal * 0.25),
    discountAmount: discount > 0 ? Math.round(qty * sku.retailPrice * discount / 100) : 0,
    totalAmount: Math.round(lineTotal * 1.25),
    shippingAddress: faker.location.streetAddress(), shippingCity: faker.location.city(),
    shippingCountry: market,
    requestedShipDate: now().toISOString(), actualShipDate: null, deliveredAt: null,
    notes: `[SCENARIO] Order from ${market}`, priority: 0,
    createdById: ecomUser.id, createdAt: now().toISOString(), updatedAt: now().toISOString(),
  };
  store.salesOrders.push(so);
  store.soLines.push(soLine);
  return { soId, soNumber };
}

function depleteStock(skuId: string, locationId: string, qty: number): number {
  const sl = store.stockLevels.find(s => s.skuId === skuId && s.locationId === locationId);
  if (!sl || sl.quantityOnHand <= 0) return 0;
  const depleted = Math.min(sl.quantityOnHand, qty);
  sl.quantityOnHand -= depleted;
  sl.updatedAt = now().toISOString();
  return depleted;
}

// ═══════════════════════════════════════════════════════════
// SCENARIO CATALOG
// ═══════════════════════════════════════════════════════════

export const SCENARIO_CATALOG: ScenarioCatalogEntry[] = [
  // ── Demand Shocks ─────────────────────────────────────
  {
    id: 'VIRAL_PRODUCT',
    name: 'Viral Product',
    description: 'A product goes viral on social media in a specific market, causing an explosive demand spike that overwhelms inventory and fulfillment.',
    category: 'DEMAND',
    affects: 'E-commerce, inventory, fulfillment, customer service',
    exampleTrigger: 'A TikTok creator features the Musubi bag, generating 2M+ views overnight',
    defaultDurationMinutes: 10080, // 1 week
    defaultSeverity: 'HIGH',
    configurableParams: ['market', 'productId', 'severity', 'durationMinutes'],
  },
  {
    id: 'CELEBRITY_ENDORSEMENT',
    name: 'Celebrity Endorsement',
    description: 'A major celebrity is photographed wearing Acne Studios, driving demand across an entire product category.',
    category: 'DEMAND',
    affects: 'All channels, wholesale, planning, marketing',
    exampleTrigger: 'A-list celebrity wears Acne outerwear to a premiere — photos go viral across global media',
    defaultDurationMinutes: 20160, // 2 weeks
    defaultSeverity: 'MEDIUM',
    configurableParams: ['category', 'severity', 'durationMinutes'],
  },
  {
    id: 'FLASH_SALE_GONE_WRONG',
    name: 'Flash Sale Gone Wrong',
    description: 'A promotional code leaks or a sale event gets far more traction than planned, flooding the system with discounted orders.',
    category: 'DEMAND',
    affects: 'E-commerce, payments, fulfillment, finance, customer service',
    exampleTrigger: 'An influencer shares a 40%-off promo code meant for VICs only — it spreads to Reddit and Twitter',
    defaultDurationMinutes: 1440, // 1 day
    defaultSeverity: 'HIGH',
    configurableParams: ['discountPercent', 'severity', 'durationMinutes'],
  },

  // ── Market & Economic ─────────────────────────────────
  {
    id: 'GEOPOLITICAL_DISRUPTION',
    name: 'Geopolitical Disruption',
    description: 'Political tensions, trade sanctions, or a consumer boycott in a market sharply reduces demand and disrupts wholesale relationships.',
    category: 'MARKET',
    affects: 'Wholesale, retail stores, e-commerce, finance, legal',
    exampleTrigger: 'New import tariffs announced on EU luxury goods in a key Asian market',
    defaultDurationMinutes: 43200, // 1 month
    defaultSeverity: 'HIGH',
    configurableParams: ['market', 'severity', 'durationMinutes'],
  },
  {
    id: 'MARKET_RECESSION',
    name: 'Market Recession',
    description: 'A sudden economic downturn in a specific market causes consumer spending to plummet, returns to spike, and wholesale partners to pull back.',
    category: 'MARKET',
    affects: 'All channels in affected market, finance, planning',
    exampleTrigger: 'Consumer confidence index crashes in the US after banking sector turmoil',
    defaultDurationMinutes: 129600, // 3 months
    defaultSeverity: 'HIGH',
    configurableParams: ['market', 'region', 'severity', 'durationMinutes'],
  },
  {
    id: 'GLOBAL_ECONOMIC_SLOWDOWN',
    name: 'Global Economic Slowdown',
    description: 'A worldwide economic contraction hits all markets simultaneously — demand drops, FX volatility spikes, and wholesale partners delay commitments.',
    category: 'MARKET',
    affects: 'All channels, all markets, finance, wholesale, planning',
    exampleTrigger: 'Global GDP forecasts revised downward after synchronized central bank tightening',
    defaultDurationMinutes: 259200, // 6 months
    defaultSeverity: 'MEDIUM',
    configurableParams: ['severity', 'durationMinutes'],
  },
  {
    id: 'CURRENCY_CRISIS',
    name: 'Currency Crisis',
    description: 'A sudden FX rate shock disrupts pricing, erodes margins, and complicates vendor payments across affected currencies.',
    category: 'MARKET',
    affects: 'Finance, supply chain payments, pricing, ERP',
    exampleTrigger: 'SEK depreciates 12% against EUR and USD in a single week after unexpected central bank decision',
    defaultDurationMinutes: 20160, // 2 weeks
    defaultSeverity: 'HIGH',
    configurableParams: ['severity', 'durationMinutes'],
  },

  // ── Supply Chain ──────────────────────────────────────
  {
    id: 'SUPPLIER_DISRUPTION',
    name: 'Supplier Disruption',
    description: 'A key supplier faces a production halt — factory fire, labour dispute, or regulatory shutdown — delaying all pending purchase orders.',
    category: 'SUPPLY',
    affects: 'Purchase orders, inventory planning, buying, supplier management',
    exampleTrigger: 'Primary denim supplier in Italy halts production due to factory flooding',
    defaultDurationMinutes: 43200, // 1 month
    defaultSeverity: 'HIGH',
    configurableParams: ['supplierId', 'severity', 'durationMinutes'],
  },
  {
    id: 'LOGISTICS_BOTTLENECK',
    name: 'Logistics Bottleneck',
    description: 'A port strike, carrier failure, or customs backlog blocks shipments in a region, delaying deliveries and creating warehouse backlogs.',
    category: 'SUPPLY',
    affects: 'Warehouse, shipping, customer service, retail replenishment',
    exampleTrigger: 'Dockworkers strike at major European port halts container unloading for 2+ weeks',
    defaultDurationMinutes: 20160, // 2 weeks
    defaultSeverity: 'HIGH',
    configurableParams: ['region', 'severity', 'durationMinutes'],
  },
  {
    id: 'RAW_MATERIAL_SHORTAGE',
    name: 'Raw Material Shortage',
    description: 'A critical raw material becomes scarce, delaying production across multiple suppliers and driving up costs.',
    category: 'SUPPLY',
    affects: 'All suppliers, purchase orders, PLM, costing, planning',
    exampleTrigger: 'Global organic cotton shortage after crop failure in major producing regions',
    defaultDurationMinutes: 129600, // 3 months
    defaultSeverity: 'MEDIUM',
    configurableParams: ['material', 'severity', 'durationMinutes'],
  },

  // ── Quality & Brand ───────────────────────────────────
  {
    id: 'QUALITY_CRISIS',
    name: 'Quality Crisis',
    description: 'A product batch has serious defects — fabric flaws, broken hardware, or dye issues — triggering mass returns, CS overload, and a potential recall.',
    category: 'QUALITY',
    affects: 'Customer service, retail stores, e-commerce returns, QA, finance, brand',
    exampleTrigger: 'Customers report zipper failures on a bestselling jacket within days of delivery',
    defaultDurationMinutes: 20160, // 2 weeks
    defaultSeverity: 'HIGH',
    configurableParams: ['productId', 'severity', 'durationMinutes'],
  },
  {
    id: 'COUNTERFEIT_SURGE',
    name: 'Counterfeit Surge',
    description: 'Counterfeit Acne products flood a market, confusing customers, damaging brand reputation, and complicating authentication.',
    category: 'QUALITY',
    affects: 'Brand, customer service, DPP/authentication, legal, retail',
    exampleTrigger: 'High-quality fakes of the Musubi bag appear on major marketplaces in Asia',
    defaultDurationMinutes: 43200, // 1 month
    defaultSeverity: 'MEDIUM',
    configurableParams: ['market', 'productId', 'severity', 'durationMinutes'],
  },

  // ── Operational ───────────────────────────────────────
  {
    id: 'WAREHOUSE_OUTAGE',
    name: 'Warehouse Outage',
    description: 'A distribution center goes offline due to fire, flooding, or system failure — blocking fulfillment and forcing emergency rerouting.',
    category: 'OPERATIONAL',
    affects: 'Warehouse, fulfillment, shipping, e-commerce, retail replenishment',
    exampleTrigger: 'Central Warehouse EU WMS system crashes and automated picking lines go offline',
    defaultDurationMinutes: 4320, // 3 days
    defaultSeverity: 'CRITICAL',
    configurableParams: ['locationId', 'severity', 'durationMinutes'],
  },
  {
    id: 'PAYMENT_PROVIDER_OUTAGE',
    name: 'Payment Provider Outage',
    description: 'A major payment provider (Adyen or Klarna) experiences downtime, blocking transactions across e-commerce and POS.',
    category: 'OPERATIONAL',
    affects: 'E-commerce, POS, finance, customer experience',
    exampleTrigger: 'Adyen experiences a Europe-wide outage during peak Saturday trading',
    defaultDurationMinutes: 720, // 12 hours
    defaultSeverity: 'CRITICAL',
    configurableParams: ['provider', 'severity', 'durationMinutes'],
  },
  {
    id: 'CYBER_INCIDENT',
    name: 'Cyber Security Incident',
    description: 'A security breach compromises systems — ransomware, data exfiltration, or DDoS — forcing partial shutdowns and incident response.',
    category: 'OPERATIONAL',
    affects: 'E-commerce, IT systems, customer data, legal, all operations',
    exampleTrigger: 'Ransomware attack encrypts internal systems; e-commerce site taken offline as precaution',
    defaultDurationMinutes: 10080, // 1 week
    defaultSeverity: 'CRITICAL',
    configurableParams: ['severity', 'durationMinutes'],
  },

  // ── External ──────────────────────────────────────────
  {
    id: 'WEATHER_ANOMALY',
    name: 'Unseasonable Weather',
    description: 'Extreme or unseasonable weather shifts demand between categories — warm winters kill outerwear sales, cold summers stall lightweight collections.',
    category: 'EXTERNAL',
    affects: 'Retail, planning, inventory allocation, markdown strategy',
    exampleTrigger: 'Record-warm November across Europe — outerwear sits unsold, knitwear demand plummets',
    defaultDurationMinutes: 43200, // 1 month
    defaultSeverity: 'MEDIUM',
    configurableParams: ['region', 'weatherType', 'severity', 'durationMinutes'],
  },

  // ── Season Launch ────────────────────────────────────
  {
    id: 'SEASON_LAUNCH',
    name: 'Season Collection Launch',
    description: 'A new season collection launches across all channels, triggering a surge in wholesale orders, press coverage, e-commerce traffic, inventory allocation pressure, and warehouse processing spikes.',
    category: 'BUSINESS',
    affects: 'All channels, wholesale, PLM, inventory, e-commerce, marketing, warehouse',
    exampleTrigger: 'SS27 collection officially launches across all Acne Studios channels simultaneously',
    defaultDurationMinutes: 20160, // 2 weeks
    defaultSeverity: 'HIGH',
    configurableParams: ['season', 'seasonYear', 'severity', 'durationMinutes'],
  },

  // ── Sizing Issues ─────────────────────────────────
  {
    id: 'SIZING_DEFECT',
    name: 'Sizing Defect (Runs Wrong)',
    description: 'A product batch has incorrect sizing — garments run too large or too small compared to the size chart, causing a wave of online returns with "wrong size" as the reason.',
    category: 'QUALITY',
    affects: 'E-commerce returns, customer service, inventory, finance, brand reputation',
    exampleTrigger: 'New denim fit runs 2 sizes too small — customers ordering their usual size receive garments that don\'t fit',
    defaultDurationMinutes: 20160, // 2 weeks
    defaultSeverity: 'HIGH',
    configurableParams: ['productId', 'severity', 'durationMinutes'],
  },
  {
    id: 'SIZE_CURVE_ERROR',
    name: 'Size Curve Ordering Error',
    description: 'A buying error applied the wrong size curve to a purchase order — too many XS/XL and not enough M/L. Core sizes sell out while extremes sit unsold.',
    category: 'SUPPLY',
    affects: 'Inventory allocation, lost sales, markdown pressure, planning, wholesale',
    exampleTrigger: 'AW26 knitwear PO used menswear size curve for womenswear — size S/M sold out in 3 days, XL overstock at 20 weeks cover',
    defaultDurationMinutes: 43200, // 1 month
    defaultSeverity: 'HIGH',
    configurableParams: ['productId', 'category', 'severity', 'durationMinutes'],
  },
];

// ═══════════════════════════════════════════════════════════
// SCENARIO ACTIVATION
// ═══════════════════════════════════════════════════════════

export function activateScenario(scenarioId: string, params: Record<string, unknown> = {}, simClockIso?: string): ActiveScenarioInfo | null {
  const def = SCENARIO_CATALOG.find(s => s.id === scenarioId);
  if (!def) return null;

  const severity = (params.severity as Severity) || def.defaultSeverity;
  const duration = (params.durationMinutes as number) || def.defaultDurationMinutes;
  // Use sim clock if available (scenario expiry is in simulated time)
  const activatedAt = simClockIso ? new Date(simClockIso) : now();
  const expiresAt = new Date(activatedAt.getTime() + duration * 60000);

  const base: Omit<ActiveScenarioInternal, 'generateTick'> = {
    instanceId: generateId(),
    scenarioId,
    name: def.name,
    severity,
    activatedAt: activatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    status: 'ACTIVE',
    resolvedAt: null,
    eventsGenerated: 0,
    context: {},
  };

  const makers: Record<string, (b: typeof base, p: Record<string, unknown>) => ActiveScenarioInternal> = {
    VIRAL_PRODUCT: makeViralProduct,
    CELEBRITY_ENDORSEMENT: makeCelebrityEndorsement,
    FLASH_SALE_GONE_WRONG: makeFlashSale,
    GEOPOLITICAL_DISRUPTION: makeGeopolitical,
    MARKET_RECESSION: makeRecession,
    GLOBAL_ECONOMIC_SLOWDOWN: makeGlobalSlowdown,
    CURRENCY_CRISIS: makeCurrencyCrisis,
    SUPPLIER_DISRUPTION: makeSupplierDisruption,
    LOGISTICS_BOTTLENECK: makeLogisticsBottleneck,
    RAW_MATERIAL_SHORTAGE: makeRawMaterialShortage,
    QUALITY_CRISIS: makeQualityCrisis,
    COUNTERFEIT_SURGE: makeCounterfeitSurge,
    WAREHOUSE_OUTAGE: makeWarehouseOutage,
    PAYMENT_PROVIDER_OUTAGE: makePaymentOutage,
    CYBER_INCIDENT: makeCyberIncident,
    WEATHER_ANOMALY: makeWeatherAnomaly,
    SEASON_LAUNCH: makeSeasonLaunch,
    SIZING_DEFECT: makeSizingDefect,
    SIZE_CURVE_ERROR: makeSizeCurveError,
  };

  const maker = makers[scenarioId];
  if (!maker) return null;

  const scenario = maker(base, params);
  activeScenarios.push(scenario);
  return toInfo(scenario);
}

function toInfo(s: ActiveScenarioInternal): ActiveScenarioInfo {
  const { generateTick: _, ...info } = s;
  return info;
}

// ═══════════════════════════════════════════════════════════
// TICK PROCESSOR (called by simulation.ts each interval)
// ═══════════════════════════════════════════════════════════

export function processScenarioTick(simClockIso?: string): SimEvent[] {
  const events: SimEvent[] = [];
  const checkTime = simClockIso ? new Date(simClockIso) : new Date();

  for (const scenario of activeScenarios) {
    if (scenario.status !== 'ACTIVE') continue;

    if (checkTime > new Date(scenario.expiresAt)) {
      scenario.status = 'RESOLVED';
      scenario.resolvedAt = simClockIso || now().toISOString();
      events.push({
        id: generateId(),
        timestamp: simClockIso || now().toISOString(),
        system: 'Simulation',
        type: 'SCENARIO_RESOLVED',
        summary: `[SCENARIO ENDED] "${scenario.name}" has expired and been auto-resolved after generating ${scenario.eventsGenerated} events`,
        entityId: null,
        details: { instanceId: scenario.instanceId, scenarioId: scenario.scenarioId, eventsGenerated: scenario.eventsGenerated },
      });
      continue;
    }

    const tickEvents = scenario.generateTick();
    events.push(...tickEvents);
  }

  return events;
}

// ═══════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════

export function getScenarioCatalog(): ScenarioCatalogEntry[] {
  return SCENARIO_CATALOG;
}

export function getActiveScenarios(): ActiveScenarioInfo[] {
  return activeScenarios.map(toInfo);
}

export function deactivateScenario(instanceId: string): ActiveScenarioInfo | null {
  const scenario = activeScenarios.find(s => s.instanceId === instanceId && s.status === 'ACTIVE');
  if (!scenario) return null;
  scenario.status = 'RESOLVED';
  scenario.resolvedAt = now().toISOString();
  return toInfo(scenario);
}

export function clearAllScenarios(): void {
  activeScenarios.length = 0;
}

// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════
//
// SCENARIO IMPLEMENTATIONS
//
// ═══════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════


// ─── 1. VIRAL PRODUCT ────────────────────────────────────
// A product goes viral on social media in a specific market.
// Effects: massive ecom orders, stock depletion, social buzz,
// back-in-stock requests, CS overload.

function makeViralProduct(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const product = params.productId
    ? (store.products.find(p => p.id === params.productId) || rProduct())
    : rProduct();
  const market = (params.market as string) || rMarket();
  const skus = skusFor(product.id);
  const mult = sevMult(base.severity);

  base.name = `Viral Product: ${product.name} in ${market}`;
  base.context = { productId: product.id, productName: product.name, market, styleNumber: product.styleNumber };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Surge of ecom orders
      if (chance(55 * mult)) {
        const sku = faker.helpers.arrayElement(skus);
        const { soId, soNumber } = createScenarioOrder(sku, market);
        events.push(sEvt('SFCC', 'ECOMMERCE_ORDER',
          `Viral demand: ${soNumber} — ${product.name} (${sku.colour}, ${sku.size}) ordered from ${market}`,
          soId, { soNumber, productName: product.name, market }, ctx));
      }

      // Social media buzz
      if (chance(35 * mult)) {
        const platform = faker.helpers.arrayElement(['TikTok', 'Instagram', 'X/Twitter', 'Xiaohongshu', 'Pinterest']);
        const mentions = (1000 + Math.floor(Math.random() * 50000)).toLocaleString();
        events.push(sEvt('CRM', 'SOCIAL_BUZZ',
          `${product.name} trending on ${platform} — ${mentions} new mentions in ${market}`,
          product.id, { platform, mentions, market }, ctx));
      }

      // Stock depletion at stores
      if (chance(40 * mult)) {
        const marketStores = storesIn(market);
        if (marketStores.length > 0) {
          const loc = faker.helpers.arrayElement(marketStores);
          const sku = faker.helpers.arrayElement(skus);
          const depleted = depleteStock(sku.id, loc.id, 1 + Math.floor(Math.random() * 3));
          if (depleted > 0) {
            const remaining = store.stockLevels.find(s => s.skuId === sku.id && s.locationId === loc.id)?.quantityOnHand ?? 0;
            events.push(sEvt('Nedap iD Cloud', 'STOCK_DEPLETION',
              `Viral demand: ${product.name} (${sku.colour}, ${sku.size}) — sold ${depleted} at ${loc.name}, ${remaining} remaining`,
              loc.id, { productName: product.name, depleted, remaining, locationName: loc.name }, ctx));
          }
        }
      }

      // Back-in-stock request surge
      if (chance(25 * mult)) {
        const count = 10 + Math.floor(Math.random() * 80);
        events.push(sEvt('SFCC', 'BACK_IN_STOCK_SURGE',
          `${count} back-in-stock alert signups for ${product.name} from ${market} in the last hour`,
          product.id, { count, market }, ctx));
      }

      // CS tickets about availability
      if (chance(20 * mult)) {
        const customer = faker.person.fullName();
        events.push(sEvt('Customer Service', 'CS_TICKET',
          `CS ticket: ${customer} — "When will ${product.name} be back in stock? I saw it on TikTok"`,
          null, { customerName: customer, productName: product.name, type: 'availability_inquiry' }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 2. CELEBRITY ENDORSEMENT ────────────────────────────
// A celebrity is photographed wearing Acne, driving demand
// across an entire category.

function makeCelebrityEndorsement(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const category = (params.category as string) || faker.helpers.arrayElement(['Outerwear', 'Denim', 'Knitwear', 'Accessories']);
  const categoryProducts = store.products.filter(p => p.category === category);
  const celebrity = faker.helpers.arrayElement([
    'Timothée Chalamet', 'Zendaya', 'Hailey Bieber', 'BTS Jimin', 'Blackpink Jennie',
    'Bad Bunny', 'Dua Lipa', 'Jacob Elordi', 'Billie Eilish', 'Dev Hynes',
  ]);
  const mult = sevMult(base.severity);

  base.name = `Celebrity Endorsement: ${celebrity} wears ${category}`;
  base.context = { celebrity, category, productCount: categoryProducts.length };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];
      const product = categoryProducts.length > 0 ? faker.helpers.arrayElement(categoryProducts) : rProduct();

      // Media coverage
      if (chance(30 * mult)) {
        const outlet = faker.helpers.arrayElement(['Vogue', 'GQ', 'Hypebeast', 'Highsnobiety', 'WWD', 'Elle', 'The Cut', 'Grazia']);
        events.push(sEvt('CRM', 'MEDIA_COVERAGE',
          `${outlet}: "${celebrity} spotted in Acne Studios ${product.name}" — article trending`,
          product.id, { celebrity, outlet, productName: product.name }, ctx));
      }

      // Demand spike across category
      if (chance(40 * mult)) {
        const skus = skusFor(product.id);
        if (skus.length > 0) {
          const sku = faker.helpers.arrayElement(skus);
          const market = rMarket();
          const { soId, soNumber } = createScenarioOrder(sku, market);
          events.push(sEvt('SFCC', 'ECOMMERCE_ORDER',
            `Celebrity-driven order: ${soNumber} — ${product.name} (${sku.colour}, ${sku.size}) from ${market}`,
            soId, { soNumber, celebrity, productName: product.name }, ctx));
        }
      }

      // Wholesale inquiries
      if (chance(15 * mult)) {
        const buyer = faker.helpers.arrayElement(['Nordstrom', 'Selfridges', 'Le Bon Marché', 'Isetan', 'Lane Crawford', 'Ssense', 'Net-a-Porter']);
        events.push(sEvt('NuORDER', 'WHOLESALE_INQUIRY',
          `${buyer} requesting increased allocation for ${category} — citing ${celebrity} endorsement effect`,
          null, { buyer, category, celebrity }, ctx));
      }

      // Clienteling activity
      if (chance(20 * mult)) {
        const loc = rStore();
        const vicName = faker.person.fullName();
        events.push(sEvt('Teamwork POS', 'CLIENTELING',
          `VIC ${vicName} at ${loc.name}: "I want what ${celebrity} was wearing" — ${product.name} requested`,
          loc.id, { vicName, celebrity, locationName: loc.name, productName: product.name }, ctx));
      }

      // Store stock depletion from celebrity-driven demand
      if (chance(25 * mult)) {
        const loc = rStore();
        const catSkus = store.skus.filter(s => categoryProducts.some(p => p.id === s.productId));
        if (catSkus.length > 0) {
          const sku = faker.helpers.arrayElement(catSkus);
          const depleted = depleteStock(sku.id, loc.id, 1 + Math.floor(Math.random() * 3));
          if (depleted > 0) {
            const pName = store.products.find(p => p.id === sku.productId)?.name || '?';
            events.push(sEvt('Nedap iD Cloud', 'STOCK_DEPLETION',
              `Celebrity demand: ${pName} (${sku.colour}, ${sku.size}) — sold ${depleted} at ${loc.name}`,
              loc.id, { productName: pName, depleted, locationName: loc.name, celebrity }, ctx));
          }
        }
      }

      // Social media surge
      if (chance(25 * mult)) {
        const platform = faker.helpers.arrayElement(['Instagram', 'TikTok', 'X/Twitter', 'Pinterest']);
        events.push(sEvt('CRM', 'SOCIAL_BUZZ',
          `Acne Studios ${category} mentions up ${100 + Math.floor(Math.random() * 400)}% on ${platform} after ${celebrity} sighting`,
          null, { platform, celebrity, category, upliftPercent: 100 + Math.floor(Math.random() * 400) }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 3. FLASH SALE GONE WRONG ────────────────────────────
// A leaked promo code causes a flood of heavily-discounted orders.

function makeFlashSale(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const discount = (params.discountPercent as number) || faker.helpers.arrayElement([30, 40, 50]);
  const promoCode = faker.helpers.arrayElement(['ACNEVIC40', 'PRIVATE50', 'STAFFONLY30', 'FRIENDS40', 'OOPS50']);
  const mult = sevMult(base.severity);

  base.name = `Flash Sale Gone Wrong: ${promoCode} leaked (${discount}% off)`;
  base.context = { promoCode, discountPercent: discount };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Flood of discounted orders (very high frequency)
      if (chance(70 * mult)) {
        const product = rProduct();
        const skus = skusFor(product.id);
        if (skus.length > 0) {
          const sku = faker.helpers.arrayElement(skus);
          const market = rMarket();
          const { soId, soNumber } = createScenarioOrder(sku, market, discount);
          events.push(sEvt('SFCC', 'ECOMMERCE_ORDER',
            `Promo abuse: ${soNumber} — ${product.name} at ${discount}% off using ${promoCode} from ${market}`,
            soId, { soNumber, promoCode, discount, productName: product.name }, ctx));
        }
      }

      // Payment system strain
      if (chance(25 * mult)) {
        const failType = faker.helpers.arrayElement(['timeout', 'rate_limited', '3DS_failed', 'gateway_overloaded']);
        events.push(sEvt('Adyen', 'PAYMENT_FAILURE',
          `Payment failure (system overload): ${failType} — order volume ${(200 + Math.floor(Math.random() * 300))}% above normal`,
          null, { failType, volumeIncrease: 200 + Math.floor(Math.random() * 300) }, ctx));
      }

      // Cart abandonment from slow site
      if (chance(30 * mult)) {
        const customer = faker.person.fullName();
        events.push(sEvt('SFCC', 'CART_ABANDONED',
          `Cart abandoned (site slowdown): ${customer} — page load time ${(3 + Math.random() * 8).toFixed(1)}s`,
          null, { customerName: customer, reason: 'site_performance' }, ctx));
      }

      // Fulfillment backlog warnings
      if (chance(15 * mult)) {
        const wh = rWarehouse();
        const pending = 50 + Math.floor(Math.random() * 300);
        events.push(sEvt('Blue Yonder WMS', 'FULFILLMENT_BACKLOG',
          `Fulfillment backlog at ${wh.name}: ${pending} orders pending, pick capacity exceeded`,
          wh.id, { warehouseName: wh.name, pendingOrders: pending }, ctx));
      }

      // Finance alert
      if (chance(10 * mult)) {
        const revenue = Math.floor(Math.random() * 500000) + 100000;
        events.push(sEvt('D365 ERP', 'MARGIN_ALERT',
          `Finance alert: ${promoCode} usage detected at scale — estimated margin impact: SEK -${revenue.toLocaleString()}`,
          null, { promoCode, estimatedLoss: revenue }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 4. GEOPOLITICAL DISRUPTION ──────────────────────────
// Sanctions, tariffs, or boycott in a specific market.

function makeGeopolitical(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const market = (params.market as string) || faker.helpers.arrayElement(['CN', 'US', 'KR', 'JP', 'GB']);
  const marketName: Record<string, string> = { CN: 'China', US: 'United States', KR: 'South Korea', JP: 'Japan', GB: 'United Kingdom', FR: 'France', DE: 'Germany' };
  const country = marketName[market] || market;
  const cause = faker.helpers.arrayElement([
    `new import tariffs on EU luxury goods in ${country}`,
    `consumer boycott of European brands in ${country}`,
    `diplomatic tensions affecting trade with ${country}`,
    `new regulatory restrictions on fashion imports in ${country}`,
  ]);
  const mult = sevMult(base.severity);

  base.name = `Geopolitical Disruption: ${country}`;
  base.context = { market, country, cause };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Wholesale cancellations
      if (chance(25 * mult)) {
        const buyer = faker.helpers.arrayElement(['major department store', 'multi-brand retailer', 'franchise partner', 'online marketplace']);
        const amount = (50000 + Math.floor(Math.random() * 300000)).toLocaleString();
        events.push(sEvt('NuORDER', 'WHOLESALE_CANCELLATION',
          `Wholesale partner (${buyer}) in ${country} cancelling order — citing ${cause}. Value: EUR ${amount}`,
          null, { buyer, country, cause, amount }, ctx));
      }

      // E-com demand collapse
      if (chance(30 * mult)) {
        const drop = 30 + Math.floor(Math.random() * 50);
        events.push(sEvt('SFCC', 'DEMAND_DROP',
          `E-commerce orders from ${country} down ${drop}% vs. last week — political situation impacting consumer sentiment`,
          null, { country, dropPercent: drop }, ctx));
      }

      // Store footfall decline
      if (chance(20 * mult)) {
        const marketStores = storesIn(market);
        if (marketStores.length > 0) {
          const loc = faker.helpers.arrayElement(marketStores);
          const drop = 20 + Math.floor(Math.random() * 40);
          events.push(sEvt('Store Operations', 'FOOTFALL_DECLINE',
            `${loc.name}: footfall down ${drop}% — staff reporting noticeably fewer visitors`,
            loc.id, { locationName: loc.name, dropPercent: drop }, ctx));
        }
      }

      // Regulatory/legal alert
      if (chance(10 * mult)) {
        events.push(sEvt('D365 ERP', 'REGULATORY_ALERT',
          `Legal alert: new compliance requirements for ${country} market — review of import documentation needed`,
          null, { country }, ctx));
      }

      // Shipment holds
      if (chance(15 * mult)) {
        const carrier = faker.helpers.arrayElement(['DHL Express', 'FedEx', 'UPS']);
        events.push(sEvt('Carrier', 'SHIPMENT_HOLD',
          `${carrier}: shipments to ${country} held at customs — additional documentation required due to new regulations`,
          null, { carrier, country }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 5. MARKET RECESSION ─────────────────────────────────
// Economic downturn in a specific market.

function makeRecession(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const market = (params.market as string) || rMarket();
  const region = (params.region as string) || store.locations.find(l => l.countryCode === market)?.region || 'EU';
  const mult = sevMult(base.severity);

  base.name = `Market Recession: ${market} (${region})`;
  base.context = { market, region };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Demand decline
      if (chance(35 * mult)) {
        const product = rProduct();
        const drop = 20 + Math.floor(Math.random() * 35);
        events.push(sEvt('AI Intelligence', 'DEMAND_DROP',
          `Demand decline: ${product.name} down ${drop}% in ${market} — recessionary consumer pullback`,
          product.id, { productName: product.name, market, dropPercent: drop }, ctx));
      }

      // Returns spike (buyer's remorse)
      if (chance(25 * mult)) {
        const loc = storesIn(market).length > 0 ? faker.helpers.arrayElement(storesIn(market)) : rStore();
        const product = rProduct();
        events.push(sEvt('Teamwork POS', 'RETAIL_RETURN',
          `Return at ${loc.name}: ${product.name} — reason: "can't afford it right now" — buyer's remorse returns up ${15 + Math.floor(Math.random() * 30)}%`,
          loc.id, { locationName: loc.name, productName: product.name, reason: 'buyers_remorse' }, ctx));
      }

      // Markdown pressure
      if (chance(15 * mult)) {
        const product = rProduct();
        const weeksOfCover = 12 + Math.floor(Math.random() * 10);
        events.push(sEvt('AI Intelligence', 'MARKDOWN_PRESSURE',
          `Markdown recommended: ${product.name} — ${weeksOfCover} weeks of cover in ${market}, sell-through declining`,
          product.id, { productName: product.name, weeksOfCover, market }, ctx));
      }

      // Wholesale payment delays
      if (chance(12 * mult)) {
        const buyer = faker.helpers.arrayElement(['regional department store', 'franchise partner', 'multi-brand boutique']);
        events.push(sEvt('Medius AP', 'PAYMENT_DELAY',
          `Wholesale partner (${buyer}) in ${market} requesting 60-day payment term extension — citing cash flow constraints`,
          null, { buyer, market, reason: 'cash_flow' }, ctx));
      }

      // Store performance drop
      if (chance(20 * mult)) {
        const marketStores = storesIn(market);
        if (marketStores.length > 0) {
          const loc = faker.helpers.arrayElement(marketStores);
          const revDrop = 15 + Math.floor(Math.random() * 30);
          events.push(sEvt('Store Operations', 'PERFORMANCE_DECLINE',
            `${loc.name}: daily revenue down ${revDrop}% vs. last year — conversion rate declining`,
            loc.id, { locationName: loc.name, revenueDropPercent: revDrop }, ctx));
        }
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 6. GLOBAL ECONOMIC SLOWDOWN ─────────────────────────
// Worldwide contraction affecting all markets.

function makeGlobalSlowdown(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const mult = sevMult(base.severity);

  base.name = 'Global Economic Slowdown';
  base.context = { affectedRegions: REGIONS };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Global demand drop
      if (chance(30 * mult)) {
        const market = rMarket();
        const drop = 10 + Math.floor(Math.random() * 25);
        events.push(sEvt('AI Intelligence', 'GLOBAL_DEMAND_DROP',
          `Global slowdown: orders from ${market} down ${drop}% — consumer confidence at multi-year low`,
          null, { market, dropPercent: drop }, ctx));
      }

      // FX volatility
      if (chance(20 * mult)) {
        const pair = faker.helpers.arrayElement(['EUR/SEK', 'USD/SEK', 'GBP/SEK', 'JPY/SEK', 'CNY/SEK']);
        const swing = (1 + Math.random() * 4).toFixed(1);
        events.push(sEvt('D365 ERP', 'FX_VOLATILITY',
          `FX volatility: ${pair} moved ${swing}% in 24h — margin forecasts require revision`,
          null, { pair, swingPercent: swing }, ctx));
      }

      // Wholesale delays
      if (chance(18 * mult)) {
        const buyer = faker.helpers.arrayElement(['Nordstrom', 'Selfridges', 'Isetan', 'Galeries Lafayette', 'KaDeWe']);
        events.push(sEvt('NuORDER', 'WHOLESALE_DELAY',
          `${buyer} delaying AW2026 order commitment by 4-6 weeks — "waiting for economic clarity"`,
          null, { buyer, reason: 'economic_uncertainty' }, ctx));
      }

      // Budget constraints
      if (chance(12 * mult)) {
        const area = faker.helpers.arrayElement(['marketing', 'store expansion', 'IT investment', 'hiring', 'travel']);
        events.push(sEvt('D365 ERP', 'BUDGET_FREEZE',
          `Budget freeze: ${area} spend halted pending revised FY forecast — CFO directive`,
          null, { area }, ctx));
      }

      // Cost-cutting AI recommendation
      if (chance(10 * mult)) {
        const saving = (100000 + Math.floor(Math.random() * 500000)).toLocaleString();
        events.push(sEvt('AI Intelligence', 'COST_RECOMMENDATION',
          `AI recommendation: reduce PO quantities by 15-25% across non-core styles — potential saving: SEK ${saving}`,
          null, { saving }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 7. CURRENCY CRISIS ──────────────────────────────────
// Sudden FX rate shock.

function makeCurrencyCrisis(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const mult = sevMult(base.severity);
  const depreciatingCurrency = faker.helpers.arrayElement(['SEK', 'EUR', 'GBP', 'JPY', 'KRW']);
  const shockPercent = 8 + Math.floor(Math.random() * 15);

  base.name = `Currency Crisis: ${depreciatingCurrency} -${shockPercent}%`;
  base.context = { depreciatingCurrency, shockPercent };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // FX rate shock events
      if (chance(25 * mult)) {
        const rate = (10 + Math.random() * 4).toFixed(4);
        events.push(sEvt('D365 ERP', 'FX_RATE_SHOCK',
          `FX ALERT: ${depreciatingCurrency} down ${shockPercent}% — current rate ${rate}. Emergency pricing review triggered`,
          null, { currency: depreciatingCurrency, shockPercent, rate }, ctx));
      }

      // Margin erosion
      if (chance(20 * mult)) {
        const product = rProduct();
        const erosion = 5 + Math.floor(Math.random() * 15);
        events.push(sEvt('D365 ERP', 'MARGIN_EROSION',
          `Margin erosion: ${product.name} blended margin dropped ${erosion}pp due to ${depreciatingCurrency} weakness`,
          product.id, { productName: product.name, erosionPercent: erosion, currency: depreciatingCurrency }, ctx));
      }

      // Vendor payment complications
      if (chance(15 * mult)) {
        const supplier = rSupplier();
        events.push(sEvt('Medius AP', 'PAYMENT_FX_ISSUE',
          `Payment complication: ${supplier.name} invoice in ${supplier.currency} — FX loss SEK ${(10000 + Math.floor(Math.random() * 50000)).toLocaleString()} vs. booking rate`,
          supplier.id, { supplierName: supplier.name, currency: supplier.currency }, ctx));
      }

      // Pricing anomaly
      if (chance(12 * mult)) {
        const market = rMarket();
        events.push(sEvt('SFCC', 'PRICING_ANOMALY',
          `Pricing anomaly: ${market} e-commerce prices now ${5 + Math.floor(Math.random() * 15)}% below competitor parity due to FX — arbitrage risk`,
          null, { market, currency: depreciatingCurrency }, ctx));
      }

      // Intercompany transfer issues
      if (chance(10 * mult)) {
        events.push(sEvt('D365 ERP', 'INTERCOMPANY_FX',
          `Intercompany transfer delayed: FX settlement dispute on ${depreciatingCurrency} transactions — treasury review required`,
          null, { currency: depreciatingCurrency }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 8. SUPPLIER DISRUPTION ──────────────────────────────
// A key supplier faces production halt.

function makeSupplierDisruption(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const supplier = params.supplierId
    ? (store.suppliers.find(s => s.id === params.supplierId) || rSupplier())
    : rSupplier();
  const cause = faker.helpers.arrayElement(['factory fire', 'labour dispute', 'regulatory shutdown', 'flooding', 'power grid failure', 'key personnel departure']);
  const affectedPOs = store.purchaseOrders.filter(po =>
    po.supplierId === supplier.id && !['RECEIVED', 'CLOSED', 'CANCELLED'].includes(po.status));
  const mult = sevMult(base.severity);

  base.name = `Supplier Disruption: ${supplier.name} (${cause})`;
  base.context = { supplierId: supplier.id, supplierName: supplier.name, cause, affectedPOCount: affectedPOs.length };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // PO delay notifications — actually push back delivery dates
      if (chance(30 * mult) && affectedPOs.length > 0) {
        const po = faker.helpers.arrayElement(affectedPOs);
        const delayDays = 14 + Math.floor(Math.random() * 30);
        // Actually delay the PO delivery
        if (po.expectedDelivery) {
          const newDate = new Date(new Date(po.expectedDelivery).getTime() + delayDays * 86400000);
          po.expectedDelivery = newDate.toISOString();
          po.updatedAt = now().toISOString();
          if (po.notes) po.notes += ` | [SCENARIO] Delayed ${delayDays}d: ${cause}`;
          else po.notes = `[SCENARIO] Delayed ${delayDays}d: ${cause}`;
        }
        events.push(sEvt('Supply Chain', 'PO_DELAY',
          `${supplier.name}: ${po.poNumber} delayed ${delayDays}+ days due to ${cause} — status: ${po.status}`,
          po.id, { supplierName: supplier.name, poNumber: po.poNumber, delayDays, cause }, ctx));
      }

      // Stockout projections
      if (chance(20 * mult)) {
        const product = rProduct();
        const daysUntilStockout = 5 + Math.floor(Math.random() * 20);
        events.push(sEvt('AI Intelligence', 'STOCKOUT_PROJECTION',
          `Stockout risk: ${product.name} projected to sell out in ${daysUntilStockout} days — pending PO from ${supplier.name} delayed`,
          product.id, { productName: product.name, daysUntilStockout, supplierName: supplier.name }, ctx));
      }

      // Alternative sourcing requests
      if (chance(10 * mult)) {
        const product = rProduct();
        events.push(sEvt('Centric PLM', 'ALTERNATE_SOURCING',
          `Alternate sourcing initiated for ${product.name} — contacting backup suppliers due to ${supplier.name} disruption`,
          product.id, { productName: product.name, reason: cause }, ctx));
      }

      // Supplier communication updates
      if (chance(15 * mult)) {
        const update = faker.helpers.arrayElement([
          `${supplier.name}: "Situation ongoing. Earliest restart estimate: ${2 + Math.floor(Math.random() * 4)} weeks"`,
          `${supplier.name}: "Partial production resumed at 30% capacity"`,
          `${supplier.name}: "Force majeure clause invoked — insurance claim filed"`,
          `${supplier.name}: "Working on redirecting production to secondary facility"`,
        ]);
        events.push(sEvt('Supply Chain', 'SUPPLIER_UPDATE',
          update, supplier.id, { supplierName: supplier.name }, ctx));
      }

      // Insurance/finance impact
      if (chance(8 * mult)) {
        const exposure = (200000 + Math.floor(Math.random() * 800000)).toLocaleString();
        events.push(sEvt('D365 ERP', 'FINANCIAL_EXPOSURE',
          `Supply chain finance: SEK ${exposure} in open POs at risk from ${supplier.name} disruption`,
          supplier.id, { supplierName: supplier.name, exposure }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 9. LOGISTICS BOTTLENECK ─────────────────────────────
// Port strike or carrier failure blocks shipments.

function makeLogisticsBottleneck(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const region = (params.region as string) || faker.helpers.arrayElement(REGIONS);
  const cause = faker.helpers.arrayElement(['port workers strike', 'severe weather at hub', 'carrier bankruptcy', 'customs system outage', 'container shortage']);
  const mult = sevMult(base.severity);

  base.name = `Logistics Bottleneck: ${region} (${cause})`;
  base.context = { region, cause };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Shipment delays
      if (chance(35 * mult)) {
        const carrier = faker.helpers.arrayElement(['DHL Express', 'FedEx', 'UPS', 'PostNord', 'DB Schenker']);
        const tracking = `${carrier.slice(0, 3).toUpperCase()}${Math.floor(Math.random() * 9e9) + 1e9}`;
        const delay = 3 + Math.floor(Math.random() * 10);
        events.push(sEvt('Carrier', 'SHIPMENT_DELAYED',
          `${carrier} ${tracking}: shipment delayed ${delay}+ days in ${region} — ${cause}`,
          null, { carrier, tracking, delayDays: delay, region, cause }, ctx));
      }

      // Warehouse backlog
      if (chance(20 * mult)) {
        const regionWarehouses = store.locations.filter(l => l.type === 'WAREHOUSE' && l.region === region);
        const wh = regionWarehouses.length > 0 ? faker.helpers.arrayElement(regionWarehouses) : rWarehouse();
        events.push(sEvt('Blue Yonder WMS', 'INBOUND_BACKLOG',
          `Inbound backlog at ${wh.name}: ${10 + Math.floor(Math.random() * 30)} containers awaiting unloading — ${cause}`,
          wh.id, { warehouseName: wh.name, cause }, ctx));
      }

      // Customer delivery complaints
      if (chance(25 * mult)) {
        const customer = faker.person.fullName();
        const daysLate = 3 + Math.floor(Math.random() * 7);
        events.push(sEvt('Customer Service', 'CS_TICKET',
          `CS ticket: ${customer} — delivery ${daysLate} days overdue to ${region} — "Where is my order?"`,
          null, { customerName: customer, daysLate, region }, ctx));
      }

      // Expedited shipping cost
      if (chance(12 * mult)) {
        const cost = (5000 + Math.floor(Math.random() * 30000)).toLocaleString();
        events.push(sEvt('D365 ERP', 'LOGISTICS_COST',
          `Emergency air freight to bypass ${region} bottleneck — additional cost: SEK ${cost} per shipment`,
          null, { region, additionalCost: cost }, ctx));
      }

      // Store replenishment impact
      if (chance(18 * mult)) {
        const loc = storesInRegion(region).length > 0 ? faker.helpers.arrayElement(storesInRegion(region)) : rStore();
        events.push(sEvt('Store Operations', 'REPLENISHMENT_DELAYED',
          `${loc.name}: replenishment shipment delayed — stockroom running low on key styles`,
          loc.id, { locationName: loc.name, cause }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 10. RAW MATERIAL SHORTAGE ───────────────────────────
// A critical raw material becomes scarce.

function makeRawMaterialShortage(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const material = (params.material as string) || faker.helpers.arrayElement([
    'organic cotton', 'Italian nappa leather', 'Japanese selvedge denim',
    'recycled polyester', 'merino wool', 'mohair yarn', 'vegetable-tanned leather',
  ]);
  const priceIncrease = 15 + Math.floor(Math.random() * 40);
  const mult = sevMult(base.severity);

  base.name = `Raw Material Shortage: ${material}`;
  base.context = { material, priceIncreasePercent: priceIncrease };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Supplier notifications
      if (chance(25 * mult)) {
        const supplier = rSupplier();
        events.push(sEvt('Supply Chain', 'MATERIAL_SHORTAGE',
          `${supplier.name}: "${material} allocation reduced by ${20 + Math.floor(Math.random() * 40)}% — global supply constrained"`,
          supplier.id, { supplierName: supplier.name, material }, ctx));
      }

      // Cost increase alerts
      if (chance(18 * mult)) {
        const product = rProduct();
        const costIncrease = Math.round(product.costPrice * priceIncrease / 100);
        events.push(sEvt('Centric PLM', 'COSTING_IMPACT',
          `BOM cost increase: ${product.name} — ${material} component up ${priceIncrease}%, +SEK ${costIncrease}/unit`,
          product.id, { productName: product.name, material, costIncrease, priceIncreasePercent: priceIncrease }, ctx));
      }

      // Production timeline shifts
      if (chance(15 * mult)) {
        const supplier = rSupplier();
        const delay = 10 + Math.floor(Math.random() * 20);
        events.push(sEvt('Supply Chain', 'PRODUCTION_DELAY',
          `${supplier.name}: production timeline extended ${delay} days — waiting for ${material} delivery`,
          supplier.id, { supplierName: supplier.name, material, delayDays: delay }, ctx));
      }

      // Material substitution PLM event
      if (chance(8 * mult)) {
        const product = rProduct();
        const alt = faker.helpers.arrayElement(['conventional cotton', 'synthetic alternative', 'blended fabric', 'deadstock material', 'recycled alternative']);
        events.push(sEvt('Centric PLM', 'MATERIAL_SUBSTITUTION',
          `Material substitution proposal: ${product.name} — replace ${material} with ${alt}. Impact: -2 sustainability score, -${5 + Math.floor(Math.random() * 10)}% cost`,
          product.id, { productName: product.name, original: material, proposed: alt }, ctx));
      }

      // Industry news
      if (chance(10 * mult)) {
        events.push(sEvt('AI Intelligence', 'MARKET_INTELLIGENCE',
          `Industry alert: ${material} spot price up ${priceIncrease}% — ${faker.helpers.arrayElement(['crop failure in producing region', 'export ban by major producer', 'logistics disruption at origin', 'surge in competing demand'])}`,
          null, { material, priceIncreasePercent: priceIncrease }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 11. QUALITY CRISIS ──────────────────────────────────
// A product batch has serious defects.

function makeQualityCrisis(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const product = params.productId
    ? (store.products.find(p => p.id === params.productId) || rProduct())
    : rProduct();
  const defect = faker.helpers.arrayElement([
    'zipper failure after 2-3 wears', 'fabric colour bleeding in wash', 'seam splitting under normal use',
    'button detachment', 'lining tearing prematurely', 'dye transfer staining other garments',
    'allergic reaction reports from fabric treatment',
  ]);
  const skus = skusFor(product.id);
  const mult = sevMult(base.severity);

  base.name = `Quality Crisis: ${product.name} — ${defect}`;
  base.context = { productId: product.id, productName: product.name, defect, styleNumber: product.styleNumber };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Customer returns (high frequency)
      if (chance(50 * mult)) {
        const loc = rStore();
        const sku = skus.length > 0 ? faker.helpers.arrayElement(skus) : store.skus[0];
        events.push(sEvt('Teamwork POS', 'QUALITY_RETURN',
          `Defective return at ${loc.name}: ${product.name} (${sku.colour}, ${sku.size}) — "${defect}"`,
          loc.id, { locationName: loc.name, productName: product.name, defect }, ctx));
      }

      // CS complaint surge
      if (chance(40 * mult)) {
        const customer = faker.person.fullName();
        const channel = faker.helpers.arrayElement(['email', 'phone', 'live_chat', 'instagram_dm', 'X/Twitter_public']);
        events.push(sEvt('Customer Service', 'QUALITY_COMPLAINT',
          `CS ticket (${channel}): ${customer} — "${product.name}: ${defect}" — ${channel === 'X/Twitter_public' ? 'PUBLIC MENTION — PR risk' : 'requesting full refund'}`,
          null, { customerName: customer, channel, productName: product.name, defect, public: channel.includes('public') }, ctx));
      }

      // Social media backlash
      if (chance(20 * mult)) {
        const platform = faker.helpers.arrayElement(['Instagram', 'TikTok', 'X/Twitter', 'Reddit']);
        const engagement = (500 + Math.floor(Math.random() * 10000)).toLocaleString();
        events.push(sEvt('CRM', 'SOCIAL_BACKLASH',
          `Negative post about ${product.name} on ${platform} — "${defect}" — ${engagement} engagements and counting`,
          product.id, { platform, engagement, productName: product.name, defect }, ctx));
      }

      // Stock quarantine at stores — actually reduce available stock
      if (chance(15 * mult)) {
        const loc = rStore();
        const sku = skus.length > 0 ? faker.helpers.arrayElement(skus) : null;
        if (sku) {
          const qty = 2 + Math.floor(Math.random() * 8);
          const quarantined = depleteStock(sku.id, loc.id, qty);
          if (quarantined > 0) {
            events.push(sEvt('Store Operations', 'STOCK_QUARANTINE',
              `${loc.name}: quarantined ${quarantined} units of ${product.name} (${sku.colour}, ${sku.size}) — pulled from sales floor`,
              loc.id, { locationName: loc.name, productName: product.name, quantity: quarantined }, ctx));
          }
        }
      }

      // QA investigation progress
      if (chance(10 * mult)) {
        const finding = faker.helpers.arrayElement([
          `root cause identified: supplier ${rSupplier().name} batch defect`,
          'third-party lab results pending — expected within 48h',
          `defect rate estimated at ${5 + Math.floor(Math.random() * 15)}% of batch`,
          'batch traceability: DPP records indicate affected units shipped to 8 markets',
        ]);
        events.push(sEvt('Centric PLM', 'QA_INVESTIGATION',
          `QA update for ${product.name}: ${finding}`,
          product.id, { productName: product.name, finding }, ctx));
      }

      // Financial impact
      if (chance(8 * mult)) {
        const refundCost = (50000 + Math.floor(Math.random() * 200000)).toLocaleString();
        events.push(sEvt('D365 ERP', 'QUALITY_FINANCIAL_IMPACT',
          `Quality crisis financial impact: ${product.name} — estimated refund/replacement cost: SEK ${refundCost}`,
          product.id, { productName: product.name, estimatedCost: refundCost }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 12. COUNTERFEIT SURGE ───────────────────────────────
// Counterfeit products flood a market.

function makeCounterfeitSurge(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const market = (params.market as string) || faker.helpers.arrayElement(['CN', 'KR', 'US', 'GB', 'IT']);
  const product = params.productId
    ? (store.products.find(p => p.id === params.productId) || rProduct())
    : store.products.find(p => p.category === 'Accessories') || rProduct();
  const mult = sevMult(base.severity);

  base.name = `Counterfeit Surge: ${product.name} in ${market}`;
  base.context = { market, productId: product.id, productName: product.name };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // DPP authentication failures
      if (chance(30 * mult)) {
        const city = faker.location.city();
        events.push(sEvt('Temera DPP', 'AUTHENTICATION_FAILURE',
          `DPP scan FAILED: ${product.name} in ${city}, ${market} — NFC tag invalid/missing. Likely counterfeit`,
          product.id, { productName: product.name, city, market, result: 'COUNTERFEIT_SUSPECTED' }, ctx));
      }

      // CS tickets about fakes
      if (chance(25 * mult)) {
        const customer = faker.person.fullName();
        const source = faker.helpers.arrayElement(['marketplace', 'resale platform', 'social media seller', 'unauthorized retailer']);
        events.push(sEvt('Customer Service', 'COUNTERFEIT_INQUIRY',
          `CS ticket: ${customer} — "Is my ${product.name} authentic? Bought from ${source}" — product fails DPP verification`,
          null, { customerName: customer, productName: product.name, source }, ctx));
      }

      // Brand monitoring alert
      if (chance(15 * mult)) {
        const platform = faker.helpers.arrayElement(['Amazon', 'eBay', 'Taobao', 'DHgate', 'AliExpress', 'Depop', 'Vestiaire Collective']);
        const listings = 20 + Math.floor(Math.random() * 100);
        events.push(sEvt('CRM', 'COUNTERFEIT_DETECTION',
          `Brand monitoring: ${listings} suspected counterfeit ${product.name} listings found on ${platform} in ${market}`,
          product.id, { platform, listings, market, productName: product.name }, ctx));
      }

      // Legal enforcement action
      if (chance(8 * mult)) {
        events.push(sEvt('D365 ERP', 'LEGAL_ACTION',
          `Legal: cease-and-desist sent to ${faker.helpers.arrayElement(['marketplace seller', 'social media account', 'unauthorized retailer'])} in ${market} for counterfeit ${product.name}`,
          null, { market, productName: product.name }, ctx));
      }

      // Legitimate DPP scans increase (customers checking authenticity)
      if (chance(20 * mult)) {
        const scans = 20 + Math.floor(Math.random() * 50);
        events.push(sEvt('Temera DPP', 'AUTHENTICATION_SURGE',
          `DPP authentication scans up ${100 + Math.floor(Math.random() * 200)}% in ${market} — ${scans} scans in last hour (customers verifying purchases)`,
          product.id, { market, scans, productName: product.name }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 13. WAREHOUSE OUTAGE ────────────────────────────────
// A distribution center goes offline.

function makeWarehouseOutage(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const warehouses = store.locations.filter(l => l.type === 'WAREHOUSE');
  const warehouse = params.locationId
    ? (warehouses.find(w => w.id === params.locationId) || warehouses[0])
    : faker.helpers.arrayElement(warehouses);
  const cause = faker.helpers.arrayElement(['WMS system crash', 'power outage', 'fire alarm evacuation', 'flooding', 'HVAC failure', 'automated system malfunction']);
  const mult = sevMult(base.severity);

  base.name = `Warehouse Outage: ${warehouse.name} (${cause})`;
  base.context = { locationId: warehouse.id, locationName: warehouse.name, region: warehouse.region, cause };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Warehouse offline status
      if (chance(20 * mult)) {
        events.push(sEvt('Blue Yonder WMS', 'WAREHOUSE_OFFLINE',
          `${warehouse.name} OFFLINE: ${cause} — all picking, packing, and dispatch operations suspended`,
          warehouse.id, { warehouseName: warehouse.name, cause, status: 'OFFLINE' }, ctx));
      }

      // Order rerouting — actually put some orders on hold
      if (chance(30 * mult)) {
        const altWh = warehouses.find(w => w.id !== warehouse.id) || warehouse;
        const eligible = store.salesOrders.filter(so =>
          ['CONFIRMED', 'ALLOCATED', 'PICKING'].includes(so.status) && so.locationId === warehouse.id);
        if (eligible.length > 0) {
          const so = eligible[Math.floor(Math.random() * eligible.length)];
          so.status = 'ON_HOLD' as any;
          so.notes = (so.notes || '') + ` | [SCENARIO] On hold: ${warehouse.name} outage`;
          so.updatedAt = now().toISOString();
        }
        const orders = 5 + Math.floor(Math.random() * 25);
        events.push(sEvt('Blue Yonder WMS', 'ORDER_REROUTED',
          `${orders} orders rerouted from ${warehouse.name} → ${altWh.name} — increased transit time: +${1 + Math.floor(Math.random() * 3)} days`,
          altWh.id, { from: warehouse.name, to: altWh.name, ordersRerouted: orders }, ctx));
      }

      // Delivery delay notifications
      if (chance(35 * mult)) {
        const customer = faker.person.fullName();
        events.push(sEvt('Customer Service', 'DELIVERY_DELAY',
          `Automated delay notification sent to ${customer}: "Your order is delayed due to warehouse operations disruption"`,
          null, { customerName: customer, warehouseName: warehouse.name }, ctx));
      }

      // Inventory visibility issues
      if (chance(15 * mult)) {
        events.push(sEvt('Nedap iD Cloud', 'INVENTORY_SYNC_FAILED',
          `Inventory sync failed for ${warehouse.name}: stock levels may be inaccurate across ${5 + Math.floor(Math.random() * 10)} e-commerce markets`,
          warehouse.id, { warehouseName: warehouse.name }, ctx));
      }

      // Emergency operations
      if (chance(10 * mult)) {
        const update = faker.helpers.arrayElement([
          `Emergency team dispatched to ${warehouse.name} — ETA: ${1 + Math.floor(Math.random() * 3)} hours`,
          `${warehouse.name}: partial operations restored in zone A — manual picking only`,
          `${warehouse.name}: backup generator activated — limited systems operational`,
          `${warehouse.name}: full restoration estimated in ${4 + Math.floor(Math.random() * 20)} hours`,
        ]);
        events.push(sEvt('Blue Yonder WMS', 'EMERGENCY_UPDATE', update, warehouse.id, { warehouseName: warehouse.name }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 14. PAYMENT PROVIDER OUTAGE ─────────────────────────
// Adyen or Klarna goes down.

function makePaymentOutage(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const provider = (params.provider as string) || faker.helpers.arrayElement(['Adyen', 'Klarna']);
  const mult = sevMult(base.severity);

  base.name = `Payment Provider Outage: ${provider}`;
  base.context = { provider };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Failed transactions (very high frequency)
      if (chance(60 * mult)) {
        const amount = (500 + Math.floor(Math.random() * 30000));
        const currency = faker.helpers.arrayElement(['SEK', 'EUR', 'USD', 'GBP']);
        const method = provider === 'Klarna'
          ? faker.helpers.arrayElement(['pay_later', 'pay_in_4', 'financing'])
          : faker.helpers.arrayElement(['visa', 'mastercard', 'amex', 'apple_pay', 'google_pay']);
        events.push(sEvt(provider, 'PAYMENT_FAILED',
          `${provider} OUTAGE: Transaction failed — ${currency} ${(amount / 100).toFixed(2)} via ${method} — ${faker.helpers.arrayElement(['connection timeout', 'service unavailable', '503 error', 'gateway unreachable'])}`,
          null, { provider, amount, currency, method, reason: 'provider_outage' }, ctx));
      }

      // Cart abandonment spike
      if (chance(40 * mult)) {
        const customer = faker.person.fullName();
        events.push(sEvt('SFCC', 'CART_ABANDONED',
          `Cart abandoned: ${customer} — payment via ${provider} failed, customer left checkout`,
          null, { customerName: customer, provider, reason: 'payment_failure' }, ctx));
      }

      // POS impact (Adyen only)
      if (provider === 'Adyen' && chance(25 * mult)) {
        const loc = rStore();
        events.push(sEvt('Teamwork POS', 'POS_PAYMENT_FAILED',
          `POS terminal at ${loc.name}: card payment declined — ${provider} unreachable. Accepting cash/Swish only`,
          loc.id, { locationName: loc.name, provider }, ctx));
      }

      // Revenue loss tracking
      if (chance(15 * mult)) {
        const lostOrders = 10 + Math.floor(Math.random() * 50);
        const lostRevenue = (50000 + Math.floor(Math.random() * 200000)).toLocaleString();
        events.push(sEvt('D365 ERP', 'REVENUE_IMPACT',
          `${provider} outage revenue impact: ~${lostOrders} failed orders, estimated SEK ${lostRevenue} lost in last 30 minutes`,
          null, { provider, lostOrders, lostRevenue }, ctx));
      }

      // Status page updates
      if (chance(12 * mult)) {
        const update = faker.helpers.arrayElement([
          `${provider} status: "Investigating increased error rates across European endpoints"`,
          `${provider} status: "Identified — routing issue at primary data center"`,
          `${provider} status: "Fix deployed, monitoring recovery — ETA: 30 minutes"`,
          `${provider} status: "Partial recovery — some transactions succeeding"`,
        ]);
        events.push(sEvt(provider, 'STATUS_UPDATE', update, null, { provider }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 15. CYBER SECURITY INCIDENT ─────────────────────────
// Security breach affecting operations.

function makeCyberIncident(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const attackType = faker.helpers.arrayElement(['ransomware', 'data_breach', 'DDoS', 'credential_stuffing', 'supply_chain_compromise']);
  const attackName: Record<string, string> = {
    ransomware: 'Ransomware Attack',
    data_breach: 'Data Breach',
    DDoS: 'DDoS Attack',
    credential_stuffing: 'Credential Stuffing Attack',
    supply_chain_compromise: 'Supply Chain Compromise',
  };
  const mult = sevMult(base.severity);

  base.name = `Cyber Incident: ${attackName[attackType]}`;
  base.context = { attackType };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Security alerts
      if (chance(25 * mult)) {
        const detail = {
          ransomware: `Ransomware detected on ${faker.helpers.arrayElement(['inventory management', 'ERP', 'email', 'file server'])} systems — encryption in progress`,
          data_breach: `Unauthorized data access detected: ${faker.helpers.arrayElement(['customer records', 'payment data', 'employee data', 'supplier contracts'])} may be compromised`,
          DDoS: `DDoS attack: ${faker.helpers.arrayElement(['acnestudios.com', 'API gateway', 'payment endpoints'])} receiving ${(50 + Math.floor(Math.random() * 200))}x normal traffic`,
          credential_stuffing: `Credential stuffing: ${1000 + Math.floor(Math.random() * 10000)} login attempts/minute — ${Math.floor(Math.random() * 50)} accounts compromised`,
          supply_chain_compromise: `Compromised dependency detected in ${faker.helpers.arrayElement(['SFCC integration', 'payment module', 'inventory sync', 'API middleware'])}`,
        }[attackType];
        events.push(sEvt('Security', 'SECURITY_ALERT', `🔴 ${detail}`, null, { attackType, severity: 'CRITICAL' }, ctx));
      }

      // System impact
      if (chance(30 * mult)) {
        const system = faker.helpers.arrayElement(['e-commerce site', 'POS systems', 'warehouse management', 'internal tools', 'email', 'API endpoints']);
        const impact = faker.helpers.arrayElement(['offline', 'degraded performance', 'read-only mode', 'intermittent failures']);
        events.push(sEvt('Security', 'SYSTEM_IMPACT',
          `${system}: ${impact} — precautionary ${faker.helpers.arrayElement(['shutdown', 'isolation', 'throttling'])} due to cyber incident`,
          null, { system, impact, attackType }, ctx));
      }

      // E-commerce impact
      if (attackType !== 'credential_stuffing' && chance(20 * mult)) {
        const lost = 5 + Math.floor(Math.random() * 20);
        events.push(sEvt('SFCC', 'ECOM_DISRUPTION',
          `E-commerce disruption: ~${lost} orders/hour lost — checkout ${faker.helpers.arrayElement(['disabled', 'operating in degraded mode', 'intermittent 500 errors'])}`,
          null, { ordersLostPerHour: lost }, ctx));
      }

      // Incident response updates
      if (chance(15 * mult)) {
        const update = faker.helpers.arrayElement([
          'Incident response team activated — war room established',
          'External forensics firm engaged — initial assessment underway',
          'Customer notification drafted — legal review pending',
          'Affected systems isolated — containment in progress',
          'Backup restoration initiated for affected systems',
          `Regulatory notification prepared for ${faker.helpers.arrayElement(['GDPR authorities', 'Swedish DPA', 'affected customers'])}`,
        ]);
        events.push(sEvt('Security', 'INCIDENT_RESPONSE', update, null, { attackType }, ctx));
      }

      // Customer impact
      if (chance(12 * mult)) {
        events.push(sEvt('Customer Service', 'CS_SURGE',
          `CS ticket volume up ${100 + Math.floor(Math.random() * 300)}% — customers reporting ${faker.helpers.arrayElement(['login issues', 'order status unavailable', 'payment errors', 'password reset failures', 'suspicious account activity'])}`,
          null, { attackType }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 16. WEATHER ANOMALY ─────────────────────────────────
// Unseasonable weather shifts demand between categories.

function makeWeatherAnomaly(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const region = (params.region as string) || faker.helpers.arrayElement(REGIONS);
  const weatherType = (params.weatherType as string) || faker.helpers.arrayElement(['unseasonably_warm', 'unseasonably_cold', 'extreme_heat', 'prolonged_rain', 'freak_snowstorm']);
  const weatherDesc: Record<string, string> = {
    unseasonably_warm: 'Unseasonably warm temperatures',
    unseasonably_cold: 'Unseasonably cold snap',
    extreme_heat: 'Extreme heat wave',
    prolonged_rain: 'Prolonged heavy rainfall',
    freak_snowstorm: 'Unexpected late-season snowstorm',
  };
  const warmCategories = ['Outerwear', 'Knitwear'];
  const coldCategories = ['T-shirts', 'Denim'];
  const isWarm = ['unseasonably_warm', 'extreme_heat'].includes(weatherType);
  const surgeCategories = isWarm ? coldCategories : warmCategories;
  const slumpCategories = isWarm ? warmCategories : coldCategories;
  const mult = sevMult(base.severity);

  base.name = `Weather Anomaly: ${weatherDesc[weatherType] || weatherType} in ${region}`;
  base.context = { region, weatherType, surgeCategories, slumpCategories };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Category demand surge
      if (chance(30 * mult)) {
        const cat = faker.helpers.arrayElement(surgeCategories);
        const products = store.products.filter(p => p.category === cat);
        const product = products.length > 0 ? faker.helpers.arrayElement(products) : rProduct();
        const increase = 20 + Math.floor(Math.random() * 50);
        events.push(sEvt('AI Intelligence', 'WEATHER_DEMAND_SURGE',
          `${weatherDesc[weatherType]}: ${cat} demand up ${increase}% in ${region} — ${product.name} selling fast`,
          product.id, { category: cat, product: product.name, increase, region, weatherType }, ctx));
      }

      // Category demand slump
      if (chance(25 * mult)) {
        const cat = faker.helpers.arrayElement(slumpCategories);
        const products = store.products.filter(p => p.category === cat);
        const product = products.length > 0 ? faker.helpers.arrayElement(products) : rProduct();
        const drop = 25 + Math.floor(Math.random() * 40);
        events.push(sEvt('AI Intelligence', 'WEATHER_DEMAND_SLUMP',
          `${weatherDesc[weatherType]}: ${cat} demand down ${drop}% in ${region} — ${product.name} sitting unsold`,
          product.id, { category: cat, product: product.name, drop, region, weatherType }, ctx));
      }

      // Forecast accuracy degradation
      if (chance(15 * mult)) {
        events.push(sEvt('AI Intelligence', 'FORECAST_DEVIATION',
          `Demand forecast accuracy dropped to ${40 + Math.floor(Math.random() * 25)}% in ${region} — weather anomaly not in model training data`,
          null, { region, weatherType }, ctx));
      }

      // Markdown pressure on slumping categories
      if (chance(12 * mult)) {
        const cat = faker.helpers.arrayElement(slumpCategories);
        const products = store.products.filter(p => p.category === cat);
        const product = products.length > 0 ? faker.helpers.arrayElement(products) : rProduct();
        events.push(sEvt('AI Intelligence', 'MARKDOWN_RECOMMENDATION',
          `Weather-driven markdown: consider ${15 + Math.floor(Math.random() * 20)}% reduction on ${product.name} (${cat}) in ${region} — ${12 + Math.floor(Math.random() * 8)} weeks of cover`,
          product.id, { product: product.name, category: cat, region }, ctx));
      }

      // Store-level impact
      if (chance(18 * mult)) {
        const regionStores = storesInRegion(region);
        if (regionStores.length > 0) {
          const loc = faker.helpers.arrayElement(regionStores);
          const surgeCat = faker.helpers.arrayElement(surgeCategories);
          events.push(sEvt('Store Operations', 'WEATHER_IMPACT',
            `${loc.name}: customers asking for ${surgeCat.toLowerCase()} — ${weatherDesc[weatherType]} driving unexpected demand. Floor reset recommended`,
            loc.id, { locationName: loc.name, surgeCategory: surgeCat, weatherType }, ctx));
        }
      }

      // Inventory reallocation recommendation
      if (chance(10 * mult)) {
        const surgeCat = faker.helpers.arrayElement(surgeCategories);
        events.push(sEvt('AI Intelligence', 'REALLOCATION_RECOMMENDATION',
          `AI recommendation: transfer ${surgeCat.toLowerCase()} inventory from ${isWarm ? 'cold' : 'warm'}-weather markets to ${region} — projected revenue uplift: SEK ${(50000 + Math.floor(Math.random() * 150000)).toLocaleString()}`,
          null, { surgeCategory: surgeCat, region }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}

// ─── 17. SEASON LAUNCH ──────────────────────────────────
// Simulates the market reaction to a new collection launch.
// Effects: wholesale order surge, press buzz, e-commerce traffic spike,
// warehouse processing pressure, inventory allocation scramble.

function makeSeasonLaunch(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const season = (params.season as string) || 'SS';
  const seasonYear = (params.seasonYear as number) || 2027;
  const label = `${season === 'SS' ? 'Spring/Summer' : season === 'AW' ? 'Autumn/Winter' : season === 'PRE_FALL' ? 'Pre-Fall' : season === 'RESORT' ? 'Resort' : season} ${seasonYear}`;

  // Find products for this season (if drop has happened) or fall back to newest products
  const seasonProducts = store.products.filter(p => p.season === season && p.seasonYear === seasonYear);
  const products = seasonProducts.length > 0 ? seasonProducts : store.products.slice(-20);
  const mult = sevMult(base.severity);

  base.name = `Season Launch: ${label}`;
  base.context = { season, seasonYear, label, productCount: products.length };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];
      const product = products.length > 0 ? faker.helpers.arrayElement(products) : rProduct();
      const skus = skusFor(product.id);

      // Wholesale order surge
      if (chance(40 * mult)) {
        const partner = faker.company.name();
        const units = 50 + Math.floor(Math.random() * 500);
        const market = rMarket();
        events.push(sEvt('NuORDER', 'WHOLESALE_ORDER',
          `${label} wholesale order: ${partner} (${market}) ordered ${units} units of ${product.name}`,
          product.id, { partner, market, units, productName: product.name, season, seasonYear }, ctx));
      }

      // E-commerce traffic spike
      if (chance(45 * mult)) {
        const market = rMarket();
        const increase = 30 + Math.floor(Math.random() * 80);
        events.push(sEvt('SFCC', 'TRAFFIC_SURGE',
          `${label} launch traffic: ${market} e-commerce up ${increase}% — ${product.name} is trending`,
          null, { market, increase, productName: product.name }, ctx));
      }

      // E-commerce orders on new collection
      if (chance(50 * mult) && skus.length > 0) {
        const sku = faker.helpers.arrayElement(skus);
        const market = rMarket();
        const { soId, soNumber } = createScenarioOrder(sku, market);
        events.push(sEvt('SFCC', 'ECOMMERCE_ORDER',
          `${label} launch order: ${soNumber} — ${product.name} (${sku.colour}, ${sku.size}) from ${market}`,
          soId, { soNumber, productName: product.name, market, season, seasonYear }, ctx));
      }

      // Press & media coverage
      if (chance(20 * mult)) {
        const outlet = faker.helpers.arrayElement(['Vogue', 'GQ', 'Highsnobiety', 'Hypebeast', 'WWD', 'Business of Fashion', 'Dazed', 'i-D', 'SSENSE', 'Elle']);
        events.push(sEvt('Marketing', 'PRESS_COVERAGE',
          `${outlet} features ${label} collection — highlighting ${product.name} as a standout piece`,
          product.id, { outlet, productName: product.name, season, seasonYear }, ctx));
      }

      // Warehouse processing spike
      if (chance(25 * mult)) {
        const wh = rWarehouse();
        const orders = 20 + Math.floor(Math.random() * 80);
        events.push(sEvt('Blue Yonder WMS', 'PROCESSING_SPIKE',
          `${wh.name}: ${orders} pick tasks queued for ${label} launch orders — processing capacity at ${70 + Math.floor(Math.random() * 25)}%`,
          wh.id, { warehouseName: wh.name, orders, season, seasonYear }, ctx));
      }

      // PLM finalization events
      if (chance(15 * mult)) {
        events.push(sEvt('Centric PLM', 'COLLECTION_FINALIZED',
          `${label} collection: ${product.name} tech pack approved — moving to full production`,
          product.id, { productName: product.name, season, seasonYear }, ctx));
      }

      // Stock allocation pressure
      if (chance(20 * mult)) {
        const loc = rStore();
        events.push(sEvt('AI Intelligence', 'ALLOCATION_PRESSURE',
          `${loc.name}: requesting ${label} allocation for ${product.name} — current stock: 0 units, demand forecast: ${10 + Math.floor(Math.random() * 40)} units`,
          loc.id, { locationName: loc.name, productName: product.name, season, seasonYear }, ctx));
      }

      // Social media buzz
      if (chance(30 * mult)) {
        const platform = faker.helpers.arrayElement(['Instagram', 'TikTok', 'X/Twitter', 'Pinterest', 'Xiaohongshu']);
        const engagement = (5 + Math.random() * 20).toFixed(1);
        events.push(sEvt('Marketing', 'SOCIAL_BUZZ',
          `${platform}: ${label} launch content — ${engagement}K engagements, ${product.name} featured in ${3 + Math.floor(Math.random() * 10)} creator posts`,
          null, { platform, engagement, productName: product.name, season, seasonYear }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 20. SIZING DEFECT ───────────────────────────────────
// A product runs wrong — causes a wave of "wrong size" returns.

function makeSizingDefect(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const product = params.productId
    ? (store.products.find(p => p.id === params.productId) || rProduct())
    : rProduct();
  const skus = skusFor(product.id);
  const direction = faker.helpers.arrayElement(['too_small', 'too_large']);
  const mult = sevMult(base.severity);

  base.name = `Sizing Defect: ${product.name} runs ${direction.replace('_', ' ')}`;
  base.context = { productId: product.id, productName: product.name, defect: direction, styleNumber: product.styleNumber };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Online returns (high frequency)
      if (chance(55 * mult)) {
        const sku = skus.length > 0 ? faker.helpers.arrayElement(skus) : null;
        if (sku) {
          const customer = faker.person.fullName();
          const wrongNote = direction === 'too_small'
            ? `ordered ${sku.size}, need ${faker.helpers.arrayElement(['one size up', 'two sizes up'])}`
            : `ordered ${sku.size}, need ${faker.helpers.arrayElement(['one size down', 'two sizes down'])}`;
          events.push(sEvt('SFCC', 'ECOMMERCE_RETURN',
            `Online return: ${customer} — ${product.name} (${sku.colour}, ${sku.size}) — "runs ${direction.replace('_', ' ')}, ${wrongNote}"`,
            product.id, { customerName: customer, productName: product.name, size: sku.size, reason: 'wrong_size', defect: direction }, ctx));
        }
      }

      // CS complaints surge
      if (chance(40 * mult)) {
        const customer = faker.person.fullName();
        const channel = faker.helpers.arrayElement(['email', 'live_chat', 'phone', 'instagram_dm']);
        events.push(sEvt('Customer Service', 'SIZING_COMPLAINT',
          `CS ticket (${channel}): ${customer} — "${product.name} size chart is wrong, runs ${direction.replace('_', ' ')}. Very disappointed"`,
          null, { customerName: customer, productName: product.name, channel, defect: direction }, ctx));
      }

      // Social media complaints
      if (chance(20 * mult)) {
        const platform = faker.helpers.arrayElement(['Instagram', 'TikTok', 'X/Twitter']);
        events.push(sEvt('CRM', 'SOCIAL_COMPLAINT',
          `Negative post on ${platform}: "${product.name} sizing is way off — ordered my usual ${faker.helpers.arrayElement(['S', 'M', 'L'])} and it's ${direction === 'too_small' ? 'tiny' : 'huge'}" — ${100 + Math.floor(Math.random() * 2000)} engagements`,
          product.id, { platform, productName: product.name, defect: direction }, ctx));
      }

      // Exchange requests
      if (chance(30 * mult)) {
        const fromSize = faker.helpers.arrayElement(['S', 'M', 'L']);
        const toSize = direction === 'too_small'
          ? faker.helpers.arrayElement(['L', 'XL'])
          : faker.helpers.arrayElement(['XS', 'S']);
        events.push(sEvt('Customer Service', 'EXCHANGE_REQUEST',
          `Exchange request: ${product.name} — ${fromSize} → ${toSize} (runs ${direction.replace('_', ' ')})`,
          product.id, { productName: product.name, fromSize, toSize, defect: direction }, ctx));
      }

      // PLM investigation
      if (chance(8 * mult)) {
        events.push(sEvt('Centric PLM', 'SIZING_INVESTIGATION',
          `QA sizing investigation: ${product.name} — spec sheet vs production measurements show ${direction === 'too_small' ? '+2cm' : '-2cm'} deviation across all sizes. Supplier notified`,
          product.id, { productName: product.name, defect: direction }, ctx));
      }

      // Financial impact
      if (chance(10 * mult)) {
        const returnRate = 25 + Math.floor(Math.random() * 30);
        const refundCost = (10000 + Math.floor(Math.random() * 50000)).toLocaleString();
        events.push(sEvt('D365 ERP', 'RETURN_COST_IMPACT',
          `Sizing defect impact: ${product.name} — return rate ${returnRate}% (normal: 8%), estimated cost: SEK ${refundCost}`,
          product.id, { productName: product.name, returnRate, refundCost }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}


// ─── 21. SIZE CURVE ERROR ────────────────────────────────
// Wrong size curve on PO — core sizes sell out, extremes overstock.

function makeSizeCurveError(base: Omit<ActiveScenarioInternal, 'generateTick'>, params: Record<string, unknown>): ActiveScenarioInternal {
  const category = (params.category as string) || faker.helpers.arrayElement(['Knitwear', 'Outerwear', 'T-shirts', 'Denim']);
  const categoryProducts = store.products.filter(p => p.category === category);
  const product = params.productId
    ? (store.products.find(p => p.id === params.productId) || (categoryProducts[0] || rProduct()))
    : (categoryProducts.length > 0 ? faker.helpers.arrayElement(categoryProducts) : rProduct());
  const skus = skusFor(product.id);
  const mult = sevMult(base.severity);
  const coreSizes = ['S', 'M', 'L', '29', '30', '31', '39', '40', '41', '42'];

  base.name = `Size Curve Error: ${product.name} (${category})`;
  base.context = { productId: product.id, productName: product.name, category, styleNumber: product.styleNumber };
  const ctx = { id: base.instanceId, name: base.name };

  return {
    ...base,
    generateTick() {
      const events: SimEvent[] = [];

      // Core sizes selling out → stockout alerts + stock depletion
      if (chance(40 * mult)) {
        const coreSkus = skus.filter(s => coreSizes.includes(s.size));
        if (coreSkus.length > 0) {
          const sku = faker.helpers.arrayElement(coreSkus);
          const loc = rStore();
          const sold = depleteStock(sku.id, loc.id, 1 + Math.floor(Math.random() * 2));
          if (sold > 0) {
            events.push(sEvt('AI Intelligence', 'STOCKOUT_ALERT',
              `Size curve imbalance: ${product.name} (${sku.size}) sold out at ${loc.name} — core size demand exceeds allocation`,
              loc.id, { productName: product.name, size: sku.size, locationName: loc.name }, ctx));
          }
        }
      }

      // Back-in-stock requests for core sizes
      if (chance(35 * mult)) {
        const size = faker.helpers.arrayElement(['S', 'M', 'L']);
        const count = 5 + Math.floor(Math.random() * 30);
        events.push(sEvt('SFCC', 'BACK_IN_STOCK_SURGE',
          `${count} back-in-stock requests for ${product.name} size ${size} — core sizes depleted by curve error`,
          product.id, { productName: product.name, size, count }, ctx));
      }

      // Extreme sizes overstock alerts
      if (chance(25 * mult)) {
        const size = faker.helpers.arrayElement(['XS', 'XL', 'XXL']);
        const weeksOfCover = 15 + Math.floor(Math.random() * 15);
        events.push(sEvt('AI Intelligence', 'OVERSTOCK_ALERT',
          `Overstock: ${product.name} size ${size} — ${weeksOfCover} weeks of cover (target: 6). Too many extreme sizes ordered`,
          product.id, { productName: product.name, size, weeksOfCover }, ctx));
      }

      // Markdown pressure on extreme sizes
      if (chance(15 * mult)) {
        const size = faker.helpers.arrayElement(['XS', 'XL']);
        const discount = 20 + Math.floor(Math.random() * 20);
        events.push(sEvt('AI Intelligence', 'MARKDOWN_RECOMMENDATION',
          `Markdown: ${product.name} size ${size} — suggest ${discount}% reduction to clear overstock`,
          product.id, { productName: product.name, size, discount }, ctx));
      }

      // Lost revenue from core stockouts
      if (chance(12 * mult)) {
        const lostUnits = 10 + Math.floor(Math.random() * 30);
        const lostRevenue = Math.round(lostUnits * product.costPrice * 3.5).toLocaleString();
        events.push(sEvt('D365 ERP', 'LOST_SALES',
          `Lost sales: ${product.name} — ~${lostUnits} units of S/M/L unfulfilled. Revenue impact: SEK ${lostRevenue}`,
          product.id, { productName: product.name, lostUnits, lostRevenue }, ctx));
      }

      // Wholesale partner complaints
      if (chance(10 * mult)) {
        const buyer = faker.helpers.arrayElement(['Nordstrom', 'Selfridges', 'Galeries Lafayette', 'Isetan']);
        events.push(sEvt('NuORDER', 'WHOLESALE_COMPLAINT',
          `${buyer}: "${product.name} size ${faker.helpers.arrayElement(['S', 'M'])} sold out in 3 days but we have 6 weeks of ${faker.helpers.arrayElement(['XS', 'XL'])} — rebalance needed"`,
          null, { buyer, productName: product.name }, ctx));
      }

      // Emergency reorder for core sizes
      if (chance(8 * mult)) {
        const supplier = store.suppliers[Math.floor(Math.random() * store.suppliers.length)];
        events.push(sEvt('Supply Chain', 'EMERGENCY_REORDER',
          `Emergency reorder: ${product.name} sizes S/M/L — expedite from ${supplier?.name || '?'}. Air freight recommended`,
          product.id, { productName: product.name, supplierName: supplier?.name }, ctx));
      }

      this.eventsGenerated += events.length;
      return events;
    },
  };
}
