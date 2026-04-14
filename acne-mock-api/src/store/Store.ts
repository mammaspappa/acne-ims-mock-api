import type {
  User, Product, SKU, ProductImage, Location, Supplier,
  PurchaseOrder, POLine, POReceipt, PODocument, POStatusHistory,
  SalesOrder, SOLine, SOStatusHistory, Shipment,
  StockLevel, StockMovement, AuditLog,
  SOPOMatch, MatchingRun,
  DemandForecast, AIRecommendation, AnomalyAlert, ModelRegistry,
  SeasonDrop, SeasonCalendarEntry, Customer,
} from './types.js';
import { seedAll } from './seed/index.js';
import { resetSequences } from '../utils/number-sequence.js';
import { setMockNow } from '../utils/date.js';
import { readFileSync, writeFileSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export class Store {
  users: User[] = [];
  products: Product[] = [];
  skus: SKU[] = [];
  productImages: ProductImage[] = [];
  locations: Location[] = [];
  suppliers: Supplier[] = [];
  purchaseOrders: PurchaseOrder[] = [];
  poLines: POLine[] = [];
  poReceipts: POReceipt[] = [];
  poDocuments: PODocument[] = [];
  poStatusHistory: POStatusHistory[] = [];
  salesOrders: SalesOrder[] = [];
  soLines: SOLine[] = [];
  soStatusHistory: SOStatusHistory[] = [];
  shipments: Shipment[] = [];
  stockLevels: StockLevel[] = [];
  stockMovements: StockMovement[] = [];
  auditLogs: AuditLog[] = [];
  sopoMatches: SOPOMatch[] = [];
  matchingRuns: MatchingRun[] = [];
  demandForecasts: DemandForecast[] = [];
  aiRecommendations: AIRecommendation[] = [];
  anomalyAlerts: AnomalyAlert[] = [];
  modelRegistry: ModelRegistry[] = [];
  seasonDrops: SeasonDrop[] = [];
  seasonCalendar: SeasonCalendarEntry[] = [];
  customers: Customer[] = [];

  private _snapshot: string = '';
  private _indexes = new Map<string, Map<string, unknown>>();

  constructor() {
    this.seed();
  }

  seed(): void {
    resetSequences();
    setMockNow(null);

    const cacheFile = join(__dirname, '..', '..', 'seed-cache.json');

    // Check if cache exists and is newer than all source files
    if (this._isCacheValid(cacheFile)) {
      try {
        const cached = JSON.parse(readFileSync(cacheFile, 'utf-8'));
        this._deserialize(cached);
        this._snapshot = JSON.stringify(cached);
        this._buildIndexes();
        return;
      } catch { /* fall through to full seed */ }
    }

    // Full seed simulation
    seedAll(this);
    this._snapshot = JSON.stringify(this._serialize());
    this._buildIndexes();

    // Save cache for next startup
    try {
      writeFileSync(cacheFile, this._snapshot);
    } catch { /* ignore write errors */ }
  }

  private _isCacheValid(cacheFile: string): boolean {
    try {
      const cacheStat = statSync(cacheFile);
      const cacheTime = cacheStat.mtimeMs;

      // Check if any source files are newer than cache
      const srcDirs = [
        join(__dirname, 'seed'),
        join(__dirname, 'data'),
        join(__dirname, '..', 'modules', 'admin'),
      ];
      for (const dir of srcDirs) {
        try {
          for (const file of readdirSync(dir)) {
            const fileStat = statSync(join(dir, file));
            if (fileStat.mtimeMs > cacheTime) return false;
          }
        } catch { /* dir doesn't exist, skip */ }
      }
      return true;
    } catch {
      return false; // cache doesn't exist
    }
  }

  reset(): void {
    resetSequences();
    setMockNow(null);
    const data = JSON.parse(this._snapshot);
    this._deserialize(data);
    this._buildIndexes();
  }

  private _serialize(): Record<string, unknown[]> {
    return {
      users: this.users,
      products: this.products,
      skus: this.skus,
      productImages: this.productImages,
      locations: this.locations,
      suppliers: this.suppliers,
      purchaseOrders: this.purchaseOrders,
      poLines: this.poLines,
      poReceipts: this.poReceipts,
      poDocuments: this.poDocuments,
      poStatusHistory: this.poStatusHistory,
      salesOrders: this.salesOrders,
      soLines: this.soLines,
      soStatusHistory: this.soStatusHistory,
      shipments: this.shipments,
      stockLevels: this.stockLevels,
      stockMovements: this.stockMovements,
      auditLogs: this.auditLogs,
      sopoMatches: this.sopoMatches,
      matchingRuns: this.matchingRuns,
      demandForecasts: this.demandForecasts,
      aiRecommendations: this.aiRecommendations,
      anomalyAlerts: this.anomalyAlerts,
      modelRegistry: this.modelRegistry,
      seasonDrops: this.seasonDrops,
      seasonCalendar: this.seasonCalendar,
      customers: this.customers,
    };
  }

  private _deserialize(data: Record<string, unknown[]>): void {
    for (const [key, value] of Object.entries(data)) {
      (this as Record<string, unknown>)[key] = JSON.parse(JSON.stringify(value));
    }
  }

  private _buildIndexes(): void {
    this._indexes.clear();
    this._indexes.set('users', new Map(this.users.map(u => [u.id, u])));
    this._indexes.set('products', new Map(this.products.map(p => [p.id, p])));
    this._indexes.set('skus', new Map(this.skus.map(s => [s.id, s])));
    this._indexes.set('locations', new Map(this.locations.map(l => [l.id, l])));
    this._indexes.set('suppliers', new Map(this.suppliers.map(s => [s.id, s])));
    this._indexes.set('purchaseOrders', new Map(this.purchaseOrders.map(po => [po.id, po])));
    this._indexes.set('salesOrders', new Map(this.salesOrders.map(so => [so.id, so])));
  }

  // Generic CRUD helpers

  findById<T extends { id: string }>(collection: T[], id: string): T | undefined {
    return collection.find(item => item.id === id);
  }

  findByField<T>(collection: T[], field: keyof T, value: unknown): T[] {
    return collection.filter(item => item[field] === value);
  }

  insert<T extends { id: string }>(collection: T[], item: T): T {
    collection.push(item);
    return item;
  }

  update<T extends { id: string }>(collection: T[], id: string, patch: Partial<T>): T | undefined {
    const index = collection.findIndex(item => item.id === id);
    if (index === -1) return undefined;
    collection[index] = { ...collection[index], ...patch };
    return collection[index];
  }

  remove<T extends { id: string }>(collection: T[], id: string): boolean {
    const index = collection.findIndex(item => item.id === id);
    if (index === -1) return false;
    collection.splice(index, 1);
    return true;
  }

  stats(): Record<string, number> {
    return {
      users: this.users.length,
      products: this.products.length,
      skus: this.skus.length,
      locations: this.locations.length,
      suppliers: this.suppliers.length,
      purchaseOrders: this.purchaseOrders.length,
      poLines: this.poLines.length,
      salesOrders: this.salesOrders.length,
      soLines: this.soLines.length,
      stockLevels: this.stockLevels.length,
      sopoMatches: this.sopoMatches.length,
      demandForecasts: this.demandForecasts.length,
      aiRecommendations: this.aiRecommendations.length,
      anomalyAlerts: this.anomalyAlerts.length,
      seasonDrops: this.seasonDrops.length,
      customers: this.customers.length,
    };
  }
}

// Singleton
export const store = new Store();
