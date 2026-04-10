import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import type { User, UserRole, Location, Supplier } from '../../store/types.js';
import { paginate, parsePagination } from '../../utils/pagination.js';
import { filterItems } from '../../utils/filter.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';

// ─── ROLE DESCRIPTIONS ───────────────────────────────

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  BUYER: 'Buying & Merchandising Team',
  WHOLESALE: 'Wholesale / Commercial Team',
  STORE_MGR: 'Retail Store Managers',
  STORE_ASSOC: 'Retail Sales Associates',
  ECOM: 'E-commerce Operations',
  WAREHOUSE: 'Warehouse / Logistics',
  SUPPLIER: 'Suppliers / Manufacturers',
  FINANCE: 'Finance / Accounting',
  PLANNER: 'Planning / Demand Team',
  EXEC: 'C-Suite / Directors',
  CS_AGENT: 'Customer Service',
  QA: 'Quality Assurance',
  ADMIN: 'System Administrator',
};

// ─── HELPERS ──────────────────────────────────────────

/** Strip passwordHash before sending to client */
function toPublicUser(user: User) {
  const { passwordHash, ...rest } = user;
  return rest;
}

// ─── LIST STAKEHOLDERS ────────────────────────────────

export async function listStakeholders(
  request: FastifyRequest<{
    Querystring: {
      role?: UserRole;
      locationId?: string;
      supplierId?: string;
      isActive?: boolean;
      search?: string;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { role, locationId, supplierId, isActive, search } = request.query;

  let users = store.users;

  if (search) {
    const q = search.toLowerCase();
    users = users.filter(
      u =>
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
    );
  }

  users = filterItems(users as unknown as Record<string, unknown>[], {
    ...(role && { role }),
    ...(locationId && { locationId }),
    ...(supplierId && { supplierId }),
    ...(isActive !== undefined && { isActive }),
  }) as unknown as User[];

  const pagination = parsePagination(request.query);
  const result = paginate(users, pagination);
  return reply.send({
    data: result.data.map(toPublicUser),
    pagination: result.pagination,
  });
}

// ─── GET STAKEHOLDER ──────────────────────────────────

export async function getStakeholder(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const user = store.findById(store.users, request.params.id);
  if (!user) {
    return reply.status(404).send({ error: 'Stakeholder not found' });
  }
  return reply.send(toPublicUser(user));
}

// ─── CREATE STAKEHOLDER ───────────────────────────────

export async function createStakeholder(
  request: FastifyRequest<{
    Body: {
      email: string;
      firstName: string;
      lastName: string;
      role: UserRole;
      locationId?: string;
      supplierId?: string;
      password?: string;
    };
  }>,
  reply: FastifyReply
) {
  const { email, firstName, lastName, role, locationId, supplierId, password } = request.body;

  // Check for duplicate email
  const existing = store.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return reply.status(409).send({ error: 'A user with this email already exists' });
  }

  // Validate locationId if provided
  if (locationId) {
    const location = store.findById(store.locations, locationId);
    if (!location) {
      return reply.status(400).send({ error: 'Invalid locationId — location not found' });
    }
  }

  // Validate supplierId if provided
  if (supplierId) {
    const supplier = store.findById(store.suppliers, supplierId);
    if (!supplier) {
      return reply.status(400).send({ error: 'Invalid supplierId — supplier not found' });
    }
  }

  const timestamp = now().toISOString();
  const user: User = {
    id: generateId(),
    email,
    passwordHash: password || 'hackathon2026',
    firstName,
    lastName,
    role,
    isActive: true,
    locationId: locationId || null,
    supplierId: supplierId || null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  store.insert(store.users, user);
  return reply.status(201).send(toPublicUser(user));
}

// ─── UPDATE STAKEHOLDER ───────────────────────────────

export async function updateStakeholder(
  request: FastifyRequest<{
    Params: { id: string };
    Body: {
      email?: string;
      firstName?: string;
      lastName?: string;
      role?: UserRole;
      locationId?: string | null;
      supplierId?: string | null;
      isActive?: boolean;
    };
  }>,
  reply: FastifyReply
) {
  const user = store.findById(store.users, request.params.id);
  if (!user) {
    return reply.status(404).send({ error: 'Stakeholder not found' });
  }

  const body = request.body;

  // Check for duplicate email if changing email
  if (body.email && body.email.toLowerCase() !== user.email.toLowerCase()) {
    const existing = store.users.find(
      u => u.email.toLowerCase() === body.email!.toLowerCase() && u.id !== user.id
    );
    if (existing) {
      return reply.status(409).send({ error: 'A user with this email already exists' });
    }
  }

  // Validate locationId if provided
  if (body.locationId) {
    const location = store.findById(store.locations, body.locationId);
    if (!location) {
      return reply.status(400).send({ error: 'Invalid locationId — location not found' });
    }
  }

  // Validate supplierId if provided
  if (body.supplierId) {
    const supplier = store.findById(store.suppliers, body.supplierId);
    if (!supplier) {
      return reply.status(400).send({ error: 'Invalid supplierId — supplier not found' });
    }
  }

  const patch: Partial<User> = {
    ...body,
    updatedAt: now().toISOString(),
  };

  const updated = store.update(store.users, user.id, patch);
  if (!updated) {
    return reply.status(500).send({ error: 'Failed to update stakeholder' });
  }

  return reply.send(toPublicUser(updated));
}

// ─── DELETE (DEACTIVATE) STAKEHOLDER ──────────────────

export async function deleteStakeholder(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const user = store.findById(store.users, request.params.id);
  if (!user) {
    return reply.status(404).send({ error: 'Stakeholder not found' });
  }

  const updated = store.update(store.users, user.id, {
    isActive: false,
    updatedAt: now().toISOString(),
  });

  if (!updated) {
    return reply.status(500).send({ error: 'Failed to deactivate stakeholder' });
  }

  return reply.send({
    status: 'ok',
    message: `Stakeholder ${user.firstName} ${user.lastName} (${user.email}) has been deactivated`,
  });
}

// ─── LIST ROLES ───────────────────────────────────────

export async function listRoles(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  const data = Object.entries(ROLE_DESCRIPTIONS).map(([role, description]) => ({
    role,
    description,
  }));
  return reply.send({ data });
}

// ─── LIST LOCATIONS ───────────────────────────────────

export async function listLocations(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  return reply.send({ data: store.locations });
}

// ─── LIST SUPPLIERS ───────────────────────────────────

export async function listSuppliers(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  return reply.send({ data: store.suppliers });
}
