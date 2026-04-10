// ─── SHARED PROPERTY DEFS ──────────────────────────────

const soStatuses = [
  'DRAFT', 'CONFIRMED', 'ALLOCATED', 'PICKING', 'PACKED',
  'SHIPPED', 'PARTIALLY_SHIPPED', 'DELIVERED', 'RETURNED', 'CANCELLED', 'ON_HOLD',
] as const;

const soChannels = [
  'RETAIL_STORE', 'ECOMMERCE', 'WHOLESALE', 'MARKETPLACE', 'CLIENTELING',
] as const;

const soTypes = [
  'STANDARD', 'PRE_ORDER', 'BACK_ORDER', 'TRANSFER', 'REPLENISHMENT', 'RETURN', 'EXCHANGE',
] as const;

const currencies = [
  'SEK', 'EUR', 'USD', 'GBP', 'JPY', 'CNY', 'KRW', 'AUD', 'CAD', 'SGD', 'HKD',
] as const;

const salesOrderProperties = {
  id: { type: 'string' },
  soNumber: { type: 'string' },
  channel: { type: 'string', enum: soChannels },
  type: { type: 'string', enum: soTypes },
  status: { type: 'string', enum: soStatuses },
  locationId: { type: ['string', 'null'] },
  customerId: { type: ['string', 'null'] },
  customerName: { type: ['string', 'null'] },
  customerEmail: { type: ['string', 'null'] },
  wholesaleBuyerId: { type: ['string', 'null'] },
  currency: { type: 'string', enum: currencies },
  subtotal: { type: 'number' },
  taxAmount: { type: 'number' },
  discountAmount: { type: 'number' },
  totalAmount: { type: 'number' },
  shippingAddress: { type: ['string', 'null'] },
  shippingCity: { type: ['string', 'null'] },
  shippingCountry: { type: ['string', 'null'] },
  requestedShipDate: { type: ['string', 'null'] },
  actualShipDate: { type: ['string', 'null'] },
  deliveredAt: { type: ['string', 'null'] },
  notes: { type: ['string', 'null'] },
  priority: { type: 'number' },
  createdById: { type: 'string' },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

const soLineProperties = {
  id: { type: 'string' },
  salesOrderId: { type: 'string' },
  skuId: { type: 'string' },
  quantityOrdered: { type: 'number' },
  quantityAllocated: { type: 'number' },
  quantityShipped: { type: 'number' },
  quantityReturned: { type: 'number' },
  unitPrice: { type: 'number' },
  discountPercent: { type: 'number' },
  lineTotal: { type: 'number' },
  notes: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

const soStatusHistoryProperties = {
  id: { type: 'string' },
  salesOrderId: { type: 'string' },
  fromStatus: { type: ['string', 'null'] },
  toStatus: { type: 'string' },
  changedById: { type: 'string' },
  reason: { type: ['string', 'null'] },
  changedAt: { type: 'string' },
} as const;

const shipmentProperties = {
  id: { type: 'string' },
  salesOrderId: { type: 'string' },
  trackingNumber: { type: ['string', 'null'] },
  carrier: { type: ['string', 'null'] },
  shippedAt: { type: ['string', 'null'] },
  deliveredAt: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
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

const errorResponse = {
  type: 'object' as const,
  properties: {
    error: { type: 'string' as const },
    message: { type: 'string' as const },
  },
};

// ─── CREATE SO ─────────────────────────────────────────

export const createSOSchema = {
  body: {
    type: 'object',
    required: ['channel', 'type', 'currency'],
    properties: {
      channel: { type: 'string', enum: soChannels },
      type: { type: 'string', enum: soTypes },
      currency: { type: 'string', enum: currencies },
      locationId: { type: 'string' },
      customerId: { type: 'string' },
      customerName: { type: 'string' },
      customerEmail: { type: 'string' },
      wholesaleBuyerId: { type: 'string' },
      shippingAddress: { type: 'string' },
      shippingCity: { type: 'string' },
      shippingCountry: { type: 'string' },
      requestedShipDate: { type: 'string' },
      notes: { type: 'string' },
      priority: { type: 'number', default: 0 },
      storeCode: { type: 'string', description: 'Store code for SO number generation (RETAIL_STORE, CLIENTELING)' },
      region: { type: 'string', description: 'Region code for SO number generation (ECOMMERCE)' },
      buyerCode: { type: 'string', description: 'Buyer code for SO number generation (WHOLESALE)' },
      platform: { type: 'string', description: 'Platform code for SO number generation (MARKETPLACE)' },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: salesOrderProperties,
    },
    400: errorResponse,
  },
} as const;

// ─── LIST SOs ──────────────────────────────────────────

export const listSOsSchema = {
  querystring: {
    type: 'object',
    properties: {
      channel: { type: 'string', enum: soChannels },
      status: { type: 'string', enum: soStatuses },
      type: { type: 'string', enum: soTypes },
      locationId: { type: 'string' },
      search: { type: 'string' },
      page: { type: 'number', default: 1 },
      limit: { type: 'number', default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: salesOrderProperties } },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;

// ─── GET SO ────────────────────────────────────────────

export const getSOSchema = {
  params: idParams,
  response: {
    200: {
      type: 'object',
      properties: {
        ...salesOrderProperties,
        lines: { type: 'array', items: { type: 'object', properties: soLineProperties } },
        shipments: { type: 'array', items: { type: 'object', properties: shipmentProperties } },
      },
    },
    404: errorResponse,
  },
} as const;

// ─── UPDATE SO ─────────────────────────────────────────

export const updateSOSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      customerName: { type: 'string' },
      customerEmail: { type: 'string' },
      shippingAddress: { type: 'string' },
      shippingCity: { type: 'string' },
      shippingCountry: { type: 'string' },
      requestedShipDate: { type: 'string' },
      notes: { type: 'string' },
      priority: { type: 'number' },
    },
  },
  response: {
    200: { type: 'object', properties: salesOrderProperties },
    404: errorResponse,
    409: errorResponse,
  },
} as const;

// ─── ADD LINE ITEMS ────────────────────────────────────

export const addLinesSchema = {
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
          required: ['skuId', 'quantityOrdered', 'unitPrice'],
          properties: {
            skuId: { type: 'string' },
            quantityOrdered: { type: 'number', minimum: 1 },
            unitPrice: { type: 'number', minimum: 0 },
            discountPercent: { type: 'number', minimum: 0, maximum: 100, default: 0 },
            notes: { type: 'string' },
          },
        },
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        ...salesOrderProperties,
        lines: { type: 'array', items: { type: 'object', properties: soLineProperties } },
      },
    },
    404: errorResponse,
    409: errorResponse,
  },
} as const;

// ─── STATUS TRANSITION (shared for confirm/allocate/pick/pack/ship/deliver/cancel) ──

const transitionBody = {
  type: 'object' as const,
  properties: {
    reason: { type: 'string' as const },
  },
};

const transitionResponse = {
  200: { type: 'object' as const, properties: salesOrderProperties },
  404: errorResponse,
  409: errorResponse,
};

export const confirmSOSchema = {
  params: idParams,
  body: transitionBody,
  response: transitionResponse,
} as const;

export const allocateSOSchema = {
  params: idParams,
  body: transitionBody,
  response: transitionResponse,
} as const;

export const pickSOSchema = {
  params: idParams,
  body: transitionBody,
  response: transitionResponse,
} as const;

export const packSOSchema = {
  params: idParams,
  body: transitionBody,
  response: transitionResponse,
} as const;

export const shipSOSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      reason: { type: 'string' },
      trackingNumber: { type: 'string' },
      carrier: { type: 'string' },
    },
  },
  response: transitionResponse,
} as const;

export const deliverSOSchema = {
  params: idParams,
  body: transitionBody,
  response: transitionResponse,
} as const;

export const returnSOSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      reason: { type: 'string' },
    },
  },
  response: transitionResponse,
} as const;

export const cancelSOSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      reason: { type: 'string' },
    },
  },
  response: transitionResponse,
} as const;

export const holdSOSchema = {
  params: idParams,
  body: {
    type: 'object',
    properties: {
      reason: { type: 'string' },
    },
  },
  response: transitionResponse,
} as const;

export const releaseSOSchema = {
  params: idParams,
  body: transitionBody,
  response: transitionResponse,
} as const;

// ─── STATUS HISTORY ────────────────────────────────────

export const getSOHistorySchema = {
  params: idParams,
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: soStatusHistoryProperties } },
      },
    },
    404: errorResponse,
  },
} as const;
