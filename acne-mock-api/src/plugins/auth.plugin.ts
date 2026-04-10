import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { UserRole } from '../store/types.js';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { userId: string; email: string; role: UserRole; locationId: string | null };
    user: { userId: string; email: string; role: UserRole; locationId: string | null };
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    jwt: import('@fastify/jwt').JWT;
  }
  interface FastifyRequest {
    currentUser: { userId: string; email: string; role: UserRole; locationId: string | null };
  }
}

const DEFAULT_USER = {
  userId: 'system',
  email: 'admin@acne.mock',
  role: 'ADMIN' as UserRole,
  locationId: null,
};

// This plugin adds the currentUser decorator and onRequest hook.
// JWT itself must be registered at the root level before this plugin.
export async function authHooksPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.decorateRequest('currentUser', null as any);

  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = await request.jwtVerify() as any;
        request.currentUser = decoded;
      } catch {
        request.currentUser = { ...DEFAULT_USER };
      }
    } else {
      request.currentUser = { ...DEFAULT_USER };
    }
  });
}

// Role check helper — use as preHandler
export function requireRoles(...roles: UserRole[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.currentUser) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    if (request.currentUser.role === 'ADMIN') return;
    if (!roles.includes(request.currentUser.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Required roles: ${roles.join(', ')}. Your role: ${request.currentUser.role}`,
      });
    }
  };
}
