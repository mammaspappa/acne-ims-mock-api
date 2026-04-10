import type { Store } from '../Store.js';
import type { PurchaseOrder, POLine, POReceipt, PODocument, POStatusHistory, POStatus, Season, Currency } from '../types.js';
import { generateId } from '../../utils/id.js';
import { daysAgo, daysFromNow, now } from '../../utils/date.js';
import { setSequence } from '../../utils/number-sequence.js';

const statusFlow: POStatus[] = [
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT_TO_SUPPLIER',
  'CONFIRMED_BY_SUPPLIER', 'IN_PRODUCTION', 'SHIPPED',
  'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED',
];

interface POSeed {
  status: POStatus;
  supplierIndex: number;
  season: Season;
  seasonYear: number;
  daysAgoCreated: number;
  lineSkuIndices: number[]; // indices into store.skus
  quantities: number[];
  notes: string | null;
  shippingTerms: string;
  hasDocuments: boolean;
}

function buildPOSeeds(): POSeed[] {
  return [
    // ── AW2026 POs (current season — the bulk) ─────────
    {
      status: 'DRAFT',
      supplierIndex: 1, // Nordic Textile — knitwear
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 2,
      lineSkuIndices: [80, 82, 85, 88], // knitwear SKUs
      quantities: [60, 45, 80, 35],
      notes: 'Draft PO for AW26 knitwear restock. Awaiting final colour confirmation from design team.',
      shippingTerms: 'DAP',
      hasDocuments: false,
    },
    {
      status: 'PENDING_APPROVAL',
      supplierIndex: 0, // Tessuti Italiani — leather
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 5,
      lineSkuIndices: [4, 6, 8, 10, 12], // outerwear SKUs
      quantities: [25, 30, 40, 20, 15],
      notes: 'Leather outerwear order — exceeds SEK 500k threshold, requires director approval.',
      shippingTerms: 'FOB',
      hasDocuments: true,
    },
    {
      status: 'APPROVED',
      supplierIndex: 2, // Denim Craft — denim
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 12,
      lineSkuIndices: [30, 32, 34, 36, 38, 42, 44], // denim SKUs
      quantities: [100, 80, 120, 60, 90, 75, 50],
      notes: 'Core denim replenishment. 1996 and 1977 fits — bestsellers. Approved by head of buying.',
      shippingTerms: 'CIF',
      hasDocuments: true,
    },
    {
      status: 'SENT_TO_SUPPLIER',
      supplierIndex: 3, // East Fashion — RTW
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 18,
      lineSkuIndices: [110, 112, 114, 116], // t-shirt/top SKUs
      quantities: [200, 150, 180, 120],
      notes: 'Face Collection core tees — carry-over. Sent to supplier 2026-03-25. Awaiting confirmation.',
      shippingTerms: 'FOB',
      hasDocuments: true,
    },
    {
      status: 'CONFIRMED_BY_SUPPLIER',
      supplierIndex: 4, // Lisboa Footwear
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 25,
      lineSkuIndices: [165, 168, 172, 176, 180], // footwear SKUs
      quantities: [40, 60, 80, 35, 45],
      notes: 'AW26 footwear. Supplier confirmed 2026-03-20. Production starts week 14.',
      shippingTerms: 'DAP',
      hasDocuments: true,
    },
    {
      status: 'IN_PRODUCTION',
      supplierIndex: 1, // Nordic Textile
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 45,
      lineSkuIndices: [78, 81, 84, 86, 90, 93], // knitwear SKUs
      quantities: [70, 55, 90, 40, 60, 45],
      notes: 'Mohair and lambswool pieces. In production since week 9. ETA: week 18.',
      shippingTerms: 'DAP',
      hasDocuments: true,
    },
    {
      status: 'SHIPPED',
      supplierIndex: 0, // Tessuti Italiani
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 55,
      lineSkuIndices: [0, 2, 5, 7], // outerwear SKUs
      quantities: [30, 25, 20, 35],
      notes: 'Wool coats and blazers. Shipped from Biella 2026-02-18. DHL tracking: 1234567890.',
      shippingTerms: 'FOB',
      hasDocuments: true,
    },
    {
      status: 'PARTIALLY_RECEIVED',
      supplierIndex: 2, // Denim Craft
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 70,
      lineSkuIndices: [31, 33, 35, 40, 43, 46, 48], // denim SKUs
      quantities: [120, 80, 100, 70, 85, 60, 90],
      notes: 'Denim batch 1 of 2 received. 60% of order in warehouse. Remaining shipment ETA +2 weeks.',
      shippingTerms: 'CIF',
      hasDocuments: true,
    },
    {
      status: 'RECEIVED',
      supplierIndex: 3, // East Fashion
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 85,
      lineSkuIndices: [111, 113, 115, 118, 120], // t-shirt SKUs
      quantities: [250, 180, 200, 150, 100],
      notes: 'Full order received. QA passed — 2 units damaged (Nash Face Patch BLK-M). Invoice matched.',
      shippingTerms: 'FOB',
      hasDocuments: true,
    },
    {
      status: 'CLOSED',
      supplierIndex: 4, // Lisboa Footwear
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 110,
      lineSkuIndices: [166, 170, 174], // footwear SKUs
      quantities: [50, 70, 40],
      notes: 'AW26 early footwear drop. Fully received, QA passed, invoice matched and paid. PO closed.',
      shippingTerms: 'DAP',
      hasDocuments: true,
    },

    // ── SS2026 POs (wrapping up) ─────────
    {
      status: 'CLOSED',
      supplierIndex: 3, // East Fashion
      season: 'SS', seasonYear: 2026,
      daysAgoCreated: 150,
      lineSkuIndices: [109, 112, 116, 119], // t-shirt SKUs
      quantities: [300, 200, 250, 180],
      notes: 'SS26 Face Collection tees. Closed and fully paid.',
      shippingTerms: 'FOB',
      hasDocuments: true,
    },
    {
      status: 'CLOSED',
      supplierIndex: 2, // Denim Craft
      season: 'SS', seasonYear: 2026,
      daysAgoCreated: 160,
      lineSkuIndices: [30, 34, 38, 44], // denim SKUs
      quantities: [150, 100, 120, 80],
      notes: 'SS26 denim core. All received, QA passed.',
      shippingTerms: 'CIF',
      hasDocuments: true,
    },
    {
      status: 'RECEIVED',
      supplierIndex: 1, // Nordic Textile
      season: 'SS', seasonYear: 2026,
      daysAgoCreated: 140,
      lineSkuIndices: [83, 87, 92], // lighter knitwear
      quantities: [40, 55, 35],
      notes: 'SS26 lightweight knits. Received. Awaiting final invoice reconciliation.',
      shippingTerms: 'DAP',
      hasDocuments: true,
    },

    // ── AW2025 historical POs (all closed) ─────────
    {
      status: 'CLOSED',
      supplierIndex: 0,
      season: 'AW', seasonYear: 2025,
      daysAgoCreated: 300,
      lineSkuIndices: [1, 3, 6], // outerwear
      quantities: [35, 20, 40],
      notes: 'AW25 leather and wool. Fully delivered and closed.',
      shippingTerms: 'FOB',
      hasDocuments: true,
    },
    {
      status: 'CLOSED',
      supplierIndex: 2,
      season: 'AW', seasonYear: 2025,
      daysAgoCreated: 280,
      lineSkuIndices: [32, 36, 40, 44, 48], // denim
      quantities: [130, 90, 110, 70, 85],
      notes: 'AW25 denim core restock. High sell-through on 1996 fit.',
      shippingTerms: 'CIF',
      hasDocuments: false,
    },

    // ── CANCELLED POs ─────────
    {
      status: 'CANCELLED',
      supplierIndex: 3,
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 40,
      lineSkuIndices: [117, 121], // tops
      quantities: [100, 80],
      notes: 'CANCELLED: Design team pulled two styles from AW26 collection after buy meeting review.',
      shippingTerms: 'FOB',
      hasDocuments: false,
    },

    // ── Additional current POs for depth ─────────
    {
      status: 'APPROVED',
      supplierIndex: 0, // Tessuti Italiani — accessories
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 8,
      lineSkuIndices: [145, 147, 150, 152], // accessories
      quantities: [50, 80, 30, 60],
      notes: 'Musubi bag restock. Approved — high demand signal from Tokyo and Seoul stores.',
      shippingTerms: 'DAP',
      hasDocuments: true,
    },
    {
      status: 'IN_PRODUCTION',
      supplierIndex: 2, // Denim Craft
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 50,
      lineSkuIndices: [30, 32, 34, 36, 38, 40, 42], // full denim range
      quantities: [150, 120, 180, 90, 130, 100, 70],
      notes: 'Large denim order — second batch for AW26. Critical for wholesale pre-orders.',
      shippingTerms: 'CIF',
      hasDocuments: true,
    },
    {
      status: 'CONFIRMED_BY_SUPPLIER',
      supplierIndex: 3, // East Fashion — trousers
      season: 'AW', seasonYear: 2026,
      daysAgoCreated: 22,
      lineSkuIndices: [130, 132, 135, 138], // trouser SKUs
      quantities: [80, 60, 70, 50],
      notes: 'AW26 trouser programme. Supplier confirmed, production slot booked for week 16.',
      shippingTerms: 'FOB',
      hasDocuments: true,
    },
    {
      status: 'DRAFT',
      supplierIndex: 4, // Lisboa — additional footwear
      season: 'PRE_FALL', seasonYear: 2026,
      daysAgoCreated: 1,
      lineSkuIndices: [167, 171, 175, 179], // footwear
      quantities: [30, 45, 55, 25],
      notes: 'Pre-Fall 2026 footwear exploration. Draft — pending design sign-off on Adriana colourway.',
      shippingTerms: 'DAP',
      hasDocuments: false,
    },
  ];
}

export function seedPurchaseOrders(store: Store): void {
  const seeds = buildPOSeeds();
  const buyerUser = store.users.find(u => u.role === 'BUYER')!;
  const buyer2User = store.users.find(u => u.email === 'buyer2@acne.mock') || buyerUser;
  const execUser = store.users.find(u => u.role === 'EXEC')!;
  const warehouseUser = store.users.find(u => u.role === 'WAREHOUSE')!;
  const qaUser = store.users.find(u => u.role === 'QA')!;
  const mainWarehouse = store.locations.find(l => l.name === 'Central Warehouse EU')!;
  const naWarehouse = store.locations.find(l => l.name === 'Warehouse NA');
  const apacWarehouse = store.locations.find(l => l.name === 'Warehouse APAC');

  const counters: Record<string, number> = {};

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    const supplier = store.suppliers[seed.supplierIndex];
    const prefix = `PO-${seed.season}${seed.seasonYear}`;
    counters[prefix] = (counters[prefix] || 0) + 1;
    const poNumber = `${prefix}-${String(counters[prefix]).padStart(5, '0')}`;
    const createdAt = daysAgo(seed.daysAgoCreated).toISOString();

    // Alternate delivery locations for variety
    const deliveryLoc = seed.seasonYear === 2026 && i % 5 === 3 ? naWarehouse : seed.seasonYear === 2026 && i % 7 === 4 ? apacWarehouse : mainWarehouse;
    const creator = i % 3 === 0 ? buyer2User : buyerUser;

    const po: PurchaseOrder = {
      id: generateId(),
      poNumber,
      supplierId: supplier.id,
      season: seed.season,
      seasonYear: seed.seasonYear,
      status: seed.status,
      currency: supplier.currency,
      totalAmount: 0,
      expectedDelivery: seed.status === 'CANCELLED' ? null : daysAgo(seed.daysAgoCreated - supplier.leadTimeDays - 7).toISOString(),
      actualDelivery: ['RECEIVED', 'CLOSED'].includes(seed.status) ? daysAgo(seed.daysAgoCreated - supplier.leadTimeDays).toISOString() : seed.status === 'PARTIALLY_RECEIVED' ? daysAgo(seed.daysAgoCreated - supplier.leadTimeDays + 5).toISOString() : null,
      deliveryLocationId: deliveryLoc?.id || mainWarehouse.id,
      shippingTerms: seed.shippingTerms,
      paymentTerms: supplier.paymentTerms,
      notes: seed.notes,
      createdById: creator.id,
      approvedById: statusFlow.indexOf(seed.status) >= 2 || seed.status === 'CANCELLED' ? execUser.id : null,
      approvedAt: statusFlow.indexOf(seed.status) >= 2 ? daysAgo(seed.daysAgoCreated - 2).toISOString() : null,
      sentToSupplierAt: statusFlow.indexOf(seed.status) >= 3 ? daysAgo(seed.daysAgoCreated - 4).toISOString() : null,
      createdAt,
      updatedAt: daysAgo(Math.min(seed.daysAgoCreated, 1)).toISOString(),
    };

    // Create PO Lines
    let totalAmount = 0;
    for (let li = 0; li < seed.lineSkuIndices.length; li++) {
      const skuIdx = seed.lineSkuIndices[li] % store.skus.length;
      const sku = store.skus[skuIdx];
      const product = store.products.find(p => p.id === sku.productId)!;
      const qty = seed.quantities[li] || 50;
      const unitCost = product.costPrice;
      const lineTotal = qty * unitCost;
      totalAmount += lineTotal;

      const isReceived = ['PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'].includes(seed.status);
      const isPartial = seed.status === 'PARTIALLY_RECEIVED';
      const qtyReceived = isReceived ? (isPartial ? Math.floor(qty * (0.5 + Math.random() * 0.2)) : qty) : 0;

      const poLine: POLine = {
        id: generateId(),
        purchaseOrderId: po.id,
        skuId: sku.id,
        quantityOrdered: qty,
        quantityReceived: qtyReceived,
        unitCost,
        lineTotal,
        expectedDate: po.expectedDelivery,
        notes: li === 0 && seed.status === 'PARTIALLY_RECEIVED' ? `${qtyReceived}/${qty} received in first shipment` : null,
        createdAt,
        updatedAt: daysAgo(Math.min(seed.daysAgoCreated, 1)).toISOString(),
      };
      store.poLines.push(poLine);

      // Create receipts for received lines
      if (qtyReceived > 0) {
        const damaged = Math.random() > 0.9 ? Math.floor(Math.random() * 3) + 1 : 0;
        const receipt: POReceipt = {
          id: generateId(),
          poLineId: poLine.id,
          quantityReceived: qtyReceived,
          receivedAt: po.actualDelivery || daysAgo(seed.daysAgoCreated - supplier.leadTimeDays).toISOString(),
          receivedById: warehouseUser.id,
          locationId: deliveryLoc?.id || mainWarehouse.id,
          qualityStatus: damaged > 0 ? 'PARTIAL_FAIL' : 'PASSED',
          damagedQuantity: damaged,
          notes: damaged > 0 ? `${damaged} unit(s) with visible defects — colour inconsistency. Quarantined for QA review.` : null,
        };
        store.poReceipts.push(receipt);
      }
    }

    po.totalAmount = totalAmount;
    store.purchaseOrders.push(po);

    // Documents
    if (seed.hasDocuments) {
      const docTypes = ['PURCHASE_ORDER_PDF', 'PACKING_LIST', 'QUALITY_CERT', 'INVOICE'];
      const statusIdx = statusFlow.indexOf(seed.status);
      const docCount = Math.min(statusIdx + 1, docTypes.length);
      for (let di = 0; di < docCount; di++) {
        store.poDocuments.push({
          id: generateId(),
          purchaseOrderId: po.id,
          type: docTypes[di],
          fileName: `${poNumber}_${docTypes[di].toLowerCase()}.pdf`,
          fileUrl: `https://mock-docs.acnestudios.mock/po/${poNumber}/${docTypes[di].toLowerCase()}.pdf`,
          uploadedAt: daysAgo(seed.daysAgoCreated - di * 3).toISOString(),
        });
      }
    }

    // Status history — walk through every status up to current
    if (seed.status === 'CANCELLED') {
      // Cancelled POs: DRAFT → PENDING_APPROVAL → CANCELLED
      const cancelHistory: Array<{ from: POStatus | null; to: POStatus; by: string; daysOffset: number; reason: string | null }> = [
        { from: null, to: 'DRAFT', by: creator.id, daysOffset: 0, reason: null },
        { from: 'DRAFT', to: 'PENDING_APPROVAL', by: creator.id, daysOffset: 1, reason: null },
        { from: 'PENDING_APPROVAL', to: 'CANCELLED', by: execUser.id, daysOffset: 3, reason: 'Styles pulled from collection by design team' },
      ];
      for (const h of cancelHistory) {
        store.poStatusHistory.push({
          id: generateId(),
          purchaseOrderId: po.id,
          fromStatus: h.from,
          toStatus: h.to,
          changedById: h.by,
          reason: h.reason,
          changedAt: daysAgo(seed.daysAgoCreated - h.daysOffset).toISOString(),
        });
      }
    } else {
      const statusIdx = statusFlow.indexOf(seed.status);
      for (let si = 0; si <= statusIdx; si++) {
        store.poStatusHistory.push({
          id: generateId(),
          purchaseOrderId: po.id,
          fromStatus: si === 0 ? null : statusFlow[si - 1],
          toStatus: statusFlow[si],
          changedById: si <= 1 ? creator.id : si === 2 ? execUser.id : si <= 4 ? creator.id : si <= 6 ? warehouseUser.id : warehouseUser.id,
          reason: null,
          changedAt: daysAgo(seed.daysAgoCreated - si * 2).toISOString(),
        });
      }
    }
  }

  // Set final sequence counters
  for (const [prefix, count] of Object.entries(counters)) {
    setSequence(prefix, count);
  }
}
