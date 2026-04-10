import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';
import { nextSequence } from '../../utils/number-sequence.js';

// ─── Helpers ────────────────────────────────────────────

type NuOrderStatus = 'new' | 'processing' | 'shipped' | 'cancelled';

function mapSOStatusToNuOrder(status: string): NuOrderStatus {
  switch (status) {
    case 'DRAFT':
    case 'CONFIRMED':
      return 'new';
    case 'ALLOCATED':
    case 'PICKING':
    case 'PACKED':
      return 'processing';
    case 'SHIPPED':
    case 'PARTIALLY_SHIPPED':
    case 'DELIVERED':
      return 'shipped';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'new';
  }
}

function mapNuOrderStatusToSO(status: NuOrderStatus): string {
  switch (status) {
    case 'new':
      return 'CONFIRMED';
    case 'processing':
      return 'ALLOCATED';
    case 'shipped':
      return 'SHIPPED';
    case 'cancelled':
      return 'CANCELLED';
    default:
      return 'CONFIRMED';
  }
}

function buildBuyerCode(customerName: string): string {
  return customerName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
}

function buildOrderResponse(so: typeof store.salesOrders[0]) {
  const lines = store.soLines.filter(l => l.salesOrderId === so.id);
  const lineItems = lines.map(line => {
    const sku = store.findById(store.skus, line.skuId);
    const product = sku ? store.findById(store.products, sku.productId) : null;
    return {
      line_id: line.id,
      sku: sku?.sku ?? null,
      style_number: product?.styleNumber ?? null,
      style_name: product?.name ?? null,
      colour: sku?.colour ?? null,
      colour_code: sku?.colourCode ?? null,
      size: sku?.size ?? null,
      quantity: line.quantityOrdered,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
      discount_percent: line.discountPercent,
    };
  });

  return {
    order_id: so.id,
    order_number: so.soNumber,
    order_date: so.createdAt,
    status: mapSOStatusToNuOrder(so.status),
    buyer: so.customerName,
    buyer_code: so.customerName ? buildBuyerCode(so.customerName) : null,
    buyer_email: so.customerEmail,
    wholesale_buyer_id: so.wholesaleBuyerId,
    currency: so.currency,
    subtotal: so.subtotal,
    tax_amount: so.taxAmount,
    discount_amount: so.discountAmount,
    total_amount: so.totalAmount,
    ship_to: {
      address: so.shippingAddress,
      city: so.shippingCity,
      country: so.shippingCountry,
    },
    requested_ship_date: so.requestedShipDate,
    actual_ship_date: so.actualShipDate,
    notes: so.notes,
    line_items: lineItems,
    created_at: so.createdAt,
    updated_at: so.updatedAt,
  };
}

// ─── GET /orders ────────────────────────────────────────

export async function listOrders(
  request: FastifyRequest<{
    Querystring: { status?: NuOrderStatus; buyer_code?: string; limit?: string };
  }>,
  reply: FastifyReply,
) {
  const { status, buyer_code, limit: limitStr } = request.query;
  const limit = Math.min(100, Math.max(1, parseInt(limitStr || '50', 10)));

  let orders = store.salesOrders.filter(so => so.channel === 'WHOLESALE');

  if (status) {
    orders = orders.filter(so => mapSOStatusToNuOrder(so.status) === status);
  }

  if (buyer_code) {
    orders = orders.filter(so =>
      so.customerName && buildBuyerCode(so.customerName) === buyer_code.toUpperCase(),
    );
  }

  const results = orders.slice(0, limit).map(buildOrderResponse);
  return reply.send(results);
}

// ─── GET /orders/:id ────────────────────────────────────

export async function getOrder(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const so = store.salesOrders.find(
    s => s.id === request.params.id && s.channel === 'WHOLESALE',
  );
  if (!so) {
    return reply.status(404).send({ error: 'Order not found' });
  }

  return reply.send(buildOrderResponse(so));
}

// ─── POST /orders ───────────────────────────────────────

export async function createOrder(
  request: FastifyRequest<{
    Body: {
      buyer: { name: string; code: string; email: string };
      items: Array<{ sku: string; quantity: number }>;
      ship_to: { address: string; city: string; country: string };
    };
  }>,
  reply: FastifyReply,
) {
  const { buyer, items, ship_to } = request.body;

  const creator = store.users.find(u => u.role === 'WHOLESALE') || store.users[0];
  const soNumber = nextSequence(`SO-WH-${buyer.code || 'NUORD'}`, 5);
  const ts = now().toISOString();

  const so = {
    id: generateId(),
    soNumber,
    channel: 'WHOLESALE' as const,
    type: 'PRE_ORDER' as const,
    status: 'CONFIRMED' as const,
    locationId: store.locations[0].id,
    customerId: generateId(),
    customerName: buyer.name,
    customerEmail: buyer.email,
    wholesaleBuyerId: `NUORDER-${buyer.code}`,
    currency: 'EUR' as const,
    subtotal: 0,
    taxAmount: 0,
    discountAmount: 0,
    totalAmount: 0,
    shippingAddress: ship_to.address,
    shippingCity: ship_to.city,
    shippingCountry: ship_to.country,
    requestedShipDate: null,
    actualShipDate: null,
    deliveredAt: null,
    notes: `Created via NuORDER B2B platform`,
    priority: 0,
    createdById: creator.id,
    createdAt: ts,
    updatedAt: ts,
  };

  let subtotal = 0;

  for (const item of items) {
    const sku = store.skus.find(s => s.sku === item.sku);
    if (!sku) continue;

    const unitPrice = sku.wholesalePrice;
    const lineTotal = item.quantity * unitPrice;
    subtotal += lineTotal;

    store.soLines.push({
      id: generateId(),
      salesOrderId: so.id,
      skuId: sku.id,
      quantityOrdered: item.quantity,
      quantityAllocated: 0,
      quantityShipped: 0,
      quantityReturned: 0,
      unitPrice,
      discountPercent: 0,
      lineTotal,
      notes: null,
      createdAt: ts,
      updatedAt: ts,
    });
  }

  so.subtotal = Math.round(subtotal);
  so.totalAmount = so.subtotal;

  store.salesOrders.push(so);

  store.soStatusHistory.push({
    id: generateId(),
    salesOrderId: so.id,
    fromStatus: null,
    toStatus: 'CONFIRMED',
    changedById: creator.id,
    reason: 'Created via NuORDER',
    changedAt: ts,
  });

  return reply.status(201).send(buildOrderResponse(so));
}

// ─── PUT /orders/:id/status ─────────────────────────────

export async function updateOrderStatus(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { status: NuOrderStatus };
  }>,
  reply: FastifyReply,
) {
  const so = store.salesOrders.find(
    s => s.id === request.params.id && s.channel === 'WHOLESALE',
  );
  if (!so) {
    return reply.status(404).send({ error: 'Order not found' });
  }

  const newStatus = mapNuOrderStatusToSO(request.body.status);
  const oldStatus = so.status;

  so.status = newStatus as typeof so.status;
  so.updatedAt = now().toISOString();

  store.soStatusHistory.push({
    id: generateId(),
    salesOrderId: so.id,
    fromStatus: oldStatus,
    toStatus: so.status,
    changedById: store.users[0].id,
    reason: `Status updated via NuORDER to ${request.body.status}`,
    changedAt: now().toISOString(),
  });

  return reply.send(buildOrderResponse(so));
}

// ─── GET /line-sheets ───────────────────────────────────

export async function listLineSheets(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const seasonYears = new Map<string, typeof store.products[0][]>();

  for (const p of store.products) {
    const key = `${p.season}${p.seasonYear}`;
    if (!seasonYears.has(key)) seasonYears.set(key, []);
    seasonYears.get(key)!.push(p);
  }

  const lineSheets = Array.from(seasonYears.entries()).map(([key, products]) => ({
    season_year: key,
    season: products[0].season,
    year: products[0].seasonYear,
    style_count: products.length,
    categories: [...new Set(products.map(p => p.category))],
    status: 'PUBLISHED',
  }));

  return reply.send(lineSheets);
}

// ─── GET /line-sheets/:seasonYear ───────────────────────

export async function getLineSheet(
  request: FastifyRequest<{ Params: { seasonYear: string } }>,
  reply: FastifyReply,
) {
  const { seasonYear } = request.params;
  // parse e.g. "AW2026" => season=AW, year=2026
  const seasonMatch = seasonYear.match(/^([A-Z_]+)(\d{4})$/);
  if (!seasonMatch) {
    return reply.status(400).send({ error: 'Invalid seasonYear format. Expected e.g. AW2026' });
  }
  const [, season, yearStr] = seasonMatch;
  const year = parseInt(yearStr, 10);

  const products = store.products.filter(
    p => p.season === season && p.seasonYear === year,
  );

  if (products.length === 0) {
    return reply.status(404).send({ error: 'Line sheet not found' });
  }

  const items = products.map((p, idx) => {
    const skus = store.skus.filter(s => s.productId === p.id);
    const colors = [...new Set(skus.map(s => ({ code: s.colourCode, name: s.colour })))];
    const sizes = [...new Set(skus.map(s => s.size))];
    const images = store.productImages.filter(i => i.productId === p.id);

    // Generate seeded sell-through data
    const rng = seededRandomNu(p.id.charCodeAt(0) + idx * 37);
    const sellThrough = {
      units_sold: Math.floor(rng() * 500) + 50,
      units_shipped: Math.floor(rng() * 600) + 100,
      sell_through_pct: Math.round((40 + rng() * 55) * 10) / 10,
      weeks_of_sale: Math.floor(rng() * 20) + 4,
      top_accounts: [
        { account: 'Nordstrom', sell_through_pct: Math.round((50 + rng() * 40) * 10) / 10 },
        { account: 'Selfridges', sell_through_pct: Math.round((45 + rng() * 45) * 10) / 10 },
        { account: 'Ssense', sell_through_pct: Math.round((55 + rng() * 35) * 10) / 10 },
      ],
    };

    return {
      style_number: p.styleNumber,
      name: p.name,
      category: p.category,
      sub_category: p.subCategory,
      gender: p.gender,
      wholesale_price: skus[0]?.wholesalePrice ?? 0,
      retail_price: skus[0]?.retailPrice ?? 0,
      price_currency: skus[0]?.priceCurrency ?? 'SEK',
      colors: colors.filter((c, i, arr) => arr.findIndex(x => x.code === c.code) === i),
      sizes,
      is_carry_over: p.isCarryOver,
      collection: p.collection,
      images: images.map(i => ({ url: i.url, is_primary: i.isPrimary })),
      sell_through_data: sellThrough,
    };
  });

  return reply.send({
    season_year: seasonYear,
    season,
    year,
    status: 'PUBLISHED',
    style_count: products.length,
    items,
  });
}

// ─── GET /products ──────────────────────────────────────

export async function listProducts(
  request: FastifyRequest<{
    Querystring: { season?: string; category?: string; limit?: string };
  }>,
  reply: FastifyReply,
) {
  const { season, category, limit: limitStr } = request.query;
  const limit = Math.min(200, Math.max(1, parseInt(limitStr || '100', 10)));

  let products = store.products;

  if (season) {
    products = products.filter(p => `${p.season}${p.seasonYear}` === season || p.season === season);
  }

  if (category) {
    products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  const results = products.slice(0, limit).map(p => {
    const skus = store.skus.filter(s => s.productId === p.id);
    return {
      style_number: p.styleNumber,
      name: p.name,
      category: p.category,
      sub_category: p.subCategory,
      gender: p.gender,
      season: `${p.season}${p.seasonYear}`,
      collection: p.collection,
      wholesale_price: skus[0]?.wholesalePrice ?? 0,
      retail_price: skus[0]?.retailPrice ?? 0,
      price_currency: skus[0]?.priceCurrency ?? 'SEK',
      size_run: [...new Set(skus.map(s => s.size))],
      color_count: new Set(skus.map(s => s.colourCode)).size,
      is_carry_over: p.isCarryOver,
    };
  });

  return reply.send(results);
}

// ─── GET /products/:styleNumber ─────────────────────────

export async function getProduct(
  request: FastifyRequest<{ Params: { styleNumber: string } }>,
  reply: FastifyReply,
) {
  const product = store.products.find(p => p.styleNumber === request.params.styleNumber);
  if (!product) {
    return reply.status(404).send({ error: 'Product not found' });
  }

  const skus = store.skus.filter(s => s.productId === product.id);
  const images = store.productImages.filter(i => i.productId === product.id);

  const colorOptions = new Map<string, { code: string; name: string; sizes: string[] }>();
  for (const sku of skus) {
    if (!colorOptions.has(sku.colourCode)) {
      colorOptions.set(sku.colourCode, { code: sku.colourCode, name: sku.colour, sizes: [] });
    }
    colorOptions.get(sku.colourCode)!.sizes.push(sku.size);
  }

  return reply.send({
    style_number: product.styleNumber,
    name: product.name,
    category: product.category,
    sub_category: product.subCategory,
    gender: product.gender,
    season: `${product.season}${product.seasonYear}`,
    collection: product.collection,
    description: product.description,
    wholesale_price: skus[0]?.wholesalePrice ?? 0,
    retail_price: skus[0]?.retailPrice ?? 0,
    cost_price: product.costPrice,
    price_currency: skus[0]?.priceCurrency ?? 'SEK',
    is_carry_over: product.isCarryOver,
    color_options: Array.from(colorOptions.values()),
    size_run: [...new Set(skus.map(s => s.size))],
    images: images.map(i => ({ url: i.url, is_primary: i.isPrimary, alt_text: i.altText })),
  });
}

function seededRandomNu(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateBuyerHistory(companyCode: string, totalSpend: number) {
  const rng = seededRandomNu(companyCode.charCodeAt(0) + companyCode.charCodeAt(1) * 256);
  const seasons = ['AW2025', 'SS2025', 'AW2024', 'SS2024'];
  return seasons.map(season => {
    const factor = 0.6 + rng() * 0.8;
    return {
      season,
      order_total: Math.round(totalSpend * factor),
      order_count: 1 + Math.floor(rng() * 4),
      currency: 'EUR',
    };
  });
}

function generateAppointments(companyCode: string) {
  const rng = seededRandomNu(companyCode.charCodeAt(0) * 100 + companyCode.charCodeAt(2));
  const shows = [
    { name: 'Paris Fashion Week Showroom', city: 'Paris', date: '2026-03-02' },
    { name: 'Copenhagen Fashion Week', city: 'Copenhagen', date: '2026-01-28' },
    { name: 'Pitti Uomo', city: 'Florence', date: '2026-01-13' },
    { name: 'Project New York', city: 'New York', date: '2026-01-22' },
    { name: 'London Fashion Week Mens', city: 'London', date: '2026-01-10' },
  ];
  const count = 1 + Math.floor(rng() * 3);
  const selected: typeof shows = [];
  for (let i = 0; i < count && i < shows.length; i++) {
    const idx = Math.floor(rng() * shows.length);
    const show = shows[idx];
    if (!selected.find(s => s.name === show.name)) {
      selected.push(show);
    }
  }
  return selected.map(show => ({
    trade_show: show.name,
    city: show.city,
    date: show.date,
    time_slot: `${10 + Math.floor(rng() * 6)}:00`,
    status: rng() > 0.3 ? 'confirmed' : 'pending',
    buyer_notes: rng() > 0.5 ? 'Interested in outerwear and denim' : null,
  }));
}

// ─── GET /companies ─────────────────────────────────────

export async function listCompanies(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const wholesaleOrders = store.salesOrders.filter(so => so.channel === 'WHOLESALE');

  // Group by buyer
  const buyerMap = new Map<string, { name: string; email: string | null; city: string | null; country: string | null; orderCount: number; totalSpend: number }>();

  for (const so of wholesaleOrders) {
    const key = so.customerName || 'Unknown';
    if (!buyerMap.has(key)) {
      buyerMap.set(key, {
        name: key,
        email: so.customerEmail,
        city: so.shippingCity,
        country: so.shippingCountry,
        orderCount: 0,
        totalSpend: 0,
      });
    }
    const entry = buyerMap.get(key)!;
    entry.orderCount++;
    entry.totalSpend += so.totalAmount;
  }

  const companies = Array.from(buyerMap.entries()).map(([name, data]) => {
    const code = buildBuyerCode(name);
    return {
      company_code: code,
      company_name: data.name,
      contact_email: data.email,
      city: data.city,
      country: data.country,
      order_count: data.orderCount,
      total_spend: data.totalSpend,
      status: 'ACTIVE',
      buyer_history: generateBuyerHistory(code, data.totalSpend),
      appointments: generateAppointments(code),
    };
  });

  return reply.send(companies);
}

// ─── GET /companies/:code ───────────────────────────────

export async function getCompany(
  request: FastifyRequest<{ Params: { code: string } }>,
  reply: FastifyReply,
) {
  const code = request.params.code.toUpperCase();

  const wholesaleOrders = store.salesOrders.filter(
    so => so.channel === 'WHOLESALE' && so.customerName && buildBuyerCode(so.customerName) === code,
  );

  if (wholesaleOrders.length === 0) {
    return reply.status(404).send({ error: 'Company not found' });
  }

  const firstOrder = wholesaleOrders[0];
  const orderHistory = wholesaleOrders.map(so => ({
    order_id: so.id,
    order_number: so.soNumber,
    order_date: so.createdAt,
    status: mapSOStatusToNuOrder(so.status),
    total_amount: so.totalAmount,
    currency: so.currency,
  }));

  const totalSpend = wholesaleOrders.reduce((s, o) => s + o.totalAmount, 0);

  return reply.send({
    company_code: code,
    company_name: firstOrder.customerName,
    contact_email: firstOrder.customerEmail,
    city: firstOrder.shippingCity,
    country: firstOrder.shippingCountry,
    wholesale_buyer_id: firstOrder.wholesaleBuyerId,
    order_count: wholesaleOrders.length,
    total_spend: totalSpend,
    status: 'ACTIVE',
    buyer_history: generateBuyerHistory(code, totalSpend),
    appointments: generateAppointments(code),
    order_history: orderHistory,
  });
}
