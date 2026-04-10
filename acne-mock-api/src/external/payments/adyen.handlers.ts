import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { daysAgo, now } from '../../utils/date.js';

// ─── Types ────────────────────────────────────────────

type AdyenResultCode =
  | 'Authorised'
  | 'Refused'
  | 'Cancelled'
  | 'Error'
  | 'Pending'
  | 'RedirectShopper';

type AdyenPaymentStatus =
  | 'authorised'
  | 'captured'
  | 'partially_captured'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled';

interface AdyenAmount {
  value: number;
  currency: string;
}

interface AdyenPaymentEvent {
  type: string;
  status: string;
  timestamp: string;
  pspReference: string;
  amount?: AdyenAmount;
}

interface AdyenPaymentRecord {
  pspReference: string;
  merchantAccount: string;
  merchantReference: string;
  amount: AdyenAmount;
  capturedAmount: AdyenAmount;
  refundedAmount: AdyenAmount;
  status: AdyenPaymentStatus;
  paymentMethod: { type: string; brand?: string };
  resultCode: AdyenResultCode;
  shopperReference: string | null;
  shopperEmail: string | null;
  shopperName: { firstName: string; lastName: string } | null;
  shopperLocale: string | null;
  countryCode: string | null;
  returnUrl: string | null;
  captures: Array<{
    pspReference: string;
    amount: AdyenAmount;
    status: string;
    createdAt: string;
  }>;
  refunds: Array<{
    pspReference: string;
    amount: AdyenAmount;
    status: string;
    createdAt: string;
  }>;
  cancellation: {
    pspReference: string;
    status: string;
    createdAt: string;
  } | null;
  events: AdyenPaymentEvent[];
  createdAt: string;
  updatedAt: string;
}

// ─── In-memory store ──────────────────────────────────

const adyenPayments: AdyenPaymentRecord[] = [];
let seeded = false;

function randomHex(len: number): string {
  const chars = '0123456789ABCDEF';
  let s = '';
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function genPspRef(): string {
  return `MOCK_PSP_${randomHex(16)}`;
}

// ─── Seed ─────────────────────────────────────────────

export function seedAdyenData(): void {
  if (seeded) return;
  seeded = true;
  adyenPayments.length = 0;

  // Find delivered/shipped ecommerce and retail SOs to seed historical payments
  const eligibleSOs = store.salesOrders.filter(
    so =>
      ['SHIPPED', 'DELIVERED', 'RETURNED'].includes(so.status) &&
      ['ECOMMERCE', 'RETAIL_STORE', 'MARKETPLACE', 'CLIENTELING'].includes(so.channel)
  );

  const paymentTypes = [
    { type: 'scheme', brand: 'visa' },
    { type: 'scheme', brand: 'mastercard' },
    { type: 'scheme', brand: 'amex' },
    { type: 'klarna_paynow', brand: undefined },
    { type: 'scheme', brand: 'visa' },
    { type: 'ideal', brand: undefined },
    { type: 'swish', brand: undefined },
    { type: 'scheme', brand: 'mastercard' },
    { type: 'scheme', brand: 'visa' },
    { type: 'klarna_account', brand: undefined },
    { type: 'scheme', brand: 'amex' },
    { type: 'scheme', brand: 'visa' },
    { type: 'swish', brand: undefined },
    { type: 'scheme', brand: 'mastercard' },
    { type: 'ideal', brand: undefined },
  ];

  const statuses: AdyenPaymentStatus[] = [
    'captured', 'captured', 'captured', 'refunded',
    'captured', 'captured', 'authorised', 'captured',
    'partially_refunded', 'captured', 'captured', 'refunded',
    'captured', 'authorised', 'captured',
  ];

  for (let i = 0; i < Math.min(eligibleSOs.length, 15); i++) {
    const so = eligibleSOs[i];
    const pmtType = paymentTypes[i % paymentTypes.length];
    const status = statuses[i % statuses.length];
    const pspRef = genPspRef();
    const daysOffset = 30 - i * 3;

    // Adyen amounts are in minor units (cents/ore)
    const minorMultiplier = ['JPY', 'KRW'].includes(so.currency) ? 1 : 100;
    const amountValue = Math.round(so.totalAmount * minorMultiplier);

    // Derive shopper details from the sales order
    const countryCode = so.shippingCountry || 'SE';
    const localeMap: Record<string, string> = {
      SE: 'sv_SE', US: 'en_US', GB: 'en_GB', DE: 'de_DE', FR: 'fr_FR',
      NL: 'nl_NL', IT: 'it_IT', ES: 'es_ES', NO: 'nb_NO', DK: 'da_DK',
      FI: 'fi_FI', JP: 'ja_JP', KR: 'ko_KR', CN: 'zh_CN',
    };
    const nameParts = (so.customerName || 'Web Customer').split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // Build events array showing status transitions
    const events: AdyenPaymentEvent[] = [
      { type: 'AUTHORISATION', status: 'success', timestamp: daysAgo(daysOffset).toISOString(), pspReference: pspRef, amount: { value: amountValue, currency: so.currency } },
    ];
    if (['captured', 'refunded', 'partially_refunded', 'partially_captured'].includes(status)) {
      events.push({ type: 'CAPTURE', status: 'success', timestamp: daysAgo(daysOffset - 1).toISOString(), pspReference: genPspRef(), amount: { value: amountValue, currency: so.currency } });
    }
    if (['captured', 'refunded', 'partially_refunded'].includes(status)) {
      events.push({ type: 'SETTLED', status: 'success', timestamp: daysAgo(daysOffset - 2).toISOString(), pspReference: pspRef });
    }
    if (status === 'refunded') {
      events.push({ type: 'REFUND', status: 'success', timestamp: daysAgo(daysOffset - 3).toISOString(), pspReference: genPspRef(), amount: { value: amountValue, currency: so.currency } });
    }

    const record: AdyenPaymentRecord = {
      pspReference: pspRef,
      merchantAccount: 'AcneStudios_MOCK',
      merchantReference: so.soNumber,
      amount: { value: amountValue, currency: so.currency },
      capturedAmount: ['captured', 'refunded', 'partially_refunded', 'partially_captured'].includes(status)
        ? { value: amountValue, currency: so.currency }
        : { value: 0, currency: so.currency },
      refundedAmount: status === 'refunded'
        ? { value: amountValue, currency: so.currency }
        : { value: 0, currency: so.currency },
      status,
      paymentMethod: { type: pmtType.type, brand: pmtType.brand },
      resultCode: 'Authorised',
      shopperReference: so.customerEmail || so.customerId || null,
      shopperEmail: so.customerEmail || null,
      shopperName: { firstName, lastName },
      shopperLocale: localeMap[countryCode] || 'en_US',
      countryCode,
      returnUrl: `https://acnestudios.mock/checkout/result?ref=${so.soNumber}`,
      captures: ['captured', 'refunded', 'partially_refunded'].includes(status) ? [{
        pspReference: genPspRef(),
        amount: { value: amountValue, currency: so.currency },
        status: 'received',
        createdAt: daysAgo(daysOffset - 1).toISOString(),
      }] : [],
      refunds: status === 'refunded' ? [{
        pspReference: genPspRef(),
        amount: { value: amountValue, currency: so.currency },
        status: 'received',
        createdAt: daysAgo(daysOffset - 3).toISOString(),
      }] : [],
      cancellation: null,
      events,
      createdAt: daysAgo(daysOffset).toISOString(),
      updatedAt: now().toISOString(),
    };

    adyenPayments.push(record);
  }
}

// ─── Handlers ─────────────────────────────────────────

// POST /paymentMethods
export async function getPaymentMethods(
  request: FastifyRequest<{
    Body: {
      merchantAccount?: string;
      countryCode?: string;
      amount?: AdyenAmount;
    };
  }>,
  reply: FastifyReply
) {
  seedAdyenData();

  const country = request.body?.countryCode || 'SE';

  const methods = [
    { name: 'Credit Card', type: 'scheme', brands: ['visa', 'mastercard', 'amex'] },
  ];

  // Add region-specific methods
  if (['SE', 'FI', 'NO', 'DK'].includes(country)) {
    methods.push({ name: 'Swish', type: 'swish', brands: [] });
    methods.push({ name: 'Klarna — Pay now', type: 'klarna_paynow', brands: [] });
    methods.push({ name: 'Klarna — Pay later', type: 'klarna', brands: [] });
    methods.push({ name: 'Klarna — Slice it', type: 'klarna_account', brands: [] });
  } else if (['NL'].includes(country)) {
    methods.push({ name: 'iDEAL', type: 'ideal', brands: [] });
    methods.push({ name: 'Klarna — Pay later', type: 'klarna', brands: [] });
  } else if (['DE', 'AT'].includes(country)) {
    methods.push({ name: 'Klarna — Pay later', type: 'klarna', brands: [] });
    methods.push({ name: 'Klarna — Slice it', type: 'klarna_account', brands: [] });
  } else {
    methods.push({ name: 'Klarna — Pay later', type: 'klarna', brands: [] });
  }

  return reply.send({ paymentMethods: methods });
}

// POST /payments
export async function createPayment(
  request: FastifyRequest<{
    Body: {
      amount: AdyenAmount;
      reference?: string;
      merchantAccount?: string;
      paymentMethod?: { type: string; brand?: string };
      returnUrl?: string;
      shopperReference?: string;
    };
  }>,
  reply: FastifyReply
) {
  seedAdyenData();
  const body = request.body;

  const pspRef = genPspRef();
  const record: AdyenPaymentRecord = {
    pspReference: pspRef,
    merchantAccount: body.merchantAccount || 'AcneStudios_MOCK',
    merchantReference: body.reference || `REF_${randomHex(8)}`,
    amount: body.amount,
    capturedAmount: { value: 0, currency: body.amount.currency },
    refundedAmount: { value: 0, currency: body.amount.currency },
    status: 'authorised',
    paymentMethod: body.paymentMethod || { type: 'scheme' },
    resultCode: 'Authorised',
    shopperReference: body.shopperReference || null,
    shopperEmail: (body as any).shopperEmail || null,
    shopperName: (body as any).shopperName || null,
    shopperLocale: (body as any).shopperLocale || null,
    countryCode: (body as any).countryCode || null,
    returnUrl: body.returnUrl || null,
    captures: [],
    refunds: [],
    cancellation: null,
    events: [
      { type: 'AUTHORISATION', status: 'success', timestamp: now().toISOString(), pspReference: pspRef, amount: body.amount },
    ],
    createdAt: now().toISOString(),
    updatedAt: now().toISOString(),
  };

  adyenPayments.push(record);

  return reply.send({
    pspReference: pspRef,
    resultCode: 'Authorised' as AdyenResultCode,
    merchantReference: record.merchantReference,
    amount: body.amount,
    additionalData: {
      cardBin: '411111',
      cardSummary: '1111',
      expiryDate: '03/2030',
      paymentMethod: body.paymentMethod?.type || 'scheme',
      authorisedAmountValue: String(body.amount.value),
      authorisedAmountCurrency: body.amount.currency,
    },
  });
}

// POST /payments/:pspReference/captures
export async function capturePayment(
  request: FastifyRequest<{
    Params: { pspReference: string };
    Body: {
      amount: AdyenAmount;
      merchantAccount?: string;
    };
  }>,
  reply: FastifyReply
) {
  seedAdyenData();
  const record = adyenPayments.find(p => p.pspReference === request.params.pspReference);
  if (!record) {
    return reply.status(422).send({
      status: 422,
      errorCode: '167',
      message: 'Original pspReference required for this operation',
      errorType: 'validation',
    });
  }

  if (record.status !== 'authorised' && record.status !== 'partially_captured') {
    return reply.status(422).send({
      status: 422,
      errorCode: '168',
      message: `Payment cannot be captured in status: ${record.status}`,
      errorType: 'validation',
    });
  }

  const captureRef = genPspRef();
  const captureAmount = request.body.amount;

  record.captures.push({
    pspReference: captureRef,
    amount: captureAmount,
    status: 'received',
    createdAt: now().toISOString(),
  });

  record.capturedAmount = {
    value: record.capturedAmount.value + captureAmount.value,
    currency: captureAmount.currency,
  };

  record.status = record.capturedAmount.value >= record.amount.value ? 'captured' : 'partially_captured';
  record.updatedAt = now().toISOString();

  return reply.send({
    pspReference: captureRef,
    status: 'received',
    paymentPspReference: record.pspReference,
    amount: captureAmount,
    merchantAccount: request.body.merchantAccount || record.merchantAccount,
  });
}

// POST /payments/:pspReference/refunds
export async function refundPayment(
  request: FastifyRequest<{
    Params: { pspReference: string };
    Body: {
      amount: AdyenAmount;
      merchantAccount?: string;
    };
  }>,
  reply: FastifyReply
) {
  seedAdyenData();
  const record = adyenPayments.find(p => p.pspReference === request.params.pspReference);
  if (!record) {
    return reply.status(422).send({
      status: 422,
      errorCode: '167',
      message: 'Original pspReference required for this operation',
      errorType: 'validation',
    });
  }

  if (record.status !== 'captured' && record.status !== 'partially_refunded') {
    return reply.status(422).send({
      status: 422,
      errorCode: '171',
      message: `Payment cannot be refunded in status: ${record.status}`,
      errorType: 'validation',
    });
  }

  const refundRef = genPspRef();
  const refundAmount = request.body.amount;

  record.refunds.push({
    pspReference: refundRef,
    amount: refundAmount,
    status: 'received',
    createdAt: now().toISOString(),
  });

  record.refundedAmount = {
    value: record.refundedAmount.value + refundAmount.value,
    currency: refundAmount.currency,
  };

  record.status = record.refundedAmount.value >= record.capturedAmount.value ? 'refunded' : 'partially_refunded';
  record.updatedAt = now().toISOString();

  return reply.send({
    pspReference: refundRef,
    status: 'received',
    paymentPspReference: record.pspReference,
    amount: refundAmount,
    merchantAccount: request.body.merchantAccount || record.merchantAccount,
  });
}

// POST /payments/:pspReference/cancels
export async function cancelPayment(
  request: FastifyRequest<{
    Params: { pspReference: string };
    Body: {
      merchantAccount?: string;
    };
  }>,
  reply: FastifyReply
) {
  seedAdyenData();
  const record = adyenPayments.find(p => p.pspReference === request.params.pspReference);
  if (!record) {
    return reply.status(422).send({
      status: 422,
      errorCode: '167',
      message: 'Original pspReference required for this operation',
      errorType: 'validation',
    });
  }

  if (record.status !== 'authorised') {
    return reply.status(422).send({
      status: 422,
      errorCode: '169',
      message: `Payment cannot be cancelled in status: ${record.status}`,
      errorType: 'validation',
    });
  }

  const cancelRef = genPspRef();
  record.cancellation = {
    pspReference: cancelRef,
    status: 'received',
    createdAt: now().toISOString(),
  };
  record.status = 'cancelled';
  record.updatedAt = now().toISOString();

  return reply.send({
    pspReference: cancelRef,
    status: 'received',
    paymentPspReference: record.pspReference,
    merchantAccount: request.body?.merchantAccount || record.merchantAccount,
  });
}

// GET /payments — list all payment records
export async function listPayments(
  request: FastifyRequest<{
    Querystring: {
      status?: string;
      merchantReference?: string;
      limit?: string;
      offset?: string;
    };
  }>,
  reply: FastifyReply
) {
  seedAdyenData();
  const { status, merchantReference, limit: limitStr, offset: offsetStr } = request.query;
  const limit = Math.min(100, Math.max(1, parseInt(limitStr || '50', 10)));
  const offset = Math.max(0, parseInt(offsetStr || '0', 10));

  let records = [...adyenPayments];

  if (status) {
    records = records.filter(r => r.status === status);
  }
  if (merchantReference) {
    records = records.filter(r => r.merchantReference === merchantReference);
  }

  // Sort by createdAt desc
  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const total = records.length;
  const data = records.slice(offset, offset + limit).map(r => ({
    pspReference: r.pspReference,
    merchantAccount: r.merchantAccount,
    merchantReference: r.merchantReference,
    amount: r.amount,
    capturedAmount: r.capturedAmount,
    refundedAmount: r.refundedAmount,
    status: r.status,
    paymentMethod: r.paymentMethod,
    resultCode: r.resultCode,
    shopperReference: r.shopperReference,
    shopperEmail: r.shopperEmail,
    shopperName: r.shopperName,
    shopperLocale: r.shopperLocale,
    countryCode: r.countryCode,
    events: r.events,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  return reply.send({ data, pagination: { offset, limit, total } });
}

// GET /payments/:pspReference
export async function getPaymentDetails(
  request: FastifyRequest<{ Params: { pspReference: string } }>,
  reply: FastifyReply
) {
  seedAdyenData();
  const record = adyenPayments.find(p => p.pspReference === request.params.pspReference);
  if (!record) {
    return reply.status(422).send({
      status: 422,
      errorCode: '167',
      message: 'Original pspReference not found',
      errorType: 'validation',
    });
  }

  return reply.send({
    pspReference: record.pspReference,
    merchantAccount: record.merchantAccount,
    merchantReference: record.merchantReference,
    amount: record.amount,
    capturedAmount: record.capturedAmount,
    refundedAmount: record.refundedAmount,
    status: record.status,
    paymentMethod: record.paymentMethod,
    resultCode: record.resultCode,
    shopperReference: record.shopperReference,
    shopperEmail: record.shopperEmail,
    shopperName: record.shopperName,
    shopperLocale: record.shopperLocale,
    countryCode: record.countryCode,
    captures: record.captures,
    refunds: record.refunds,
    cancellation: record.cancellation,
    events: record.events,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
