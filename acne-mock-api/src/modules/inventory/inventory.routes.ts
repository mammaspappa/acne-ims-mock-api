import type { FastifyInstance } from 'fastify';
import {
  checkAvailability,
  listStockLevels,
  transferStock,
  adjustStock,
  reconcileStock,
  listMovements,
  listAlerts,
} from './inventory.handlers.js';
import {
  checkAvailabilitySchema,
  listStockLevelsSchema,
  transferStockSchema,
  adjustStockSchema,
  reconcileStockSchema,
  listMovementsSchema,
  listAlertsSchema,
} from './inventory.schemas.js';
import { requireRoles } from '../../plugins/auth.plugin.js';

export async function inventoryRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/inventory/availability', {
    schema: {
      ...checkAvailabilitySchema,
      tags: ['Inventory'],
      summary: 'Check stock availability',
      description:
        'Check available stock by SKU, location, or region. ' +
        'Available = OnHand - Allocated + InTransit. ' +
        'All filters are optional and can be combined.',
    },
  }, checkAvailability);

  fastify.get('/inventory/levels', {
    schema: {
      ...listStockLevelsSchema,
      tags: ['Inventory'],
      summary: 'List stock levels',
      description:
        'Returns stock levels with optional filters for skuId, locationId, and belowReorderPoint. ' +
        'Use belowReorderPoint=true to find items that need replenishment.',
    },
  }, listStockLevels);

  fastify.post('/inventory/transfer', {
    schema: {
      ...transferStockSchema,
      tags: ['Inventory'],
      summary: 'Initiate inter-location stock transfer',
      description:
        'Transfers stock between locations. Decreases quantityOnHand at source, ' +
        'increases quantityInTransit at destination, and creates TRANSFER_OUT and TRANSFER_IN movement records.',
    },
    preHandler: requireRoles('WAREHOUSE', 'STORE_MGR', 'PLANNER'),
  }, transferStock as any);

  fastify.post('/inventory/adjust', {
    schema: {
      ...adjustStockSchema,
      tags: ['Inventory'],
      summary: 'Manual stock adjustment',
      description:
        'Apply a manual stock adjustment with a reason. Positive quantity increases on-hand, ' +
        'negative decreases it. Creates an ADJUSTMENT_POSITIVE or ADJUSTMENT_NEGATIVE movement record.',
    },
    preHandler: requireRoles('WAREHOUSE', 'STORE_MGR', 'QA'),
  }, adjustStock as any);

  fastify.post('/inventory/reconcile', {
    schema: {
      ...reconcileStockSchema,
      tags: ['Inventory'],
      summary: 'Reconcile RFID count data',
      description:
        'Process RFID count data for a location. Compares provided counts against system quantities, ' +
        'updates stock levels, flags discrepancies, and creates RFID_RECONCILIATION movement records for differences.',
    },
    preHandler: requireRoles('WAREHOUSE', 'STORE_MGR', 'STORE_ASSOC'),
  }, reconcileStock as any);

  fastify.get('/inventory/movements', {
    schema: {
      ...listMovementsSchema,
      tags: ['Inventory'],
      summary: 'List stock movements',
      description:
        'Returns stock movement history sorted by most recent first. ' +
        'Filter by skuId, movement type, location, or reference.',
    },
  }, listMovements);

  fastify.get('/inventory/alerts', {
    schema: {
      ...listAlertsSchema,
      tags: ['Inventory'],
      summary: 'Low stock alerts',
      description:
        'Returns stock levels where quantityOnHand is at or below the reorderPoint. ' +
        'Each alert includes the alertType (LOW_STOCK or OUT_OF_STOCK) and the deficit amount.',
    },
  }, listAlerts);
}
