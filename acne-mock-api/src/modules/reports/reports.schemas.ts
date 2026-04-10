// ─── Shared helpers ─────────────────────────────────────

const seasonEnum = ['SS', 'AW', 'RESORT', 'PRE_FALL', 'CAPSULE'];

const queryWithSeasonFilters = {
  type: 'object',
  properties: {
    season: { type: 'string', enum: seasonEnum },
    seasonYear: { type: 'number' },
  },
} as const;

// ─── Seasonal buy summary ───────────────────────────────

export const seasonalBuySummarySchema = {
  querystring: {
    type: 'object',
    properties: {
      season: { type: 'string', enum: seasonEnum },
      seasonYear: { type: 'number' },
      category: { type: 'string' },
      supplierId: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        season: { type: 'string' },
        seasonYear: { type: ['number', 'null'] },
        totalBudget: { type: 'number' },
        totalSpend: { type: 'number' },
        remainingBudget: { type: 'number' },
        utilizationPercent: { type: 'number' },
        byCategory: { type: 'array', items: { type: 'object' } },
        bySupplier: { type: 'array', items: { type: 'object' } },
        byStatus: { type: 'object' },
      },
    },
  },
} as const;

// ─── Open to buy ────────────────────────────────────────

export const openToBuySchema = {
  querystring: queryWithSeasonFilters,
  response: {
    200: {
      type: 'object',
      properties: {
        season: { type: 'string' },
        seasonYear: { type: ['number', 'null'] },
        categories: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              budget: { type: 'number' },
              committed: { type: 'number' },
              remaining: { type: 'number' },
              utilizationPercent: { type: 'number' },
            },
          },
        },
        total: {
          type: 'object',
          properties: {
            budget: { type: 'number' },
            committed: { type: 'number' },
            remaining: { type: 'number' },
            utilizationPercent: { type: 'number' },
          },
        },
      },
    },
  },
} as const;

// ─── Sell-through ───────────────────────────────────────

export const sellThroughSchema = {
  querystring: {
    type: 'object',
    properties: {
      channel: { type: 'string' },
      category: { type: 'string' },
      season: { type: 'string', enum: seasonEnum },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        overall: {
          type: 'object',
          properties: {
            unitsSold: { type: 'number' },
            unitsReceived: { type: 'number' },
            sellThroughRate: { type: 'number' },
          },
        },
        byChannel: { type: 'array', items: { type: 'object' } },
        byCategory: { type: 'array', items: { type: 'object' } },
      },
    },
  },
} as const;

// ─── Fulfillment SLA ────────────────────────────────────

export const fulfillmentSlaSchema = {
  querystring: {
    type: 'object',
    properties: {
      channel: { type: 'string' },
      targetDays: { type: 'number', default: 3 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        targetDays: { type: 'number' },
        totalOrders: { type: 'number' },
        withinSla: { type: 'number' },
        outsideSla: { type: 'number' },
        slaPercent: { type: 'number' },
        avgFulfillmentDays: { type: 'number' },
        byChannel: { type: 'array', items: { type: 'object' } },
      },
    },
  },
} as const;

// ─── Gross margin ───────────────────────────────────────

export const grossMarginSchema = {
  querystring: {
    type: 'object',
    properties: {
      channel: { type: 'string' },
      category: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        overall: {
          type: 'object',
          properties: {
            revenue: { type: 'number' },
            cogs: { type: 'number' },
            grossMargin: { type: 'number' },
            marginPercent: { type: 'number' },
          },
        },
        byChannel: { type: 'array', items: { type: 'object' } },
        byCategory: { type: 'array', items: { type: 'object' } },
      },
    },
  },
} as const;

// ─── Supplier performance ───────────────────────────────

export const supplierPerformanceSchema = {
  querystring: {
    type: 'object',
    properties: {
      supplierId: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        suppliers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              supplierId: { type: 'string' },
              supplierName: { type: 'string' },
              totalPOs: { type: 'number' },
              onTimeDeliveryRate: { type: 'number' },
              avgLeadTimeDays: { type: 'number' },
              defectRate: { type: 'number' },
              totalUnitsOrdered: { type: 'number' },
              totalUnitsReceived: { type: 'number' },
              totalSpend: { type: 'number' },
            },
          },
        },
      },
    },
  },
} as const;

// ─── Stock aging ────────────────────────────────────────

export const stockAgingSchema = {
  querystring: {
    type: 'object',
    properties: {
      locationId: { type: 'string' },
      category: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        agingBuckets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              bucket: { type: 'string' },
              skuCount: { type: 'number' },
              totalUnits: { type: 'number' },
              totalValue: { type: 'number' },
            },
          },
        },
        topAging: { type: 'array', items: { type: 'object' } },
      },
    },
  },
} as const;

// ─── Match health ───────────────────────────────────────

export const matchHealthSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        totalMatches: { type: 'number' },
        matchRate: { type: 'number' },
        autoConfirmRate: { type: 'number' },
        avgMatchScore: { type: 'number' },
        byStatus: { type: 'object' },
        recentRuns: { type: 'array', items: { type: 'object' } },
      },
    },
  },
} as const;

// ─── Executive KPIs ─────────────────────────────────────

export const executiveKpisSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        revenue: { type: 'object' },
        inventory: { type: 'object' },
        orders: { type: 'object' },
        supply: { type: 'object' },
        aiHealth: { type: 'object' },
        generatedAt: { type: 'string' },
      },
    },
  },
} as const;
