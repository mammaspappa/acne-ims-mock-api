import type { FastifyInstance } from 'fastify';
import {
  listStakeholders,
  getStakeholder,
  createStakeholder,
  updateStakeholder,
  deleteStakeholder,
  listRoles,
  listLocations,
  listSuppliers,
} from './stakeholders.handlers.js';
import {
  listStakeholdersSchema,
  getStakeholderSchema,
  createStakeholderSchema,
  updateStakeholderSchema,
  deleteStakeholderSchema,
  listRolesSchema,
  listLocationsSchema,
  listSuppliersSchema,
} from './stakeholders.schemas.js';

export async function stakeholderRoutes(fastify: FastifyInstance): Promise<void> {
  // Static routes must be registered before parameterised routes
  // to avoid Fastify treating "roles" / "locations" / "suppliers" as :id

  fastify.get('/stakeholders/roles', {
    schema: {
      ...listRolesSchema,
      tags: ['Stakeholders'],
      summary: 'List all available roles',
      description: 'Returns every UserRole enum value together with a human-readable description of the team or function it represents.',
    },
  }, listRoles);

  fastify.get('/stakeholders/locations', {
    schema: {
      ...listLocationsSchema,
      tags: ['Stakeholders'],
      summary: 'List all locations',
      description: 'Returns all warehouses, retail stores, and office locations available in the system.',
    },
  }, listLocations);

  fastify.get('/stakeholders/suppliers', {
    schema: {
      ...listSuppliersSchema,
      tags: ['Stakeholders'],
      summary: 'List all suppliers',
      description: 'Returns all registered suppliers / manufacturers including contact details and lead times.',
    },
  }, listSuppliers);

  fastify.get('/stakeholders', {
    schema: {
      ...listStakeholdersSchema,
      tags: ['Stakeholders'],
      summary: 'List all stakeholders',
      description: 'List all users with optional filters for role, locationId, supplierId, and active status. Supports free-text search across name and email.',
    },
  }, listStakeholders);

  fastify.get('/stakeholders/:id', {
    schema: {
      ...getStakeholderSchema,
      tags: ['Stakeholders'],
      summary: 'Get stakeholder by ID',
      description: 'Returns full user details for a single stakeholder (password hash excluded).',
    },
  }, getStakeholder);

  fastify.post('/stakeholders', {
    schema: {
      ...createStakeholderSchema,
      tags: ['Stakeholders'],
      summary: 'Create a new stakeholder',
      description: 'Create a new user with the specified role and optional location/supplier assignment. Defaults password to "hackathon2026" if not provided.',
    },
  }, createStakeholder);

  fastify.patch('/stakeholders/:id', {
    schema: {
      ...updateStakeholderSchema,
      tags: ['Stakeholders'],
      summary: 'Update a stakeholder',
      description: 'Partially update a stakeholder\'s profile. Any fields omitted from the body are left unchanged.',
    },
  }, updateStakeholder);

  fastify.delete('/stakeholders/:id', {
    schema: {
      ...deleteStakeholderSchema,
      tags: ['Stakeholders'],
      summary: 'Deactivate a stakeholder',
      description: 'Soft-deletes a stakeholder by setting isActive to false. The user record is retained for audit purposes.',
    },
  }, deleteStakeholder);
}
