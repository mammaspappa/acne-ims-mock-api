// ─── Shared property definitions ───────────────────────

const paginationProperties = {
  page: { type: 'number' },
  limit: { type: 'number' },
  total: { type: 'number' },
  totalPages: { type: 'number' },
} as const;

const forecastProperties = {
  id: { type: 'string' },
  skuId: { type: 'string' },
  locationId: { type: ['string', 'null'] },
  season: { type: 'string' },
  seasonYear: { type: 'number' },
  forecastDate: { type: 'string' },
  predictedDemand: { type: 'number' },
  confidenceLow: { type: 'number' },
  confidenceHigh: { type: 'number' },
  modelVersion: { type: 'string' },
  features: { type: ['object', 'null'] },
  createdAt: { type: 'string' },
} as const;

const recommendationProperties = {
  id: { type: 'string' },
  type: { type: 'string' },
  targetEntity: { type: 'string' },
  targetId: { type: 'string' },
  recommendation: { type: 'string' },
  confidence: { type: 'number' },
  reasoning: { type: 'object' },
  impact: { type: ['object', 'null'] },
  status: { type: 'string' },
  acceptedById: { type: ['string', 'null'] },
  acceptedAt: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
} as const;

const anomalyProperties = {
  id: { type: 'string' },
  type: { type: 'string' },
  severity: { type: 'string' },
  entityType: { type: 'string' },
  entityId: { type: 'string' },
  description: { type: 'string' },
  detectedValue: { type: 'number' },
  expectedRange: {
    type: 'object',
    properties: {
      low: { type: 'number' },
      high: { type: 'number' },
    },
  },
  modelVersion: { type: 'string' },
  isResolved: { type: 'boolean' },
  resolvedById: { type: ['string', 'null'] },
  resolvedAt: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
} as const;

const modelRegistryProperties = {
  id: { type: 'string' },
  modelName: { type: 'string' },
  version: { type: 'string' },
  status: { type: 'string' },
  metrics: { type: 'object' },
  hyperparameters: { type: 'object' },
  trainingDataRange: { type: 'object' },
  artifactPath: { type: 'string' },
  trainedAt: { type: 'string' },
  activatedAt: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
} as const;

// ─── List forecasts ─────────────────────────────────────

export const listForecastsSchema = {
  querystring: {
    type: 'object',
    properties: {
      skuId: { type: 'string' },
      locationId: { type: 'string' },
      season: { type: 'string' },
      page: { type: 'number', default: 1 },
      limit: { type: 'number', default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: forecastProperties } },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;

// ─── Get forecast detail for a SKU ──────────────────────

export const getForecastBySkuSchema = {
  params: {
    type: 'object',
    required: ['skuId'],
    properties: { skuId: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        skuId: { type: 'string' },
        sku: { type: 'string' },
        productName: { type: 'string' },
        forecasts: { type: 'array', items: { type: 'object', properties: forecastProperties } },
        summary: {
          type: 'object',
          properties: {
            totalPredictedDemand: { type: 'number' },
            avgConfidenceLow: { type: 'number' },
            avgConfidenceHigh: { type: 'number' },
            weeksForecasted: { type: 'number' },
            modelVersion: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

// ─── List recommendations ───────────────────────────────

export const listRecommendationsSchema = {
  querystring: {
    type: 'object',
    properties: {
      type: { type: 'string' },
      status: { type: 'string' },
      page: { type: 'number', default: 1 },
      limit: { type: 'number', default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: recommendationProperties } },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;

// ─── Accept recommendation ──────────────────────────────

export const acceptRecommendationSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: recommendationProperties,
    },
  },
} as const;

// ─── Dismiss recommendation ─────────────────────────────

export const dismissRecommendationSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: recommendationProperties,
    },
  },
} as const;

// ─── List anomalies ─────────────────────────────────────

export const listAnomaliesSchema = {
  querystring: {
    type: 'object',
    properties: {
      type: { type: 'string' },
      severity: { type: 'string' },
      isResolved: { type: 'boolean' },
      page: { type: 'number', default: 1 },
      limit: { type: 'number', default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: anomalyProperties } },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;

// ─── Resolve anomaly ────────────────────────────────────

export const resolveAnomalySchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: anomalyProperties,
    },
  },
} as const;

// ─── List models ────────────────────────────────────────

export const listModelsSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: modelRegistryProperties } },
      },
    },
  },
} as const;

// ─── Retrain model ──────────────────────────────────────

export const retrainModelSchema = {
  params: {
    type: 'object',
    required: ['name'],
    properties: { name: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        ...modelRegistryProperties,
        message: { type: 'string' },
      },
    },
  },
} as const;

// ─── Matching scores ────────────────────────────────────

export const matchingScoresSchema = {
  querystring: {
    type: 'object',
    properties: {
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
              matchId: { type: 'string' },
              salesOrderId: { type: 'string' },
              purchaseOrderId: { type: 'string' },
              skuId: { type: 'string' },
              matchScore: { type: 'number' },
              matchFactors: { type: 'object' },
              status: { type: 'string' },
              proposedBy: { type: 'string' },
            },
          },
        },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;

// ─── Seasonal insights ─────────────────────────────────

export const seasonalInsightsSchema = {
  params: {
    type: 'object',
    required: ['season', 'year'],
    properties: {
      season: { type: 'string' },
      year: { type: 'number' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        season: { type: 'string' },
        year: { type: 'number' },
        demandSummary: {
          type: 'object',
          properties: {
            totalForecastedUnits: { type: 'number' },
            topSkus: { type: 'array', items: { type: 'object' } },
            avgConfidence: { type: 'number' },
          },
        },
        recommendations: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            pending: { type: 'number' },
            accepted: { type: 'number' },
            dismissed: { type: 'number' },
            byType: { type: 'object' },
          },
        },
        anomalies: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            unresolved: { type: 'number' },
            bySeverity: { type: 'object' },
          },
        },
        matchingPerformance: {
          type: 'object',
          properties: {
            totalMatches: { type: 'number' },
            avgScore: { type: 'number' },
            autoConfirmRate: { type: 'number' },
          },
        },
      },
    },
  },
} as const;
