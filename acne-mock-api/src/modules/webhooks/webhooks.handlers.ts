import type { FastifyRequest, FastifyReply } from 'fastify';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';

// ─── IN-MEMORY WEBHOOK LOG ───────────────────────────

interface WebhookEntry {
  id: string;
  source: string;
  receivedAt: string;
  headers: Record<string, string | string[] | undefined>;
  body: unknown;
}

const webhookLog: WebhookEntry[] = [];

// ─── HELPERS ──────────────────────────────────────────

function recordWebhook(source: string, request: FastifyRequest): WebhookEntry {
  const entry: WebhookEntry = {
    id: generateId(),
    source,
    receivedAt: now().toISOString(),
    headers: request.headers as Record<string, string | string[] | undefined>,
    body: request.body,
  };
  webhookLog.push(entry);
  return entry;
}

// ─── SALESFORCE COMMERCE CLOUD ────────────────────────

export async function salesforceWebhook(
  request: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply
) {
  const entry = recordWebhook('salesforce', request);
  return reply.status(200).send({
    status: 'ok',
    message: 'Salesforce Commerce Cloud webhook received',
    webhookId: entry.id,
    receivedAt: entry.receivedAt,
  });
}

// ─── NUORDER ──────────────────────────────────────────

export async function nuorderWebhook(
  request: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply
) {
  const entry = recordWebhook('nuorder', request);
  return reply.status(200).send({
    status: 'ok',
    message: 'NuORDER webhook received',
    webhookId: entry.id,
    receivedAt: entry.receivedAt,
  });
}

// ─── NEDAP ────────────────────────────────────────────

export async function nedapWebhook(
  request: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply
) {
  const entry = recordWebhook('nedap', request);
  return reply.status(200).send({
    status: 'ok',
    message: 'Nedap RFID webhook received',
    webhookId: entry.id,
    receivedAt: entry.receivedAt,
  });
}

// ─── CARRIER ──────────────────────────────────────────

export async function carrierWebhook(
  request: FastifyRequest<{ Body: unknown }>,
  reply: FastifyReply
) {
  const entry = recordWebhook('carrier', request);
  return reply.status(200).send({
    status: 'ok',
    message: 'Carrier tracking webhook received',
    webhookId: entry.id,
    receivedAt: entry.receivedAt,
  });
}

// ─── VIEW WEBHOOK LOG ─────────────────────────────────

export async function getWebhookLog(
  request: FastifyRequest<{
    Querystring: {
      source?: string;
      limit?: number;
    };
  }>,
  reply: FastifyReply
) {
  let entries = [...webhookLog];

  const { source, limit } = request.query;

  if (source) {
    entries = entries.filter(e => e.source === source);
  }

  // Return most recent first
  entries.reverse();

  const max = Math.min(limit || 50, 200);
  entries = entries.slice(0, max);

  return reply.send({
    data: entries,
    total: entries.length,
  });
}
