import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';

export async function customerRoutes(fastify: FastifyInstance): Promise<void> {

  fastify.get('/stakeholders/customers', {
    schema: {
      tags: ['Stakeholders'],
      summary: 'List customers',
      description: 'Returns paginated list of persistent customers with behavior profiles (VIC, REGULAR, RETURNING, BARGAIN_HUNTER, TOURIST). Customers accumulate purchase history as the simulation runs.',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 },
          profile: { type: 'string', enum: ['VIC', 'REGULAR', 'RETURNING', 'BARGAIN_HUNTER', 'TOURIST'] },
          country: { type: 'string' },
          tier: { type: 'string', enum: ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] },
          minOrders: { type: 'number' },
          sort: { type: 'string', enum: ['totalSpent', 'totalOrders', 'lastOrderAt', 'firstOrderAt'] },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { limit?: number; offset?: number; profile?: string; country?: string; tier?: string; minOrders?: number; sort?: string; order?: string } }>, reply: FastifyReply) => {
    const q = request.query;
    let customers = [...store.customers];

    if (q.profile) customers = customers.filter(c => c.profile === q.profile);
    if (q.country) customers = customers.filter(c => c.countryCode === q.country);
    if (q.tier) customers = customers.filter(c => c.tier === q.tier);
    if (q.minOrders !== undefined) customers = customers.filter(c => c.totalOrders >= q.minOrders!);

    if (q.sort) {
      const dir = q.order === 'asc' ? 1 : -1;
      customers.sort((a, b) => {
        const av = (a as any)[q.sort!] ?? 0;
        const bv = (b as any)[q.sort!] ?? 0;
        if (av < bv) return -dir;
        if (av > bv) return dir;
        return 0;
      });
    }

    const total = customers.length;
    const limit = q.limit ?? 50;
    const offset = q.offset ?? 0;
    return reply.send({
      data: customers.slice(offset, offset + limit),
      pagination: { total, limit, offset },
    });
  });

  fastify.get('/stakeholders/customers/:id', {
    schema: {
      tags: ['Stakeholders'],
      summary: 'Get customer by ID',
      description: 'Returns a single customer including order history derived from sales orders.',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const customer = store.customers.find(c => c.id === request.params.id);
    if (!customer) return reply.status(404).send({ error: 'Customer not found' });

    const orders = store.salesOrders
      .filter(so => so.customerId === customer.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)
      .map(so => ({
        id: so.id, soNumber: so.soNumber, channel: so.channel, status: so.status,
        totalAmount: so.totalAmount, currency: so.currency, createdAt: so.createdAt,
      }));

    return reply.send({ customer, recentOrders: orders, orderCount: orders.length });
  });

  fastify.get('/stakeholders/customers/stats', {
    schema: {
      tags: ['Stakeholders'],
      summary: 'Customer segmentation stats',
      description: 'Returns aggregate stats per customer profile.',
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    const byProfile: Record<string, { count: number; totalOrders: number; totalSpentSek: number; avgOrders: number; avgSpent: number }> = {};
    for (const c of store.customers) {
      if (!byProfile[c.profile]) byProfile[c.profile] = { count: 0, totalOrders: 0, totalSpentSek: 0, avgOrders: 0, avgSpent: 0 };
      byProfile[c.profile].count++;
      byProfile[c.profile].totalOrders += c.totalOrders;
      byProfile[c.profile].totalSpentSek += c.totalSpentSek;
    }
    for (const p of Object.keys(byProfile)) {
      byProfile[p].avgOrders = byProfile[p].count > 0 ? Math.round(byProfile[p].totalOrders / byProfile[p].count * 10) / 10 : 0;
      byProfile[p].avgSpent = byProfile[p].count > 0 ? Math.round(byProfile[p].totalSpentSek / byProfile[p].count) : 0;
    }
    return reply.send({ totalCustomers: store.customers.length, byProfile });
  });
}
