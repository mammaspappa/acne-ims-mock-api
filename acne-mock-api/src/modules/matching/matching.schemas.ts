// ─── SHARED PROPERTIES ──────────────────────────────────

const matchFactorsProperties = {
  skuExactMatch:       { type: 'number' },
  timingAlignment:     { type: 'number' },
  locationProximity:   { type: 'number' },
  quantityFit:         { type: 'number' },
  channelPriority:     { type: 'number' },
  seasonAlignment:     { type: 'number' },
  supplierReliability: { type: 'number' },
  marginContribution:  { type: 'number' },
} as const;

const matchProperties = {
  id:                   { type: 'string' },
  salesOrderId:         { type: 'string' },
  salesOrderLineId:     { type: ['string', 'null'] },
  purchaseOrderId:      { type: 'string' },
  purchaseOrderLineId:  { type: ['string', 'null'] },
  skuId:                { type: 'string' },
  quantityMatched:      { type: 'number' },
  matchScore:           { type: 'number' },
  matchFactors:         { type: 'object', properties: matchFactorsProperties },
  status:               { type: 'string', enum: ['PROPOSED', 'CONFIRMED', 'AUTO_CONFIRMED', 'REJECTED', 'SUPERSEDED', 'FULFILLED', 'EXPIRED'] },
  proposedBy:           { type: 'string' },
  confirmedById:        { type: ['string', 'null'] },
  confirmedAt:          { type: ['string', 'null'] },
  rejectedReason:       { type: ['string', 'null'] },
  expectedFulfillDate:  { type: ['string', 'null'] },
  createdAt:            { type: 'string' },
  updatedAt:            { type: 'string' },
} as const;

const matchingRunProperties = {
  id:                     { type: 'string' },
  triggeredBy:            { type: 'string' },
  matchesProposed:        { type: 'number' },
  matchesAutoConfirmed:   { type: 'number' },
  matchesRequiringReview: { type: 'number' },
  unmatched:              { type: 'number' },
  avgMatchScore:          { type: ['number', 'null'] },
  executionTimeMs:        { type: ['number', 'null'] },
  modelVersion:           { type: ['string', 'null'] },
  startedAt:              { type: 'string' },
  completedAt:            { type: ['string', 'null'] },
} as const;

const paginationProperties = {
  page:       { type: 'number' },
  limit:      { type: 'number' },
  total:      { type: 'number' },
  totalPages: { type: 'number' },
} as const;

// ─── SCHEMAS ────────────────────────────────────────────

export const runMatchingSchema = {
  body: {
    type: 'object',
    properties: {
      season:      { type: 'string', enum: ['SS', 'AW', 'RESORT', 'PRE_FALL', 'CAPSULE'] },
      seasonYear:  { type: 'number' },
      skuId:       { type: 'string' },
      triggeredBy: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        run:     { type: 'object', properties: matchingRunProperties },
        matches: { type: 'array', items: { type: 'object', properties: matchProperties } },
      },
    },
  },
} as const;

export const listProposalsSchema = {
  querystring: {
    type: 'object',
    properties: {
      status:          { type: 'string' },
      skuId:           { type: 'string' },
      salesOrderId:    { type: 'string' },
      purchaseOrderId: { type: 'string' },
      minScore:        { type: 'number' },
      maxScore:        { type: 'number' },
      page:            { type: 'number', default: 1 },
      limit:           { type: 'number', default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data:       { type: 'array', items: { type: 'object', properties: matchProperties } },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;

export const getProposalSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        ...matchProperties,
        salesOrder:    { type: 'object', additionalProperties: true },
        purchaseOrder: { type: 'object', additionalProperties: true },
        soLine:        { type: ['object', 'null'], additionalProperties: true },
        poLine:        { type: ['object', 'null'], additionalProperties: true },
        sku:           { type: ['object', 'null'], additionalProperties: true },
      },
    },
  },
} as const;

export const confirmProposalSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  body: {
    type: 'object',
    properties: {
      confirmedById: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: matchProperties,
    },
  },
} as const;

export const rejectProposalSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  body: {
    type: 'object',
    required: ['reason'],
    properties: {
      reason:     { type: 'string' },
      rejectedBy: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: matchProperties,
    },
  },
} as const;

export const bulkConfirmSchema = {
  body: {
    type: 'object',
    properties: {
      minScore:      { type: 'number', default: 0.85 },
      confirmedById: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        confirmed: { type: 'number' },
        matches:   { type: 'array', items: { type: 'object', properties: matchProperties } },
      },
    },
  },
} as const;

export const unmatchedSOsSchema = {
  querystring: {
    type: 'object',
    properties: {
      season:     { type: 'string' },
      seasonYear: { type: 'number' },
      channel:    { type: 'string' },
      page:       { type: 'number', default: 1 },
      limit:      { type: 'number', default: 20 },
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
              soLine:     { type: 'object', additionalProperties: true },
              salesOrder: { type: 'object', additionalProperties: true },
              sku:        { type: ['object', 'null'], additionalProperties: true },
              unmatched:  { type: 'number' },
            },
          },
        },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;

export const unmatchedPOCapacitySchema = {
  querystring: {
    type: 'object',
    properties: {
      season:     { type: 'string' },
      seasonYear: { type: 'number' },
      supplierId: { type: 'string' },
      page:       { type: 'number', default: 1 },
      limit:      { type: 'number', default: 20 },
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
              poLine:        { type: 'object', additionalProperties: true },
              purchaseOrder: { type: 'object', additionalProperties: true },
              sku:           { type: ['object', 'null'], additionalProperties: true },
              available:     { type: 'number' },
            },
          },
        },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;

export const matchingHealthSchema = {
  querystring: {
    type: 'object',
    properties: {
      season:     { type: 'string' },
      seasonYear: { type: 'number' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        totalSOLines:       { type: 'number' },
        matchedSOLines:     { type: 'number' },
        unmatchedSOLines:   { type: 'number' },
        matchRate:          { type: 'number' },
        avgMatchScore:      { type: ['number', 'null'] },
        autoConfirmedCount: { type: 'number' },
        proposedCount:      { type: 'number' },
        confirmedCount:     { type: 'number' },
        rejectedCount:      { type: 'number' },
        byChannel:          { type: 'object', additionalProperties: true },
      },
    },
  },
} as const;

export const matchingTimelineSchema = {
  querystring: {
    type: 'object',
    properties: {
      season:     { type: 'string' },
      seasonYear: { type: 'number' },
      days:       { type: 'number', default: 60 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        timeline: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date:           { type: 'string' },
              poArrivals:     { type: 'number' },
              soDeadlines:    { type: 'number' },
              gapUnits:       { type: 'number' },
            },
          },
        },
      },
    },
  },
} as const;

export const listRunsSchema = {
  querystring: {
    type: 'object',
    properties: {
      page:  { type: 'number', default: 1 },
      limit: { type: 'number', default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data:       { type: 'array', items: { type: 'object', properties: matchingRunProperties } },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;
