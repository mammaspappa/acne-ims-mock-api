import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { generateId } from '../../utils/id.js';
import { now, daysAgo } from '../../utils/date.js';
import { nextSequence } from '../../utils/number-sequence.js';
import type { SalesOrder, SOLine, SOStatusHistory } from '../../store/types.js';

// ─── IN-MEMORY BASKET STORE ───────────────────────────

interface BasketItem {
  product_id: string;
  quantity: number;
  product_name: string;
  price: number;
  _type: string;
}

interface Basket {
  basket_id: string;
  currency: string;
  product_items: BasketItem[];
  order_total: number;
  _type: string;
  created_at: string;
}

const baskets = new Map<string, Basket>();
let basketsSeeded = false;

function seedBaskets(): void {
  if (basketsSeeded) return;
  basketsSeeded = true;

  // Pre-seed 12 baskets simulating abandoned carts and active shopping sessions
  const currencies = ['USD', 'USD', 'USD', 'EUR', 'USD', 'GBP', 'USD', 'EUR', 'USD', 'USD', 'USD', 'EUR'];
  const basketStatuses = [
    'abandoned', 'abandoned', 'active', 'active', 'abandoned', 'active',
    'abandoned', 'active', 'active', 'abandoned', 'active', 'abandoned',
  ];

  for (let i = 0; i < 12; i++) {
    const basketId = generateId();
    const currency = currencies[i];
    const itemCount = 2 + Math.floor(Math.random() * 3); // 2-4 items per basket
    const productItems: BasketItem[] = [];

    // Pick random products for this basket
    const shuffled = [...store.products].sort(() => Math.random() - 0.5);
    for (let j = 0; j < Math.min(itemCount, shuffled.length); j++) {
      const product = shuffled[j];
      const skus = store.findByField(store.skus, 'productId', product.id);
      const price = skus.length > 0 ? skus[0].retailPrice : 0;
      productItems.push({
        product_id: product.styleNumber,
        quantity: Math.floor(Math.random() * 2) + 1,
        product_name: product.name,
        price,
        _type: 'product_item',
      });
    }

    const orderTotal = productItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const createdAt = daysAgo(Math.floor(Math.random() * 5) + 1);

    baskets.set(basketId, {
      basket_id: basketId,
      currency,
      product_items: productItems,
      order_total: orderTotal,
      _type: 'basket',
      created_at: createdAt.toISOString(),
    });
  }
}

// ─── HELPERS ──────────────────────────────────────────

function sfccProduct(product: typeof store.products[0]) {
  const skus = store.findByField(store.skus, 'productId', product.id);
  const images = store.findByField(store.productImages, 'productId', product.id);
  const primaryImage = images.find(i => i.isPrimary) || images[0];

  // SFCC serves the US site — approximate USD by dividing SEK retail by 10
  const usdPrice = skus.length > 0 ? Math.round(skus[0].retailPrice / 10 * 100) / 100 : 0;

  return {
    _type: 'product',
    id: product.styleNumber,
    name: product.name,
    brand: 'Acne Studios',
    price: usdPrice,
    currency: 'USD',
    product_type: product.category === 'Accessories' ? 'accessory' : 'apparel',
    image: primaryImage?.url || null,
    primary_category_id: product.category,
    page_description: product.description,
    c_gender: product.gender,
    c_season: `${product.season}${product.seasonYear}`,
    c_style_number: product.styleNumber,
    c_collection: product.collection,
    c_is_carry_over: product.isCarryOver,
    c_isCarryOver: product.isCarryOver,
    c_subCategory: product.subCategory || null,
    variants: skus.map(sku => ({
      _type: 'variant',
      product_id: product.styleNumber,
      variation_values: {
        color: sku.colourCode,
        size: sku.size,
      },
      price: Math.round(sku.retailPrice / 10 * 100) / 100,
      orderable: sku.isActive,
      c_sku_id: sku.id,
      c_sku_code: sku.sku,
      c_barcode: sku.barcode,
      c_colour_name: sku.colour,
    })),
  };
}

function sfccList<T>(data: T[], total: number, type: string) {
  return {
    _type: type,
    count: data.length,
    total,
    data,
  };
}

function sfccOrder(so: SalesOrder) {
  const lines = store.findByField(store.soLines, 'salesOrderId', so.id) as SOLine[];
  return {
    _type: 'order',
    order_no: so.soNumber,
    order_id: so.id,
    status: so.status.toLowerCase(),
    currency: so.currency,
    order_total: so.totalAmount,
    tax_total: so.taxAmount,
    product_sub_total: so.subtotal,
    discount_total: so.discountAmount,
    customer_info: {
      _type: 'customer_info',
      customer_id: so.customerId,
      customer_name: so.customerName,
      email: so.customerEmail,
    },
    shipping_address: so.shippingAddress ? {
      _type: 'order_address',
      address1: so.shippingAddress,
      city: so.shippingCity,
      country_code: so.shippingCountry,
    } : null,
    product_items: lines.map(line => {
      const sku = store.findById(store.skus, line.skuId);
      const product = sku ? store.findById(store.products, sku.productId) : undefined;
      return {
        _type: 'product_item',
        product_id: product?.styleNumber || line.skuId,
        product_name: product?.name || 'Unknown',
        quantity: line.quantityOrdered,
        price: line.unitPrice,
        item_text: sku ? `${sku.colour} / ${sku.size}` : '',
        c_sku_id: line.skuId,
      };
    }),
    created_date: so.createdAt,
    last_modified: so.updatedAt,
  };
}

// ─── HANDLERS ─────────────────────────────────────────

// GET /products/:productId
export async function getProductHandler(
  request: FastifyRequest<{ Params: { productId: string } }>,
  reply: FastifyReply,
) {
  const { productId } = request.params;
  // Look up by style number (SFCC uses style number as product ID)
  const product = store.products.find(p => p.styleNumber === productId);
  if (!product) {
    return reply.status(404).send({
      _type: 'fault',
      type: 'ProductNotFoundException',
      message: `No product with ID '${productId}' found.`,
    });
  }
  return reply.send(sfccProduct(product));
}

// GET /products (search)
export async function searchProductsHandler(
  request: FastifyRequest<{
    Querystring: {
      q?: string;
      categoryId?: string;
      limit?: string;
      offset?: string;
      sort?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const { q, categoryId, limit: limitStr, offset: offsetStr, sort } = request.query;
  const limit = parseInt(limitStr || '100', 10);
  const offset = parseInt(offsetStr || '0', 10);

  let products = [...store.products];

  if (q) {
    const query = q.toLowerCase();
    products = products.filter(
      p =>
        p.name.toLowerCase().includes(query) ||
        p.styleNumber.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)),
    );
  }

  if (categoryId) {
    products = products.filter(p => p.category === categoryId || p.subCategory === categoryId);
  }

  if (sort) {
    const [field, dir] = sort.split('-');
    const ascending = dir !== 'desc';
    products.sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[field === 'price' ? 'costPrice' : 'name'];
      const bVal = (b as unknown as Record<string, unknown>)[field === 'price' ? 'costPrice' : 'name'];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return ascending ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return ascending ? aVal - bVal : bVal - aVal;
      }
      return 0;
    });
  }

  const total = products.length;
  const hits = products.slice(offset, offset + limit).map(p => {
    const pSkus = store.findByField(store.skus, 'productId', p.id);
    const sekPrice = pSkus[0]?.retailPrice || 0;
    return {
      _type: 'product_search_hit',
      hit_type: 'product',
      product_id: p.styleNumber,
      product_name: p.name,
      price: Math.round(sekPrice / 10 * 100) / 100,
      currency: 'USD',
      product_type: p.category === 'Accessories' ? 'accessory' : 'apparel',
      brand: 'Acne Studios',
      c_collection: p.collection,
      c_season: `${p.season}${p.seasonYear}`,
      c_isCarryOver: p.isCarryOver,
      c_subCategory: p.subCategory || null,
      image: store.findByField(store.productImages, 'productId', p.id).find(i => i.isPrimary)?.url || null,
      c_category: p.category,
      c_gender: p.gender,
      variants: pSkus.map(sku => ({
        _type: 'variant',
        product_id: p.styleNumber,
        variation_values: { color: sku.colourCode, size: sku.size },
        price: Math.round(sku.retailPrice / 10 * 100) / 100,
        orderable: sku.isActive,
      })),
    };
  });

  return reply.send({
    _type: 'product_search_result',
    count: hits.length,
    total,
    hits,
    query: q || '',
    offset,
    limit,
  });
}

// GET /categories/:categoryId
export async function getCategoryHandler(
  request: FastifyRequest<{ Params: { categoryId: string } }>,
  reply: FastifyReply,
) {
  const { categoryId } = request.params;

  // Derive categories from products
  const allCategories = deriveCategories();
  const cat = allCategories.find(c => c.id === categoryId);

  if (!cat) {
    return reply.status(404).send({
      _type: 'fault',
      type: 'CategoryNotFoundException',
      message: `No category with ID '${categoryId}' found.`,
    });
  }

  return reply.send(cat);
}

// GET /categories
export async function listCategoriesHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const categories = deriveCategories();
  return reply.send(sfccList(categories, categories.length, 'category_result'));
}

function deriveCategories() {
  const categoryMap = new Map<string, Set<string>>();

  for (const product of store.products) {
    if (!categoryMap.has(product.category)) {
      categoryMap.set(product.category, new Set());
    }
    if (product.subCategory) {
      categoryMap.get(product.category)!.add(product.subCategory);
    }
  }

  const categories: Array<{
    _type: string;
    id: string;
    name: string;
    parent_category_id: string | null;
    categories: Array<{ _type: string; id: string; name: string; parent_category_id: string }>;
  }> = [];

  for (const [cat, subs] of categoryMap) {
    const subCategories = Array.from(subs).map(sub => ({
      _type: 'category',
      id: sub,
      name: sub.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      parent_category_id: cat,
    }));

    categories.push({
      _type: 'category',
      id: cat,
      name: cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      parent_category_id: null,
      categories: subCategories,
    });
  }

  return categories;
}

// GET /baskets — list all baskets (active + abandoned)
export async function listBasketsHandler(
  request: FastifyRequest<{ Querystring: { limit?: string; offset?: string } }>,
  reply: FastifyReply,
) {
  seedBaskets();
  const { limit: limitStr, offset: offsetStr } = request.query;
  const limit = parseInt(limitStr || '50', 10);
  const offset = parseInt(offsetStr || '0', 10);

  const allBaskets = Array.from(baskets.values());
  allBaskets.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = allBaskets.length;
  const data = allBaskets.slice(offset, offset + limit);

  return reply.send(sfccList(data, total, 'basket_result'));
}

// POST /baskets
export async function createBasketHandler(
  request: FastifyRequest<{ Body: { currency?: string } }>,
  reply: FastifyReply,
) {
  seedBaskets();
  const { currency = 'EUR' } = request.body || {};
  const basketId = generateId();
  const basket: Basket = {
    basket_id: basketId,
    currency,
    product_items: [],
    order_total: 0,
    _type: 'basket',
    created_at: now().toISOString(),
  };
  baskets.set(basketId, basket);
  return reply.status(201).send(basket);
}

// POST /baskets/:basketId/items
export async function addBasketItemHandler(
  request: FastifyRequest<{
    Params: { basketId: string };
    Body: { productId: string; quantity?: number };
  }>,
  reply: FastifyReply,
) {
  seedBaskets();
  const { basketId } = request.params;
  const basket = baskets.get(basketId);
  if (!basket) {
    return reply.status(404).send({
      _type: 'fault',
      type: 'BasketNotFoundException',
      message: `No basket with ID '${basketId}' found.`,
    });
  }

  const { productId, quantity = 1 } = request.body;

  // Look up by style number
  const product = store.products.find(p => p.styleNumber === productId);
  if (!product) {
    return reply.status(404).send({
      _type: 'fault',
      type: 'ProductNotFoundException',
      message: `No product with ID '${productId}' found.`,
    });
  }

  const skus = store.findByField(store.skus, 'productId', product.id);
  const price = skus.length > 0 ? skus[0].retailPrice : 0;

  // Check if item already in basket
  const existing = basket.product_items.find(i => i.product_id === productId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    basket.product_items.push({
      product_id: productId,
      quantity,
      product_name: product.name,
      price,
      _type: 'product_item',
    });
  }

  basket.order_total = basket.product_items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return reply.send(basket);
}

// GET /baskets/:basketId
export async function getBasketHandler(
  request: FastifyRequest<{ Params: { basketId: string } }>,
  reply: FastifyReply,
) {
  seedBaskets();
  const { basketId } = request.params;
  const basket = baskets.get(basketId);
  if (!basket) {
    return reply.status(404).send({
      _type: 'fault',
      type: 'BasketNotFoundException',
      message: `No basket with ID '${basketId}' found.`,
    });
  }
  return reply.send(basket);
}

// POST /orders — create order from basket
export async function createOrderHandler(
  request: FastifyRequest<{ Body: { basketId: string } }>,
  reply: FastifyReply,
) {
  const { basketId } = request.body;
  const basket = baskets.get(basketId);
  if (!basket) {
    return reply.status(404).send({
      _type: 'fault',
      type: 'BasketNotFoundException',
      message: `No basket with ID '${basketId}' found.`,
    });
  }

  if (basket.product_items.length === 0) {
    return reply.status(400).send({
      _type: 'fault',
      type: 'InvalidBasketException',
      message: 'Cannot create order from empty basket.',
    });
  }

  const soId = generateId();
  const soNumber = nextSequence('SO-EC-WEB', 5);
  const subtotal = basket.order_total;
  const taxAmount = Math.round(subtotal * 0.25 * 100) / 100;

  const salesOrder: SalesOrder = {
    id: soId,
    soNumber,
    channel: 'ECOMMERCE',
    type: 'STANDARD',
    status: 'CONFIRMED',
    locationId: null,
    customerId: generateId(),
    customerName: 'SFCC Web Customer',
    customerEmail: 'webshop@acnestudios.com',
    wholesaleBuyerId: null,
    currency: basket.currency as SalesOrder['currency'],
    subtotal,
    taxAmount,
    discountAmount: 0,
    totalAmount: subtotal + taxAmount,
    shippingAddress: null,
    shippingCity: null,
    shippingCountry: null,
    requestedShipDate: null,
    actualShipDate: null,
    deliveredAt: null,
    notes: `Created from SFCC basket ${basketId}`,
    priority: 5,
    createdById: store.users[0]?.id || generateId(),
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
  };

  store.insert(store.salesOrders, salesOrder);

  // Create SO lines
  for (const item of basket.product_items) {
    const product = store.products.find(p => p.styleNumber === item.product_id);
    if (!product) continue;
    const skus = store.findByField(store.skus, 'productId', product.id);
    const sku = skus[0];
    if (!sku) continue;

    const soLine: SOLine = {
      id: generateId(),
      salesOrderId: soId,
      skuId: sku.id,
      quantityOrdered: item.quantity,
      quantityAllocated: 0,
      quantityShipped: 0,
      quantityReturned: 0,
      unitPrice: item.price,
      discountPercent: 0,
      lineTotal: item.price * item.quantity,
      notes: null,
      createdAt: now().toISOString(),
      updatedAt: now().toISOString(),
    };
    store.insert(store.soLines, soLine);
  }

  // Add status history
  const historyEntry: SOStatusHistory = {
    id: generateId(),
    salesOrderId: soId,
    fromStatus: null,
    toStatus: 'CONFIRMED',
    changedById: salesOrder.createdById,
    reason: 'Order placed via SFCC',
    changedAt: now().toISOString(),
  };
  store.insert(store.soStatusHistory, historyEntry);

  // Remove basket after order creation
  baskets.delete(basketId);

  return reply.status(201).send(sfccOrder(salesOrder));
}

// GET /orders — list all e-commerce orders in SFCC format
export async function listOrdersHandler(
  request: FastifyRequest<{
    Querystring: {
      status?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply,
) {
  const { status, limit: limitStr, offset: offsetStr } = request.query;
  const limit = parseInt(limitStr || '50', 10);
  const offset = parseInt(offsetStr || '0', 10);

  // Return e-commerce SOs mapped to SFCC format
  let ecomOrders = store.salesOrders.filter(so => so.channel === 'ECOMMERCE');

  if (status) {
    ecomOrders = ecomOrders.filter(so => so.status.toLowerCase() === status.toLowerCase());
  }

  ecomOrders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = ecomOrders.length;
  const data = ecomOrders.slice(offset, offset + limit).map(so => sfccOrder(so));

  return reply.send({
    _type: 'order_search_result',
    count: data.length,
    total,
    data,
    offset,
    limit,
  });
}

// GET /orders/:orderId
export async function getOrderHandler(
  request: FastifyRequest<{ Params: { orderId: string } }>,
  reply: FastifyReply,
) {
  const { orderId } = request.params;

  // Try by ID first, then by soNumber
  let so = store.findById(store.salesOrders, orderId);
  if (!so) {
    so = store.salesOrders.find(s => s.soNumber === orderId);
  }

  if (!so) {
    return reply.status(404).send({
      _type: 'fault',
      type: 'OrderNotFoundException',
      message: `No order with ID '${orderId}' found.`,
    });
  }

  return reply.send(sfccOrder(so));
}
