import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { toCsv } from '../../utils/csv.js';

// Map URL-friendly entity names to store collections
const ENTITIES: Record<string, () => Record<string, unknown>[]> = {
  'products': () => store.products as any,
  'skus': () => store.skus as any,
  'locations': () => store.locations as any,
  'suppliers': () => store.suppliers as any,
  'users': () => store.users.map(u => {
    const { passwordHash: _pw, ...rest } = u;
    return rest as any;
  }),
  'purchase-orders': () => store.purchaseOrders as any,
  'po-lines': () => store.poLines as any,
  'po-receipts': () => store.poReceipts as any,
  'po-status-history': () => store.poStatusHistory as any,
  'sales-orders': () => store.salesOrders as any,
  'so-lines': () => store.soLines as any,
  'so-status-history': () => store.soStatusHistory as any,
  'shipments': () => store.shipments as any,
  'stock-levels': () => store.stockLevels as any,
  'stock-movements': () => store.stockMovements as any,
  'matches': () => store.sopoMatches as any,
  'matching-runs': () => store.matchingRuns as any,
  'forecasts': () => store.demandForecasts as any,
  'recommendations': () => store.aiRecommendations as any,
  'anomalies': () => store.anomalyAlerts as any,
  'audit-logs': () => store.auditLogs as any,
  'season-drops': () => store.seasonDrops as any,
  'customers': () => store.customers as any,
};

export async function exportRoutes(fastify: FastifyInstance): Promise<void> {

  // List available exports
  fastify.get('/export', {
    schema: {
      tags: ['Admin'],
      summary: 'List available CSV exports',
      description: 'Returns the list of entities that can be exported as CSV via /api/v1/export/:entity.csv',
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const host = `${request.protocol}://${request.hostname}`;
    const entities = Object.keys(ENTITIES).map(name => ({
      entity: name,
      rows: ENTITIES[name]().length,
      csv: `${host}/api/v1/export/${name}.csv`,
      json: `${host}/api/v1/export/${name}.json`,
    }));
    return reply.send({ entities });
  });

  // CSV export
  fastify.get('/export/:entity.csv', {
    schema: {
      tags: ['Admin'],
      summary: 'Export entity as CSV',
      description: 'Returns all rows of the specified entity as a downloadable CSV file. See /api/v1/export for the list of available entities.',
      params: {
        type: 'object',
        required: ['entity'],
        properties: { entity: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { entity: string } }>, reply: FastifyReply) => {
    const name = request.params.entity;
    const loader = ENTITIES[name];
    if (!loader) {
      return reply.status(404).send({
        error: `Unknown entity "${name}"`,
        availableEntities: Object.keys(ENTITIES),
      });
    }
    const rows = loader();
    const csv = toCsv(rows);
    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${name}.csv"`)
      .send(csv);
  });

  // JSON export (full dump, not paginated)
  fastify.get('/export/:entity.json', {
    schema: {
      tags: ['Admin'],
      summary: 'Export entity as JSON',
      description: 'Returns all rows of the specified entity as a JSON array (not paginated, unlike the standard list endpoints).',
      params: {
        type: 'object',
        required: ['entity'],
        properties: { entity: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { entity: string } }>, reply: FastifyReply) => {
    const name = request.params.entity;
    const loader = ENTITIES[name];
    if (!loader) {
      return reply.status(404).send({
        error: `Unknown entity "${name}"`,
        availableEntities: Object.keys(ENTITIES),
      });
    }
    return reply.send(loader());
  });
}
