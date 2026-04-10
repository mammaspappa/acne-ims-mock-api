import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { setLatency, getLatency, setLatencyPreset, getPresets } from '../../plugins/latency.plugin.js';
import { setMockNow, now } from '../../utils/date.js';

export async function healthHandler(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    status: 'ok',
    timestamp: now().toISOString(),
    currentLatencyMs: getLatency(),
    stats: store.stats(),
  });
}

export async function resetHandler(_request: FastifyRequest, reply: FastifyReply) {
  store.reset();
  return reply.send({
    status: 'ok',
    message: 'All data has been reset to seed state',
    stats: store.stats(),
  });
}

export async function seedInfoHandler(_request: FastifyRequest, reply: FastifyReply) {
  const users = store.users.map(u => ({
    email: u.email,
    role: u.role,
    password: 'hackathon2026',
    locationId: u.locationId,
  }));

  const sampleIds = {
    products: store.products.slice(0, 3).map(p => ({ id: p.id, name: p.name, styleNumber: p.styleNumber })),
    skus: store.skus.slice(0, 3).map(s => ({ id: s.id, sku: s.sku })),
    purchaseOrders: store.purchaseOrders.slice(0, 3).map(po => ({ id: po.id, poNumber: po.poNumber, status: po.status })),
    salesOrders: store.salesOrders.slice(0, 3).map(so => ({ id: so.id, soNumber: so.soNumber, status: so.status, channel: so.channel })),
    locations: store.locations.map(l => ({ id: l.id, name: l.name, type: l.type })),
    suppliers: store.suppliers.map(s => ({ id: s.id, name: s.name, code: s.code })),
  };

  return reply.send({
    users,
    sampleIds,
    apiPrefix: '/api/v1',
    externalApiPrefix: '/external',
    documentation: '/docs',
    authNote: 'Authentication is optional. Without a Bearer token, all requests run as ADMIN.',
  });
}

export async function setLatencyHandler(
  request: FastifyRequest<{ Body: { preset?: string; ms?: number } }>,
  reply: FastifyReply
) {
  const { preset, ms } = request.body;

  if (preset) {
    const success = setLatencyPreset(preset);
    if (!success) {
      return reply.status(400).send({
        error: `Invalid preset. Available: ${Object.keys(getPresets()).join(', ')}`,
      });
    }
    return reply.send({ status: 'ok', latencyMs: getLatency(), preset });
  }

  if (ms !== undefined) {
    setLatency(Math.max(0, ms));
    return reply.send({ status: 'ok', latencyMs: getLatency() });
  }

  return reply.send({
    currentLatencyMs: getLatency(),
    presets: getPresets(),
  });
}

export async function timeTravelHandler(
  request: FastifyRequest<{ Body: { date?: string; advanceDays?: number } }>,
  reply: FastifyReply
) {
  const { date, advanceDays } = request.body;

  if (date) {
    const d = new Date(date);
    if (isNaN(d.getTime())) {
      return reply.status(400).send({ error: 'Invalid date format' });
    }
    setMockNow(d);
    return reply.send({ status: 'ok', currentDate: d.toISOString() });
  }

  if (advanceDays !== undefined) {
    const current = now();
    current.setDate(current.getDate() + advanceDays);
    setMockNow(current);
    return reply.send({ status: 'ok', currentDate: current.toISOString() });
  }

  setMockNow(null);
  return reply.send({ status: 'ok', message: 'Reset to real time', currentDate: now().toISOString() });
}
