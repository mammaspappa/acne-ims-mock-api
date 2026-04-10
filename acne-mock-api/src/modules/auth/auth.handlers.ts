import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';

export async function loginHandler(
  request: FastifyRequest<{ Body: { email: string; password: string } }>,
  reply: FastifyReply
) {
  const { email, password } = request.body;

  const user = store.users.find(u => u.email === email);
  if (!user) {
    return reply.status(401).send({ error: 'Invalid credentials' });
  }

  // Mock auth — plaintext password check
  if (user.passwordHash !== password) {
    return reply.status(401).send({ error: 'Invalid credentials' });
  }

  if (!user.isActive) {
    return reply.status(403).send({ error: 'Account is disabled' });
  }

  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    locationId: user.locationId,
  };

  const token = (request.server as any).jwt.sign(payload, { expiresIn: '24h' });

  return reply.send({
    token,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      locationId: user.locationId,
    },
  });
}

export async function meHandler(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const currentUser = request.currentUser || { userId: 'system', email: 'admin@acne.mock', role: 'ADMIN' as const, locationId: null };
  const user = store.users.find(u => u.id === currentUser.userId);

  if (!user) {
    return reply.send({
      id: 'system',
      email: 'admin@acne.mock',
      firstName: 'Admin',
      lastName: 'System',
      role: 'ADMIN',
      locationId: null,
      isActive: true,
    });
  }

  return reply.send({
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    locationId: user.locationId,
    isActive: user.isActive,
  });
}
