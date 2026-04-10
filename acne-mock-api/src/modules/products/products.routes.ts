import type { FastifyInstance } from 'fastify';
import { listProducts, getProduct, listSkus } from './products.handlers.js';
import { listProductsSchema, getProductSchema, listSkusSchema } from './products.schemas.js';

export async function productRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/products', {
    schema: {
      ...listProductsSchema,
      tags: ['Products'],
      summary: 'List products',
      description: 'List all products with optional filters for category, gender, season, collection. Supports text search.',
    },
  }, listProducts);

  fastify.get('/products/:id', {
    schema: {
      ...getProductSchema,
      tags: ['Products'],
      summary: 'Get product by ID',
      description: 'Returns product details with all associated SKUs.',
    },
  }, getProduct);

  fastify.get('/skus', {
    schema: {
      ...listSkusSchema,
      tags: ['Products'],
      summary: 'List SKUs',
      description: 'List all SKUs with optional filters for productId, colour, size.',
    },
  }, listSkus);
}
