import type { FastifyInstance } from 'fastify';
import {
  getMetadata, listEntities,
  listVendors, getVendor,
  listPurchaseOrders, getPurchaseOrder,
  listSalesOrders, getSalesOrder,
  listProducts, getProduct,
  listInventoryOnHand,
  listCustomers, getCustomer,
  listGeneralJournalEntries,
  listExchangeRates,
} from './d365.handlers.js';

export async function d365Routes(fastify: FastifyInstance): Promise<void> {
  // OData metadata
  fastify.get('/$metadata', {
    schema: {
      tags: ['External: D365'],
      summary: 'Get OData metadata document',
      description: 'Returns the OData $metadata XML document describing all available entities, their properties, and relationships. Follows the Dynamics 365 Finance & Operations OData v4 pattern.',
    },
  }, getMetadata);

  fastify.get('/', {
    schema: {
      tags: ['External: D365'],
      summary: 'List available OData entity sets',
      description: 'Returns the OData service document listing all available entity collections.',
    },
  }, listEntities);

  // Vendors (Suppliers)
  fastify.get('/Vendors', {
    schema: {
      tags: ['External: D365'],
      summary: 'List vendors',
      description: 'OData entity: Vendors. Maps to IMS suppliers. Supports $top, $skip, $filter, $select, $orderby, $count, cross-company.',
      querystring: {
        type: 'object',
        properties: {
          $top: { type: 'number' },
          $skip: { type: 'number' },
          $filter: { type: 'string' },
          $select: { type: 'string' },
          $orderby: { type: 'string' },
          $count: { type: 'boolean' },
          'cross-company': { type: 'boolean' },
        },
      },
    },
  }, listVendors);

  fastify.get('/Vendors(:key)', {
    schema: {
      tags: ['External: D365'],
      summary: 'Get vendor by key',
      description: 'Retrieve a single vendor entity. Key format: VendorAccountNumber=\'SUP-TI\',dataAreaId=\'acse\'',
      params: { type: 'object', required: ['key'], properties: { key: { type: 'string' } } },
    },
  }, getVendor);

  // Purchase Orders
  fastify.get('/PurchaseOrderHeaders', {
    schema: {
      tags: ['External: D365'],
      summary: 'List purchase order headers',
      description: 'OData entity: PurchaseOrderHeaders. Maps to IMS purchase orders. Supports $top, $skip, $filter, $expand=PurchaseOrderLines.',
      querystring: {
        type: 'object',
        properties: {
          $top: { type: 'number' },
          $skip: { type: 'number' },
          $filter: { type: 'string' },
          $select: { type: 'string' },
          $expand: { type: 'string' },
          $orderby: { type: 'string' },
        },
      },
    },
  }, listPurchaseOrders);

  fastify.get('/PurchaseOrderHeaders(:key)', {
    schema: {
      tags: ['External: D365'],
      summary: 'Get purchase order by key',
      params: { type: 'object', required: ['key'], properties: { key: { type: 'string' } } },
    },
  }, getPurchaseOrder);

  // Sales Orders
  fastify.get('/SalesOrderHeaders', {
    schema: {
      tags: ['External: D365'],
      summary: 'List sales order headers',
      description: 'OData entity: SalesOrderHeaders. Maps to IMS sales orders. Supports $expand=SalesOrderLines.',
      querystring: {
        type: 'object',
        properties: {
          $top: { type: 'number' },
          $skip: { type: 'number' },
          $filter: { type: 'string' },
          $select: { type: 'string' },
          $expand: { type: 'string' },
          $orderby: { type: 'string' },
        },
      },
    },
  }, listSalesOrders);

  fastify.get('/SalesOrderHeaders(:key)', {
    schema: {
      tags: ['External: D365'],
      summary: 'Get sales order by key',
      params: { type: 'object', required: ['key'], properties: { key: { type: 'string' } } },
    },
  }, getSalesOrder);

  // Products
  fastify.get('/ReleasedProducts', {
    schema: {
      tags: ['External: D365'],
      summary: 'List released products',
      description: 'OData entity: ReleasedProducts. Maps to IMS products/SKUs with D365-specific fields (ItemNumber, ProductType, ItemModelGroup).',
      querystring: {
        type: 'object',
        properties: {
          $top: { type: 'number' },
          $skip: { type: 'number' },
          $filter: { type: 'string' },
          $select: { type: 'string' },
        },
      },
    },
  }, listProducts);

  fastify.get('/ReleasedProducts(:key)', {
    schema: {
      tags: ['External: D365'],
      summary: 'Get released product by key',
      params: { type: 'object', required: ['key'], properties: { key: { type: 'string' } } },
    },
  }, getProduct);

  // Inventory
  fastify.get('/InventoryOnHand', {
    schema: {
      tags: ['External: D365'],
      summary: 'List inventory on-hand',
      description: 'OData entity: InventoryOnHand. Real-time stock position per item/warehouse. Maps to IMS stock levels.',
      querystring: {
        type: 'object',
        properties: {
          $top: { type: 'number' },
          $skip: { type: 'number' },
          $filter: { type: 'string' },
        },
      },
    },
  }, listInventoryOnHand);

  // Customers
  fastify.get('/Customers', {
    schema: {
      tags: ['External: D365'],
      summary: 'List customers',
      description: 'OData entity: Customers. Maps to IMS sales order customer data and wholesale buyers.',
      querystring: {
        type: 'object',
        properties: {
          $top: { type: 'number' },
          $skip: { type: 'number' },
          $filter: { type: 'string' },
          $select: { type: 'string' },
        },
      },
    },
  }, listCustomers);

  fastify.get('/Customers(:key)', {
    schema: {
      tags: ['External: D365'],
      summary: 'Get customer by key',
      params: { type: 'object', required: ['key'], properties: { key: { type: 'string' } } },
    },
  }, getCustomer);

  // Financial
  fastify.get('/GeneralJournalEntries', {
    schema: {
      tags: ['External: D365'],
      summary: 'List general journal entries',
      description: 'OData entity: GeneralJournalEntries. GL entries generated from PO receipts and SO shipments.',
      querystring: {
        type: 'object',
        properties: {
          $top: { type: 'number', default: 20 },
          $skip: { type: 'number', default: 0 },
          $filter: { type: 'string' },
        },
      },
    },
  }, listGeneralJournalEntries);

  fastify.get('/ExchangeRates', {
    schema: {
      tags: ['External: D365'],
      summary: 'List currency exchange rates',
      description: 'OData entity: ExchangeRates. SEK-based exchange rates used for multi-currency operations.',
    },
  }, listExchangeRates);
}
