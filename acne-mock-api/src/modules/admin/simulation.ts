import type { Store } from '../../store/Store.js';

// Mutable store reference — set lazily to avoid circular init with Store.ts.
// runSeedSimulation passes it explicitly; startSimulation resolves it at runtime.
let store: Store = null as any;

export function setStoreRef(s: Store): void { store = s; }
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';
import { faker } from '@faker-js/faker';
import type { SalesOrder, SOLine, PurchaseOrder, POLine, POStatus, SOStatus, StockMovement, Shipment, SOStatusHistory, POStatusHistory, POReceipt, AuditLog, DemandForecast, AIRecommendation, AnomalyAlert, SOPOMatch, MatchingRun } from '../../store/types.js';
import { nextSequence } from '../../utils/number-sequence.js';
import { processScenarioTick, clearAllScenarios, activateScenario, SCENARIO_CATALOG, getActiveScenarios } from './scenarios.js';

// ─── Simulation State ─────────────────────────────────

const PASSPHRASE = 'acne-hackathon-simulate-2026';

interface SimulationState {
  running: boolean;
  startedAt: string | null;
  endsAt: string | null;
  durationHours: number;
  eventsGenerated: number;
  intervalId: ReturnType<typeof setInterval> | null;
  eventLog: SimEvent[];
  speedMultiplier: number;
  autoScenarios: boolean;
  nextAutoScenarioSimTime: number | null; // sim-clock timestamp for next auto-trigger
}

export interface SimEvent {
  id: string;
  timestamp: string;
  system: string;
  type: string;
  summary: string;
  entityId: string | null;
  details: Record<string, unknown>;
}

const state: SimulationState = {
  running: false,
  startedAt: null,
  endsAt: null,
  durationHours: 8,
  eventsGenerated: 0,
  intervalId: null,
  eventLog: [],
  speedMultiplier: 1,
  autoScenarios: false,
  nextAutoScenarioSimTime: null,
};

export function getSimulationState() {
  return {
    running: state.running,
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    durationHours: state.durationHours,
    eventsGenerated: state.eventsGenerated,
    eventLogSize: state.eventLog.length,
    speedMultiplier: state.speedMultiplier,
    autoScenarios: state.autoScenarios,
    activeScenarios: getActiveScenarios().filter(s => s.status === 'ACTIVE').length,
    simClock: simClock.toISOString(),
    recentEvents: state.eventLog.slice(-20),
  };
}

export function getSimulationLog(limit = 100, offset = 0) {
  const reversed = [...state.eventLog].reverse();
  return {
    events: reversed.slice(offset, offset + limit),
    total: state.eventLog.length,
    offset,
    limit,
  };
}

export function validatePassphrase(phrase: string): boolean {
  return phrase === PASSPHRASE;
}

export async function startSimulation(durationHours = 8, speedMultiplier = 1, autoScenarios = false): Promise<boolean> {
  if (state.running) return false;
  // Resolve store on first runtime use if not yet set
  if (!store) {
    const mod = await import('../../store/Store.js');
    store = mod.store;
  }

  state.running = true;
  state.startedAt = now().toISOString();
  state.durationHours = durationHours;
  state.speedMultiplier = Math.max(1, Math.min(1000, speedMultiplier));
  state.eventsGenerated = 0;
  state.eventLog = [];
  state.autoScenarios = autoScenarios;
  // Schedule first auto-scenario 2-8 hours of sim time after start
  state.nextAutoScenarioSimTime = autoScenarios ? simClock.getTime() + (7200000 + Math.random() * 21600000) : null;

  // Initialize simulated clock to current time (or mock time if time-traveled)
  simClock = now();

  const endTime = new Date(now().getTime() + (durationHours * 3600000) / state.speedMultiplier);
  state.endsAt = endTime.toISOString();

  // Base interval: ~45 seconds of simulated time between batches
  // Capped at 100ms minimum to avoid CPU overload
  const baseIntervalMs = Math.max(100, 45000 / state.speedMultiplier);

  state.intervalId = setInterval(() => {
    if (!state.running) {
      clearInterval(state.intervalId!);
      return;
    }
    if (new Date() > endTime) {
      stopSimulation();
      return;
    }
    // Advance the simulated clock
    advanceSimClock();

    const batchSize = 4 + Math.floor(Math.random() * 8);
    for (let i = 0; i < batchSize; i++) {
      const event = generateEvent();
      if (event) {
        state.eventLog.push(event);
        state.eventsGenerated++;
      }
    }

    // Process chained cross-system events
    const chainEvents = processChainQueue();
    for (const event of chainEvents) {
      state.eventLog.push(event);
      state.eventsGenerated++;
    }

    // Process active scenarios (pass sim clock for expiry checks)
    const simClockIso = simClock.toISOString();
    const scenarioEvents = processScenarioTick(simClockIso);
    for (const event of scenarioEvents) {
      state.eventLog.push(event);
      state.eventsGenerated++;
    }

    // Auto-trigger random scenarios (checked against sim time)
    if (state.autoScenarios && state.nextAutoScenarioSimTime && simClock.getTime() >= state.nextAutoScenarioSimTime) {
      const scenarioIds = SCENARIO_CATALOG.map(s => s.id);
      const randomId = scenarioIds[Math.floor(Math.random() * scenarioIds.length)];
      const severities = ['LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'HIGH', 'CRITICAL'] as const;
      const severity = severities[Math.floor(Math.random() * severities.length)];
      const result = activateScenario(randomId, { severity }, simClockIso);
      if (result) {
        const announcement: SimEvent = {
          id: generateId(),
          timestamp: simClockIso,
          system: 'Simulation',
          type: 'AUTO_SCENARIO_TRIGGERED',
          summary: `[AUTO SCENARIO] "${result.name}" triggered at ${severity} severity — expires at ${result.expiresAt}`,
          entityId: null,
          details: { instanceId: result.instanceId, scenarioId: result.scenarioId, severity, context: result.context },
        };
        state.eventLog.push(announcement);
        state.eventsGenerated++;
      }
      // Schedule next auto-scenario 6-48 hours of sim time later
      state.nextAutoScenarioSimTime = simClock.getTime() + (21600000 + Math.random() * 151200000);
    }
  }, baseIntervalMs);

  // Initial burst
  for (let i = 0; i < 8; i++) {
    const event = generateEvent();
    if (event) {
      state.eventLog.push(event);
      state.eventsGenerated++;
    }
  }

  return true;
}

export function stopSimulation(): void {
  state.running = false;
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  clearAllScenarios();
  chainQueue.length = 0;
}

// ─── Event Chain Queue ───────────────────────────────
// When an event in one system fires, it can queue follow-up
// events in other systems with a simulated-time delay.
// This creates realistic cross-system cascades.

interface QueuedChainEvent {
  fireAt: number; // simClock timestamp (ms)
  system: string;
  type: string;
  summaryFn: () => string; // deferred so dynamic data is fresh
  entityId: string | null;
  details: Record<string, unknown>;
  mutation?: () => void;
}

const chainQueue: QueuedChainEvent[] = [];
const CHAIN_QUEUE_MAX = 2000; // prevent unbounded growth

function queueChain(
  delayMinutes: number, system: string, type: string,
  summary: string | (() => string), entityId: string | null,
  details: Record<string, unknown>, mutation?: () => void,
) {
  if (chainQueue.length >= CHAIN_QUEUE_MAX) return; // drop if full
  chainQueue.push({
    fireAt: simClock.getTime() + delayMinutes * 60000,
    system, type,
    summaryFn: typeof summary === 'function' ? summary : () => summary,
    entityId, details, mutation,
  });
}

function processChainQueue(): SimEvent[] {
  const events: SimEvent[] = [];
  const simNow = simClock.getTime();
  let i = 0;
  while (i < chainQueue.length) {
    if (chainQueue[i].fireAt <= simNow) {
      const item = chainQueue.splice(i, 1)[0];
      try { if (item.mutation) item.mutation(); } catch { /* skip */ }
      events.push({
        id: generateId(),
        timestamp: simClock.toISOString(),
        system: item.system,
        type: item.type,
        summary: item.summaryFn(),
        entityId: item.entityId,
        details: { ...item.details, _chained: true },
      });
    } else {
      i++;
    }
  }
  return events;
}

// ─── Simulated Clock ─────────────────────────────────
// Tracks simulated time that advances ~45 sim-seconds per tick.
// Each tick, simClock advances so events can check "what time is it in Tokyo?"

let simClock: Date = new Date();

export function getSimClock(): Date { return new Date(simClock.getTime()); }

function advanceSimClock() {
  // Each tick represents ~45 seconds of simulated time (jittered ±15s)
  const jitter = 30000 + Math.random() * 30000; // 30-60 simulated seconds
  simClock = new Date(simClock.getTime() + jitter);
}

// UTC offset in hours for each IANA timezone (approximation — no DST)
const TZ_OFFSETS: Record<string, number> = {
  'Europe/Stockholm': 2, 'Europe/Paris': 2, 'Europe/London': 1, 'Europe/Rome': 2,
  'Europe/Berlin': 2, 'Europe/Copenhagen': 2, 'Europe/Brussels': 2, 'Europe/Oslo': 2,
  'America/New_York': -4, 'America/Los_Angeles': -7,
  'Asia/Tokyo': 9, 'Asia/Seoul': 9, 'Asia/Shanghai': 8, 'Asia/Hong_Kong': 8,
  'Asia/Singapore': 8, 'Asia/Bangkok': 7, 'Australia/Sydney': 11,
};

function localHour(timezone: string): number {
  const offset = TZ_OFFSETS[timezone] ?? 0;
  const utcH = simClock.getUTCHours() + simClock.getUTCMinutes() / 60;
  return ((utcH + offset) % 24 + 24) % 24;
}

function isStoreOpen(timezone: string): boolean {
  const h = localHour(timezone);
  return h >= 10 && h < 20; // 10:00–20:00 local
}

function isWarehouseActive(timezone: string): boolean {
  const h = localHour(timezone);
  return h >= 6 && h < 22; // 06:00–22:00 local — longer shift
}

function isOfficeHours(timezone: string): boolean {
  const h = localHour(timezone);
  return h >= 9 && h < 18;
}

// E-commerce volume curve (0.0–1.0) by local hour — peaks afternoon/evening
const ECOM_CURVE = [
  0.08, 0.05, 0.03, 0.02, 0.02, 0.04, // 00-05: overnight trickle
  0.08, 0.15, 0.25, 0.35, 0.45, 0.55,  // 06-11: morning ramp-up
  0.60, 0.55, 0.50, 0.55, 0.65, 0.80,  // 12-17: afternoon
  0.95, 1.00, 0.90, 0.70, 0.45, 0.20,  // 18-23: evening peak then wind-down
];

function ecomVolume(timezone: string): number {
  const h = Math.floor(localHour(timezone));
  return ECOM_CURVE[h] ?? 0.3;
}

// Retail foot traffic curve — peaks early afternoon
const RETAIL_CURVE = [
  0, 0, 0, 0, 0, 0,         // 00-05: closed
  0, 0, 0, 0.1, 0.3, 0.6,   // 06-11: opens at 10
  0.8, 1.0, 0.95, 0.85, 0.75, 0.6,  // 12-17: peak then taper
  0.4, 0.2, 0, 0, 0, 0,     // 18-23: closes at 20
];

function retailVolume(timezone: string): number {
  const h = Math.floor(localHour(timezone));
  return RETAIL_CURVE[h] ?? 0;
}

// ─── Helpers ──────────────────────────────────────────

// Returns a random open store, or any store if none are open (24/7 ecom world)
function randomStore() {
  const allStores = store.locations.filter(l => l.type === 'STORE');
  const openStores = allStores.filter(l => isStoreOpen(l.timezone));
  // Strongly prefer open stores, but sometimes return closed stores (security events, etc.)
  if (openStores.length > 0 && Math.random() < 0.92) {
    return openStores[Math.floor(Math.random() * openStores.length)];
  }
  return allStores[Math.floor(Math.random() * allStores.length)];
}

// Returns a random active warehouse
function randomWarehouse() {
  const allWh = store.locations.filter(l => l.type === 'WAREHOUSE');
  const activeWh = allWh.filter(l => isWarehouseActive(l.timezone));
  if (activeWh.length > 0 && Math.random() < 0.85) {
    return activeWh[Math.floor(Math.random() * activeWh.length)];
  }
  return allWh[Math.floor(Math.random() * allWh.length)];
}

function randomSku() {
  return store.skus[Math.floor(Math.random() * store.skus.length)];
}

function randomProduct() {
  return store.products[Math.floor(Math.random() * store.products.length)];
}

function randomSupplier() {
  return store.suppliers[Math.floor(Math.random() * store.suppliers.length)];
}

function productForSku(sku: { productId: string }) {
  return store.products.find(p => p.id === sku.productId);
}

// Pick a random e-commerce market weighted by current local volume
function randomEcomMarket(): string {
  const markets = [
    { cc: 'US', tz: 'America/New_York' },
    { cc: 'SE', tz: 'Europe/Stockholm' },
    { cc: 'FR', tz: 'Europe/Paris' },
    { cc: 'GB', tz: 'Europe/London' },
    { cc: 'DE', tz: 'Europe/Berlin' },
    { cc: 'JP', tz: 'Asia/Tokyo' },
    { cc: 'KR', tz: 'Asia/Seoul' },
    { cc: 'AU', tz: 'Australia/Sydney' },
    { cc: 'DK', tz: 'Europe/Copenhagen' },
    { cc: 'CN', tz: 'Asia/Shanghai' },
    { cc: 'IT', tz: 'Europe/Rome' },
    { cc: 'NO', tz: 'Europe/Oslo' },
  ];
  // Weight by ecom volume curve for each market's local time
  const weighted = markets.map(m => ({ cc: m.cc, w: ecomVolume(m.tz) + 0.02 }));
  const total = weighted.reduce((s, m) => s + m.w, 0);
  let roll = Math.random() * total;
  for (const m of weighted) {
    roll -= m.w;
    if (roll <= 0) return m.cc;
  }
  return 'US';
}

function evt(system: string, type: string, summary: string, entityId: string | null, details: Record<string, unknown>): SimEvent {
  return { id: generateId(), timestamp: simClock.toISOString(), system, type, summary, entityId, details };
}

// Season-aware product selection — products in the current season sell more
function seasonalProduct(): ReturnType<typeof randomProduct> {
  const month = simClock.getMonth() + 1; // 1-12
  const isAW = month >= 8 || month <= 2; // Aug-Feb = Autumn/Winter
  const products = store.products;
  if (products.length === 0) return randomProduct();

  // Weight by season match and category
  const weighted = products.map(p => {
    let w = 1;
    const pSeason = p.season;
    if ((isAW && pSeason === 'AW') || (!isAW && pSeason === 'SS')) w = 3; // in-season
    if ((isAW && pSeason === 'SS') || (!isAW && pSeason === 'AW')) w = 0.4; // off-season
    if (p.isCarryOver) w *= 1.2; // carry-over always sells
    // Category seasonal boost
    if (isAW && (p.category === 'Outerwear' || p.category === 'Knitwear')) w *= 2;
    if (!isAW && (p.category === 'T-shirts' || p.category === 'Denim')) w *= 1.5;
    return { p, w };
  });
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let roll = Math.random() * total;
  for (const { p, w } of weighted) {
    roll -= w;
    if (roll <= 0) return p;
  }
  return products[0];
}

// Is it a weekend in simulated time?
function isWeekend(): boolean {
  const day = simClock.getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

const countryToCurrency: Record<string, string> = { US: 'USD', SE: 'SEK', FR: 'EUR', GB: 'GBP', DE: 'EUR', JP: 'JPY', KR: 'KRW', AU: 'AUD', CN: 'CNY', IT: 'EUR', DK: 'EUR', NO: 'NOK', SG: 'SGD', TH: 'THB', HK: 'HKD' };
const countryTaxRate: Record<string, number> = { US: 0.08, SE: 0.25, FR: 0.20, GB: 0.20, DE: 0.19, JP: 0.10, KR: 0.10, AU: 0.10, DK: 0.25, NO: 0.25, IT: 0.22, CN: 0.13, SG: 0.09, TH: 0.07, HK: 0 };
// Rough FX rates from SEK to local currency (SEK base)
const sekToLocal: Record<string, number> = { SEK: 1, EUR: 0.088, USD: 0.095, GBP: 0.075, JPY: 14.5, KRW: 128, AUD: 0.145, CNY: 0.69, NOK: 1.02, DKK: 0.66, SGD: 0.127, HKD: 0.74, THB: 3.3 };

// ─── Event Generators ─────────────────────────────────

type Gen = () => SimEvent | null;

const generators: Array<{ weight: number; fn: Gen }> = [
  // ── Commerce (high frequency — 80+ stores, 20+ ecom sites, 800 wholesale partners)
  { weight: 40, fn: genEcomOrder },
  { weight: 20, fn: genCartAbandonment },
  { weight: 35, fn: genRetailSale },
  { weight: 8,  fn: genRetailReturn },
  { weight: 6,  fn: genClientelingOrder },
  { weight: 12, fn: genWholesaleActivity },
  // ── Fulfillment & Logistics ────────────────
  { weight: 15, fn: genOrderLifecycle },
  { weight: 12, fn: genWarehouseActivity },
  { weight: 8,  fn: genShipmentUpdate },
  // ── RFID & Inventory ──────────────────────
  { weight: 14, fn: genRfidScan },
  { weight: 6,  fn: genStockMovement },
  { weight: 3,  fn: genRfidDiscrepancy },
  // ── Payments ──────────────────────────────
  { weight: 10, fn: genAdyenPayment },
  { weight: 6,  fn: genKlarnaEvent },
  // ── Supply Chain ──────────────────────────
  { weight: 5,  fn: genSupplierUpdate },
  { weight: 4,  fn: genMediusInvoice },
  // ── Product & PLM ─────────────────────────
  { weight: 3,  fn: genCentricPlmEvent },
  { weight: 5,  fn: genDppScan },
  // ── Intelligence & Analytics ──────────────
  { weight: 5,  fn: genAiAlert },
  { weight: 3,  fn: genAiRecommendation },
  // ── ERP / D365 ────────────────────────────
  { weight: 4,  fn: genD365Event },
  // ── Customer Engagement ───────────────────
  { weight: 8,  fn: genCustomerEngagement },
  { weight: 5,  fn: genCustomerService },
  // ── Store Operations ──────────────────────
  { weight: 4,  fn: genStoreOps },
  // ── Purchase Orders & Supply ───────────────
  { weight: 5,  fn: genPOCreate },
  { weight: 8,  fn: genPOLifecycle },
  // ── AI & Matching ─────────────────────────
  { weight: 2,  fn: genMatchingRun },
  { weight: 2,  fn: genForecastUpdate },
  // ── Security & Fraud ──────────────────────
  { weight: 2,  fn: genSecurityEvent },
];

// Time-of-day weight multipliers — how much each generator's weight is scaled
// based on what's happening globally at this simulated hour.
function timeWeightMultiplier(fn: Gen): number {
  // Use Stockholm (HQ) as reference for global business rhythm
  const hqHour = localHour('Europe/Stockholm');
  const anyStoreOpen = store.locations.some(l => l.type === 'STORE' && isStoreOpen(l.timezone));
  const anyWarehouseActive = store.locations.some(l => l.type === 'WAREHOUSE' && isWarehouseActive(l.timezone));

  // E-commerce: always on, but weighted by combined global volume
  if (fn === genEcomOrder || fn === genCartAbandonment) {
    const avgVol = [
      ecomVolume('America/New_York'), ecomVolume('Europe/Stockholm'),
      ecomVolume('Asia/Tokyo'), ecomVolume('Australia/Sydney'),
    ].reduce((a, b) => a + b, 0) / 4;
    return 0.15 + avgVol * 0.85; // never fully zero (night owls exist)
  }

  // In-store: only when stores are open somewhere, boosted on weekends
  if (fn === genRetailSale || fn === genRetailReturn || fn === genClientelingOrder ||
      fn === genRfidScan || fn === genRfidDiscrepancy || fn === genStoreOps) {
    const weekendBoost = isWeekend() ? 1.4 : 1.0; // 40% more retail on weekends
    return anyStoreOpen ? weekendBoost : 0.03;
  }

  // Warehouse: active on extended hours
  if (fn === genWarehouseActivity || fn === genShipmentUpdate || fn === genOrderLifecycle) {
    return anyWarehouseActive ? 1.0 : 0.1;
  }

  // B2B/wholesale/PLM/finance/POs: office hours (EU-centric HQ), zero on weekends
  if (fn === genWholesaleActivity || fn === genMediusInvoice || fn === genCentricPlmEvent || fn === genD365Event || fn === genPOCreate || fn === genPOLifecycle || fn === genMatchingRun || fn === genForecastUpdate) {
    if (isWeekend()) return 0.02; // near-zero on weekends
    return isOfficeHours('Europe/Stockholm') ? 1.0 : 0.05;
  }

  // Payments: follows combined ecom + retail
  if (fn === genAdyenPayment || fn === genKlarnaEvent) {
    const avgVol = [
      ecomVolume('America/New_York'), ecomVolume('Europe/Stockholm'), ecomVolume('Asia/Tokyo'),
    ].reduce((a, b) => a + b, 0) / 3;
    return anyStoreOpen ? 0.3 + avgVol * 0.7 : 0.1 + avgVol * 0.9;
  }

  // AI/analytics: office hours with some overnight batch processing
  if (fn === genAiAlert || fn === genAiRecommendation) {
    return isOfficeHours('Europe/Stockholm') ? 1.0 : 0.3;
  }

  // Customer engagement: follows ecom curve loosely
  if (fn === genCustomerEngagement || fn === genCustomerService) {
    const vol = ecomVolume('Europe/Stockholm');
    return 0.2 + vol * 0.8;
  }

  // Supplier updates: office hours in supplier timezones (spread globally)
  if (fn === genSupplierUpdate) {
    return (isOfficeHours('Europe/Rome') || isOfficeHours('Asia/Shanghai')) ? 1.0 : 0.15;
  }

  // DPP scans: happen globally, slight daytime bias
  if (fn === genDppScan) return 0.3 + ecomVolume('Europe/Stockholm') * 0.7;

  // Stock movements: warehouse hours
  if (fn === genStockMovement) return anyWarehouseActive ? 1.0 : 0.1;

  // Security: slightly more at night (fraud attempts)
  if (fn === genSecurityEvent) {
    return hqHour >= 22 || hqHour < 6 ? 1.5 : 0.8;
  }

  return 1.0; // fallback
}

function generateEvent(): SimEvent | null {
  // Apply time-of-day weights
  const weighted = generators.map(g => ({ ...g, effectiveWeight: g.weight * timeWeightMultiplier(g.fn) }));
  const totalWeight = weighted.reduce((sum, g) => sum + g.effectiveWeight, 0);
  let roll = Math.random() * totalWeight;
  for (const gen of weighted) {
    roll -= gen.effectiveWeight;
    if (roll <= 0) {
      try { return gen.fn(); } catch { return null; }
    }
  }
  return null;
}

// ─── Store Record Helpers ─────────────────────────────
// These create proper records in store collections alongside events,
// so the data is fully consistent for seed simulation.

function systemUser() {
  return store.users.find(u => u.role === 'ADMIN') || store.users[0];
}
function ecomUser() {
  return store.users.find(u => u.role === 'ECOM') || systemUser();
}
function warehouseUser() {
  return store.users.find(u => u.role === 'WAREHOUSE') || systemUser();
}
function buyerUser() {
  return store.users.find(u => u.role === 'BUYER') || systemUser();
}

function logSOStatusChange(soId: string, from: SOStatus | null, to: SOStatus, userId?: string, reason?: string) {
  store.soStatusHistory.push({
    id: generateId(), salesOrderId: soId,
    fromStatus: from, toStatus: to,
    changedById: userId || systemUser().id,
    reason: reason || null, changedAt: simClock.toISOString(),
  });
}

function logPOStatusChange(poId: string, from: POStatus | null, to: POStatus, userId?: string, reason?: string) {
  store.poStatusHistory.push({
    id: generateId(), purchaseOrderId: poId,
    fromStatus: from, toStatus: to,
    changedById: userId || systemUser().id,
    reason: reason || null, changedAt: simClock.toISOString(),
  });
}

function logStockMovement(skuId: string, type: StockMovement['type'], qty: number, fromLoc: string | null, toLoc: string | null, refType: string | null, refId: string | null, reason?: string) {
  store.stockMovements.push({
    id: generateId(), skuId, type, quantity: qty,
    fromLocationId: fromLoc, toLocationId: toLoc,
    referenceType: refType, referenceId: refId,
    reason: reason || null,
    performedById: warehouseUser().id, performedAt: simClock.toISOString(),
  });
}

function logAudit(action: string, entityType: string, entityId: string, oldValue: Record<string, unknown> | null, newValue: Record<string, unknown> | null) {
  store.auditLogs.push({
    id: generateId(), userId: systemUser().id,
    action, entityType, entityId,
    oldValue, newValue,
    ipAddress: '10.0.0.1', timestamp: simClock.toISOString(),
  });
}

function createShipment(soId: string, carrier: string, tracking: string): Shipment {
  const s: Shipment = {
    id: generateId(), salesOrderId: soId,
    trackingNumber: tracking, carrier,
    shippedAt: simClock.toISOString(), deliveredAt: null,
    createdAt: simClock.toISOString(),
  };
  store.shipments.push(s);
  return s;
}

// ═══════════════════════════════════════════════════════
// COMMERCE
// ═══════════════════════════════════════════════════════

function genEcomOrder(): SimEvent {
  const country = randomEcomMarket();
  const currency = countryToCurrency[country] || 'EUR';
  const customer = { name: faker.person.fullName(), email: faker.internet.email(), city: faker.location.city(), country };
  const itemCount = 1 + Math.floor(Math.random() * 3);
  // Pick SKUs from seasonal products
  const selectedProducts = Array.from({ length: itemCount }, () => seasonalProduct());
  const skus = selectedProducts.map(p => {
    const pSkus = store.skus.filter(s => s.productId === p.id);
    return pSkus.length > 0 ? pSkus[Math.floor(Math.random() * pSkus.length)] : store.skus[Math.floor(Math.random() * store.skus.length)];
  });
  const ecomUser = store.users.find(u => u.role === 'ECOM')!;

  let subtotal = 0;
  const soLines: SOLine[] = [];
  const soId = generateId();
  const soNumber = `SO-EC-SIM-${String(state.eventsGenerated + 1).padStart(5, '0')}`;
  const fxRate = sekToLocal[currency] || 0.095;

  for (const sku of skus) {
    const qty = 1 + Math.floor(Math.random() * 2);
    const localPrice = Math.round(sku.retailPrice * fxRate);
    const lineTotal = qty * localPrice;
    subtotal += lineTotal;
    soLines.push({
      id: generateId(), salesOrderId: soId, skuId: sku.id, quantityOrdered: qty,
      quantityAllocated: 0, quantityShipped: 0, quantityReturned: 0,
      unitPrice: localPrice, discountPercent: 0, lineTotal,
      notes: null, createdAt: now().toISOString(), updatedAt: now().toISOString(),
    });
  }

  const so: SalesOrder = {
    id: soId, soNumber, channel: 'ECOMMERCE', type: 'STANDARD', status: 'CONFIRMED',
    locationId: store.locations[0].id, customerId: generateId(),
    customerName: customer.name, customerEmail: customer.email, wholesaleBuyerId: null,
    currency: currency as any,
    subtotal: Math.round(subtotal), taxAmount: Math.round(subtotal * (countryTaxRate[country] ?? 0.20)), discountAmount: 0, totalAmount: Math.round(subtotal * (1 + (countryTaxRate[country] ?? 0.20))),
    shippingAddress: faker.location.streetAddress(), shippingCity: customer.city, shippingCountry: customer.country,
    requestedShipDate: now().toISOString(), actualShipDate: null, deliveredAt: null,
    notes: `[SIM] Online order from ${customer.city}, ${customer.country}`, priority: 0,
    createdById: ecomUser.id, createdAt: now().toISOString(), updatedAt: now().toISOString(),
  };
  store.salesOrders.push(so);
  store.soLines.push(...soLines);
  logSOStatusChange(soId, null, 'CONFIRMED', ecomUser.id, 'Online order placed');
  logAudit('CREATE', 'SalesOrder', soId, null, { soNumber, channel: 'ECOMMERCE', status: 'CONFIRMED' });

  const names = skus.map(s => productForSku(s)?.name || '?').join(', ');
  const payMethod = faker.helpers.arrayElement(['visa', 'mastercard', 'amex', 'klarna', 'apple_pay']);
  const carrier = faker.helpers.arrayElement(['DHL Express', 'FedEx', 'UPS', 'PostNord']);
  const tracking = `${carrier.slice(0, 3).toUpperCase()}${Math.floor(Math.random() * 9e9) + 1e9}`;
  const wh = randomWarehouse();
  const chainId = soNumber;

  // ── Chain: Ecom Order → Payment → OMS → WMS → Ship ──
  // +1-3 min: Payment authorized
  queueChain(1 + Math.random() * 2, 'Adyen', 'PAYMENT_AUTHORIZED',
    `Payment authorized: ${currency} ${(so.totalAmount / 100).toFixed(2)} via ${payMethod} for ${soNumber}`,
    soId, { chainId, soNumber, amount: so.totalAmount, currency, method: payMethod });

  // +3-8 min: OMS confirms order
  queueChain(3 + Math.random() * 5, 'Teamwork Commerce', 'ORDER_CONFIRMED',
    `OMS order confirmed: ${soNumber} — ${itemCount} item(s) routed to ${wh.name} for fulfillment`,
    soId, { chainId, soNumber, warehouseName: wh.name, items: itemCount });

  // +30-120 min: WMS pick task
  queueChain(30 + Math.random() * 90, 'Blue Yonder WMS', 'PICK_TASK_CREATED',
    `Pick task created for ${soNumber} at ${wh.name} — ${itemCount} item(s) from zone ${faker.helpers.arrayElement(['A', 'B', 'C'])}-${Math.floor(Math.random() * 20) + 1}`,
    soId, { chainId, soNumber, warehouseName: wh.name });

  // +90-240 min: RFID outbound scan at warehouse
  queueChain(90 + Math.random() * 150, 'Nedap iD Cloud', 'RFID_OUTBOUND',
    `RFID outbound scan at ${wh.name}: ${itemCount} item(s) verified for ${soNumber}`,
    soId, { chainId, soNumber, warehouseName: wh.name, tagsScanned: itemCount });

  // +120-300 min: Carrier dispatches
  queueChain(120 + Math.random() * 180, 'Carrier', 'SHIPMENT_DISPATCHED',
    `${carrier}: Shipment dispatched for ${soNumber} — tracking ${tracking}, destination: ${customer.city}, ${country}`,
    soId, { chainId, soNumber, carrier, tracking, destination: customer.city },
    () => {
      const prev = so.status;
      so.status = 'SHIPPED' as any; so.actualShipDate = simClock.toISOString(); so.updatedAt = simClock.toISOString();
      logSOStatusChange(soId, prev as SOStatus, 'SHIPPED', warehouseUser().id, 'Dispatched via ' + carrier);
      createShipment(soId, carrier, tracking);
      for (const line of soLines) {
        line.quantityShipped = line.quantityOrdered;
        logStockMovement(line.skuId, 'SO_SHIPMENT', line.quantityOrdered, wh.id, null, 'SalesOrder', soId);
      }
    });

  // +150-360 min: Adyen capture
  queueChain(150 + Math.random() * 210, 'Adyen', 'PAYMENT_CAPTURED',
    `Payment captured: ${currency} ${(so.totalAmount / 100).toFixed(2)} via ${payMethod} for ${soNumber}`,
    soId, { chainId, soNumber, amount: so.totalAmount, currency, method: payMethod });

  return evt('SFCC', 'ECOMMERCE_ORDER', `New online order ${soNumber} from ${customer.name} (${customer.city}, ${country}) — ${itemCount} item(s): ${names}`, soId, { soNumber, customer, items: itemCount, total: so.totalAmount, currency });
}

function genCartAbandonment(): SimEvent {
  const sku = randomSku();
  const product = productForSku(sku);
  const customer = faker.person.fullName();
  const page = faker.helpers.arrayElement(['product_page', 'cart', 'checkout_shipping', 'checkout_payment']);
  return evt('SFCC', 'CART_ABANDONED', `Cart abandoned by ${customer} at ${page.replace(/_/g, ' ')} — ${product?.name || '?'} (${sku.colour}, ${sku.size})`, null,
    { customerName: customer, skuId: sku.id, productName: product?.name, colour: sku.colour, size: sku.size, price: sku.retailPrice, abandonedAt: page });
}

function genRetailSale(): SimEvent {
  const loc = randomStore();
  if (!isStoreOpen(loc.timezone)) return genEcomOrder(); // fallback to ecom if store closed
  const sku = randomSku();
  const product = productForSku(sku);
  const qty = 1;
  // Safely decrement stock + log movement
  const sl = store.stockLevels.find(s => s.skuId === sku.id && s.locationId === loc.id);
  if (sl && sl.quantityOnHand > 0) {
    sl.quantityOnHand -= qty;
    sl.updatedAt = simClock.toISOString();
    logStockMovement(sku.id, 'SO_ALLOCATION', qty, loc.id, null, 'RETAIL_SALE', loc.id, 'In-store sale');
  }
  const h = localHour(loc.timezone);
  const payment = faker.helpers.arrayElement(['card_visa', 'card_mastercard', 'card_amex', 'cash', 'klarna', 'apple_pay', 'swish', 'google_pay']);
  const associate = faker.person.firstName();
  const localTime = `${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
  const pspRef = `MOCK_PSP_${generateId().slice(0, 10).toUpperCase()}`;

  // ── Chain: Retail Sale → Payment → RFID → Reorder check ──
  // +0-1 min: Adyen payment processed
  if (payment !== 'cash') {
    queueChain(Math.random(), 'Adyen', 'PAYMENT_AUTHORIZED',
      `POS payment: ${loc.countryCode === 'SE' ? 'SEK' : 'EUR'} ${sku.retailPrice} via ${payment} at ${loc.name} (${pspRef})`,
      loc.id, { locationName: loc.name, method: payment, amount: sku.retailPrice, pspRef });
  }

  // +0-2 min: Nedap RFID exit gate detects item leaving
  queueChain(Math.random() * 2, 'Nedap iD Cloud', 'RFID_EXIT_GATE',
    `RFID exit gate at ${loc.name}: ${product?.name || '?'} (${sku.colour}, ${sku.size}) — tag deactivated, sale confirmed`,
    loc.id, { locationName: loc.name, productName: product?.name, sku: sku.sku });

  // +10-30 min: Low stock alert if below reorder point
  if (sl && sl.quantityOnHand <= (sl.reorderPoint ?? 3)) {
    queueChain(10 + Math.random() * 20, 'AI Intelligence', 'LOW_STOCK_ALERT',
      `Low stock alert: ${product?.name || '?'} (${sku.colour}, ${sku.size}) at ${loc.name} — ${sl.quantityOnHand} units remaining (reorder point: ${sl.reorderPoint ?? 3})`,
      loc.id, { locationName: loc.name, productName: product?.name, remaining: sl.quantityOnHand, reorderPoint: sl.reorderPoint ?? 3 });
  }

  return evt('Teamwork POS', 'RETAIL_SALE', `In-store sale at ${loc.name} (${localTime} local): ${product?.name || '?'} (${sku.colour}, ${sku.size}) — ${payment} — served by ${associate}`, loc.id,
    { locationName: loc.name, localTime, skuId: sku.id, productName: product?.name, colour: sku.colour, size: sku.size, price: sku.retailPrice, paymentMethod: payment, associate, terminalId: `POS-${loc.name.slice(0, 5).toUpperCase()}-${Math.floor(Math.random() * 3) + 1}` });
}

function genRetailReturn(): SimEvent {
  const loc = randomStore();
  if (!isStoreOpen(loc.timezone)) return genCartAbandonment(); // fallback
  const sku = randomSku();
  const product = productForSku(sku);
  const reason = faker.helpers.arrayElement(['wrong_size', 'changed_mind', 'defective', 'colour_mismatch', 'gift_return', 'not_as_expected']);
  const refundMethod = faker.helpers.arrayElement(['original_payment', 'store_credit', 'exchange']);
  // Add stock back + log movement
  const sl = store.stockLevels.find(s => s.skuId === sku.id && s.locationId === loc.id);
  if (sl) {
    sl.quantityOnHand += 1;
    sl.updatedAt = simClock.toISOString();
    logStockMovement(sku.id, 'RETURN_RECEIPT', 1, null, loc.id, 'RETAIL_RETURN', loc.id, reason);
  }

  // ── Chain: Return → Refund → RFID scan back ──
  // +1-5 min: Refund processed
  if (refundMethod === 'original_payment') {
    const provider = faker.helpers.arrayElement(['Adyen', 'Klarna']);
    queueChain(1 + Math.random() * 4, provider, 'REFUND_PROCESSED',
      `Refund processed at ${loc.name}: ${sku.retailPrice} ${sku.priceCurrency} via ${provider} — reason: ${reason.replace(/_/g, ' ')}`,
      loc.id, { locationName: loc.name, amount: sku.retailPrice, reason });
  }

  // +0-2 min: Nedap RFID scans item back into store inventory
  queueChain(Math.random() * 2, 'Nedap iD Cloud', 'RFID_RETURN_SCAN',
    `RFID return scan at ${loc.name}: ${product?.name || '?'} (${sku.colour}, ${sku.size}) — returned to sellable stock`,
    loc.id, { locationName: loc.name, productName: product?.name, sku: sku.sku });

  // +30-120 min: If defective, trigger CS investigation chain
  if (reason === 'defective') {
    queueChain(30 + Math.random() * 90, 'Customer Service', 'QUALITY_REPORT',
      `Quality report filed: ${product?.name || '?'} (${sku.colour}, ${sku.size}) returned defective at ${loc.name} — forwarded to QA team`,
      loc.id, { locationName: loc.name, productName: product?.name, reason });
  }

  return evt('Teamwork POS', 'RETAIL_RETURN', `Return at ${loc.name}: ${product?.name || '?'} (${sku.colour}, ${sku.size}) — reason: ${reason.replace(/_/g, ' ')} — ${refundMethod.replace(/_/g, ' ')}`, loc.id,
    { locationName: loc.name, productName: product?.name, reason, refundMethod });
}

function genClientelingOrder(): SimEvent {
  const loc = randomStore();
  if (!isStoreOpen(loc.timezone)) return genCustomerEngagement(); // fallback
  const sku = randomSku();
  const product = productForSku(sku);
  const vicName = faker.person.fullName();
  const action = faker.helpers.arrayElement(['special_order_placed', 'item_reserved', 'personal_shopping_scheduled', 'wish_list_item_arrived']);
  const text = {
    special_order_placed: `VIC special order: ${vicName} at ${loc.name} ordered ${product?.name || '?'} (not in store stock — warehouse transfer initiated)`,
    item_reserved: `Item reserved for VIC ${vicName} at ${loc.name}: ${product?.name || '?'} (${sku.colour}, ${sku.size})`,
    personal_shopping_scheduled: `Personal shopping appointment scheduled for ${vicName} at ${loc.name} — ${faker.helpers.arrayElement(['tomorrow 14:00', 'Saturday 11:00', 'next Monday 10:00'])}`,
    wish_list_item_arrived: `VIC ${vicName} notified: wish-listed ${product?.name || '?'} now available at ${loc.name}`,
  }[action];
  // Chain: special_order_placed → create actual SO + warehouse transfer
  if (action === 'special_order_placed') {
    const soId = generateId();
    const soNumber = `SO-CL-SIM-${generateId().slice(0, 6).toUpperCase()}`;
    const storeMgr = store.users.find(u => u.role === 'STORE_MGR') || systemUser();
    const lineTotal = sku.retailPrice;
    const soLine: SOLine = {
      id: generateId(), salesOrderId: soId, skuId: sku.id,
      quantityOrdered: 1, quantityAllocated: 0, quantityShipped: 0, quantityReturned: 0,
      unitPrice: sku.retailPrice, discountPercent: 0, lineTotal,
      notes: `VIC: ${vicName}`, createdAt: simClock.toISOString(), updatedAt: simClock.toISOString(),
    };
    const so: SalesOrder = {
      id: soId, soNumber, channel: 'CLIENTELING', type: 'STANDARD', status: 'CONFIRMED',
      locationId: loc.id, customerId: generateId(),
      customerName: vicName, customerEmail: null, wholesaleBuyerId: null,
      currency: (sku.priceCurrency || 'SEK') as any,
      subtotal: lineTotal, taxAmount: Math.round(lineTotal * 0.25), discountAmount: 0,
      totalAmount: Math.round(lineTotal * 1.25),
      shippingAddress: null, shippingCity: loc.city, shippingCountry: loc.countryCode,
      requestedShipDate: simClock.toISOString(), actualShipDate: null, deliveredAt: null,
      notes: `[SIM] VIC clienteling order at ${loc.name}`, priority: 2,
      createdById: storeMgr.id, createdAt: simClock.toISOString(), updatedAt: simClock.toISOString(),
    };
    store.salesOrders.push(so);
    store.soLines.push(soLine);
    logSOStatusChange(soId, null, 'CONFIRMED', storeMgr.id, 'VIC special order');

    // Queue warehouse transfer fulfillment
    const wh = randomWarehouse();
    queueChain(60 + Math.random() * 240, 'Blue Yonder WMS', 'PICK_TASK_CREATED',
      `VIC special order pick at ${wh.name}: ${product?.name || '?'} (${sku.colour}, ${sku.size}) for ${loc.name}`,
      soId, { soNumber, warehouseName: wh.name, vicName });
    queueChain(1440 + Math.random() * 2880, 'Carrier', 'SHIPMENT_DISPATCHED',
      `Store transfer for VIC order ${soNumber}: ${wh.name} → ${loc.name}`,
      soId, { soNumber, from: wh.name, to: loc.name });
  }

  return evt('Teamwork POS', 'CLIENTELING', text!, loc.id, { vicName, locationName: loc.name, action, productName: product?.name });
}

function genWholesaleActivity(): SimEvent {
  const buyers = ['Nordstrom', 'Selfridges', 'Le Bon Marché', 'Isetan', 'Lane Crawford', 'KaDeWe', 'NK Stockholm', 'Galeries Lafayette', 'Rinascente', 'Ssense', 'Mr Porter'];
  const buyer = faker.helpers.arrayElement(buyers);
  const product = randomProduct();
  const action = faker.helpers.arrayElement(['viewed_line_sheet', 'added_to_order', 'requested_samples', 'price_inquiry', 'confirmed_order', 'requested_delivery_change', 'cancelled_line', 'approved_proforma']);
  const text = {
    viewed_line_sheet: `${buyer} viewed AW2026 line sheet (${2 + Math.floor(Math.random() * 15)} min session)`,
    added_to_order: `${buyer} added ${product.name} (${5 + Math.floor(Math.random() * 30)} units) to draft order`,
    requested_samples: `${buyer} requested salesman samples: ${product.name} — ship to ${faker.location.city()}`,
    price_inquiry: `${buyer} inquired about volume pricing for ${product.name} (${50 + Math.floor(Math.random() * 200)}+ units)`,
    confirmed_order: `${buyer} confirmed AW2026 order — ${8 + Math.floor(Math.random() * 25)} styles, ${faker.helpers.arrayElement(['EUR', 'USD', 'GBP'])} ${(50000 + Math.floor(Math.random() * 300000)).toLocaleString()}`,
    requested_delivery_change: `${buyer} requested delivery date change for order — new date: ${faker.date.future().toISOString().split('T')[0]}`,
    cancelled_line: `${buyer} cancelled ${product.name} from draft order — reason: ${faker.helpers.arrayElement(['budget constraint', 'category overlap', 'late delivery concern'])}`,
    approved_proforma: `${buyer} approved proforma invoice for pending order`,
  }[action];
  // ── Chain: Wholesale Confirmed → OMS → WMS pick → Carrier → Invoice ──
  if (action === 'confirmed_order') {
    const wh = randomWarehouse();
    const styles = 8 + Math.floor(Math.random() * 25);
    const carrier = faker.helpers.arrayElement(['DHL Express', 'FedEx', 'DB Schenker']);

    // +2-8 hours: Teamwork OMS processes wholesale order
    queueChain(120 + Math.random() * 360, 'Teamwork Commerce', 'WHOLESALE_ORDER_PROCESSED',
      `Wholesale order from ${buyer} processed — ${styles} styles allocated from ${wh.name}`,
      null, { buyer, warehouseName: wh.name, styles });

    // +1-3 days: WMS pick task for wholesale bulk order
    queueChain(1440 + Math.random() * 2880, 'Blue Yonder WMS', 'WHOLESALE_PICK',
      `Wholesale pick task at ${wh.name} for ${buyer} — ${styles} styles, bulk palletization`,
      wh.id, { buyer, warehouseName: wh.name, styles });

    // +2-5 days: Carrier dispatch
    queueChain(2880 + Math.random() * 4320, 'Carrier', 'WHOLESALE_SHIPMENT',
      `${carrier}: Wholesale shipment for ${buyer} dispatched from ${wh.name} — ${Math.floor(Math.random() * 5) + 1} pallets`,
      wh.id, { buyer, carrier, warehouseName: wh.name });

    // +3-7 days: Medius invoice created
    queueChain(4320 + Math.random() * 5760, 'Medius AP', 'WHOLESALE_INVOICE',
      `Wholesale invoice generated for ${buyer} — ${faker.helpers.arrayElement(['EUR', 'USD', 'GBP'])} ${(50000 + Math.floor(Math.random() * 300000)).toLocaleString()}`,
      null, { buyer });
  }

  return evt('NuORDER', 'WHOLESALE_ACTIVITY', text!, null, { buyer, action, productName: product.name, styleNumber: product.styleNumber });
}

// ═══════════════════════════════════════════════════════
// FULFILLMENT & LOGISTICS
// ═══════════════════════════════════════════════════════

function genOrderLifecycle(): SimEvent {
  // Progress a random existing SO to next status
  const transitions: Record<string, string> = { DRAFT: 'CONFIRMED', CONFIRMED: 'ALLOCATED', ALLOCATED: 'PICKING', PICKING: 'PACKED', PACKED: 'SHIPPED', PARTIALLY_SHIPPED: 'DELIVERED', SHIPPED: 'DELIVERED' };
  const eligible = store.salesOrders.filter(so => so.status in transitions);
  if (eligible.length === 0) return genWarehouseActivity();

  const so = eligible[Math.floor(Math.random() * eligible.length)];
  const nextStatus = transitions[so.status];
  const prevStatus = so.status;
  so.status = nextStatus as any;
  so.updatedAt = simClock.toISOString();
  logSOStatusChange(so.id, prevStatus as SOStatus, nextStatus as SOStatus, warehouseUser().id);

  if (nextStatus === 'SHIPPED') {
    so.actualShipDate = simClock.toISOString();
    const carrier = faker.helpers.arrayElement(['DHL Express', 'FedEx', 'UPS', 'PostNord']);
    const tracking = `${carrier.slice(0, 3).toUpperCase()}${Math.floor(Math.random() * 9e9) + 1e9}`;
    createShipment(so.id, carrier, tracking);
    const lines = store.soLines.filter(l => l.salesOrderId === so.id);
    for (const line of lines) {
      line.quantityShipped = line.quantityOrdered;
      line.updatedAt = simClock.toISOString();
      logStockMovement(line.skuId, 'SO_SHIPMENT', line.quantityOrdered, so.locationId, null, 'SalesOrder', so.id);
    }
    // Chain: carrier dispatch + RFID outbound
    const wh = store.locations.find(l => l.id === so.locationId) || randomWarehouse();
    queueChain(Math.random() * 5, 'Nedap iD Cloud', 'RFID_OUTBOUND',
      `RFID outbound scan at ${wh.name}: ${lines.length} item(s) verified for ${so.soNumber}`,
      so.id, { soNumber: so.soNumber, warehouseName: wh.name });
    queueChain(30 + Math.random() * 60, 'Carrier', 'SHIPMENT_UPDATE',
      `${carrier} ${tracking}: Shipment for ${so.soNumber} in transit — departed ${wh.name}`,
      so.id, { carrier, tracking, soNumber: so.soNumber });
  }
  if (nextStatus === 'ALLOCATED') {
    const lines = store.soLines.filter(l => l.salesOrderId === so.id);
    for (const line of lines) {
      line.quantityAllocated = line.quantityOrdered;
      line.updatedAt = simClock.toISOString();
    }
  }
  if (nextStatus === 'DELIVERED') {
    so.deliveredAt = simClock.toISOString();
    // Chain: DPP scan (customer receives product) + D365 revenue recognition
    const product = store.soLines.filter(l => l.salesOrderId === so.id)
      .map(l => store.products.find(p => store.skus.find(s => s.id === l.skuId)?.productId === p.id))
      .find(p => p);
    queueChain(1440 + Math.random() * 4320, 'Temera DPP', 'DPP_SCAN',
      `Digital passport scanned (consumer scan): ${product?.name || 'product'} in ${so.shippingCity || 'unknown'}, ${so.shippingCountry || '??'}`,
      so.id, { scanType: 'consumer_scan', soNumber: so.soNumber, verified: true });
    queueChain(60 + Math.random() * 1440, 'D365 ERP', 'REVENUE_RECOGNITION',
      `Revenue recognized: ${so.soNumber} — ${so.currency} ${so.totalAmount.toLocaleString()} (${so.channel})`,
      so.id, { soNumber: so.soNumber, amount: so.totalAmount, currency: so.currency });
  }

  return evt('Teamwork Commerce', 'ORDER_LIFECYCLE', `Order ${so.soNumber} progressed: ${prevStatus} → ${nextStatus} (${so.channel}, ${so.customerName || 'Unknown'})`, so.id,
    { soNumber: so.soNumber, from: prevStatus, to: nextStatus, channel: so.channel, customerName: so.customerName });
}

function genWarehouseActivity(): SimEvent {
  const wh = randomWarehouse();
  const activity = faker.helpers.arrayElement(['pick_completed', 'pack_completed', 'shipment_dispatched', 'inbound_received', 'cycle_count', 'putaway_completed', 'bin_transfer', 'quality_hold_released', 'dock_appointment']);
  const carrier = faker.helpers.arrayElement(['DHL Express', 'FedEx', 'UPS', 'PostNord', 'DB Schenker', 'Yamato Transport']);
  const text: Record<string, string> = {
    pick_completed: `Pick task completed at ${wh.name} — ${2 + Math.floor(Math.random() * 8)} items from ${1 + Math.floor(Math.random() * 3)} orders`,
    pack_completed: `Pack station ${Math.floor(Math.random() * 5) + 1}: order packed at ${wh.name} — ${faker.helpers.arrayElement(['standard box', 'garment bag', 'gift wrapped'])}`,
    shipment_dispatched: `Outbound shipment dispatched from ${wh.name} via ${carrier} — tracking: ${carrier.slice(0, 3).toUpperCase()}${Math.floor(Math.random() * 9000000000) + 1000000000}`,
    inbound_received: `Inbound PO received at ${wh.name} dock ${Math.floor(Math.random() * 4) + 1} — ${10 + Math.floor(Math.random() * 50)} units, ${Math.floor(Math.random() * 3)} pallets`,
    cycle_count: `Cycle count completed in zone ${faker.helpers.arrayElement(['A', 'B', 'C', 'D'])}-${Math.floor(Math.random() * 20) + 1} at ${wh.name} — ${95 + Math.floor(Math.random() * 5)}% accuracy`,
    putaway_completed: `Putaway completed at ${wh.name} — ${5 + Math.floor(Math.random() * 20)} items shelved in zone ${faker.helpers.arrayElement(['A', 'B', 'C'])}`,
    bin_transfer: `Bin transfer at ${wh.name}: ${3 + Math.floor(Math.random() * 10)} items moved from overstock to pick face`,
    quality_hold_released: `QA hold released at ${wh.name} — ${2 + Math.floor(Math.random() * 8)} items cleared for allocation`,
    dock_appointment: `Dock appointment confirmed at ${wh.name} — ${carrier} arrival ${faker.helpers.arrayElement(['tomorrow 08:00', 'today 14:30', 'Wednesday 10:00'])}`,
  };
  // ── Chain: Inbound Received → RFID scan → Putaway → Invoice match → D365 posting ──
  if (activity === 'inbound_received') {
    const units = 10 + Math.floor(Math.random() * 50);
    const supplier = randomSupplier();

    // +30-120 min: Nedap RFID bulk scan of inbound goods
    queueChain(30 + Math.random() * 90, 'Nedap iD Cloud', 'RFID_INBOUND_SCAN',
      `RFID bulk scan at ${wh.name}: ${units} items verified from inbound shipment (${supplier.name})`,
      wh.id, { warehouseName: wh.name, supplierName: supplier.name, itemsScanned: units });

    // +60-240 min: Putaway completed
    queueChain(60 + Math.random() * 180, 'Blue Yonder WMS', 'PUTAWAY_COMPLETED',
      `Putaway completed at ${wh.name}: ${units} items from ${supplier.name} shelved in zone ${faker.helpers.arrayElement(['A', 'B', 'C'])}-${Math.floor(Math.random() * 20) + 1}`,
      wh.id, { warehouseName: wh.name, supplierName: supplier.name, items: units });

    // +1-5 days: Medius 3-way invoice match
    queueChain(1440 + Math.random() * 5760, 'Medius AP', 'THREE_WAY_MATCH',
      `3-way match completed: ${supplier.name} — PO ↔ receipt (${units} units at ${wh.name}) ↔ invoice — ${supplier.currency} ${(units * (200 + Math.floor(Math.random() * 800))).toLocaleString()} ✓`,
      null, { supplierName: supplier.name, warehouseName: wh.name, units });

    // +2-7 days: D365 GL posting
    queueChain(2880 + Math.random() * 7200, 'D365 ERP', 'GL_POSTING',
      `GL posting: Inventory receipt from ${supplier.name} — ${units} units at ${wh.name} — posted to 1400-INVENTORY`,
      null, { supplierName: supplier.name, units, account: '1400-INVENTORY' });
  }

  return evt('Blue Yonder WMS', 'WAREHOUSE_ACTIVITY', text[activity], wh.id, { warehouseName: wh.name, activityType: activity });
}

function genShipmentUpdate(): SimEvent {
  const carrier = faker.helpers.arrayElement(['DHL Express', 'FedEx', 'UPS', 'PostNord', 'DB Schenker']);
  const status = faker.helpers.arrayElement(['in_transit', 'out_for_delivery', 'delivered', 'customs_cleared', 'delay_reported', 'attempted_delivery']);
  const tracking = `${carrier.slice(0, 3).toUpperCase()}${Math.floor(Math.random() * 9000000000) + 1000000000}`;
  const city = faker.location.city();
  const text: Record<string, string> = {
    in_transit: `${carrier} ${tracking}: In transit — departed ${city} hub`,
    out_for_delivery: `${carrier} ${tracking}: Out for delivery in ${city}`,
    delivered: `${carrier} ${tracking}: Delivered in ${city} — signed by ${faker.person.lastName()}`,
    customs_cleared: `${carrier} ${tracking}: Customs cleared at ${city} — proceeding to destination`,
    delay_reported: `${carrier} ${tracking}: Delay reported — weather disruption at ${city} hub, ETA +${1 + Math.floor(Math.random() * 3)} days`,
    attempted_delivery: `${carrier} ${tracking}: Delivery attempted in ${city} — no one home, retry scheduled`,
  };
  // Chains for delivery and delay events
  if (status === 'delivered') {
    const product = randomProduct();
    queueChain(720 + Math.random() * 4320, 'Temera DPP', 'DPP_SCAN',
      `Digital passport scanned (consumer scan): ${product.name} in ${city}`,
      null, { scanType: 'consumer_scan', productName: product.name, city, verified: true });
  }
  if (status === 'delay_reported') {
    const delayDays = 1 + Math.floor(Math.random() * 3);
    queueChain(30 + Math.random() * 120, 'AI Intelligence', 'DELIVERY_DELAY_ALERT',
      `Delivery delay detected: ${carrier} ${tracking} — ${delayDays} day(s) delayed at ${city}. Forecasts may be impacted`,
      null, { carrier, tracking, delayDays, city });
    queueChain(60 + Math.random() * 240, 'Customer Service', 'PROACTIVE_NOTIFICATION',
      `Proactive delay notification sent to customer: ${carrier} shipment delayed ${delayDays} day(s) — ${city} hub disruption`,
      null, { carrier, tracking, delayDays });
  }

  return evt('Carrier', 'SHIPMENT_UPDATE', text[status], null, { carrier, tracking, status, city });
}

// ═══════════════════════════════════════════════════════
// RFID & INVENTORY
// ═══════════════════════════════════════════════════════

function genRfidScan(): SimEvent {
  const loc = randomStore();
  if (!isStoreOpen(loc.timezone)) return genDppScan(); // fallback to DPP scan
  const zone = faker.helpers.arrayElement(['SALES_FLOOR', 'SALES_FLOOR', 'STOCKROOM', 'FITTING_ROOM', 'WINDOW_DISPLAY', 'CHECKOUT', 'ENTRANCE_GATE']);
  const scanner = faker.helpers.arrayElement(['ceiling_antenna', 'handheld_scanner', 'smart_shelf', 'entrance_gate', 'fitting_room_reader']);
  const scanRanges: Record<string, [number, number]> = { ceiling_antenna: [8, 30], handheld_scanner: [1, 8], smart_shelf: [10, 40], entrance_gate: [1, 4], fitting_room_reader: [1, 6] };
  const [lo, hi] = scanRanges[scanner] || [5, 15];
  const itemCount = lo + Math.floor(Math.random() * (hi - lo + 1));
  return evt('Nedap iD Cloud', 'RFID_SCAN_EVENT', `RFID ${scanner.replace(/_/g, ' ')} at ${loc.name} (${zone}): ${itemCount} tags read`, loc.id,
    { locationName: loc.name, zone, tagsRead: itemCount, scannerType: scanner, dwellTimeSeconds: 1 + Math.floor(Math.random() * 15) });
}

function genRfidDiscrepancy(): SimEvent {
  const loc = randomStore();
  const sku = randomSku();
  const product = productForSku(sku);
  const expected = 3 + Math.floor(Math.random() * 8);
  const actual = expected + (Math.random() > 0.5 ? -1 * (1 + Math.floor(Math.random() * 3)) : 1 + Math.floor(Math.random() * 2));
  const diff = actual - expected;
  // ── Chain: RFID Discrepancy → AI Anomaly → Investigation ──
  // +15-60 min: AI anomaly alert
  queueChain(15 + Math.random() * 45, 'AI Intelligence', 'ANOMALY_DETECTED',
    `Anomaly detected: inventory discrepancy at ${loc.name} for ${product?.name || '?'} (${diff > 0 ? '+' : ''}${diff} units). Confidence: ${(85 + Math.random() * 10).toFixed(0)}%`,
    loc.id, { locationName: loc.name, productName: product?.name, difference: diff, severity: Math.abs(diff) >= 3 ? 'HIGH' : 'MEDIUM' });

  // +60-240 min: Investigation result
  const resolution = diff < 0
    ? faker.helpers.arrayElement(['items found in fitting room', 'theft suspected — security review', 'items misplaced in stockroom', 'inter-store transfer not scanned'])
    : faker.helpers.arrayElement(['return not scanned at POS', 'transfer receipt not logged', 'duplicate RFID tag detected']);
  queueChain(60 + Math.random() * 180, 'Store Operations', 'DISCREPANCY_RESOLVED',
    `Investigation result at ${loc.name}: ${product?.name || '?'} discrepancy (${diff > 0 ? '+' : ''}${diff}) — ${resolution}`,
    loc.id, { locationName: loc.name, productName: product?.name, resolution, difference: diff },
    () => {
      // Correct the stock level
      const sl = store.stockLevels.find(s => s.skuId === sku.id && s.locationId === loc.id);
      if (sl) { sl.quantityOnHand = Math.max(0, sl.quantityOnHand + diff); sl.lastCountedAt = simClock.toISOString(); }
    });

  return evt('Nedap iD Cloud', 'RFID_DISCREPANCY', `Stock discrepancy at ${loc.name}: ${product?.name || '?'} (${sku.colour}, ${sku.size}) — system: ${expected}, RFID count: ${actual} (${diff > 0 ? '+' : ''}${diff})`, loc.id,
    { locationName: loc.name, productName: product?.name, sku: sku.sku, expected, actual, difference: diff });
}

function genStockMovement(): SimEvent {
  const sku = randomSku();
  const product = productForSku(sku);
  const type = faker.helpers.arrayElement(['transfer', 'replenishment', 'return_received', 'adjustment', 'damage_writeoff']);
  const fromLoc = type === 'replenishment' ? randomWarehouse() : randomStore();
  let toLoc = type === 'replenishment' ? randomStore() : randomWarehouse();
  if (fromLoc.id === toLoc.id) toLoc = store.locations.find(l => l.id !== fromLoc.id && l.type === toLoc.type) || store.locations[0];
  const qty = 1 + Math.floor(Math.random() * 8);
  const text: Record<string, string> = {
    transfer: `Stock transfer: ${qty}x ${product?.name || '?'} (${sku.colour}) from ${fromLoc.name} → ${toLoc.name}`,
    replenishment: `Replenishment: ${qty}x ${product?.name || '?'} sent from ${fromLoc.name} → ${toLoc.name}`,
    return_received: `Return received: ${qty}x ${product?.name || '?'} at ${toLoc.name} — returned to sellable stock`,
    adjustment: `Stock adjustment: ${Math.random() > 0.5 ? '+' : '-'}${qty}x ${product?.name || '?'} at ${fromLoc.name} — ${faker.helpers.arrayElement(['cycle count correction', 'system sync', 'found in stockroom'])}`,
    damage_writeoff: `Damage writeoff: ${qty}x ${product?.name || '?'} at ${fromLoc.name} — ${faker.helpers.arrayElement(['water damage', 'torn seam', 'colour defect', 'soiled', 'broken zipper'])}`,
  };
  // Log the stock movement record
  const mvtType = type === 'replenishment' ? 'TRANSFER_OUT' : type === 'damage_writeoff' ? 'DAMAGE_WRITEOFF' : type === 'adjustment' ? 'ADJUSTMENT_POSITIVE' : type === 'return_received' ? 'RETURN_RECEIPT' : 'TRANSFER_OUT';
  logStockMovement(sku.id, mvtType as any, qty, fromLoc.id, toLoc.id, 'STOCK_MOVEMENT', sku.id, type);

  // Chains for specific movement types
  if (type === 'damage_writeoff') {
    const cost = (product?.costPrice || 500) * qty;
    queueChain(1440 + Math.random() * 2880, 'D365 ERP', 'GL_POSTING',
      `Inventory write-off: ${qty}x ${product?.name || '?'} at ${fromLoc.name} — SEK ${cost.toLocaleString()} posted to 5200-WRITEOFF`,
      sku.id, { productName: product?.name, quantity: qty, amount: cost, account: '5200-WRITEOFF' });
  }
  if (type === 'replenishment') {
    queueChain(30 + Math.random() * 120, 'Blue Yonder WMS', 'PICK_TASK_CREATED',
      `Replenishment pick at ${fromLoc.name}: ${qty}x ${product?.name || '?'} for ${toLoc.name}`,
      sku.id, { from: fromLoc.name, to: toLoc.name, quantity: qty });
    const carrier = faker.helpers.arrayElement(['DHL Express', 'PostNord', 'DB Schenker']);
    queueChain(120 + Math.random() * 360, 'Carrier', 'SHIPMENT_DISPATCHED',
      `${carrier}: Replenishment shipment ${fromLoc.name} → ${toLoc.name} — ${qty}x ${product?.name || '?'}`,
      sku.id, { carrier, from: fromLoc.name, to: toLoc.name });
    queueChain(1440 + Math.random() * 4320, 'Nedap iD Cloud', 'RFID_INBOUND_SCAN',
      `RFID inbound scan at ${toLoc.name}: ${qty}x ${product?.name || '?'} received from ${fromLoc.name}`,
      sku.id, { locationName: toLoc.name, quantity: qty });
  }
  if (type === 'transfer') {
    queueChain(0.5 + Math.random() * 2, 'Nedap iD Cloud', 'RFID_TRANSFER_SCAN',
      `RFID scan: ${qty}x ${product?.name || '?'} transferred ${fromLoc.name} → ${toLoc.name}`,
      sku.id, { from: fromLoc.name, to: toLoc.name, quantity: qty });
  }

  return evt('Inventory', 'STOCK_MOVEMENT', text[type], sku.id, { movementType: type, quantity: qty, skuId: sku.id, productName: product?.name, from: fromLoc.name, to: toLoc.name });
}

// ═══════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════

function genAdyenPayment(): SimEvent {
  // Try to link to an actual SO for realistic payment data
  const recentSOs = store.salesOrders.filter(so => ['CONFIRMED', 'ALLOCATED', 'SHIPPED', 'DELIVERED'].includes(so.status));
  const linkedSO = recentSOs.length > 0 && Math.random() < 0.6 ? recentSOs[Math.floor(Math.random() * recentSOs.length)] : null;

  const type = faker.helpers.arrayElement(['authorised', 'authorised', 'captured', 'captured', 'refunded', 'partially_refunded', 'chargeback', 'settlement_completed', 'payment_failed']);
  const amount = linkedSO ? linkedSO.totalAmount : (500 + Math.floor(Math.random() * 50000));
  const currency = linkedSO ? linkedSO.currency : faker.helpers.arrayElement(['SEK', 'EUR', 'USD', 'GBP']);
  const method = faker.helpers.arrayElement(['visa', 'visa', 'mastercard', 'mastercard', 'amex', 'apple_pay', 'swish', 'google_pay']);
  const psp = `MOCK_PSP_SIM_${generateId().slice(0, 12).toUpperCase()}`;
  const soRef = linkedSO ? ` (${linkedSO.soNumber})` : '';
  const text: Record<string, string> = {
    authorised: `Payment authorised: ${currency} ${amount.toLocaleString()}${soRef} via ${method}`,
    captured: `Payment captured: ${currency} ${amount.toLocaleString()}${soRef} via ${method}`,
    refunded: `Full refund: ${currency} ${amount.toLocaleString()}${soRef} via ${method}`,
    partially_refunded: `Partial refund: ${currency} ${Math.round(amount * 0.5).toLocaleString()} of ${amount.toLocaleString()}${soRef} via ${method}`,
    chargeback: `Chargeback received: ${currency} ${amount.toLocaleString()}${soRef} via ${method} — investigation required`,
    settlement_completed: `Settlement batch completed: ${10 + Math.floor(Math.random() * 50)} transactions, ${currency} ${(amount * 10).toLocaleString()} total`,
    payment_failed: `Payment failed: ${currency} ${amount.toLocaleString()} via ${method} — ${faker.helpers.arrayElement(['insufficient funds', 'card declined', '3DS authentication failed', 'fraud suspicion'])}`,
  };

  // Chain: captured payments → D365 revenue posting
  if (type === 'captured' && linkedSO) {
    queueChain(60 + Math.random() * 1440, 'D365 ERP', 'GL_POSTING',
      `Payment capture posted: ${linkedSO.soNumber} — ${currency} ${amount.toLocaleString()} to 4100-REVENUE`,
      linkedSO.id, { soNumber: linkedSO.soNumber, amount, currency, account: '4100-REVENUE' });
  }

  return evt('Adyen', 'PAYMENT_EVENT', text[type], linkedSO?.id || psp, { eventType: type, amount, currency, paymentMethod: method, pspReference: psp, soNumber: linkedSO?.soNumber || null });
}

function genKlarnaEvent(): SimEvent {
  // Try to link to an actual ecom SO
  const ecomSOs = store.salesOrders.filter(so => so.channel === 'ECOMMERCE' && ['CONFIRMED', 'SHIPPED'].includes(so.status));
  const linkedSO = ecomSOs.length > 0 && Math.random() < 0.5 ? ecomSOs[Math.floor(Math.random() * ecomSOs.length)] : null;

  const type = faker.helpers.arrayElement(['session_created', 'session_expired', 'order_placed', 'order_captured', 'reminder_sent', 'installment_paid', 'late_payment_notice']);
  const customer = linkedSO?.customerName || faker.person.fullName();
  const amount = linkedSO ? linkedSO.totalAmount : (1000 + Math.floor(Math.random() * 50000));
  const currency = linkedSO ? linkedSO.currency : faker.helpers.arrayElement(['SEK', 'EUR', 'USD', 'GBP', 'NOK']);
  const soRef = linkedSO ? ` (${linkedSO.soNumber})` : '';
  const text: Record<string, string> = {
    session_created: `Klarna session created: ${customer}${soRef} — ${currency} ${amount.toLocaleString()} — Pay in 4`,
    session_expired: `Klarna session expired: ${customer} — did not complete checkout within 48h`,
    order_placed: `Klarna order placed: ${customer}${soRef} — ${currency} ${amount.toLocaleString()} — Pay later`,
    order_captured: `Klarna order captured: ${customer}${soRef} — ${currency} ${amount.toLocaleString()} shipped`,
    reminder_sent: `Klarna payment reminder sent to ${customer} — installment ${Math.floor(Math.random() * 3) + 2}/4 due`,
    installment_paid: `Klarna installment ${Math.floor(Math.random() * 3) + 1}/4 received from ${customer} — ${currency} ${Math.round(amount / 4).toLocaleString()}`,
    late_payment_notice: `Klarna late payment: ${customer} — installment overdue by ${1 + Math.floor(Math.random() * 7)} days`,
  };
  return evt('Klarna', 'KLARNA_EVENT', text[type], null, { eventType: type, customerName: customer, amount, currency });
}

// ═══════════════════════════════════════════════════════
// SUPPLY CHAIN
// ═══════════════════════════════════════════════════════

function genSupplierUpdate(): SimEvent {
  const supplier = randomSupplier();
  const type = faker.helpers.arrayElement(['production_update', 'shipment_notification', 'delay_alert', 'quality_report', 'capacity_update', 'raw_material_shortage', 'factory_audit_scheduled']);
  const text: Record<string, string> = {
    production_update: `${supplier.name}: Production batch ${Math.floor(Math.random() * 90) + 10}% complete — on track for ${faker.helpers.arrayElement(['week 18', 'week 20', 'week 22'])} delivery`,
    shipment_notification: `${supplier.name}: Shipment dispatched — ${20 + Math.floor(Math.random() * 200)} units via ${faker.helpers.arrayElement(['sea freight', 'air freight', 'road transport'])}. ETA: ${3 + Math.floor(Math.random() * 14)} days`,
    delay_alert: `⚠ ${supplier.name}: Production delay reported — ${faker.helpers.arrayElement(['raw material shortage', 'factory maintenance', 'labour shortage', 'quality rework needed'])}. New ETA: +${5 + Math.floor(Math.random() * 14)} days`,
    quality_report: `${supplier.name}: QA inspection report — ${95 + Math.floor(Math.random() * 5)}% pass rate, ${Math.floor(Math.random() * 5)} units rejected (${faker.helpers.arrayElement(['stitching defect', 'colour variance', 'fabric flaw'])})`,
    capacity_update: `${supplier.name}: Updated production capacity for Q${Math.floor(Math.random() * 4) + 1} — ${faker.helpers.arrayElement(['increased 15%', 'reduced 10%', 'at full capacity', 'new production line added'])}`,
    raw_material_shortage: `⚠ ${supplier.name}: Raw material shortage — ${faker.helpers.arrayElement(['organic cotton', 'Italian leather', 'Japanese selvedge denim', 'recycled polyester'])} limited. May affect upcoming POs.`,
    factory_audit_scheduled: `${supplier.name}: Fair Wear Foundation audit scheduled for ${faker.date.future().toISOString().split('T')[0]} at ${faker.location.city()}, ${supplier.country} facility`,
  };
  // ── Chain: Supplier Shipment → Carrier tracking → Customs → WMS inbound ──
  if (type === 'shipment_notification') {
    const units = 20 + Math.floor(Math.random() * 200);
    const etaDays = 3 + Math.floor(Math.random() * 14);
    const carrier = faker.helpers.arrayElement(['DHL Express', 'DB Schenker', 'Maersk', 'FedEx']);
    const tracking = `${carrier.slice(0, 3).toUpperCase()}${Math.floor(Math.random() * 9e9) + 1e9}`;
    const wh = randomWarehouse();

    // +1-3 days: Carrier in-transit update
    queueChain(1440 + Math.random() * 2880, 'Carrier', 'SHIPMENT_UPDATE',
      `${carrier} ${tracking}: Shipment from ${supplier.name} in transit — ${units} units, current location: ${faker.location.city()}`,
      null, { carrier, tracking, supplierName: supplier.name, units });

    // +ETA-2 to ETA days: Customs cleared (for international)
    if (supplier.country !== 'Sweden') {
      queueChain((etaDays - 2) * 1440 + Math.random() * 1440, 'Carrier', 'CUSTOMS_CLEARED',
        `${carrier} ${tracking}: Customs cleared for shipment from ${supplier.name} (${supplier.country}) — proceeding to ${wh.name}`,
        null, { carrier, tracking, supplierName: supplier.name, country: supplier.country });
    }

    // +ETA days: Blue Yonder inbound received
    queueChain(etaDays * 1440 + Math.random() * 720, 'Blue Yonder WMS', 'INBOUND_RECEIVED',
      `Inbound received at ${wh.name} from ${supplier.name}: ${units} units — ${carrier} ${tracking}`,
      wh.id, { warehouseName: wh.name, supplierName: supplier.name, units, carrier, tracking });
  }

  return evt('Supply Chain', 'SUPPLIER_UPDATE', text[type], supplier.id, { supplierName: supplier.name, supplierCode: supplier.code, updateType: type });
}

function genMediusInvoice(): SimEvent {
  const supplier = randomSupplier();
  const type = faker.helpers.arrayElement(['invoice_received', 'invoice_matched', 'invoice_approved', 'payment_scheduled', 'payment_executed', 'three_way_match_failed', 'credit_note_received']);
  const amount = 5000 + Math.floor(Math.random() * 500000);
  const text: Record<string, string> = {
    invoice_received: `Invoice received from ${supplier.name}: ${supplier.currency} ${amount.toLocaleString()} — awaiting match`,
    invoice_matched: `Invoice matched (3-way): ${supplier.name} — PO ↔ receipt ↔ invoice — ${supplier.currency} ${amount.toLocaleString()} ✓`,
    invoice_approved: `Invoice approved for payment: ${supplier.name} — ${supplier.currency} ${amount.toLocaleString()}`,
    payment_scheduled: `Payment scheduled: ${supplier.name} — ${supplier.currency} ${amount.toLocaleString()} — payment date: ${faker.date.future({ years: 0.1 }).toISOString().split('T')[0]}`,
    payment_executed: `Payment executed: ${supplier.name} — ${supplier.currency} ${amount.toLocaleString()} via ${faker.helpers.arrayElement(['SEPA transfer', 'wire transfer', 'bank giro'])}`,
    three_way_match_failed: `⚠ 3-way match failed: ${supplier.name} — ${faker.helpers.arrayElement(['quantity mismatch (PO: 100, received: 95, invoiced: 100)', 'price variance exceeds tolerance (2.3%)', 'PO not found for invoice reference'])}`,
    credit_note_received: `Credit note from ${supplier.name}: ${supplier.currency} ${Math.floor(amount * 0.1).toLocaleString()} — ${faker.helpers.arrayElement(['defective goods return', 'pricing correction', 'short shipment adjustment'])}`,
  };
  return evt('Medius AP', 'INVOICE_EVENT', text[type], supplier.id, { eventType: type, supplierName: supplier.name, amount, currency: supplier.currency });
}

// ═══════════════════════════════════════════════════════
// PRODUCT & PLM
// ═══════════════════════════════════════════════════════

function genCentricPlmEvent(): SimEvent {
  const product = randomProduct();
  const type = faker.helpers.arrayElement(['tech_pack_approved', 'sample_reviewed', 'material_test_passed', 'colorway_added', 'spec_updated', 'bom_finalized', 'costing_approved', 'fit_comment_added']);
  const designer = faker.helpers.arrayElement(['Jonny J.', 'Maria S.', 'Erik L.', 'Sophie K.', 'Liam W.']);
  const text: Record<string, string> = {
    tech_pack_approved: `Tech pack approved for ${product.name} (${product.season}${product.seasonYear}) by ${designer}`,
    sample_reviewed: `Sample review: ${product.name} — ${faker.helpers.arrayElement(['approved', 'approved with comments', 'revision needed', 'rejected — remake required'])}`,
    material_test_passed: `Material test passed for ${product.name}: ${faker.helpers.arrayElement(['tensile strength', 'colour fastness', 'pilling resistance', 'shrinkage test'])} — ${faker.helpers.arrayElement(['Grade A', 'Grade B+', 'Meets spec'])}`,
    colorway_added: `New colorway added to ${product.name}: ${faker.helpers.arrayElement(['Sage Green', 'Terracotta', 'Ice Blue', 'Charcoal Melange', 'Bone White'])} — pending sample`,
    spec_updated: `Spec sheet updated for ${product.name} by ${designer}: ${faker.helpers.arrayElement(['adjusted shoulder measurement -1cm', 'changed button placement', 'updated lining fabric', 'revised pocket depth'])}`,
    bom_finalized: `BOM finalized for ${product.name}: ${3 + Math.floor(Math.random() * 5)} materials, total cost ${product.costPrice} SEK/unit`,
    costing_approved: `Costing approved for ${product.name}: cost ${product.costPrice} SEK → wholesale ${Math.round(product.costPrice * 2)} SEK → retail ${Math.round(product.costPrice * 3.5)} SEK`,
    fit_comment_added: `Fit comment on ${product.name} by ${designer}: "${faker.helpers.arrayElement(['Sleeve length 2cm too long on size M', 'Waist sits well, good silhouette', 'Need more ease in hip for comfort', 'Back length perfect, approve for production'])}"`,
  };
  return evt('Centric PLM', 'PLM_EVENT', text[type], product.id, { eventType: type, productName: product.name, styleNumber: product.styleNumber, designer });
}

function genDppScan(): SimEvent {
  const sku = randomSku();
  const product = productForSku(sku);
  const scanType = faker.helpers.arrayElement(['consumer_scan', 'consumer_scan', 'store_verification', 'customs_check', 'resale_authentication', 'recycling_center', 'brand_authentication']);
  const city = faker.location.city();
  const country = faker.location.countryCode();
  // ── Chain: Resale auth scan → occasionally fail → CS ticket ──
  if (scanType === 'resale_authentication' && Math.random() < 0.15) {
    // 15% of resale auths fail → triggers CS inquiry
    queueChain(10 + Math.random() * 60, 'Customer Service', 'AUTHENTICATION_INQUIRY',
      `CS ticket: Customer in ${city}, ${country} — "${product?.name || '?'} failed DPP authentication on resale platform — requesting verification"`,
      null, { productName: product?.name, city, country, scanType });
    return evt('Temera DPP', 'DPP_SCAN', `Digital passport scanned (resale authentication): ${product?.name || '?'} in ${city}, ${country} — VERIFICATION FAILED`, sku.id,
      { scanType, productName: product?.name, sku: sku.sku, city, country, verified: false, nfcTagId: sku.rfidTag });
  }

  return evt('Temera DPP', 'DPP_SCAN', `Digital passport scanned (${scanType.replace(/_/g, ' ')}): ${product?.name || '?'} in ${city}, ${country}`, sku.id,
    { scanType, productName: product?.name, sku: sku.sku, city, country, verified: true, nfcTagId: sku.rfidTag });
}

// ═══════════════════════════════════════════════════════
// INTELLIGENCE & ANALYTICS
// ═══════════════════════════════════════════════════════

function genAiAlert(): SimEvent {
  const product = randomProduct();
  const loc = randomStore();
  const type = faker.helpers.arrayElement(['demand_spike', 'demand_drop', 'low_stock', 'reorder_needed', 'sell_through_declining', 'competitor_price', 'trend_detected', 'overstock_risk', 'margin_erosion']);
  const text: Record<string, string> = {
    demand_spike: `📈 Demand spike: ${product.name} selling ${(1.5 + Math.random() * 3).toFixed(1)}x above forecast at ${loc.name}`,
    demand_drop: `📉 Demand drop: ${product.name} down ${15 + Math.floor(Math.random() * 40)}% WoW — consider markdown`,
    low_stock: `⚠ Low stock: ${product.name} at ${loc.name} — ${Math.floor(Math.random() * 4)} units remaining (reorder point: ${3 + Math.floor(Math.random() * 3)})`,
    reorder_needed: `🔄 Reorder recommended: ${product.name} — projected stockout in ${3 + Math.floor(Math.random() * 10)} days across ${1 + Math.floor(Math.random() * 4)} locations`,
    sell_through_declining: `Sell-through declining: ${product.name} at ${(30 + Math.random() * 20).toFixed(0)}% (target: 65%) — ${Math.floor(Math.random() * 8) + 12} weeks of cover`,
    competitor_price: `Competitor alert: ${faker.helpers.arrayElement(['COS', 'Arket', 'Totême', 'Our Legacy', 'Ami Paris'])} has similar product to ${product.name} at ${10 + Math.floor(Math.random() * 25)}% lower price`,
    trend_detected: `Trend detected: ${product.category} category up ${5 + Math.floor(Math.random() * 20)}% across ${faker.helpers.arrayElement(['social media mentions', 'search volume', 'editorial features'])}`,
    overstock_risk: `Overstock risk: ${product.name} — ${15 + Math.floor(Math.random() * 15)} weeks of cover. Consider transfer to ${faker.helpers.arrayElement(['outlet', 'high-velocity store', 'archive sale'])}`,
    margin_erosion: `Margin alert: ${product.name} blended margin dropped to ${40 + Math.floor(Math.random() * 15)}% (target: 58%) due to ${faker.helpers.arrayElement(['increased discounting', 'FX impact', 'higher logistics costs'])}`,
  };
  // Chains: actionable alerts trigger downstream systems
  if (type === 'reorder_needed') {
    const supplier = randomSupplier();
    const qty = 30 + Math.floor(Math.random() * 100);
    queueChain(240 + Math.random() * 480, 'AI Intelligence', 'AI_RECOMMENDATION',
      `Recommendation: Reorder ${product.name} — ${qty} units from ${supplier.name}. Confidence: ${80 + Math.floor(Math.random() * 15)}%`,
      product.id, { type: 'REORDER', productName: product.name, supplierName: supplier.name, quantity: qty });
  }
  if (type === 'low_stock') {
    const wh = randomWarehouse();
    const transferQty = 3 + Math.floor(Math.random() * 10);
    queueChain(120 + Math.random() * 360, 'AI Intelligence', 'AI_RECOMMENDATION',
      `Recommendation: Transfer ${transferQty} units of ${product.name} from ${wh.name} to ${loc.name}`,
      product.id, { type: 'TRANSFER', productName: product.name, from: wh.name, to: loc.name, quantity: transferQty });
  }
  if (type === 'overstock_risk') {
    queueChain(480 + Math.random() * 1440, 'AI Intelligence', 'AI_RECOMMENDATION',
      `Recommendation: Mark down ${product.name} by ${15 + Math.floor(Math.random() * 20)}% to accelerate sell-through`,
      product.id, { type: 'MARKDOWN', productName: product.name });
  }

  return evt('AI Intelligence', 'AI_ALERT', text[type], product.id, { alertType: type, productName: product.name, locationName: loc.name });
}

function genAiRecommendation(): SimEvent {
  const type = faker.helpers.arrayElement(['reorder', 'transfer', 'markdown', 'expedite_po', 'cancel_po', 'bundle_suggestion', 'pricing_optimization']);
  const product = randomProduct();
  const text: Record<string, string> = {
    reorder: `💡 Recommendation: Reorder ${product.name} — ${50 + Math.floor(Math.random() * 150)} units. Confidence: ${75 + Math.floor(Math.random() * 20)}%. Projected revenue recovery: SEK ${(50000 + Math.floor(Math.random() * 200000)).toLocaleString()}`,
    transfer: `💡 Recommendation: Transfer ${5 + Math.floor(Math.random() * 20)} units of ${product.name} from ${randomWarehouse().name} to ${randomStore().name}. Projected revenue: SEK ${(20000 + Math.floor(Math.random() * 100000)).toLocaleString()}`,
    markdown: `💡 Recommendation: Mark down ${product.name} by ${15 + Math.floor(Math.random() * 20)}%. Current stock cover: ${12 + Math.floor(Math.random() * 10)} weeks. Projected clearance: ${60 + Math.floor(Math.random() * 30)}% in 4 weeks`,
    expedite_po: `💡 Recommendation: Expedite pending PO — ${product.name} at risk of stockout. Air freight cost: SEK ${(15000 + Math.floor(Math.random() * 40000)).toLocaleString()}. Revenue at risk: SEK ${(200000 + Math.floor(Math.random() * 500000)).toLocaleString()}`,
    cancel_po: `💡 Recommendation: Reduce/cancel PO for ${product.name} — demand dropped ${30 + Math.floor(Math.random() * 30)}% since order. Potential saving: SEK ${(100000 + Math.floor(Math.random() * 300000)).toLocaleString()}`,
    bundle_suggestion: `💡 Recommendation: Create bundle "${product.name} + ${randomProduct().name}" — frequently bought together (${15 + Math.floor(Math.random() * 20)}% of baskets). Projected uplift: +8% AOV`,
    pricing_optimization: `💡 Recommendation: Price optimization for ${product.name} — elasticity analysis suggests ${faker.helpers.arrayElement(['+5% price increase sustainable', '-10% would increase volume 25%', 'current price optimal for margin'])}`,
  };
  return evt('AI Intelligence', 'AI_RECOMMENDATION', text[type], product.id, { recommendationType: type, productName: product.name, confidence: 75 + Math.floor(Math.random() * 20) });
}

// ═══════════════════════════════════════════════════════
// ERP / D365
// ═══════════════════════════════════════════════════════

function genD365Event(): SimEvent {
  const type = faker.helpers.arrayElement(['gl_posting', 'budget_check', 'fx_rate_update', 'period_close', 'vendor_payment_run', 'intercompany_transfer', 'fixed_asset_depreciation']);
  const text: Record<string, string> = {
    gl_posting: `D365 GL posting: ${faker.helpers.arrayElement(['Revenue recognition', 'COGS entry', 'Inventory valuation adjustment', 'Accrued expenses'])} — SEK ${(10000 + Math.floor(Math.random() * 500000)).toLocaleString()} posted to ${faker.helpers.arrayElement(['4100-REVENUE', '5100-COGS', '1400-INVENTORY', '6200-OPEX'])}`,
    budget_check: `D365 budget check: ${faker.helpers.arrayElement(['AW2026 buying budget', 'Marketing spend Q2', 'Store operations', 'IT infrastructure'])} — ${faker.helpers.arrayElement(['within budget (82% utilized)', 'approaching limit (94%)', 'over budget by 3% — approval needed'])}`,
    fx_rate_update: `D365 FX rates updated: EUR/SEK ${(11.2 + Math.random() * 0.3).toFixed(4)}, USD/SEK ${(10.3 + Math.random() * 0.3).toFixed(4)}, GBP/SEK ${(13.0 + Math.random() * 0.4).toFixed(4)}`,
    period_close: `D365 period close: ${faker.helpers.arrayElement(['March 2026 closed', 'Q1 2026 review complete', 'Inventory valuation finalized'])} — ${faker.helpers.arrayElement(['all journals posted', 'pending 2 manual entries', 'reconciliation complete'])}`,
    vendor_payment_run: `D365 vendor payment run: ${2 + Math.floor(Math.random() * 5)} vendors, total SEK ${(100000 + Math.floor(Math.random() * 2000000)).toLocaleString()} — ${faker.helpers.arrayElement(['scheduled for tomorrow', 'executed successfully', 'pending approval'])}`,
    intercompany_transfer: `D365 intercompany: ${faker.helpers.arrayElement(['Acne Studios SE → Acne Studios FR', 'Acne Studios SE → Acne Studios US', 'Acne Studios JP → Acne Studios SE'])} — SEK ${(50000 + Math.floor(Math.random() * 500000)).toLocaleString()} — ${faker.helpers.arrayElement(['inventory transfer', 'royalty payment', 'management fee'])}`,
    fixed_asset_depreciation: `D365 depreciation: Store fixtures & fittings — monthly depreciation SEK ${(5000 + Math.floor(Math.random() * 20000)).toLocaleString()} across ${3 + Math.floor(Math.random() * 10)} assets`,
  };
  return evt('D365 ERP', 'ERP_EVENT', text[type], null, { eventType: type });
}

// ═══════════════════════════════════════════════════════
// CUSTOMER ENGAGEMENT
// ═══════════════════════════════════════════════════════

function genCustomerEngagement(): SimEvent {
  const customer = faker.person.fullName();
  const product = randomProduct();
  const type = faker.helpers.arrayElement(['wishlist_add', 'product_review', 'newsletter_signup', 'back_in_stock_request', 'size_guide_viewed', 'social_share', 'loyalty_milestone']);
  const text: Record<string, string> = {
    wishlist_add: `${customer} added ${product.name} to wishlist (${faker.helpers.arrayElement(['acnestudios.com', 'app', 'in-store tablet'])})`,
    product_review: `New review for ${product.name}: ${'★'.repeat(3 + Math.floor(Math.random() * 3))}${'☆'.repeat(2 - Math.floor(Math.random() * 2))} — "${faker.helpers.arrayElement(['Perfect fit, love the quality', 'Runs slightly large, size down', 'Beautiful colour, exactly as pictured', 'Excellent material but pricey'])}"`,
    newsletter_signup: `Newsletter signup: ${customer} (${faker.internet.email()}) — source: ${faker.helpers.arrayElement(['footer signup', 'checkout opt-in', 'pop-up 10% offer', 'store QR code'])}`,
    back_in_stock_request: `Back-in-stock alert requested: ${customer} wants ${product.name} in ${faker.helpers.arrayElement(['Black', 'Camel', 'Navy'])} ${faker.helpers.arrayElement(['S', 'M', 'L', '38', '40'])}`,
    size_guide_viewed: `Size guide viewed: ${product.name} by visitor from ${faker.location.city()} — ${faker.helpers.arrayElement(['desktop', 'mobile', 'app'])}`,
    social_share: `${product.name} shared on ${faker.helpers.arrayElement(['Instagram', 'Pinterest', 'TikTok', 'WeChat', 'LINE'])} by ${customer}`,
    loyalty_milestone: `VIC milestone: ${customer} reached ${faker.helpers.arrayElement(['Gold tier (10+ purchases)', 'lifetime spend SEK 100,000', '5th anniversary as customer', 'top 1% buyer in region'])}`,
  };
  return evt('CRM', 'CUSTOMER_ENGAGEMENT', text[type], null, { eventType: type, customerName: customer, productName: product.name });
}

function genCustomerService(): SimEvent {
  const customer = faker.person.fullName();
  const type = faker.helpers.arrayElement(['return_request', 'order_inquiry', 'complaint', 'exchange_request', 'delivery_issue', 'product_question', 'compliment']);
  const channel = faker.helpers.arrayElement(['email', 'phone', 'live_chat', 'instagram_dm', 'in_store']);
  const text: Record<string, string> = {
    return_request: `CS ticket: ${customer} requesting return via ${channel} — ${faker.helpers.arrayElement(['wrong size ordered', 'not as expected', 'received wrong item', 'gift return'])}`,
    order_inquiry: `CS ticket: ${customer} via ${channel} — "Where is my order?" — ${faker.helpers.arrayElement(['tracking shows in transit', 'delayed at customs', 'delivered but not received', 'processing'])}`,
    complaint: `CS ticket: ${customer} via ${channel} — complaint: ${faker.helpers.arrayElement(['quality issue with seam', 'colour faded after wash', 'button fell off after 2 wears', 'zipper stuck'])}`,
    exchange_request: `CS ticket: ${customer} via ${channel} — exchange: ${faker.helpers.arrayElement(['size M → L', 'Black → Navy', 'want different style instead'])}`,
    delivery_issue: `CS ticket: ${customer} via ${channel} — ${faker.helpers.arrayElement(['package damaged on arrival', 'missing item from order', 'delivered to wrong address', 'signature required but left at door'])}`,
    product_question: `CS ticket: ${customer} via ${channel} — Q: "${faker.helpers.arrayElement(['Is this true to size?', 'What material is the lining?', 'Can I get this monogrammed?', 'When will size 38 restock?', 'Is this suitable for machine wash?'])}"`,
    compliment: `CS ticket: ${customer} via ${channel} — "${faker.helpers.arrayElement(['Amazing quality, best purchase this year', 'Your store staff in Paris were incredibly helpful', 'Love the sustainability commitment', 'The packaging was beautiful, perfect gift'])}" 🎉`,
  };
  // Chains for actionable CS tickets
  if (type === 'return_request') {
    const provider = faker.helpers.arrayElement(['Adyen', 'Klarna']);
    const product = randomProduct();
    queueChain(60 + Math.random() * 240, provider, 'REFUND_PROCESSED',
      `Refund authorized for ${customer}: ${product.costPrice * 3} SEK via ${provider} — CS return request`,
      null, { customerName: customer, amount: product.costPrice * 3 });
    queueChain(1440 + Math.random() * 4320, 'Nedap iD Cloud', 'RFID_RETURN_SCAN',
      `RFID return scan: ${product.name} returned by ${customer} — added back to sellable stock`,
      null, { customerName: customer, productName: product.name });
  }
  if (type === 'complaint') {
    queueChain(120 + Math.random() * 480, 'Customer Service', 'QUALITY_REPORT',
      `Quality investigation opened: complaint from ${customer} — forwarded to QA team`,
      null, { customerName: customer, channel });
  }

  return evt('Customer Service', 'CS_TICKET', text[type], null, { eventType: type, customerName: customer, channel, priority: type === 'complaint' ? 'high' : type === 'compliment' ? 'low' : 'medium' });
}

// ═══════════════════════════════════════════════════════
// STORE OPERATIONS
// ═══════════════════════════════════════════════════════

function genStoreOps(): SimEvent {
  const loc = randomStore();
  const h = localHour(loc.timezone);
  // Time-appropriate event selection with wider windows
  let type: string;
  if (h >= 9 && h < 11) {
    type = faker.helpers.arrayElement(['store_opened', 'store_opened', 'staff_checkin', 'staff_checkin', 'visual_merch_update']);
  } else if (h >= 19 && h < 21) {
    type = faker.helpers.arrayElement(['store_closed', 'store_closed', 'staff_checkin', 'footfall_milestone']);
  } else if (isStoreOpen(loc.timezone)) {
    type = faker.helpers.arrayElement(['visual_merch_update', 'staff_checkin', 'footfall_milestone', 'window_display_changed', 'event_scheduled']);
  } else {
    return genSecurityEvent(); // late night → security event
  }
  const text: Record<string, string> = {
    store_opened: `${loc.name} opened for the day — ${2 + Math.floor(Math.random() * 4)} staff on floor`,
    store_closed: `${loc.name} closed — daily revenue: SEK ${(15000 + Math.floor(Math.random() * 80000)).toLocaleString()}, ${5 + Math.floor(Math.random() * 30)} transactions`,
    visual_merch_update: `Visual merchandising update at ${loc.name}: ${faker.helpers.arrayElement(['New window display installed (AW26 outerwear focus)', 'Floor reset — Face Collection moved to front', 'Sale section reorganized', 'New artwork installed (rotating artist programme)'])}`,
    staff_checkin: `Staff check-in at ${loc.name}: ${faker.person.firstName()} (${faker.helpers.arrayElement(['sales associate', 'store manager', 'visual merchandiser', 'stockroom associate'])}) — ${faker.helpers.arrayElement(['morning shift', 'afternoon shift', 'full day'])}`,
    footfall_milestone: `${loc.name}: ${faker.helpers.arrayElement(['500th visitor today', '10,000th visitor this month', 'Footfall up 15% vs same day last year', 'Peak hour: 14:00-15:00 with 45 visitors'])}`,
    window_display_changed: `Window display changed at ${loc.name}: "${faker.helpers.arrayElement(['Denim Stories', 'Face of Summer', 'The Knit Edit', 'Musubi Moment', 'Archive Remix'])}" — installed by VM team`,
    event_scheduled: `Event at ${loc.name}: ${faker.helpers.arrayElement(['Private shopping evening for VICs', 'Acne Paper magazine launch', 'Artist talk + book signing', 'Personal styling masterclass', 'AW26 preview for press'])} — ${faker.helpers.arrayElement(['this Saturday', 'next Thursday evening', 'next week'])}`,
  };
  return evt('Store Operations', 'STORE_OPS', text[type], loc.id, { eventType: type, locationName: loc.name });
}

// ═══════════════════════════════════════════════════════
// SECURITY & FRAUD
// ═══════════════════════════════════════════════════════

function genSecurityEvent(): SimEvent {
  const type = faker.helpers.arrayElement(['fraud_flag', 'suspicious_return', 'failed_auth', 'rate_limit_hit', 'unusual_access', 'eas_alarm']);
  const text: Record<string, string> = {
    fraud_flag: `🔒 Fraud flag: Order from ${faker.location.city()} — ${faker.helpers.arrayElement(['shipping/billing address mismatch', 'multiple failed payment attempts', 'velocity check triggered', 'device fingerprint flagged'])} — held for review`,
    suspicious_return: `🔒 Suspicious return pattern: ${faker.person.fullName()} — ${3 + Math.floor(Math.random() * 5)} returns in ${Math.floor(Math.random() * 14) + 7} days across ${faker.helpers.arrayElement(['online + store', 'multiple stores', 'same store'])}`,
    failed_auth: `🔒 Failed authentication: ${Math.floor(Math.random() * 5) + 3} failed login attempts for ${faker.internet.email()} from ${faker.location.city()} — account ${faker.helpers.arrayElement(['temporarily locked', 'flagged for review', 'password reset sent'])}`,
    rate_limit_hit: `🔒 Rate limit: API client ${faker.helpers.arrayElement(['NuORDER integration', 'SFCC sync', 'mobile app', 'unknown IP'])} exceeded ${faker.helpers.arrayElement(['100 req/min', '3000 req/hour'])} — throttled`,
    unusual_access: `🔒 Unusual access: ${faker.helpers.arrayElement(['Admin panel accessed from new IP', 'Bulk product export triggered', 'Supplier portal login from unexpected country', 'API key used from new location'])}`,
    eas_alarm: `🔒 EAS alarm at ${randomStore().name}: Gate alarm triggered — ${faker.helpers.arrayElement(['staff deactivation missed', 'customer approached, legitimate purchase confirmed', 'tag not removed, resolved at register', 'false alarm — empty-handed exit'])}`,
  };
  return evt('Security', 'SECURITY_EVENT', text[type], null, { eventType: type, severity: type === 'fraud_flag' ? 'high' : type === 'eas_alarm' ? 'medium' : 'low' });
}

// ═══════════════════════════════════════════════════════
// PURCHASE ORDERS
// ═══════════════════════════════════════════════════════

function genPOCreate(): SimEvent {
  const supplier = randomSupplier();
  // Match product to supplier's country specialization
  const countryCategories: Record<string, string[]> = {
    'Italy': ['Outerwear', 'Accessories', 'Knitwear', 'Trousers', 'Footwear'],
    'Portugal': ['T-shirts', 'Knitwear', 'Denim', 'Footwear', 'Outerwear'],
    'China': ['T-shirts', 'Trousers', 'Outerwear', 'Denim'],
    'Turkey': ['Denim'],
    'Romania': ['Outerwear', 'Trousers'],
    'Bulgaria': ['T-shirts', 'Knitwear'],
    'Morocco': ['Outerwear', 'Accessories'],
    'Lithuania': ['Knitwear', 'T-shirts'],
  };
  const cats = countryCategories[supplier.country] || [];
  let product;
  if (cats.length > 0) {
    const matching = store.products.filter(p => cats.includes(p.category));
    product = matching.length > 0 ? matching[Math.floor(Math.random() * matching.length)] : seasonalProduct();
  } else {
    product = seasonalProduct();
  }
  const skus = store.skus.filter(s => s.productId === product.id).slice(0, 3 + Math.floor(Math.random() * 5));
  if (skus.length === 0) return genSupplierUpdate();
  const user = buyerUser();
  const poId = generateId();
  const poNumber = nextSequence(`PO-${product.season}${product.seasonYear}`, 5);
  const wh = randomWarehouse();

  let totalAmount = 0;
  const lines: POLine[] = [];
  for (const sku of skus) {
    const qty = 10 + Math.floor(Math.random() * 50);
    const unitCost = product.costPrice;
    const lineTotal = qty * unitCost;
    totalAmount += lineTotal;
    lines.push({
      id: generateId(), purchaseOrderId: poId, skuId: sku.id,
      quantityOrdered: qty, quantityReceived: 0,
      unitCost, lineTotal,
      expectedDate: null, notes: null,
      createdAt: simClock.toISOString(), updatedAt: simClock.toISOString(),
    });
  }

  const po: PurchaseOrder = {
    id: poId, poNumber, supplierId: supplier.id,
    season: product.season, seasonYear: product.seasonYear,
    status: 'DRAFT', currency: supplier.currency, totalAmount,
    expectedDelivery: new Date(simClock.getTime() + supplier.leadTimeDays * 86400000).toISOString(),
    actualDelivery: null, deliveryLocationId: wh.id,
    shippingTerms: faker.helpers.arrayElement(['FOB', 'CIF', 'DDP', 'EXW']),
    paymentTerms: supplier.paymentTerms, notes: null,
    createdById: user.id, approvedById: null, approvedAt: null, sentToSupplierAt: null,
    createdAt: simClock.toISOString(), updatedAt: simClock.toISOString(),
  };
  store.purchaseOrders.push(po);
  store.poLines.push(...lines);
  logPOStatusChange(poId, null, 'DRAFT', user.id, 'PO created');
  logAudit('CREATE', 'PurchaseOrder', poId, null, { poNumber, supplierId: supplier.id, status: 'DRAFT' });

  // Chain: auto-submit after a few hours
  queueChain(60 + Math.random() * 240, 'Supply Chain', 'PO_SUBMITTED',
    `${poNumber} submitted for approval — ${lines.length} lines, ${supplier.currency} ${totalAmount.toLocaleString()} to ${supplier.name}`,
    poId, { poNumber, supplierName: supplier.name, totalAmount },
    () => {
      po.status = 'PENDING_APPROVAL';
      po.updatedAt = simClock.toISOString();
      logPOStatusChange(poId, 'DRAFT', 'PENDING_APPROVAL', user.id);
    });

  return evt('Supply Chain', 'PO_CREATED', `New PO ${poNumber}: ${product.name} — ${lines.length} SKUs, ${supplier.currency} ${totalAmount.toLocaleString()} from ${supplier.name}`, poId,
    { poNumber, supplierName: supplier.name, productName: product.name, lines: lines.length, totalAmount, currency: supplier.currency });
}

function genPOLifecycle(): SimEvent {
  const transitions: Record<string, POStatus> = {
    PENDING_APPROVAL: 'APPROVED',
    APPROVED: 'SENT_TO_SUPPLIER',
    SENT_TO_SUPPLIER: 'CONFIRMED_BY_SUPPLIER',
    CONFIRMED_BY_SUPPLIER: 'IN_PRODUCTION',
    IN_PRODUCTION: 'SHIPPED',
    SHIPPED: 'PARTIALLY_RECEIVED',
    PARTIALLY_RECEIVED: 'RECEIVED',
  };
  const eligible = store.purchaseOrders.filter(po => po.status in transitions);
  if (eligible.length === 0) return genPOCreate();

  const po = eligible[Math.floor(Math.random() * eligible.length)];
  const nextStatus = transitions[po.status];
  const prevStatus = po.status;
  const supplier = store.suppliers.find(s => s.id === po.supplierId);
  po.status = nextStatus;
  po.updatedAt = simClock.toISOString();
  logPOStatusChange(po.id, prevStatus, nextStatus, buyerUser().id);

  if (nextStatus === 'APPROVED') {
    po.approvedById = buyerUser().id;
    po.approvedAt = simClock.toISOString();
    store.poDocuments.push({
      id: generateId(), purchaseOrderId: po.id, type: 'PO_PDF',
      fileName: `${po.poNumber}.pdf`, fileUrl: `/docs/${po.poNumber}.pdf`,
      uploadedAt: simClock.toISOString(),
    });
  }
  if (nextStatus === 'SENT_TO_SUPPLIER') {
    po.sentToSupplierAt = simClock.toISOString();
  }
  if (nextStatus === 'SHIPPED') {
    // Supplier ships — chain to inbound receipt
    const wh = store.locations.find(l => l.id === po.deliveryLocationId) || randomWarehouse();
    const carrier = faker.helpers.arrayElement(['DHL Express', 'DB Schenker', 'Maersk', 'FedEx']);
    const etaDays = (supplier?.leadTimeDays ?? 30) / 3;
    queueChain(etaDays * 1440 + Math.random() * 2880, 'Blue Yonder WMS', 'PO_INBOUND_RECEIVED',
      `PO ${po.poNumber} received at ${wh.name} from ${supplier?.name || '?'} — inspecting goods`,
      po.id, { poNumber: po.poNumber, warehouseName: wh.name },
      () => {
        // Move to PARTIALLY_RECEIVED or RECEIVED
        const poLines = store.poLines.filter(l => l.purchaseOrderId === po.id);
        for (const line of poLines) {
          const received = Math.floor(line.quantityOrdered * (0.85 + Math.random() * 0.15));
          line.quantityReceived = received;
          line.updatedAt = simClock.toISOString();
          // Create receipt record
          store.poReceipts.push({
            id: generateId(), poLineId: line.id, quantityReceived: received,
            receivedAt: simClock.toISOString(), receivedById: warehouseUser().id,
            locationId: wh.id, qualityStatus: 'PASS',
            damagedQuantity: Math.random() < 0.1 ? Math.floor(Math.random() * 3) : 0,
            notes: null,
          });
          // Increment stock
          let sl = store.stockLevels.find(s => s.skuId === line.skuId && s.locationId === wh.id);
          if (sl) {
            sl.quantityOnHand += received;
            sl.quantityOnOrder = Math.max(0, sl.quantityOnOrder - line.quantityOrdered);
            sl.updatedAt = simClock.toISOString();
          } else {
            sl = {
              id: generateId(), skuId: line.skuId, locationId: wh.id,
              quantityOnHand: received, quantityAllocated: 0, quantityInTransit: 0, quantityOnOrder: 0,
              reorderPoint: 5, reorderQuantity: 20, lastCountedAt: null, updatedAt: simClock.toISOString(),
            };
            store.stockLevels.push(sl);
          }
          logStockMovement(line.skuId, 'PO_RECEIPT', received, null, wh.id, 'PurchaseOrder', po.id);
        }
        po.actualDelivery = simClock.toISOString();
      });
  }
  if (nextStatus === 'RECEIVED') {
    po.actualDelivery = po.actualDelivery || simClock.toISOString();
    // Invoice chain
    queueChain(1440 + Math.random() * 4320, 'Medius AP', 'PO_INVOICE_MATCHED',
      `Invoice matched for ${po.poNumber}: ${po.currency} ${po.totalAmount.toLocaleString()} — 3-way match complete`,
      po.id, { poNumber: po.poNumber, amount: po.totalAmount, currency: po.currency });
    queueChain(2880 + Math.random() * 5760, 'D365 ERP', 'GL_POSTING',
      `GL posting: PO ${po.poNumber} — ${po.currency} ${po.totalAmount.toLocaleString()} posted to 1400-INVENTORY / 2100-AP`,
      po.id, { poNumber: po.poNumber, amount: po.totalAmount });
  }

  return evt('Supply Chain', 'PO_LIFECYCLE', `PO ${po.poNumber} progressed: ${prevStatus} → ${nextStatus} (${supplier?.name || '?'})`, po.id,
    { poNumber: po.poNumber, from: prevStatus, to: nextStatus, supplierName: supplier?.name });
}

// ═══════════════════════════════════════════════════════
// MATCHING & AI
// ═══════════════════════════════════════════════════════

function genMatchingRun(): SimEvent {
  // Find unmatched SO lines and try to match them to PO lines
  const unmatchedSOLines = store.soLines.filter(sol => {
    const so = store.salesOrders.find(s => s.id === sol.salesOrderId);
    if (!so || ['CANCELLED', 'DELIVERED', 'RETURNED'].includes(so.status)) return false;
    return sol.quantityAllocated < sol.quantityOrdered &&
      !store.sopoMatches.some(m => m.salesOrderLineId === sol.id && ['CONFIRMED', 'AUTO_CONFIRMED', 'PROPOSED'].includes(m.status));
  });
  if (unmatchedSOLines.length === 0) return genAiAlert();

  const runId = generateId();
  let proposed = 0, autoConfirmed = 0, unmatched = 0;
  const startTime = Date.now();

  for (const sol of unmatchedSOLines.slice(0, 5 + Math.floor(Math.random() * 10))) {
    // Find a matching PO line
    const poLine = store.poLines.find(pl => {
      const po = store.purchaseOrders.find(p => p.id === pl.purchaseOrderId);
      if (!po || ['CANCELLED', 'CLOSED'].includes(po.status)) return false;
      return pl.skuId === sol.skuId && pl.quantityOrdered - pl.quantityReceived > 0;
    });
    if (!poLine) { unmatched++; continue; }

    const score = 0.6 + Math.random() * 0.35;
    const matchQty = Math.min(sol.quantityOrdered - sol.quantityAllocated, poLine.quantityOrdered - poLine.quantityReceived);
    const autoConfirm = score >= 0.85;
    const match: SOPOMatch = {
      id: generateId(), salesOrderId: sol.salesOrderId, salesOrderLineId: sol.id,
      purchaseOrderId: poLine.purchaseOrderId, purchaseOrderLineId: poLine.id,
      skuId: sol.skuId, quantityMatched: matchQty,
      matchScore: parseFloat(score.toFixed(3)),
      matchFactors: { skuExactMatch: 1.0, timingAlignment: 0.5 + Math.random() * 0.5, locationProximity: 0.5 + Math.random() * 0.5, quantityFit: Math.min(1, matchQty / sol.quantityOrdered) },
      status: autoConfirm ? 'AUTO_CONFIRMED' : 'PROPOSED',
      proposedBy: 'MATCHING_ENGINE', confirmedById: autoConfirm ? systemUser().id : null,
      confirmedAt: autoConfirm ? simClock.toISOString() : null,
      rejectedReason: null, expectedFulfillDate: null,
      createdAt: simClock.toISOString(), updatedAt: simClock.toISOString(),
    };
    store.sopoMatches.push(match);
    if (autoConfirm) autoConfirmed++; else proposed++;
  }

  const run: MatchingRun = {
    id: runId, triggeredBy: 'SIMULATION',
    matchesProposed: proposed, matchesAutoConfirmed: autoConfirmed,
    matchesRequiringReview: proposed, unmatched,
    avgMatchScore: proposed + autoConfirmed > 0 ? 0.75 + Math.random() * 0.15 : null,
    executionTimeMs: Date.now() - startTime + Math.floor(Math.random() * 500),
    modelVersion: 'v1.2.0',
    startedAt: simClock.toISOString(), completedAt: simClock.toISOString(),
  };
  store.matchingRuns.push(run);

  const total = proposed + autoConfirmed;
  return evt('AI Intelligence', 'MATCHING_RUN', `Matching run completed: ${total} matches (${autoConfirmed} auto-confirmed, ${proposed} pending review, ${unmatched} unmatched)`, runId,
    { proposed, autoConfirmed, unmatched, avgScore: run.avgMatchScore });
}

function genForecastUpdate(): SimEvent {
  const product = randomProduct();
  const skus = store.skus.filter(s => s.productId === product.id).slice(0, 3);
  if (skus.length === 0) return genAiAlert();

  for (const sku of skus) {
    const baseDemand = 5 + Math.floor(Math.random() * 30);
    const forecast: DemandForecast = {
      id: generateId(), skuId: sku.id, locationId: null,
      season: product.season, seasonYear: product.seasonYear,
      forecastDate: simClock.toISOString(),
      predictedDemand: baseDemand,
      confidenceLow: Math.max(0, baseDemand - Math.floor(Math.random() * 8)),
      confidenceHigh: baseDemand + Math.floor(Math.random() * 12),
      modelVersion: 'v1.2.0',
      features: { trend: Math.random(), seasonality: Math.random(), priceElasticity: -0.5 - Math.random() },
      createdAt: simClock.toISOString(),
    };
    store.demandForecasts.push(forecast);
    logAudit('CREATE', 'DemandForecast', forecast.id, null, { skuId: sku.id, predictedDemand: baseDemand });
  }

  // Occasionally generate a recommendation
  if (Math.random() < 0.3) {
    const type = faker.helpers.arrayElement(['REORDER', 'TRANSFER', 'MARKDOWN', 'EXPEDITE_PO']);
    const rec: AIRecommendation = {
      id: generateId(), type, targetEntity: 'Product', targetId: product.id,
      recommendation: `${type === 'REORDER' ? 'Reorder' : type === 'TRANSFER' ? 'Transfer stock for' : type === 'MARKDOWN' ? 'Mark down' : 'Expedite PO for'} ${product.name} — predicted ${type === 'MARKDOWN' ? 'overstock' : 'demand exceeds supply'} in 2-4 weeks`,
      confidence: 0.7 + Math.random() * 0.25,
      reasoning: { demandTrend: 'increasing', stockCover: Math.floor(Math.random() * 12) + 'weeks', modelVersion: 'v1.2.0' },
      impact: { revenueAtRisk: Math.floor(Math.random() * 500000), unitsSuggested: 20 + Math.floor(Math.random() * 80) },
      status: 'PENDING', acceptedById: null, acceptedAt: null,
      createdAt: simClock.toISOString(),
    };
    store.aiRecommendations.push(rec);
    logAudit('CREATE', 'AIRecommendation', rec.id, null, { type, productName: product.name, confidence: rec.confidence });
  }

  // Occasionally generate an anomaly
  if (Math.random() < 0.15) {
    const anomalyType = faker.helpers.arrayElement(['DEMAND_SPIKE', 'DEMAND_DROP', 'STOCKOUT_RISK', 'OVERSTOCK', 'MARGIN_EROSION']);
    const alert: AnomalyAlert = {
      id: generateId(), type: anomalyType,
      severity: faker.helpers.arrayElement(['LOW', 'MEDIUM', 'HIGH']),
      entityType: 'Product', entityId: product.id,
      description: `${anomalyType.replace(/_/g, ' ')}: ${product.name} — ${faker.helpers.arrayElement(['significantly above forecast', 'below expected sell-through', 'approaching stockout', 'excess inventory detected', 'margin below target'])}`,
      detectedValue: Math.floor(Math.random() * 100),
      expectedRange: { low: 20, high: 60 },
      modelVersion: 'v1.2.0',
      isResolved: false, resolvedById: null, resolvedAt: null,
      createdAt: simClock.toISOString(),
    };
    store.anomalyAlerts.push(alert);
    logAudit('CREATE', 'AnomalyAlert', alert.id, null, { type: anomalyType, severity: alert.severity, productName: product.name });
  }

  return evt('AI Intelligence', 'FORECAST_UPDATE', `Demand forecast updated for ${product.name} (${skus.length} SKUs) — model v1.2.0`, product.id,
    { productName: product.name, skuCount: skus.length });
}

// ═══════════════════════════════════════════════════════
// SEED SIMULATION
// ═══════════════════════════════════════════════════════

/**
 * Runs the simulation synchronously for a given number of simulated days.
 * Used during seeding to generate consistent cross-system data.
 * Call after base data (locations, suppliers, users, products, SKUs, stock) is seeded.
 */
export function runSeedSimulation(days: number, storeInstance: Store): void {
  // Use provided store instance during seeding (singleton isn't ready yet)
  store = storeInstance;
  // Initialize sim clock to N days ago
  simClock = new Date(Date.now() - days * 86400000);

  // ~45 seconds per tick, so ticks per day = 86400/45 ≈ 1920
  // Use ~80 ticks/day for seeding (enough to generate realistic data, fast enough to start quickly)
  const ticksPerDay = 80;
  const totalTicks = days * ticksPerDay;
  const advancePerTick = 86400000 / ticksPerDay; // ms to advance per tick

  // Temporary state for event counting (used by SO numbering)
  state.eventsGenerated = 0;

  for (let tick = 0; tick < totalTicks; tick++) {
    // Advance clock
    simClock = new Date(simClock.getTime() + advancePerTick + (Math.random() - 0.5) * advancePerTick * 0.3);

    // Generate events (we don't store the SimEvent log, just the store mutations)
    const batchSize = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < batchSize; i++) {
      try {
        generateEvent();
      } catch (e) {
        if (tick < 3) console.error('Seed sim generator error:', e);
      }
      state.eventsGenerated++;
    }

    // Process chain queue
    try { processChainQueue(); } catch (e) {
      if (tick < 3) console.error('Seed sim chain error:', e);
    }
  }

  // Process any remaining chain events by advancing clock to now
  simClock = new Date();
  try { processChainQueue(); } catch { /* skip */ }

  // Clean up
  chainQueue.length = 0;
  state.eventsGenerated = 0;
  // store reference stays set — will be the same singleton at runtime
}
