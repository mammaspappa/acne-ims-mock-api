import type { FastifyInstance } from 'fastify';
import {
  getPaymentMethods,
  createPayment,
  capturePayment,
  refundPayment,
  cancelPayment,
  listPayments,
  getPaymentDetails,
  seedAdyenData,
} from './adyen.handlers.js';

export async function adyenRoutes(fastify: FastifyInstance): Promise<void> {
  // Ensure data is seeded on registration
  seedAdyenData();

  // POST /paymentMethods
  fastify.post('/paymentMethods', {
    schema: {
      tags: ['External: Payments'],
      summary: 'Get available payment methods',
      description:
        'Returns available payment methods for the given country and amount. ' +
        'Based on Adyen Checkout API v71. Includes Visa, Mastercard, Amex, Klarna, iDEAL, Swish depending on country.',
      body: {
        type: 'object',
        properties: {
          merchantAccount: { type: 'string', description: 'Merchant account name' },
          countryCode: { type: 'string', description: 'ISO 3166-1 alpha-2 country code (e.g. SE, NL, DE)' },
          amount: {
            type: 'object',
            properties: {
              value: { type: 'number', description: 'Amount in minor units (e.g. 10000 = 100.00 EUR)' },
              currency: { type: 'string', description: 'ISO 4217 currency code' },
            },
          },
        },
      },
    },
  }, getPaymentMethods);

  // POST /payments
  fastify.post('/payments', {
    schema: {
      tags: ['External: Payments'],
      summary: 'Create payment (Adyen)',
      description:
        'Start a payment authorisation. Returns a pspReference and resultCode. ' +
        'Mock always returns Authorised for valid requests. Based on Adyen Checkout API v71.',
      body: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: {
            type: 'object',
            required: ['value', 'currency'],
            properties: {
              value: { type: 'number', description: 'Amount in minor units' },
              currency: { type: 'string', description: 'Currency code' },
            },
          },
          reference: { type: 'string', description: 'Merchant reference (e.g. SO number)' },
          merchantAccount: { type: 'string', description: 'Merchant account name' },
          paymentMethod: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'Payment method type (scheme, ideal, klarna, swish)' },
              brand: { type: 'string', description: 'Card brand (visa, mastercard, amex)' },
            },
          },
          returnUrl: { type: 'string', description: 'URL to redirect after payment' },
          shopperReference: { type: 'string', description: 'Unique shopper ID' },
        },
      },
    },
  }, createPayment);

  // POST /payments/:pspReference/captures
  fastify.post('/payments/:pspReference/captures', {
    schema: {
      tags: ['External: Payments'],
      summary: 'Capture payment (Adyen)',
      description:
        'Capture a previously authorised payment. Supports partial captures. ' +
        'Based on Adyen Checkout API v71.',
      params: {
        type: 'object',
        properties: { pspReference: { type: 'string', description: 'PSP reference from payment authorisation' } },
        required: ['pspReference'],
      },
      body: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: {
            type: 'object',
            required: ['value', 'currency'],
            properties: {
              value: { type: 'number' },
              currency: { type: 'string' },
            },
          },
          merchantAccount: { type: 'string' },
        },
      },
    },
  }, capturePayment);

  // POST /payments/:pspReference/refunds
  fastify.post('/payments/:pspReference/refunds', {
    schema: {
      tags: ['External: Payments'],
      summary: 'Refund payment (Adyen)',
      description:
        'Refund a captured payment. Supports partial refunds. ' +
        'Based on Adyen Checkout API v71.',
      params: {
        type: 'object',
        properties: { pspReference: { type: 'string', description: 'PSP reference of the captured payment' } },
        required: ['pspReference'],
      },
      body: {
        type: 'object',
        required: ['amount'],
        properties: {
          amount: {
            type: 'object',
            required: ['value', 'currency'],
            properties: {
              value: { type: 'number' },
              currency: { type: 'string' },
            },
          },
          merchantAccount: { type: 'string' },
        },
      },
    },
  }, refundPayment);

  // POST /payments/:pspReference/cancels
  fastify.post('/payments/:pspReference/cancels', {
    schema: {
      tags: ['External: Payments'],
      summary: 'Cancel payment (Adyen)',
      description:
        'Cancel an authorised payment that has not been captured. ' +
        'Based on Adyen Checkout API v71.',
      params: {
        type: 'object',
        properties: { pspReference: { type: 'string', description: 'PSP reference of the authorised payment' } },
        required: ['pspReference'],
      },
      body: {
        type: 'object',
        properties: {
          merchantAccount: { type: 'string' },
        },
      },
    },
  }, cancelPayment);

  // GET /payments — list all payments
  fastify.get('/payments', {
    schema: {
      tags: ['External: Payments'],
      summary: 'List all payments (Adyen)',
      description:
        'List all payment records with optional filtering by status or merchant reference. ' +
        'This endpoint is mock-only — useful for browsing seeded payment data.',
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status (authorised, captured, refunded, cancelled)' },
          merchantReference: { type: 'string', description: 'Filter by merchant reference (e.g. SO number)' },
          limit: { type: 'string', description: 'Max results (default 50, max 100)' },
          offset: { type: 'string', description: 'Offset for pagination (default 0)' },
        },
      },
    },
  }, listPayments);

  // GET /payments/:pspReference
  fastify.get('/payments/:pspReference', {
    schema: {
      tags: ['External: Payments'],
      summary: 'Get payment details (Adyen)',
      description:
        'Get full payment details including captures, refunds, and cancellation status. ' +
        'This endpoint is mock-only (not in real Adyen Checkout API) — useful for debugging.',
      params: {
        type: 'object',
        properties: { pspReference: { type: 'string', description: 'PSP reference' } },
        required: ['pspReference'],
      },
    },
  }, getPaymentDetails);
}
