const userRoles = [
  'BUYER', 'WHOLESALE', 'STORE_MGR', 'STORE_ASSOC', 'ECOM',
  'WAREHOUSE', 'SUPPLIER', 'FINANCE', 'PLANNER', 'EXEC',
  'CS_AGENT', 'QA', 'ADMIN',
] as const;

const stakeholderProperties = {
  id: { type: 'string' },
  email: { type: 'string' },
  firstName: { type: 'string' },
  lastName: { type: 'string' },
  role: { type: 'string', enum: userRoles },
  isActive: { type: 'boolean' },
  locationId: { type: ['string', 'null'] },
  supplierId: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

const paginationProperties = {
  page: { type: 'number' },
  limit: { type: 'number' },
  total: { type: 'number' },
  totalPages: { type: 'number' },
} as const;

const locationProperties = {
  id: { type: 'string' },
  name: { type: 'string' },
  type: { type: 'string' },
  address: { type: 'string' },
  city: { type: 'string' },
  country: { type: 'string' },
  countryCode: { type: 'string' },
  region: { type: 'string' },
  timezone: { type: 'string' },
  isActive: { type: 'boolean' },
  createdAt: { type: 'string' },
} as const;

const supplierProperties = {
  id: { type: 'string' },
  name: { type: 'string' },
  code: { type: 'string' },
  contactName: { type: ['string', 'null'] },
  contactEmail: { type: ['string', 'null'] },
  country: { type: 'string' },
  leadTimeDays: { type: 'number' },
  paymentTerms: { type: ['string', 'null'] },
  currency: { type: 'string' },
  isActive: { type: 'boolean' },
  fairWearScore: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

// ─── LIST STAKEHOLDERS ────────────────────────────────

export const listStakeholdersSchema = {
  querystring: {
    type: 'object',
    properties: {
      role: { type: 'string', enum: userRoles },
      locationId: { type: 'string' },
      supplierId: { type: 'string' },
      isActive: { type: 'boolean' },
      search: { type: 'string' },
      page: { type: 'number', default: 1 },
      limit: { type: 'number', default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: stakeholderProperties } },
        pagination: { type: 'object', properties: paginationProperties },
      },
    },
  },
} as const;

// ─── GET STAKEHOLDER ──────────────────────────────────

export const getStakeholderSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: stakeholderProperties,
    },
  },
} as const;

// ─── CREATE STAKEHOLDER ───────────────────────────────

export const createStakeholderSchema = {
  body: {
    type: 'object',
    required: ['email', 'firstName', 'lastName', 'role'],
    properties: {
      email: { type: 'string', format: 'email' },
      firstName: { type: 'string', minLength: 1 },
      lastName: { type: 'string', minLength: 1 },
      role: { type: 'string', enum: userRoles },
      locationId: { type: 'string' },
      supplierId: { type: 'string' },
      password: { type: 'string', minLength: 1 },
    },
  },
  response: {
    201: {
      type: 'object',
      properties: stakeholderProperties,
    },
  },
} as const;

// ─── UPDATE STAKEHOLDER ───────────────────────────────

export const updateStakeholderSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  body: {
    type: 'object',
    properties: {
      email: { type: 'string', format: 'email' },
      firstName: { type: 'string', minLength: 1 },
      lastName: { type: 'string', minLength: 1 },
      role: { type: 'string', enum: userRoles },
      locationId: { type: ['string', 'null'] },
      supplierId: { type: ['string', 'null'] },
      isActive: { type: 'boolean' },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: stakeholderProperties,
    },
  },
} as const;

// ─── DELETE (DEACTIVATE) STAKEHOLDER ──────────────────

export const deleteStakeholderSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        message: { type: 'string' },
      },
    },
  },
} as const;

// ─── LIST ROLES ───────────────────────────────────────

export const listRolesSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
      },
    },
  },
} as const;

// ─── LIST LOCATIONS ───────────────────────────────────

export const listLocationsSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: locationProperties } },
      },
    },
  },
} as const;

// ─── LIST SUPPLIERS ───────────────────────────────────

export const listSuppliersSchema = {
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: supplierProperties } },
      },
    },
  },
} as const;
