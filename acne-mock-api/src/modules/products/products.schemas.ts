const productProperties = {
  id: { type: 'string' },
  styleNumber: { type: 'string' },
  name: { type: 'string' },
  category: { type: 'string' },
  subCategory: { type: ['string', 'null'] },
  gender: { type: 'string' },
  season: { type: 'string' },
  seasonYear: { type: 'number' },
  collection: { type: ['string', 'null'] },
  isCarryOver: { type: 'boolean' },
  costPrice: { type: 'number' },
  costCurrency: { type: 'string' },
  description: { type: ['string', 'null'] },
  createdAt: { type: 'string' },
  updatedAt: { type: 'string' },
} as const;

const skuProperties = {
  id: { type: 'string' },
  productId: { type: 'string' },
  sku: { type: 'string' },
  barcode: { type: ['string', 'null'] },
  colour: { type: 'string' },
  colourCode: { type: 'string' },
  size: { type: 'string' },
  sizeIndex: { type: 'number' },
  wholesalePrice: { type: 'number' },
  retailPrice: { type: 'number' },
  priceCurrency: { type: 'string' },
  weight: { type: ['number', 'null'] },
  isActive: { type: 'boolean' },
} as const;

export const listProductsSchema = {
  querystring: {
    type: 'object',
    properties: {
      category: { type: 'string' },
      gender: { type: 'string' },
      season: { type: 'string' },
      collection: { type: 'string' },
      isCarryOver: { type: 'boolean' },
      search: { type: 'string' },
      page: { type: 'number', default: 1 },
      limit: { type: 'number', default: 20 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: productProperties } },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  },
} as const;

export const getProductSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        ...productProperties,
        skus: { type: 'array', items: { type: 'object', properties: skuProperties } },
      },
    },
  },
} as const;

export const listSkusSchema = {
  querystring: {
    type: 'object',
    properties: {
      productId: { type: 'string' },
      colour: { type: 'string' },
      size: { type: 'string' },
      isActive: { type: 'boolean' },
      search: { type: 'string' },
      page: { type: 'number', default: 1 },
      limit: { type: 'number', default: 50 },
    },
  },
  response: {
    200: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object', properties: skuProperties } },
        pagination: {
          type: 'object',
          properties: {
            page: { type: 'number' },
            limit: { type: 'number' },
            total: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
      },
    },
  },
} as const;
