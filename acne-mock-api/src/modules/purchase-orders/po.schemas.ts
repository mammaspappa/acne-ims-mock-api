// ─── Shared property definitions ───────────────────────

const poStatusEnum = [
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT_TO_SUPPLIER',
  'CONFIRMED_BY_SUPPLIER', 'IN_PRODUCTION', 'SHIPPED',
  'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'CANCELLED',
];

const seasonEnum = ['SS', 'AW', 'RESORT', 'PRE_FALL', 'CAPSULE'];

const currencyEnum = [
  'SEK', 'EUR', 'USD', 'GBP', 'JPY', 'CNY', 'KRW', 'AUD', 'CAD', 'SGD', 'HKD',
];

const poProperties = {
  id: { type: 'string' },
  poNumber: { type: 'string' },
  supplierId: { type: 'string' },
  season: { type: 'string', enum: seasonEnum },
  seasonYear: { type: 'number' },
  status: { type: 'string', enum: poStatusEnum },
  currency: { type: 'string', enum: currencyEnum },
  totalAmount: { type: 'number' },
  expectedDelivery: { type: ['string', 'null'] },
  actualDelivery: { type: ['string', 'null'] },
  deliveryLocationId: { type: ['string', 'null'] },
  shippingTerms: { type: ['string', 'null'] },
  paymentTerms: { type: ['string', 'null'] },
  notes: { type: ['string', 'null'] },
  createdById: { type: 'string' },
  approvedById: { type: ['string', 'null'] },
  approvedAt: { type: ['string', 'null'] },
  sentToSupplierAt: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

const poLineProperties = {
  id: { type: 'string' },
  purchaseOrderId: { type: 'string' },
  skuId: { type: 'string' },
  quantityOrdered: { type: 'number' },
  quantityReceived: { type: 'number' },
  unitCost: { type: 'number' },
  lineTotal: { type: 'number' },
  expectedDate: { type: ['string', 'null'] },
  notes: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

const poReceiptProperties = {
  id: { type: 'string' },
  poLineId: { type: 'string' },
  quantityReceived: { type: 'number' },
  receivedAt: { type: 'string' },
  receivedById: { type: 'string' },
  locationId: { type: 'string' },
  qualityStatus: { type: 'string' },
  damagedQuantity: { type: 'number' },
  notes: { type: ['string', 'null'] },
} as const;

const poStatusHistoryProperties = {
  id: { type: 'string' },
  purchaseOrderId: { type: 'string' },
  fromStatus: { type: ['string', 'null'] },
  toStatus: { type: 'string', enum: poStatusEnum },
  changedById: { type: 'string' },
  reason: { type: ['string', 'null'] },
  changedAt: { type: 'string' },
} as const;

const paginationProperties = {
  page: { type: 'number' },
  limit: { type: 'number' },
  total: { type: 'number' },
  totalPages: { type: 'number' },
} as const;

const idParams = {
  type: 'object' as const,
  required: ['id'] as const,
  properties: { id: { type: 'string' as const } },
};

const lineIdParams = {
  type: 'object' as const,
  required: ['id', 'lineId'] as const,
  properties: {
    id: { type: 'string' as const },
    lineId: { type: 'string' as const },
  },
};

// ─── Create PO ─────────────────────────────────────────

export const createPOSchema = {
  body: {
    type: 'object',
    required: ['supplierId', 'season', 'seasonYear', 'currency'],
    properties: {
      supplierId: { type: 'string' },
      season: { type: 'string', enum: seasonEnum },
      seasonYear: { type: 'number' },
      currency: { type: 'string', enum: currencyEnum },
      expectedDelivery: { type: 'string', format: 'date-time' },
      deliveryLocationId: { type: 'string' },
      shippingTerms: { type: 'string' },
      paymentTerms: { type: 'string' },
      notes: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    201: { type: 'object', properties: poProperties },
  },
} as const;

// ─── List POs ──────────────────────────────────────────

export const listPOsSchema = {
  querystring: {
    type: 'object',
    properties: {
      season: { type: 'string', enum: seasonEnum },
      status: { type: 'string', enum: poStatusEnum },
      supplierId: { type: 'string' },
      search: { type: 'string' },
      page: { type: 'number', default: 1 },
      limit: { type: 'number', default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: poProperties } },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;

// ─── Get PO ────────────────────────────────────────────

export const getPOSchema = {
  params: idParams,
  response: {
    200: {
      type: 'object',
      properties: {
        ...poProperties,
        lines: { type: 'array', items: { type: 'object', properties: poLineProperties } },
      },
    },
  },
} as const;

// ─── Update PO ─────────────────────────────────────────

export const updatePOSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      expectedDelivery: { type: 'string', format: 'date-time' },
      deliveryLocationId: { type: 'string' },
      shippingTerms: { type: 'string' },
      paymentTerms: { type: 'string' },
      notes: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    200: { type: 'object', properties: poProperties },
  },
} as const;

// ─── Add line ──────────────────────────────────────────

export const addLineSchema = {
  params: idParams,
  body: {
    type: 'object',
    required: ['skuId', 'quantityOrdered', 'unitCost'],
    properties: {
      skuId: { type: 'string' },
      quantityOrdered: { type: 'number', minimum: 1 },
      unitCost: { type: 'number', minimum: 0 },
      expectedDate: { type: 'string', format: 'date-time' },
      notes: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    201: { type: 'object', properties: poLineProperties },
  },
} as const;

// ─── Update line ───────────────────────────────────────

export const updateLineSchema = {
  params: lineIdParams,
  body: {
    type: 'object',
    properties: {
      quantityOrdered: { type: 'number', minimum: 1 },
      unitCost: { type: 'number', minimum: 0 },
      expectedDate: { type: 'string', format: 'date-time' },
      notes: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    200: { type: 'object', properties: poLineProperties },
  },
} as const;

// ─── Delete line ───────────────────────────────────────

export const deleteLineSchema = {
  params: lineIdParams,
  response: {
    200: {
      type: 'object',
      properties: {
        message: { type: 'string' },
      },
    },
  },
} as const;

// ─── Status-transition actions ─────────────────────────

export const submitPOSchema = {
  params: idParams,
  response: {
    200: { type: 'object', properties: poProperties },
  },
} as const;

export const approvePOSchema = {
  params: idParams,
  response: {
    200: { type: 'object', properties: poProperties },
  },
} as const;

export const rejectPOSchema = {
  params: idParams,
  body: {
    type: 'object',
    required: ['reason'],
    properties: {
      reason: { type: 'string', minLength: 1 },
    },
    additionalProperties: false,
  },
  response: {
    200: { type: 'object', properties: poProperties },
  },
} as const;

export const sendPOSchema = {
  params: idParams,
  response: {
    200: { type: 'object', properties: poProperties },
  },
} as const;

export const confirmPOSchema = {
  params: idParams,
  response: {
    200: { type: 'object', properties: poProperties },
  },
} as const;

export const receivePOSchema = {
  params: idParams,
  body: {
    type: 'object',
    required: ['lines'],
    properties: {
      lines: {
        type: 'array',
        minItems: 1,
        items: {
          type: 'object',
          required: ['poLineId', 'quantityReceived'],
          properties: {
            poLineId: { type: 'string' },
            quantityReceived: { type: 'number', minimum: 0 },
            qualityStatus: { type: 'string', default: 'ACCEPTED' },
            damagedQuantity: { type: 'number', default: 0 },
            notes: { type: 'string' },
          },
          additionalProperties: false,
        },
      },
      locationId: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    200: {
      type: 'object',
      properties: {
        purchaseOrder: { type: 'object', properties: poProperties },
        receipts: {
          type: 'array',
          items: { type: 'object', properties: poReceiptProperties },
        },
      },
    },
  },
} as const;

export const cancelPOSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      reason: { type: 'string' },
    },
    additionalProperties: false,
  },
  response: {
    200: { type: 'object', properties: poProperties },
  },
} as const;

// ─── History ───────────────────────────────────────────

export const getHistorySchema = {
  params: idParams,
  response: {
    200: {
      type: 'array',
      items: { type: 'object', properties: poStatusHistoryProperties },
    },
  },
} as const;
