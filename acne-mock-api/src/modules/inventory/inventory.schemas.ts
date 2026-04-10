const stockLevelProperties = {
  id: { type: 'string' },
  skuId: { type: 'string' },
  locationId: { type: 'string' },
  quantityOnHand: { type: 'number' },
  quantityAllocated: { type: 'number' },
  quantityInTransit: { type: 'number' },
  quantityOnOrder: { type: 'number' },
  reorderPoint: { type: ['number', 'null'] },
  reorderQuantity: { type: ['number', 'null'] },
  lastCountedAt: { type: ['string', 'null'] },
  updatedAt: { type: 'string' },
} as const;

const stockMovementProperties = {
  id: { type: 'string' },
  skuId: { type: 'string' },
  type: { type: 'string' },
  quantity: { type: 'number' },
  fromLocationId: { type: ['string', 'null'] },
  toLocationId: { type: ['string', 'null'] },
  referenceType: { type: ['string', 'null'] },
  referenceId: { type: ['string', 'null'] },
  reason: { type: ['string', 'null'] },
  performedById: { type: 'string' },
  performedAt: { type: 'string' },
} as const;

const paginationProperties = {
  page: { type: 'number' },
  limit: { type: 'number' },
  total: { type: 'number' },
  totalPages: { type: 'number' },
} as const;

// ─── GET /inventory/availability ────────────────────────

export const checkAvailabilitySchema = {
  querystring: {
    type: 'object',
    properties: {
      skuId: { type: 'string' },
      locationId: { type: 'string' },
      region: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              skuId: { type: 'string' },
              locationId: { type: 'string' },
              locationName: { type: 'string' },
              region: { type: 'string' },
              quantityOnHand: { type: 'number' },
              quantityAllocated: { type: 'number' },
              quantityInTransit: { type: 'number' },
              available: { type: 'number' },
            },
          },
        },
      },
    },
  },
} as const;

// ─── GET /inventory/levels ──────────────────────────────

export const listStockLevelsSchema = {
  querystring: {
    type: 'object',
    properties: {
      skuId: { type: 'string' },
      locationId: { type: 'string' },
      belowReorderPoint: { type: 'boolean' },
      page: { type: 'number', default: 1 },
      limit: { type: 'number', default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: stockLevelProperties } },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;

// ─── POST /inventory/transfer ───────────────────────────

export const transferStockSchema = {
  body: {
    type: 'object',
    required: ['skuId', 'fromLocationId', 'toLocationId', 'quantity'],
    properties: {
      skuId: { type: 'string' },
      fromLocationId: { type: 'string' },
      toLocationId: { type: 'string' },
      quantity: { type: 'number', minimum: 1 },
      reason: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        transfer: {
          type: 'object',
          properties: {
            skuId: { type: 'string' },
            fromLocationId: { type: 'string' },
            toLocationId: { type: 'string' },
            quantity: { type: 'number' },
            movements: {
              type: 'array',
              items: { type: 'object', properties: stockMovementProperties },
            },
          },
        },
      },
    },
  },
} as const;

// ─── POST /inventory/adjust ─────────────────────────────

export const adjustStockSchema = {
  body: {
    type: 'object',
    required: ['skuId', 'locationId', 'quantity', 'reason'],
    properties: {
      skuId: { type: 'string' },
      locationId: { type: 'string' },
      quantity: { type: 'number' },
      reason: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        stockLevel: { type: 'object', properties: stockLevelProperties },
        movement: { type: 'object', properties: stockMovementProperties },
      },
    },
  },
} as const;

// ─── POST /inventory/reconcile ──────────────────────────

export const reconcileStockSchema = {
  body: {
    type: 'object',
    required: ['locationId', 'counts'],
    properties: {
      locationId: { type: 'string' },
      counts: {
        type: 'array',
        items: {
          type: 'object',
          required: ['skuId', 'countedQuantity'],
          properties: {
            skuId: { type: 'string' },
            countedQuantity: { type: 'number', minimum: 0 },
          },
        },
      },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        locationId: { type: 'string' },
        totalCounted: { type: 'number' },
        discrepancies: { type: 'number' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              skuId: { type: 'string' },
              systemQuantity: { type: 'number' },
              countedQuantity: { type: 'number' },
              difference: { type: 'number' },
              hasDiscrepancy: { type: 'boolean' },
              movementId: { type: ['string', 'null'] },
            },
          },
        },
      },
    },
  },
} as const;

// ─── GET /inventory/movements ───────────────────────────

export const listMovementsSchema = {
  querystring: {
    type: 'object',
    properties: {
      skuId: { type: 'string' },
      type: { type: 'string' },
      fromLocationId: { type: 'string' },
      toLocationId: { type: 'string' },
      referenceType: { type: 'string' },
      referenceId: { type: 'string' },
      page: { type: 'number', default: 1 },
      limit: { type: 'number', default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: stockMovementProperties } },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;

// ─── GET /inventory/alerts ──────────────────────────────

export const listAlertsSchema = {
  querystring: {
    type: 'object',
    properties: {
      locationId: { type: 'string' },
      skuId: { type: 'string' },
      page: { type: 'number', default: 1 },
      limit: { type: 'number', default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              ...stockLevelProperties,
              alertType: { type: 'string' },
              deficit: { type: 'number' },
            },
          },
        },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;
