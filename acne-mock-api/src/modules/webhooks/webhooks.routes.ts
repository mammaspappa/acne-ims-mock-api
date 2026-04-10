import type { FastifyInstance } from 'fastify';
import {
  salesforceWebhook,
  nuorderWebhook,
  nedapWebhook,
  carrierWebhook,
  getWebhookLog,
} from './webhooks.handlers.js';

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/webhooks/salesforce', {
    schema: {
      tags: ['Webhooks'],
      summary: 'Salesforce Commerce Cloud webhook',
      description: 'Inbound webhook endpoint for SFCC e-commerce order events. Accepts any JSON body, stores it in the in-memory webhook log, and returns a success acknowledgement.',
      body: { type: 'object', additionalProperties: true },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' },
            webhookId: { type: 'string' },
            receivedAt: { type: 'string' },
          },
        },
      },
    },
  }, salesforceWebhook);

  fastify.post('/webhooks/nuorder', {
    schema: {
      tags: ['Webhooks'],
      summary: 'NuORDER webhook',
      description: 'Inbound webhook endpoint for NuORDER wholesale order events. Accepts any JSON body, stores it in the in-memory webhook log, and returns a success acknowledgement.',
      body: { type: 'object', additionalProperties: true },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' },
            webhookId: { type: 'string' },
            receivedAt: { type: 'string' },
          },
        },
      },
    },
  }, nuorderWebhook);

  fastify.post('/webhooks/nedap', {
    schema: {
      tags: ['Webhooks'],
      summary: 'Nedap RFID webhook',
      description: 'Inbound webhook endpoint for Nedap iD Cloud RFID stock count events. Accepts any JSON body, stores it in the in-memory webhook log, and returns a success acknowledgement.',
      body: { type: 'object', additionalProperties: true },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' },
            webhookId: { type: 'string' },
            receivedAt: { type: 'string' },
          },
        },
      },
    },
  }, nedapWebhook);

  fastify.post('/webhooks/carrier', {
    schema: {
      tags: ['Webhooks'],
      summary: 'Carrier tracking webhook',
      description: 'Inbound webhook endpoint for carrier delivery tracking events. Accepts any JSON body, stores it in the in-memory webhook log, and returns a success acknowledgement.',
      body: { type: 'object', additionalProperties: true },
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            message: { type: 'string' },
            webhookId: { type: 'string' },
            receivedAt: { type: 'string' },
          },
        },
      },
    },
  }, carrierWebhook);

  fastify.get('/webhooks/log', {
    schema: {
      tags: ['Webhooks'],
      summary: 'View webhook history',
      description: 'Returns the in-memory log of all received webhooks, most recent first. Optionally filter by source (salesforce, nuorder, nedap, carrier) and limit results.',
      querystring: {
        type: 'object',
        properties: {
          source: { type: 'string', enum: ['salesforce', 'nuorder', 'nedap', 'carrier'] },
          limit: { type: 'number', default: 50 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  source: { type: 'string' },
                  receivedAt: { type: 'string' },
                  headers: { type: 'object', additionalProperties: true },
                  body: { type: 'object', additionalProperties: true },
                },
              },
            },
            total: { type: 'number' },
          },
        },
      },
    },
  }, getWebhookLog);
}
