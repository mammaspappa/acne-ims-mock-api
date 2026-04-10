import type { FastifyInstance } from 'fastify';
import { loginHandler, meHandler } from './auth.handlers.js';
import { loginSchema, meSchema } from './auth.schemas.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/auth/login', {
    schema: {
      ...loginSchema,
      tags: ['Auth'],
      summary: 'Login with email and password',
      description: 'Returns a JWT token. All seeded users use password "hackathon2026".',
    },
  }, loginHandler);

  fastify.get('/auth/me', {
    schema: {
      ...meSchema,
      tags: ['Auth'],
      summary: 'Get current user profile',
      description: 'Returns the authenticated user profile. Without a token, returns ADMIN.',
    },
  }, meHandler);
}
