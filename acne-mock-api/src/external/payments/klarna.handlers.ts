import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { daysAgo, now } from '../../utils/date.js';

// ─── Types (snake_case per Klarna convention) ─────────

interface KlarnaOrderLine {
  name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  reference?: string;
  image_url?: string | null;
  product_url?: string | null;
  product_identifiers?: {
    brand: string;
    category_path: string;
    global_trade_item_number?: string;
    manufacturer_part_number?: string;
  } | null;
}

interface KlarnaSession {
  session_id: string;
  client_token: string;
  status: 'complete' | 'incomplete' | 'expired';
  purchase_country: string;
  purchase_currency: string;
  locale: string;
  order_amount: number;
  order_lines: KlarnaOrderLine[];
  payment_method_categories: Array<{
    identifier: string;
    name: string;
  }>;
  authorization_token: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

interface KlarnaCapture {
  capture_id: string;
  captured_amount: number;
  captured_at: string;
  description: string | null;
}

interface KlarnaRefund {
  refund_id: string;
  refunded_amount: number;
  refunded_at: string;
  description: string | null;
}

interface KlarnaAddress {
  given_name: string;
  family_name: string;
  email: string;
  street_address: string;
  postal_code: string;
  city: string;
  country: string;
  phone?: string;
}

interface KlarnaOrder {
  order_id: string;
  authorization_token: string;
  status: 'AUTHORIZED' | 'PART_CAPTURED' | 'CAPTURED' | 'PART_REFUNDED' | 'REFUNDED' | 'CANCELLED';
  fraud_status: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  purchase_country: string;
  purchase_currency: string;
  order_amount: number;
  captured_amount: number;
  refunded_amount: number;
  order_lines: KlarnaOrderLine[];
  shipping_address: KlarnaAddress | null;
  billing_address: KlarnaAddress | null;
  captures: KlarnaCapture[];
  refunds: KlarnaRefund[];
  created_at: string;
  updated_at: string;
  expires_at: string;
}

// ─── In-memory stores ─────────────────────────────────

const sessions: KlarnaSession[] = [];
const orders: KlarnaOrder[] = [];
let seeded = false;

function randomHex(len: number): string {
  const chars = '0123456789abcdef';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function generateSessionId(): string {
  return `ks_${randomHex(24)}`;
}

function generateClientToken(): string {
  // Mimics a base64-ish token
  return `eyJ${randomHex(32)}`;
}

function generateAuthToken(): string {
  return `ka_${randomHex(32)}`;
}

function generateOrderId(): string {
  return `KO-${randomHex(8).toUpperCase()}`;
}

function generateCaptureId(): string {
  return `kc_${randomHex(16)}`;
}

function generateRefundId(): string {
  return `kr_${randomHex(16)}`;
}

// Country code to Klarna locale mapping
function getLocale(countryCode: string): string {
  const map: Record<string, string> = {
    SE: 'sv-SE', FI: 'fi-FI', NO: 'nb-NO', DK: 'da-DK',
    DE: 'de-DE', AT: 'de-AT', NL: 'nl-NL', GB: 'en-GB',
    US: 'en-US', FR: 'fr-FR', IT: 'it-IT', ES: 'es-ES',
  };
  return map[countryCode] || 'en-US';
}

// ─── Seed ─────────────────────────────────────────────

export function seedKlarnaData(): void {
  if (seeded) return;
  seeded = true;
  sessions.length = 0;
  orders.length = 0;

  // Find e-commerce SOs for Klarna orders — include all statuses that represent
  // a completed checkout (everything except DRAFT and CANCELLED)
  const eligibleSOs = store.salesOrders.filter(
    so =>
      so.channel === 'ECOMMERCE' &&
      !['DRAFT', 'CANCELLED'].includes(so.status)
  );

  const klarnaStatuses: KlarnaOrder['status'][] = [
    'CAPTURED', 'CAPTURED', 'AUTHORIZED', 'CAPTURED', 'PART_CAPTURED',
    'CAPTURED', 'PART_REFUNDED', 'REFUNDED', 'CAPTURED', 'CAPTURED',
  ];

  for (let i = 0; i < Math.min(eligibleSOs.length, 10); i++) {
    const so = eligibleSOs[i];
    const soLines = store.findByField(store.soLines, 'salesOrderId', so.id);
    const country = so.shippingCountry || 'SE';
    const locale = getLocale(country);
    const daysOffset = 20 - i * 3;

    // Minor units
    const minorMultiplier = ['JPY', 'KRW'].includes(so.currency) ? 1 : 100;
    const orderAmount = Math.round(so.totalAmount * minorMultiplier);

    const orderLines: KlarnaOrderLine[] = soLines.map(sl => {
      const sku = store.findById(store.skus, sl.skuId);
      const product = sku ? store.findById(store.products, sku.productId) : null;
      const images = product ? store.findByField(store.productImages, 'productId', product.id) : [];
      const primaryImage = images.find(img => img.isPrimary) || images[0];
      return {
        name: product ? `${product.name} — ${sku?.colour} ${sku?.size}` : 'Product',
        quantity: sl.quantityOrdered,
        unit_price: Math.round(sl.unitPrice * minorMultiplier),
        total_amount: Math.round(sl.lineTotal * minorMultiplier),
        reference: sku?.sku || undefined,
        image_url: primaryImage?.url || null,
        product_url: product ? `https://acnestudios.mock/shop/${product.styleNumber}` : null,
        product_identifiers: product ? {
          brand: 'Acne Studios',
          category_path: `${product.gender} > ${product.category}${product.subCategory ? ' > ' + product.subCategory : ''}`,
          global_trade_item_number: sku?.barcode || undefined,
          manufacturer_part_number: product.styleNumber,
        } : null,
      };
    });

    const authToken = generateAuthToken();
    const status = klarnaStatuses[i] || 'CAPTURED';

    const capturedAmount = ['CAPTURED', 'PART_REFUNDED', 'REFUNDED'].includes(status) ? orderAmount
      : status === 'PART_CAPTURED' ? Math.round(orderAmount * 0.6) : 0;

    const refundedAmount = status === 'REFUNDED' ? orderAmount
      : status === 'PART_REFUNDED' ? Math.round(orderAmount * 0.3) : 0;

    // Create corresponding session
    const sessionId = generateSessionId();
    const session: KlarnaSession = {
      session_id: sessionId,
      client_token: generateClientToken(),
      status: 'complete',
      purchase_country: country,
      purchase_currency: so.currency,
      locale,
      order_amount: orderAmount,
      order_lines: orderLines,
      payment_method_categories: [
        { identifier: 'pay_later', name: 'Pay later' },
        { identifier: 'pay_over_time', name: 'Financing' },
      ],
      authorization_token: authToken,
      expires_at: daysAgo(daysOffset - 2).toISOString(), // already expired — historical
      created_at: daysAgo(daysOffset).toISOString(),
      updated_at: daysAgo(daysOffset - 1).toISOString(),
    };
    sessions.push(session);

    // Build addresses from the sales order
    const nameParts = (so.customerName || 'Web Customer').split(' ');
    const givenName = nameParts[0];
    const familyName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';
    const shippingAddr: KlarnaAddress | null = so.shippingAddress ? {
      given_name: givenName,
      family_name: familyName,
      email: so.customerEmail || 'customer@acnestudios.mock',
      street_address: so.shippingAddress,
      postal_code: country === 'SE' ? '11436' : country === 'US' ? '10001' : country === 'GB' ? 'W1D 3DF' : '10115',
      city: so.shippingCity || 'Stockholm',
      country,
      phone: '+46701234567',
    } : null;
    const billingAddr: KlarnaAddress | null = shippingAddr ? { ...shippingAddr } : null;

    // Create order
    const orderId = generateOrderId();
    const order: KlarnaOrder = {
      order_id: orderId,
      authorization_token: authToken,
      status,
      fraud_status: 'ACCEPTED',
      purchase_country: country,
      purchase_currency: so.currency,
      order_amount: orderAmount,
      captured_amount: capturedAmount,
      refunded_amount: refundedAmount,
      order_lines: orderLines,
      shipping_address: shippingAddr,
      billing_address: billingAddr,
      captures: capturedAmount > 0 ? [{
        capture_id: generateCaptureId(),
        captured_amount: capturedAmount,
        captured_at: daysAgo(daysOffset - 2).toISOString(),
        description: `Capture for ${so.soNumber}`,
      }] : [],
      refunds: refundedAmount > 0 ? [{
        refund_id: generateRefundId(),
        refunded_amount: refundedAmount,
        refunded_at: daysAgo(daysOffset - 4).toISOString(),
        description: status === 'REFUNDED' ? 'Full refund — customer return' : 'Partial refund — damaged item',
      }] : [],
      created_at: daysAgo(daysOffset - 1).toISOString(),
      updated_at: now().toISOString(),
      expires_at: daysAgo(daysOffset - 30).toISOString(),
    };
    orders.push(order);
  }
}

// ─── Handlers ─────────────────────────────────────────

// POST /sessions
export async function createSession(
  request: FastifyRequest<{
    Body: {
      purchase_country: string;
      purchase_currency: string;
      locale?: string;
      order_amount: number;
      order_lines: KlarnaOrderLine[];
    };
  }>,
  reply: FastifyReply
) {
  seedKlarnaData();
  const body = request.body;

  const sessionId = generateSessionId();
  const authToken = generateAuthToken();
  const expiresAt = new Date(now().getTime() + 48 * 60 * 60 * 1000); // 48h

  const session: KlarnaSession = {
    session_id: sessionId,
    client_token: generateClientToken(),
    status: 'incomplete',
    purchase_country: body.purchase_country,
    purchase_currency: body.purchase_currency,
    locale: body.locale || getLocale(body.purchase_country),
    order_amount: body.order_amount,
    order_lines: body.order_lines || [],
    payment_method_categories: [
      { identifier: 'pay_later', name: 'Pay later' },
      { identifier: 'pay_over_time', name: 'Financing' },
    ],
    authorization_token: authToken,
    expires_at: expiresAt.toISOString(),
    created_at: now().toISOString(),
    updated_at: now().toISOString(),
  };

  sessions.push(session);

  return reply.send({
    session_id: session.session_id,
    client_token: session.client_token,
    payment_method_categories: session.payment_method_categories,
  });
}

// GET /sessions/:sessionId
export async function getSession(
  request: FastifyRequest<{ Params: { sessionId: string } }>,
  reply: FastifyReply
) {
  seedKlarnaData();
  const session = sessions.find(s => s.session_id === request.params.sessionId);
  if (!session) {
    return reply.status(404).send({
      error_code: 'NOT_FOUND',
      error_messages: ['Session not found'],
      correlation_id: randomHex(16),
    });
  }

  // Check expiry
  if (new Date(session.expires_at) < now() && session.status === 'incomplete') {
    session.status = 'expired';
  }

  return reply.send(session);
}

// PUT /sessions/:sessionId
export async function updateSession(
  request: FastifyRequest<{
    Params: { sessionId: string };
    Body: {
      order_amount?: number;
      order_lines?: KlarnaOrderLine[];
      purchase_currency?: string;
    };
  }>,
  reply: FastifyReply
) {
  seedKlarnaData();
  const session = sessions.find(s => s.session_id === request.params.sessionId);
  if (!session) {
    return reply.status(404).send({
      error_code: 'NOT_FOUND',
      error_messages: ['Session not found'],
      correlation_id: randomHex(16),
    });
  }

  if (session.status === 'expired') {
    return reply.status(400).send({
      error_code: 'SESSION_EXPIRED',
      error_messages: ['Session has expired. Create a new session.'],
      correlation_id: randomHex(16),
    });
  }

  const body = request.body;
  if (body.order_amount !== undefined) session.order_amount = body.order_amount;
  if (body.order_lines) session.order_lines = body.order_lines;
  if (body.purchase_currency) session.purchase_currency = body.purchase_currency;
  session.updated_at = now().toISOString();

  return reply.send(session);
}

// POST /authorizations/:authorizationToken/order
export async function createOrderFromAuth(
  request: FastifyRequest<{
    Params: { authorizationToken: string };
    Body: {
      purchase_country: string;
      purchase_currency: string;
      order_amount: number;
      order_lines: KlarnaOrderLine[];
    };
  }>,
  reply: FastifyReply
) {
  seedKlarnaData();

  // Find session by auth token
  const session = sessions.find(s => s.authorization_token === request.params.authorizationToken);
  if (!session) {
    // Accept any token for mock purposes
  }

  const body = request.body;
  const orderId = generateOrderId();

  const order: KlarnaOrder = {
    order_id: orderId,
    authorization_token: request.params.authorizationToken,
    status: 'AUTHORIZED',
    fraud_status: 'ACCEPTED',
    purchase_country: body.purchase_country,
    purchase_currency: body.purchase_currency,
    order_amount: body.order_amount,
    captured_amount: 0,
    refunded_amount: 0,
    order_lines: body.order_lines || [],
    shipping_address: (body as any).shipping_address || null,
    billing_address: (body as any).billing_address || null,
    captures: [],
    refunds: [],
    created_at: now().toISOString(),
    updated_at: now().toISOString(),
    expires_at: new Date(now().getTime() + 28 * 24 * 60 * 60 * 1000).toISOString(), // 28 days
  };

  orders.push(order);

  if (session) {
    session.status = 'complete';
    session.updated_at = now().toISOString();
  }

  return reply.send({
    order_id: orderId,
    fraud_status: 'ACCEPTED',
    redirect_url: `https://acnestudios.mock/checkout/klarna/confirmation?order_id=${orderId}`,
  });
}

// GET /orders — list all Klarna orders
export async function listOrders(
  request: FastifyRequest<{
    Querystring: {
      status?: string;
      purchase_country?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply
) {
  seedKlarnaData();
  const { status, purchase_country, limit: limitStr, offset: offsetStr } = request.query;
  const limit = Math.min(100, Math.max(1, parseInt(limitStr || '50', 10)));
  const offset = Math.max(0, parseInt(offsetStr || '0', 10));

  let filtered = [...orders];

  if (status) {
    filtered = filtered.filter(o => o.status === status);
  }
  if (purchase_country) {
    filtered = filtered.filter(o => o.purchase_country === purchase_country);
  }

  filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const total = filtered.length;
  const data = filtered.slice(offset, offset + limit);

  return reply.send({
    orders: data,
    pagination: { offset, limit, total },
  });
}

// GET /orders/:orderId
export async function getOrder(
  request: FastifyRequest<{ Params: { orderId: string } }>,
  reply: FastifyReply
) {
  seedKlarnaData();
  const order = orders.find(o => o.order_id === request.params.orderId);
  if (!order) {
    return reply.status(404).send({
      error_code: 'NOT_FOUND',
      error_messages: ['Order not found'],
      correlation_id: randomHex(16),
    });
  }
  return reply.send(order);
}

// POST /orders/:orderId/captures
export async function captureOrder(
  request: FastifyRequest<{
    Params: { orderId: string };
    Body: {
      captured_amount: number;
      description?: string;
    };
  }>,
  reply: FastifyReply
) {
  seedKlarnaData();
  const order = orders.find(o => o.order_id === request.params.orderId);
  if (!order) {
    return reply.status(404).send({
      error_code: 'NOT_FOUND',
      error_messages: ['Order not found'],
      correlation_id: randomHex(16),
    });
  }

  if (order.status !== 'AUTHORIZED' && order.status !== 'PART_CAPTURED') {
    return reply.status(400).send({
      error_code: 'BAD_VALUE',
      error_messages: [`Cannot capture order in status: ${order.status}`],
      correlation_id: randomHex(16),
    });
  }

  const captureAmount = request.body.captured_amount;
  const captureId = generateCaptureId();

  order.captures.push({
    capture_id: captureId,
    captured_amount: captureAmount,
    captured_at: now().toISOString(),
    description: request.body.description || null,
  });

  order.captured_amount += captureAmount;
  order.status = order.captured_amount >= order.order_amount ? 'CAPTURED' : 'PART_CAPTURED';
  order.updated_at = now().toISOString();

  return reply.status(201).send({
    capture_id: captureId,
    captured_amount: captureAmount,
    captured_at: now().toISOString(),
  });
}

// POST /orders/:orderId/refunds
export async function refundOrder(
  request: FastifyRequest<{
    Params: { orderId: string };
    Body: {
      refunded_amount: number;
      description?: string;
    };
  }>,
  reply: FastifyReply
) {
  seedKlarnaData();
  const order = orders.find(o => o.order_id === request.params.orderId);
  if (!order) {
    return reply.status(404).send({
      error_code: 'NOT_FOUND',
      error_messages: ['Order not found'],
      correlation_id: randomHex(16),
    });
  }

  if (order.status !== 'CAPTURED' && order.status !== 'PART_CAPTURED' && order.status !== 'PART_REFUNDED') {
    return reply.status(400).send({
      error_code: 'BAD_VALUE',
      error_messages: [`Cannot refund order in status: ${order.status}`],
      correlation_id: randomHex(16),
    });
  }

  const refundAmount = request.body.refunded_amount;
  if (refundAmount > order.captured_amount - order.refunded_amount) {
    return reply.status(400).send({
      error_code: 'BAD_VALUE',
      error_messages: ['Refund amount exceeds captured amount minus already refunded'],
      correlation_id: randomHex(16),
    });
  }

  const refundId = generateRefundId();

  order.refunds.push({
    refund_id: refundId,
    refunded_amount: refundAmount,
    refunded_at: now().toISOString(),
    description: request.body.description || null,
  });

  order.refunded_amount += refundAmount;
  order.status = order.refunded_amount >= order.captured_amount ? 'REFUNDED' : 'PART_REFUNDED';
  order.updated_at = now().toISOString();

  return reply.status(201).send({
    refund_id: refundId,
    refunded_amount: refundAmount,
    refunded_at: now().toISOString(),
  });
}
