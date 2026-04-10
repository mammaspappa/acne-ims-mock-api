import type { Store } from '../Store.js';
import type { SalesOrder, SOLine, SOStatusHistory, Shipment, SOChannel, SOType, SOStatus, Currency } from '../types.js';
import { generateId } from '../../utils/id.js';
import { daysAgo, now } from '../../utils/date.js';
import { setSequence } from '../../utils/number-sequence.js';

// ─── Realistic customer data ──────────────────────────
const retailCustomers = [
  { name: 'Lena Söderström', email: 'lena.soderstrom@email.se', city: 'Stockholm', country: 'Sweden' },
  { name: 'Pierre Moreau', email: 'p.moreau@mail.fr', city: 'Paris', country: 'France' },
  { name: 'Charlotte Webb', email: 'c.webb@post.co.uk', city: 'London', country: 'United Kingdom' },
  { name: 'Yuki Sato', email: 'yuki.sato@mail.jp', city: 'Tokyo', country: 'Japan' },
  { name: 'Jin-soo Park', email: 'jinsoo.park@mail.kr', city: 'Seoul', country: 'South Korea' },
  { name: 'Andrea Rossi', email: 'a.rossi@posta.it', city: 'Milan', country: 'Italy' },
  { name: 'Michael Chen', email: 'm.chen@mail.com', city: 'New York', country: 'United States' },
  { name: 'Emma Lindberg', email: 'emma.l@mail.se', city: 'Gothenburg', country: 'Sweden' },
  { name: 'Sophie Laurent', email: 'sophie.l@mail.fr', city: 'Lyon', country: 'France' },
  { name: 'Tomoko Ishii', email: 'tomoko.i@mail.jp', city: 'Osaka', country: 'Japan' },
  { name: 'Henrik Dahl', email: 'h.dahl@mail.no', city: 'Oslo', country: 'Norway' },
  { name: 'Anna Müller', email: 'a.mueller@mail.de', city: 'Berlin', country: 'Germany' },
];

const ecomCustomers = [
  { name: 'Sarah Johnson', email: 'sarah.j@gmail.com', city: 'Brooklyn', country: 'US', currency: 'USD' as Currency },
  { name: 'Thomas Weber', email: 't.weber@web.de', city: 'Munich', country: 'DE', currency: 'EUR' as Currency },
  { name: 'Akiko Tanaka', email: 'akiko.t@yahoo.co.jp', city: 'Yokohama', country: 'JP', currency: 'JPY' as Currency },
  { name: 'Olivia Smith', email: 'o.smith@outlook.com', city: 'Manchester', country: 'GB', currency: 'GBP' as Currency },
  { name: 'Lars Eriksson', email: 'lars.e@telia.se', city: 'Malmö', country: 'SE', currency: 'SEK' as Currency },
  { name: 'Marie Dubois', email: 'm.dubois@free.fr', city: 'Marseille', country: 'FR', currency: 'EUR' as Currency },
  { name: 'David Kim', email: 'd.kim@naver.com', city: 'Busan', country: 'KR', currency: 'KRW' as Currency },
  { name: 'Jessica Williams', email: 'jess.w@icloud.com', city: 'Los Angeles', country: 'US', currency: 'USD' as Currency },
  { name: 'Marco Bianchi', email: 'marco.b@libero.it', city: 'Rome', country: 'IT', currency: 'EUR' as Currency },
  { name: 'Frida Holm', email: 'frida.h@gmail.com', city: 'Copenhagen', country: 'DK', currency: 'EUR' as Currency },
  { name: 'Robert Taylor', email: 'r.taylor@gmail.com', city: 'Sydney', country: 'AU', currency: 'AUD' as Currency },
  { name: 'Ling Wei', email: 'ling.w@163.com', city: 'Shanghai', country: 'CN', currency: 'CNY' as Currency },
];

const wholesaleBuyers = [
  { name: 'Nordstrom Inc.', code: 'NORD001', email: 'buying@nordstrom.mock', city: 'Seattle', country: 'US', currency: 'USD' as Currency },
  { name: 'Selfridges & Co', code: 'SELF001', email: 'fashion.buying@selfridges.mock', city: 'London', country: 'GB', currency: 'GBP' as Currency },
  { name: 'Le Bon Marché', code: 'LBM001', email: 'achat@lebonmarche.mock', city: 'Paris', country: 'FR', currency: 'EUR' as Currency },
  { name: 'Isetan Mitsukoshi', code: 'ISE001', email: 'buying@isetan.mock', city: 'Tokyo', country: 'JP', currency: 'JPY' as Currency },
  { name: 'NK Stockholm', code: 'NK001', email: 'inkop@nk.mock', city: 'Stockholm', country: 'SE', currency: 'SEK' as Currency },
  { name: 'KaDeWe Berlin', code: 'KDW001', email: 'einkauf@kadewe.mock', city: 'Berlin', country: 'DE', currency: 'EUR' as Currency },
  { name: 'Lane Crawford', code: 'LC001', email: 'buying@lanecrawford.mock', city: 'Hong Kong', country: 'HK', currency: 'HKD' as Currency },
];

const marketplacePlatforms = ['FARFETCH', 'SSENSE', 'MYTHERESA'];

interface SOSeed {
  channel: SOChannel;
  type: SOType;
  status: SOStatus;
  daysAgo: number;
  lineSkuIndices: number[];
  quantities: number[];
  currency: Currency;
  locationIndex: number; // into store.locations
  priority: number;
  customerIndex?: number;
  wholesaleBuyerIndex?: number;
  notes: string | null;
}

function buildSOSeeds(): SOSeed[] {
  const seeds: SOSeed[] = [];

  // ── 12 Retail Store SOs ──────────────────────────────
  const retailData: Array<{ status: SOStatus; daysAgo: number; locIdx: number; custIdx: number; skus: number[]; qtys: number[]; notes: string | null; priority: number }> = [
    { status: 'DRAFT', daysAgo: 1, locIdx: 3, custIdx: 0, skus: [30, 32], qtys: [1, 1], notes: 'Walk-in customer. Trying on 1996 denim.', priority: 0 },
    { status: 'CONFIRMED', daysAgo: 2, locIdx: 4, custIdx: 1, skus: [0, 80], qtys: [1, 1], notes: 'Olinda coat + Kiera cardigan. Gift wrapping requested.', priority: 0 },
    { status: 'ALLOCATED', daysAgo: 3, locIdx: 5, custIdx: 2, skus: [110, 112, 145], qtys: [2, 1, 1], notes: 'Regular customer. Face tees + Platt card holder.', priority: 0 },
    { status: 'PICKING', daysAgo: 1, locIdx: 6, custIdx: 6, skus: [165, 167], qtys: [1, 1], notes: 'Footwear — customer waiting in store for fitting.', priority: 1 },
    { status: 'PACKED', daysAgo: 2, locIdx: 7, custIdx: 3, skus: [28, 30, 82], qtys: [1, 1, 1], notes: 'VIC order — Yuki Sato (repeat customer, 12th purchase this year).', priority: 2 },
    { status: 'SHIPPED', daysAgo: 5, locIdx: 3, custIdx: 7, skus: [0, 4, 6], qtys: [1, 1, 1], notes: 'Full outerwear look. Shipped to customer address (Gothenburg).', priority: 0 },
    { status: 'DELIVERED', daysAgo: 10, locIdx: 8, custIdx: 4, skus: [150, 152], qtys: [1, 1], notes: 'Accessories purchase. Delivered via Seoul Gangnam store pickup.', priority: 0 },
    { status: 'DELIVERED', daysAgo: 15, locIdx: 4, custIdx: 8, skus: [84, 86], qtys: [1, 1], notes: 'Knitwear for winter. Sophie — returning customer.', priority: 0 },
    { status: 'DELIVERED', daysAgo: 20, locIdx: 9, custIdx: 5, skus: [130, 132], qtys: [1, 1], notes: 'Milan store. Wool trousers.', priority: 0 },
    { status: 'CONFIRMED', daysAgo: 1, locIdx: 6, custIdx: 6, skus: [110, 114, 116, 150], qtys: [3, 2, 1, 1], notes: 'Bulk t-shirt purchase for corporate gifts. Michael Chen — repeat buyer.', priority: 1 },
    { status: 'ALLOCATED', daysAgo: 4, locIdx: 3, custIdx: 10, skus: [34, 36], qtys: [1, 1], notes: 'Henrik from Oslo visiting Stockholm. Denim fitting.', priority: 0 },
    { status: 'SHIPPED', daysAgo: 7, locIdx: 5, custIdx: 11, skus: [0, 80, 130, 165], qtys: [1, 1, 1, 1], notes: 'Full outfit — Anna Müller. Ship to Berlin address.', priority: 0 },
  ];
  for (const rd of retailData) {
    seeds.push({
      channel: 'RETAIL_STORE', type: 'STANDARD', status: rd.status,
      daysAgo: rd.daysAgo, lineSkuIndices: rd.skus, quantities: rd.qtys,
      currency: 'SEK', locationIndex: rd.locIdx, priority: rd.priority,
      customerIndex: rd.custIdx, notes: rd.notes,
    });
  }

  // ── 12 E-commerce SOs ────────────────────────────────
  const ecomData: Array<{ status: SOStatus; daysAgo: number; custIdx: number; skus: number[]; qtys: number[]; notes: string | null }> = [
    { status: 'CONFIRMED', daysAgo: 1, custIdx: 0, skus: [110, 112], qtys: [1, 1], notes: 'Web order #EC-84291. Express delivery requested.' },
    { status: 'ALLOCATED', daysAgo: 2, custIdx: 1, skus: [30, 32, 34], qtys: [1, 1, 1], notes: 'Three denim styles — likely fitting room order (will return 2).' },
    { status: 'PICKING', daysAgo: 1, custIdx: 2, skus: [82, 88], qtys: [1, 1], notes: 'Knitwear order from Japan. Ship from APAC warehouse.' },
    { status: 'PACKED', daysAgo: 2, custIdx: 3, skus: [0, 145], qtys: [1, 1], notes: 'UK order. Outerwear + card holder. Gift note attached.' },
    { status: 'SHIPPED', daysAgo: 4, custIdx: 4, skus: [110, 114, 120], qtys: [2, 1, 1], notes: 'Swedish domestic. Face Collection tees + hoodie.' },
    { status: 'SHIPPED', daysAgo: 6, custIdx: 5, skus: [150, 152, 154], qtys: [1, 1, 1], notes: 'France. Full accessories order — Musubi, Platt, Baker.' },
    { status: 'DELIVERED', daysAgo: 12, custIdx: 6, skus: [165, 170], qtys: [1, 1], notes: 'Korea. Footwear. Delivered successfully.' },
    { status: 'DELIVERED', daysAgo: 14, custIdx: 7, skus: [0, 4, 80, 130], qtys: [1, 1, 1, 1], notes: 'US west coast. Full outfit order. High AOV.' },
    { status: 'RETURNED', daysAgo: 8, custIdx: 8, skus: [30, 32], qtys: [1, 1], notes: 'RETURN: Size exchange — customer ordered wrong size. Return label sent.' },
    { status: 'CONFIRMED', daysAgo: 1, custIdx: 9, skus: [84, 86, 90], qtys: [1, 1, 1], notes: 'Denmark. Knitwear collection.' },
    { status: 'DELIVERED', daysAgo: 18, custIdx: 10, skus: [165, 167, 172], qtys: [1, 1, 1], notes: 'Australia. Three pairs of footwear.' },
    { status: 'SHIPPED', daysAgo: 3, custIdx: 11, skus: [0, 82, 110, 145, 165], qtys: [1, 1, 2, 1, 1], notes: 'China. Large order — head-to-toe Acne Studios.' },
  ];
  for (const ed of ecomData) {
    const cust = ecomCustomers[ed.custIdx % ecomCustomers.length];
    seeds.push({
      channel: 'ECOMMERCE', type: 'STANDARD', status: ed.status,
      daysAgo: ed.daysAgo, lineSkuIndices: ed.skus, quantities: ed.qtys,
      currency: cust.currency, locationIndex: 0, priority: 0,
      customerIndex: ed.custIdx, notes: ed.notes,
    });
  }

  // ── 8 Wholesale SOs ──────────────────────────────────
  const wsData: Array<{ status: SOStatus; daysAgo: number; buyerIdx: number; skus: number[]; qtys: number[]; notes: string | null }> = [
    { status: 'CONFIRMED', daysAgo: 60, buyerIdx: 0, skus: [0, 2, 4, 30, 32, 80, 82, 110, 112, 165], qtys: [15, 12, 20, 40, 35, 18, 22, 50, 45, 10], notes: 'Nordstrom AW26 buy. Full collection selection. Ship by 2026-08-01.' },
    { status: 'ALLOCATED', daysAgo: 55, buyerIdx: 1, skus: [0, 4, 30, 80, 84, 110, 145, 150], qtys: [10, 8, 30, 15, 12, 35, 20, 8], notes: 'Selfridges AW26. Focus on outerwear and denim.' },
    { status: 'CONFIRMED', daysAgo: 50, buyerIdx: 2, skus: [0, 2, 80, 82, 145, 150, 165, 167], qtys: [8, 6, 12, 10, 15, 6, 8, 6], notes: 'Le Bon Marché AW26. Curated selection — premium pieces only.' },
    { status: 'SHIPPED', daysAgo: 45, buyerIdx: 3, skus: [30, 32, 34, 82, 110, 112, 167], qtys: [25, 20, 15, 10, 30, 25, 12], notes: 'Isetan AW26. Shipped from APAC warehouse. DHL Express.' },
    { status: 'DELIVERED', daysAgo: 90, buyerIdx: 4, skus: [110, 112, 114, 130, 145], qtys: [20, 15, 18, 12, 10], notes: 'NK Stockholm SS26 order. Delivered and invoiced.' },
    { status: 'DELIVERED', daysAgo: 85, buyerIdx: 5, skus: [0, 30, 80, 110, 145, 165], qtys: [10, 25, 12, 30, 15, 8], notes: 'KaDeWe AW25 late delivery — wholesale agreement amended.' },
    { status: 'CONFIRMED', daysAgo: 40, buyerIdx: 6, skus: [80, 82, 84, 110, 112, 150], qtys: [8, 6, 10, 20, 15, 12], notes: 'Lane Crawford AW26. Hong Kong + Shanghai distribution.' },
    { status: 'ON_HOLD', daysAgo: 30, buyerIdx: 0, skus: [4, 6, 8, 10], qtys: [12, 10, 8, 15], notes: 'ON HOLD: Nordstrom requested pause — internal buying review. Resume expected week 17.' },
  ];
  for (const wd of wsData) {
    const buyer = wholesaleBuyers[wd.buyerIdx % wholesaleBuyers.length];
    seeds.push({
      channel: 'WHOLESALE', type: 'PRE_ORDER', status: wd.status,
      daysAgo: wd.daysAgo, lineSkuIndices: wd.skus, quantities: wd.qtys,
      currency: buyer.currency, locationIndex: 0, priority: 0,
      wholesaleBuyerIndex: wd.buyerIdx, notes: wd.notes,
    });
  }

  // ── 4 Clienteling SOs (VIC orders) ───────────────────
  const clData: Array<{ status: SOStatus; daysAgo: number; custIdx: number; locIdx: number; skus: number[]; qtys: number[]; notes: string | null; priority: number }> = [
    { status: 'CONFIRMED', daysAgo: 3, custIdx: 3, locIdx: 7, skus: [0, 82, 150], qtys: [1, 1, 1], notes: 'VIC: Yuki Sato (Tokyo Aoyama). Requested Olinda in Camel — not in store stock. Transfer from EU warehouse initiated.', priority: 2 },
    { status: 'ALLOCATED', daysAgo: 5, custIdx: 0, locIdx: 3, skus: [4, 6, 130], qtys: [1, 1, 1], notes: 'VIC: Lena Söderström (Stockholm). Personal shopping appointment. Items reserved.', priority: 2 },
    { status: 'DELIVERED', daysAgo: 14, custIdx: 1, locIdx: 4, skus: [0, 80, 145, 150, 165], qtys: [1, 1, 1, 1, 1], notes: 'VIC: Pierre Moreau (Paris). Full seasonal wardrobe refresh. Hand-delivered to residence.', priority: 2 },
    { status: 'SHIPPED', daysAgo: 7, custIdx: 4, locIdx: 8, skus: [30, 110, 112], qtys: [2, 3, 2], notes: 'VIC: Jin-soo Park (Seoul). Multiple items for fashion editorial shoot. Expedited shipping.', priority: 1 },
  ];
  for (const cl of clData) {
    seeds.push({
      channel: 'CLIENTELING', type: 'STANDARD', status: cl.status,
      daysAgo: cl.daysAgo, lineSkuIndices: cl.skus, quantities: cl.qtys,
      currency: 'SEK', locationIndex: cl.locIdx, priority: cl.priority,
      customerIndex: cl.custIdx, notes: cl.notes,
    });
  }

  // ── 3 Marketplace SOs ───────────────────────────────
  const mpData: Array<{ status: SOStatus; daysAgo: number; platform: string; skus: number[]; qtys: number[]; notes: string | null }> = [
    { status: 'SHIPPED', daysAgo: 5, platform: 'FARFETCH', skus: [0, 30], qtys: [1, 1], notes: 'Farfetch order #FF-9283741. Ship from EU warehouse.' },
    { status: 'DELIVERED', daysAgo: 12, platform: 'SSENSE', skus: [82, 84, 165], qtys: [1, 1, 1], notes: 'SSENSE order. Delivered to Montreal distribution centre.' },
    { status: 'CONFIRMED', daysAgo: 2, platform: 'MYTHERESA', skus: [150, 152], qtys: [1, 1], notes: 'mytheresa.com order. Accessories — Musubi bag.' },
  ];
  for (const mp of mpData) {
    seeds.push({
      channel: 'MARKETPLACE', type: 'STANDARD', status: mp.status,
      daysAgo: mp.daysAgo, lineSkuIndices: mp.skus, quantities: mp.qtys,
      currency: 'EUR', locationIndex: 0, priority: 0,
      notes: mp.notes,
    });
  }

  // ── 2 Replenishment SOs (auto-generated) ────────────
  seeds.push({
    channel: 'RETAIL_STORE', type: 'REPLENISHMENT', status: 'ALLOCATED',
    daysAgo: 1, lineSkuIndices: [30, 32, 34, 110, 112], quantities: [5, 5, 5, 8, 8],
    currency: 'SEK', locationIndex: 3, priority: 0,
    notes: 'AUTO-REPLENISHMENT: Stockholm Norrmalmstorg. Triggered by RFID count — 5 SKUs below reorder point.',
  });
  seeds.push({
    channel: 'RETAIL_STORE', type: 'REPLENISHMENT', status: 'SHIPPED',
    daysAgo: 4, lineSkuIndices: [80, 82, 145, 150], quantities: [3, 3, 5, 3],
    currency: 'EUR', locationIndex: 4, priority: 0,
    notes: 'AUTO-REPLENISHMENT: Paris Rue Saint-Honoré. Knitwear + accessories restock from EU warehouse.',
  });

  // ── 1 Return/Exchange SO ────────────────────────────
  seeds.push({
    channel: 'ECOMMERCE', type: 'EXCHANGE', status: 'CONFIRMED',
    daysAgo: 3, lineSkuIndices: [32], quantities: [1],
    currency: 'EUR', locationIndex: 0, priority: 0,
    customerIndex: 1, notes: 'EXCHANGE: Thomas Weber — wrong size on 1977 Bootcut. Returning 32, requesting 34.',
  });

  return seeds;
}

const channelPrefixes: Record<string, (seed: SOSeed, store: Store) => string> = {
  'RETAIL_STORE': (seed, st) => {
    const loc = st.locations[seed.locationIndex];
    const code = loc?.name.split(' ')[0]?.toUpperCase().slice(0, 5) || 'STHLM';
    return `SO-RT-${code}01`;
  },
  'ECOMMERCE': (_seed, _st) => 'SO-EC-EU',
  'WHOLESALE': (seed, _st) => {
    const buyer = wholesaleBuyers[seed.wholesaleBuyerIndex || 0];
    return `SO-WH-${buyer?.code || 'NORD001'}`;
  },
  'MARKETPLACE': (seed, _st) => {
    return `SO-MP-${marketplacePlatforms[0]}`;
  },
  'CLIENTELING': (seed, st) => {
    const loc = st.locations[seed.locationIndex];
    const code = loc?.name.split(' ')[0]?.toUpperCase().slice(0, 5) || 'STHLM';
    return `SO-CL-${code}01`;
  },
};

const soStatusFlow: SOStatus[] = ['DRAFT', 'CONFIRMED', 'ALLOCATED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'];

export function seedSalesOrders(store: Store): void {
  const seeds = buildSOSeeds();
  const counters: Record<string, number> = {};

  for (const seed of seeds) {
    const prefixFn = channelPrefixes[seed.channel] || channelPrefixes['ECOMMERCE'];
    const prefix = prefixFn(seed, store);
    counters[prefix] = (counters[prefix] || 0) + 1;
    const soNumber = `${prefix}-${String(counters[prefix]).padStart(5, '0')}`;

    const createdAt = daysAgo(seed.daysAgo).toISOString();
    const location = store.locations[seed.locationIndex];

    // Determine creator based on channel
    const creatorRole = seed.channel === 'ECOMMERCE' ? 'ECOM'
      : seed.channel === 'WHOLESALE' ? 'WHOLESALE'
      : seed.channel === 'MARKETPLACE' ? 'ECOM'
      : 'STORE_MGR';
    const creator = store.users.find(u => u.role === creatorRole) || store.users[0];

    // Customer data
    let customerName: string | null = null;
    let customerEmail: string | null = null;
    let shippingCity: string | null = null;
    let shippingCountry: string | null = null;
    let wholesaleBuyerId: string | null = null;

    if (seed.channel === 'RETAIL_STORE' || seed.channel === 'CLIENTELING') {
      const cust = retailCustomers[(seed.customerIndex || 0) % retailCustomers.length];
      customerName = cust.name;
      customerEmail = cust.email;
      shippingCity = cust.city;
      shippingCountry = cust.country;
    } else if (seed.channel === 'ECOMMERCE') {
      const cust = ecomCustomers[(seed.customerIndex || 0) % ecomCustomers.length];
      customerName = cust.name;
      customerEmail = cust.email;
      shippingCity = cust.city;
      shippingCountry = cust.country;
    } else if (seed.channel === 'WHOLESALE') {
      const buyer = wholesaleBuyers[(seed.wholesaleBuyerIndex || 0) % wholesaleBuyers.length];
      customerName = buyer.name;
      customerEmail = buyer.email;
      shippingCity = buyer.city;
      shippingCountry = buyer.country;
      wholesaleBuyerId = `NUORDER-${buyer.code}`;
    }

    const so: SalesOrder = {
      id: generateId(),
      soNumber,
      channel: seed.channel,
      type: seed.type,
      status: seed.status,
      locationId: location.id,
      customerId: generateId(),
      customerName,
      customerEmail,
      wholesaleBuyerId,
      currency: seed.currency,
      subtotal: 0,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: 0,
      shippingAddress: shippingCity ? `${Math.floor(Math.random() * 200) + 1} ${['Main St', 'Rue de la Paix', 'Storgatan', 'High Street', 'Broadway', 'Via Roma'][Math.floor(Math.random() * 6)]}` : null,
      shippingCity,
      shippingCountry,
      requestedShipDate: daysAgo(seed.daysAgo - 3).toISOString(),
      actualShipDate: ['SHIPPED', 'DELIVERED'].includes(seed.status) ? daysAgo(Math.max(0, seed.daysAgo - 5)).toISOString() : null,
      deliveredAt: seed.status === 'DELIVERED' ? daysAgo(Math.max(0, seed.daysAgo - 7)).toISOString() : null,
      notes: seed.notes,
      priority: seed.priority,
      createdById: creator.id,
      createdAt,
      updatedAt: daysAgo(Math.min(seed.daysAgo, 1)).toISOString(),
    };

    // Add lines
    let subtotal = 0;
    for (let li = 0; li < seed.lineSkuIndices.length; li++) {
      const skuIdx = seed.lineSkuIndices[li] % store.skus.length;
      const sku = store.skus[skuIdx];
      const qty = seed.quantities[li] || 1;
      const isWholesale = seed.channel === 'WHOLESALE';
      const unitPrice = isWholesale ? sku.wholesalePrice : sku.retailPrice;
      const discountPercent = isWholesale ? 0 : seed.priority >= 2 ? 10 : Math.random() > 0.85 ? 10 : 0;
      const lineTotal = qty * unitPrice * (1 - discountPercent / 100);
      subtotal += lineTotal;

      const allocated = ['ALLOCATED', 'PICKING', 'PACKED', 'SHIPPED', 'DELIVERED'].includes(seed.status);
      const shipped = ['SHIPPED', 'DELIVERED'].includes(seed.status);

      store.soLines.push({
        id: generateId(),
        salesOrderId: so.id,
        skuId: sku.id,
        quantityOrdered: qty,
        quantityAllocated: allocated ? qty : 0,
        quantityShipped: shipped ? qty : 0,
        quantityReturned: seed.status === 'RETURNED' ? qty : 0,
        unitPrice,
        discountPercent,
        lineTotal,
        notes: null,
        createdAt,
        updatedAt: daysAgo(Math.min(seed.daysAgo, 1)).toISOString(),
      });
    }

    so.subtotal = Math.round(subtotal);
    so.taxAmount = seed.channel === 'WHOLESALE' ? 0 : Math.round(subtotal * 0.25);
    so.discountAmount = seed.priority >= 2 ? Math.round(subtotal * 0.1) : 0;
    so.totalAmount = so.subtotal + so.taxAmount - so.discountAmount;
    store.salesOrders.push(so);

    // Status history
    const statusIdx = soStatusFlow.indexOf(seed.status);
    const effectiveIdx = statusIdx >= 0 ? statusIdx : (seed.status === 'RETURNED' ? 6 : seed.status === 'ON_HOLD' ? 1 : 1);
    for (let si = 0; si <= effectiveIdx; si++) {
      store.soStatusHistory.push({
        id: generateId(),
        salesOrderId: so.id,
        fromStatus: si === 0 ? null : soStatusFlow[si - 1],
        toStatus: soStatusFlow[si],
        changedById: creator.id,
        reason: null,
        changedAt: daysAgo(seed.daysAgo - si * 0.5).toISOString(),
      });
    }

    // Add ON_HOLD status if applicable
    if (seed.status === 'ON_HOLD') {
      store.soStatusHistory.push({
        id: generateId(),
        salesOrderId: so.id,
        fromStatus: 'CONFIRMED',
        toStatus: 'ON_HOLD',
        changedById: creator.id,
        reason: 'Buyer requested hold for internal review',
        changedAt: daysAgo(seed.daysAgo - 2).toISOString(),
      });
    }

    // Shipment records for shipped/delivered
    if (['SHIPPED', 'DELIVERED'].includes(seed.status)) {
      const carriers = ['DHL Express', 'FedEx', 'UPS', 'PostNord', 'DB Schenker', 'Yamato Transport'];
      store.shipments.push({
        id: generateId(),
        salesOrderId: so.id,
        trackingNumber: `${['DHL', 'FDX', 'UPS', 'PN', 'DBS', 'YMT'][Math.floor(Math.random() * 6)]}${Math.floor(Math.random() * 9000000000) + 1000000000}`,
        carrier: carriers[Math.floor(Math.random() * carriers.length)],
        shippedAt: so.actualShipDate,
        deliveredAt: so.deliveredAt,
        createdAt: so.actualShipDate || createdAt,
      });
    }
  }

  // Set sequence counters
  for (const [prefix, count] of Object.entries(counters)) {
    setSequence(prefix, count);
  }
}
