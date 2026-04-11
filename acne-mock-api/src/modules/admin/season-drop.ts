import type { Store } from '../../store/Store.js';
import type { Product, ProductImage, SKU, StockLevel, PurchaseOrder, POLine, Season, SeasonDrop, SeasonCalendarEntry } from '../../store/types.js';
import { generateId } from '../../utils/id.js';
import { nextSequence } from '../../utils/number-sequence.js';
import { generateSeasonStyles } from '../../store/seed/season-styles.generator.js';
import colorsData from '../../store/data/acne-colors.json' with { type: 'json' };
import calendarData from '../../store/data/season-calendar.json' with { type: 'json' };
import { faker } from '@faker-js/faker';

const colorMap = new Map(colorsData.map(c => [c.code, c]));
const imageBaseUrl = 'https://mock-cdn.acnestudios.mock/images';

// ─── Season label helper ────────────────────────────────

export function seasonLabel(season: Season, year: number): string {
  const labels: Record<Season, string> = {
    SS: 'Spring/Summer',
    AW: 'Autumn/Winter',
    RESORT: 'Resort',
    PRE_FALL: 'Pre-Fall',
    CAPSULE: 'Capsule',
  };
  return `${labels[season] || season} ${year}`;
}

// ─── Execute a season drop ──────────────────────────────

export interface DropResult {
  drop: SeasonDrop;
  products: Product[];
  skus: SKU[];
  purchaseOrders: PurchaseOrder[];
}

export function executeSeasonDrop(
  store: Store,
  season: Season,
  seasonYear: number,
  triggeredBy: SeasonDrop['triggeredBy'],
  timestamp: string,
  options?: { styleCount?: number },
): DropResult {
  // Idempotency check: don't drop the same season+year twice
  const existing = store.seasonDrops.find(
    d => d.season === season && d.seasonYear === seasonYear && d.status === 'COMPLETED',
  );
  if (existing) {
    throw new Error(`Season ${season} ${seasonYear} has already been dropped (id: ${existing.id})`);
  }

  const dropId = generateId();
  const label = seasonLabel(season, seasonYear);
  const styleCount = options?.styleCount ?? (20 + Math.floor(Math.random() * 10));

  const drop: SeasonDrop = {
    id: dropId,
    season,
    seasonYear,
    label,
    status: 'EXECUTING',
    triggeredBy,
    productsCreated: 0,
    skusCreated: 0,
    purchaseOrdersCreated: 0,
    inventoryAllocated: 0,
    executedAt: null,
    createdAt: timestamp,
  };
  store.seasonDrops.push(drop);

  // 1. Generate styles
  const styles = generateSeasonStyles(season, seasonYear, styleCount);

  // 2. Create products from styles
  const products: Product[] = [];
  for (const style of styles) {
    const product: Product = {
      id: generateId(),
      styleNumber: style.styleNumber,
      name: style.name,
      category: style.category,
      subCategory: style.subCategory,
      gender: style.gender,
      season,
      seasonYear,
      collection: style.collection,
      isCarryOver: false,
      costPrice: style.costPrice,
      costCurrency: 'SEK',
      description: buildDropDescription(style, season, seasonYear),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.products.push(product);
    products.push(product);

    // Generate product images (2-3 per product)
    const imgCount = 2 + Math.floor(Math.random() * 2);
    for (let img = 0; img < imgCount; img++) {
      const image: ProductImage = {
        id: generateId(),
        productId: product.id,
        url: `${imageBaseUrl}/${style.styleNumber.toLowerCase()}_${img + 1}.jpg`,
        altText: `${style.name} - ${img === 0 ? 'Front' : img === 1 ? 'Back' : 'Detail'}`,
        isPrimary: img === 0,
        sortOrder: img,
      };
      store.productImages.push(image);
    }
  }

  // 3. Create SKUs for each product
  const allSkus: SKU[] = [];
  let barcodeCounter = Date.now(); // unique barcodes
  for (let pi = 0; pi < products.length; pi++) {
    const product = products[pi];
    const style = styles[pi];

    for (const colorCode of style.colors) {
      const color = colorMap.get(colorCode);
      if (!color) continue;

      for (let si = 0; si < style.sizes.length; si++) {
        const size = style.sizes[si];
        const skuCode = `${style.styleNumber}-${colorCode}-${size}`;
        const sku: SKU = {
          id: generateId(),
          productId: product.id,
          sku: skuCode,
          barcode: String(barcodeCounter++),
          rfidTag: `E200${generateId().slice(0, 16).toUpperCase()}`,
          colour: color.name,
          colourCode: colorCode,
          size,
          sizeIndex: si,
          wholesalePrice: Math.round(style.retailPrice * 0.5),
          retailPrice: style.retailPrice,
          priceCurrency: 'SEK',
          weight: style.category === 'Footwear' ? 0.85 : style.category === 'Outerwear' ? 1.2 : 0.35,
          isActive: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        store.skus.push(sku);
        allSkus.push(sku);
      }
    }
  }

  // 4. Allocate initial inventory at warehouses
  const warehouses = store.locations.filter(l => l.type === 'WAREHOUSE');
  let inventoryCount = 0;
  for (const sku of allSkus) {
    // Main warehouse gets all SKUs
    const mainWh = warehouses[0];
    if (mainWh) {
      const qty = 15 + Math.floor(Math.random() * 45);
      const sl: StockLevel = {
        id: generateId(),
        skuId: sku.id,
        locationId: mainWh.id,
        quantityOnHand: qty,
        quantityAllocated: 0,
        quantityInTransit: 0,
        quantityOnOrder: Math.floor(Math.random() * 30),
        reorderPoint: 15,
        reorderQuantity: 30,
        lastCountedAt: null,
        updatedAt: timestamp,
      };
      store.stockLevels.push(sl);
      inventoryCount += qty;
    }
    // Regional warehouses: ~40% of SKUs
    for (const wh of warehouses.slice(1)) {
      if (Math.random() > 0.4) continue;
      const qty = 5 + Math.floor(Math.random() * 20);
      store.stockLevels.push({
        id: generateId(),
        skuId: sku.id,
        locationId: wh.id,
        quantityOnHand: qty,
        quantityAllocated: 0,
        quantityInTransit: 0,
        quantityOnOrder: 0,
        reorderPoint: 8,
        reorderQuantity: 20,
        lastCountedAt: null,
        updatedAt: timestamp,
      });
      inventoryCount += qty;
    }
  }

  // 5. Create initial purchase orders
  const suppliers = store.suppliers.filter(s => s.isActive);
  const purchaseOrders: PurchaseOrder[] = [];
  const poCount = 3 + Math.floor(Math.random() * 4);
  const productsPerPO = Math.ceil(products.length / poCount);
  const buyerUser = store.users.find(u => u.role === 'BUYER') || store.users[0];

  for (let poIdx = 0; poIdx < poCount; poIdx++) {
    const supplier = suppliers[poIdx % suppliers.length];
    const poProducts = products.slice(poIdx * productsPerPO, (poIdx + 1) * productsPerPO);
    if (poProducts.length === 0) continue;

    const poId = generateId();
    const poNumber = nextSequence(`PO-${season}${seasonYear}`, 5);
    const deliveryWh = warehouses[Math.floor(Math.random() * warehouses.length)];

    let totalAmount = 0;
    const lines: POLine[] = [];
    for (const prod of poProducts) {
      const prodSkus = allSkus.filter(s => s.productId === prod.id).slice(0, 4);
      for (const sku of prodSkus) {
        const qty = 20 + Math.floor(Math.random() * 80);
        const unitCost = prod.costPrice;
        const lineTotal = qty * unitCost;
        totalAmount += lineTotal;
        lines.push({
          id: generateId(),
          purchaseOrderId: poId,
          skuId: sku.id,
          quantityOrdered: qty,
          quantityReceived: 0,
          unitCost,
          lineTotal,
          expectedDate: null,
          notes: `[SEASON DROP] ${label}`,
          createdAt: timestamp,
          updatedAt: timestamp,
        });
      }
    }

    const status = faker.helpers.arrayElement(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT_TO_SUPPLIER'] as const);
    const po: PurchaseOrder = {
      id: poId,
      poNumber,
      supplierId: supplier.id,
      season,
      seasonYear,
      status,
      currency: supplier.currency,
      totalAmount,
      expectedDelivery: new Date(new Date(timestamp).getTime() + supplier.leadTimeDays * 86400000).toISOString(),
      actualDelivery: null,
      deliveryLocationId: deliveryWh?.id || null,
      shippingTerms: faker.helpers.arrayElement(['FOB', 'CIF', 'DDP', 'EXW']),
      paymentTerms: supplier.paymentTerms,
      notes: `[SEASON DROP] Initial production order for ${label}`,
      createdById: buyerUser.id,
      approvedById: status === 'APPROVED' || status === 'SENT_TO_SUPPLIER' ? buyerUser.id : null,
      approvedAt: status === 'APPROVED' || status === 'SENT_TO_SUPPLIER' ? timestamp : null,
      sentToSupplierAt: status === 'SENT_TO_SUPPLIER' ? timestamp : null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    store.purchaseOrders.push(po);
    store.poLines.push(...lines);
    purchaseOrders.push(po);
  }

  // 6. Finalize drop record
  drop.status = 'COMPLETED';
  drop.productsCreated = products.length;
  drop.skusCreated = allSkus.length;
  drop.purchaseOrdersCreated = purchaseOrders.length;
  drop.inventoryAllocated = inventoryCount;
  drop.executedAt = timestamp;

  return { drop, products, skus: allSkus, purchaseOrders };
}

// ─── Calendar scheduling ────────────────────────────────

export function loadDefaultCalendar(store: Store): void {
  if (store.seasonCalendar.length > 0) return; // already loaded
  for (const entry of calendarData) {
    store.seasonCalendar.push(entry as SeasonCalendarEntry);
  }
}

/**
 * Check the calendar for any drops that should fire.
 * Returns the results of any drops that were executed.
 */
export function checkCalendarDrops(store: Store, currentTime: Date): DropResult[] {
  const results: DropResult[] = [];
  const currentIso = currentTime.toISOString().slice(0, 10); // YYYY-MM-DD

  for (const entry of store.seasonCalendar) {
    if (!entry.enabled) continue;
    if (entry.dropDate > currentIso) continue;

    // Check if already dropped
    const alreadyDropped = store.seasonDrops.find(
      d => d.season === entry.season && d.seasonYear === entry.seasonYear && d.status === 'COMPLETED',
    );
    if (alreadyDropped) continue;

    // Execute the drop
    try {
      const result = executeSeasonDrop(
        store,
        entry.season,
        entry.seasonYear,
        'CALENDAR',
        currentTime.toISOString(),
      );
      results.push(result);
    } catch {
      // Already dropped or other error — skip
    }
  }

  return results;
}

// ─── Getters ────────────────────────────────────────────

export function getSeasonDrops(store: Store): SeasonDrop[] {
  return store.seasonDrops;
}

export function getSeasonDrop(store: Store, id: string): SeasonDrop | undefined {
  return store.seasonDrops.find(d => d.id === id);
}

export function getSeasonCalendar(store: Store): SeasonCalendarEntry[] {
  return store.seasonCalendar;
}

// ─── Description builder ────────────────────────────────

function buildDropDescription(
  style: { name: string; subCategory: string | null; category: string; gender: string; collection: string },
  season: Season,
  seasonYear: number,
): string {
  const seasonName = season === 'SS' ? 'Spring/Summer' : season === 'AW' ? 'Autumn/Winter' : season === 'PRE_FALL' ? 'Pre-Fall' : season === 'RESORT' ? 'Resort' : season;
  const parts = [
    `${style.name}.`,
    style.subCategory ? `${style.gender}'s ${style.subCategory.toLowerCase()}.` : `${style.gender}'s ${style.category.toLowerCase()}.`,
    `From the ${style.collection}, ${seasonName} ${seasonYear}.`,
    'New season drop.',
  ];
  if (style.category === 'Denim') {
    parts.push('Part of the Blå Konst denim programme. 100% organic cotton selvedge.');
  }
  if (style.category === 'Outerwear') {
    parts.push('Premium construction with Italian-sourced materials.');
  }
  if (style.category === 'Knitwear') {
    parts.push('Responsibly sourced yarns. Hand-finished details.');
  }
  return parts.join(' ');
}
