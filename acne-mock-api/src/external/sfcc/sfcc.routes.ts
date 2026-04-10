import type { FastifyInstance } from 'fastify';
import {
  getProductHandler,
  searchProductsHandler,
  getCategoryHandler,
  listCategoriesHandler,
  listBasketsHandler,
  createBasketHandler,
  addBasketItemHandler,
  getBasketHandler,
  createOrderHandler,
  listOrdersHandler,
  getOrderHandler,
} from './sfcc.handlers.js';

export async function sfccRoutes(fastify: FastifyInstance): Promise<void> {

  // ─── PRODUCTS ────────────────────────────────────────

  fastify.get('/products/:productId', {
    schema: {
      tags: ['External: SFCC'],
      summary: 'Get product by style number',
      description:
        'Returns a single product in SFCC Shopper API format. ' +
        'Uses the IMS style number as the SFCC product ID. ' +
        'Includes all colour/size variants.',
      params: {
        type: 'object',
        properties: { productId: { type: 'string' } },
        required: ['productId'],
      },
    },
  }, getProductHandler);

  fastify.get('/products', {
    schema: {
      tags: ['External: SFCC'],
      summary: 'Search products',
      description:
        'Search products by keyword, category, with sorting and pagination. ' +
        'Returns hits in SFCC product_search_result format.',
      querystring: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query string' },
          categoryId: { type: 'string', description: 'Filter by category ID' },
          limit: { type: 'string', description: 'Max results to return (default 25)' },
          offset: { type: 'string', description: 'Offset for pagination (default 0)' },
          sort: { type: 'string', description: 'Sort field and direction (e.g. price-asc, name-desc)' },
        },
      },
    },
  }, searchProductsHandler);

  // ─── CATEGORIES ──────────────────────────────────────

  fastify.get('/categories/:categoryId', {
    schema: {
      tags: ['External: SFCC'],
      summary: 'Get category by ID',
      description:
        'Returns a single category derived from IMS product categories. ' +
        'Includes sub-categories.',
      params: {
        type: 'object',
        properties: { categoryId: { type: 'string' } },
        required: ['categoryId'],
      },
    },
  }, getCategoryHandler);

  fastify.get('/categories', {
    schema: {
      tags: ['External: SFCC'],
      summary: 'List all categories',
      description:
        'Returns all product categories derived from the IMS product catalog. ' +
        'Categories are dynamically built from product data.',
    },
  }, listCategoriesHandler);

  // ─── BASKETS ─────────────────────────────────────────

  fastify.get('/baskets', {
    schema: {
      tags: ['External: SFCC'],
      summary: 'List all baskets',
      description:
        'List all shopping baskets including pre-seeded abandoned carts and active sessions. ' +
        'Returns baskets sorted by creation date (newest first).',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', description: 'Max results (default 50)' },
          offset: { type: 'string', description: 'Offset for pagination (default 0)' },
        },
      },
    },
  }, listBasketsHandler);

  fastify.post('/baskets', {
    schema: {
      tags: ['External: SFCC'],
      summary: 'Create a new basket',
      description:
        'Creates an empty shopping basket with the specified currency. ' +
        'Baskets are stored in-memory and can be converted to orders.',
      body: {
        type: 'object',
        properties: {
          currency: { type: 'string', description: 'Currency code (default EUR)' },
        },
      },
    },
  }, createBasketHandler);

  fastify.post('/baskets/:basketId/items', {
    schema: {
      tags: ['External: SFCC'],
      summary: 'Add item to basket',
      description:
        'Adds a product to the basket by style number. ' +
        'If the product already exists in the basket, the quantity is incremented.',
      params: {
        type: 'object',
        properties: { basketId: { type: 'string' } },
        required: ['basketId'],
      },
      body: {
        type: 'object',
        properties: {
          productId: { type: 'string', description: 'Product style number' },
          quantity: { type: 'number', description: 'Quantity to add (default 1)' },
        },
        required: ['productId'],
      },
    },
  }, addBasketItemHandler);

  fastify.get('/baskets/:basketId', {
    schema: {
      tags: ['External: SFCC'],
      summary: 'Get basket by ID',
      description:
        'Returns the basket with all items and computed order total.',
      params: {
        type: 'object',
        properties: { basketId: { type: 'string' } },
        required: ['basketId'],
      },
    },
  }, getBasketHandler);

  // ─── ORDERS ──────────────────────────────────────────

  fastify.post('/orders', {
    schema: {
      tags: ['External: SFCC'],
      summary: 'Create order from basket',
      description:
        'Converts a basket into a sales order. Creates a CONFIRMED sales order ' +
        'in the IMS store with channel=ECOMMERCE. The basket is removed after order creation.',
      body: {
        type: 'object',
        properties: {
          basketId: { type: 'string', description: 'ID of the basket to convert' },
        },
        required: ['basketId'],
      },
    },
  }, createOrderHandler);

  fastify.get('/orders', {
    schema: {
      tags: ['External: SFCC'],
      summary: 'List all e-commerce orders',
      description:
        'List all ECOMMERCE-channel orders from the IMS in SFCC format. ' +
        'Supports filtering by status and pagination.',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by order status (e.g. shipped, delivered)' },
          limit: { type: 'string', description: 'Max results (default 50)' },
          offset: { type: 'string', description: 'Offset for pagination (default 0)' },
        },
      },
    },
  }, listOrdersHandler);

  fastify.get('/orders/:orderId', {
    schema: {
      tags: ['External: SFCC'],
      summary: 'Get order by ID',
      description:
        'Returns an order in SFCC format. Looks up the order by IMS ID or SO number. ' +
        'Maps IMS sales order data to SFCC order format.',
      params: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
        required: ['orderId'],
      },
    },
  }, getOrderHandler);
}
