import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './config.js';
import { authHooksPlugin } from './plugins/auth.plugin.js';
import { latencyPlugin } from './plugins/latency.plugin.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { productRoutes } from './modules/products/products.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { seasonDropRoutes } from './modules/admin/season-drop.routes.js';
import { purchaseOrderRoutes } from './modules/purchase-orders/po.routes.js';
import { inventoryRoutes } from './modules/inventory/inventory.routes.js';
import { salesOrderRoutes } from './modules/sales-orders/so.routes.js';
import { stakeholderRoutes } from './modules/stakeholders/stakeholders.routes.js';
import { webhookRoutes } from './modules/webhooks/webhooks.routes.js';
import { matchingRoutes } from './modules/matching/matching.routes.js';
import { aiRoutes } from './modules/ai/ai.routes.js';
import { reportRoutes } from './modules/reports/reports.routes.js';
import { store } from './store/Store.js';
import { sfccRoutes } from './external/sfcc/sfcc.routes.js';
import { teamworkRoutes } from './external/teamwork/teamwork.routes.js';
import { blueYonderRoutes } from './external/blue-yonder/blue-yonder.routes.js';
import { temeraRoutes } from './external/temera/temera.routes.js';
import { d365Routes } from './external/d365/d365.routes.js';
import { nedapRoutes } from './external/nedap/nedap.routes.js';
import { nuorderRoutes } from './external/nuorder/nuorder.routes.js';
import { centricRoutes } from './external/centric/centric.routes.js';
import { mediusRoutes } from './external/medius/medius.routes.js';
import { adyenRoutes } from './external/payments/adyen.routes.js';
import { klarnaRoutes } from './external/payments/klarna.routes.js';
import { brandRoutes } from './modules/brand/brand.routes.js';
import { apiDirectoryRoute } from './external/api-directory.js';

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: config.logLevel,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true },
      },
    },
  });

  // CORS — allow everything for hackathon
  await fastify.register(cors, { origin: true });

  // JWT — registered at root level so all routes can access it
  await fastify.register(fastifyJwt, { secret: config.jwtSecret });

  // Swagger / OpenAPI
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Acne Studios IMS — Mock API',
        description: `Mock API server for the Acne Studios Inventory Management System hackathon.\n\n` +
          `**Authentication:** All endpoints work without authentication (defaults to ADMIN role). ` +
          `To test RBAC, POST to \`/api/v1/auth/login\` with any seeded user email and password \`hackathon2026\`.\n\n` +
          `**Reset data:** POST to \`/api/v1/admin/reset\` to restore all data to initial seed state.\n\n` +
          `**Seed info:** GET \`/api/v1/admin/seed-info\` for all test credentials and sample IDs.`,
        version: '1.0.0',
        contact: { name: 'Hackathon Support' },
      },
      servers: [{ url: '/' }],
      tags: [
        { name: 'Auth', description: 'Authentication & user profile' },
        { name: 'Products', description: 'Product catalog & SKUs' },
        { name: 'Purchase Orders', description: 'PO lifecycle management' },
        { name: 'Sales Orders', description: 'SO lifecycle management' },
        { name: 'Matching', description: 'SO↔PO matching engine' },
        { name: 'Inventory', description: 'Stock levels, transfers, adjustments' },
        { name: 'AI Intelligence', description: 'Forecasts, recommendations, anomalies' },
        { name: 'Reports', description: 'Analytics & reporting' },
        { name: 'Stakeholders', description: 'User & role management' },
        { name: 'Webhooks', description: 'Inbound webhook receivers for external system events' },
        { name: 'Admin', description: 'Server management, reset, latency, time-travel' },
        { name: 'External API Directory', description: 'Machine-readable directory of all 11 external system mocks — start here for AI agent discovery' },
        { name: 'External: SFCC', description: 'Salesforce Commerce Cloud mock' },
        { name: 'External: Teamwork', description: 'Teamwork Commerce OMS mock' },
        { name: 'External: Blue Yonder', description: 'Blue Yonder WMS mock' },
        { name: 'External: Nedap', description: 'Nedap iD Cloud RFID mock' },
        { name: 'External: NuORDER', description: 'NuORDER B2B wholesale mock' },
        { name: 'External: Centric', description: 'Centric Software PLM mock' },
        { name: 'External: Medius', description: 'Medius AP automation mock' },
        { name: 'External: Payments', description: 'Adyen & Klarna payment mocks' },
        { name: 'External: Temera DPP', description: 'Temera Digital Product Passport — EU ESPR compliance, NFC/QR, blockchain traceability' },
        { name: 'External: D365', description: 'Microsoft Dynamics 365 Finance & Operations — OData v4 ERP mock' },
        { name: 'Brand Resources', description: 'Acne Studios brand assets — logos, style guide, colors, typography, pricing, store directory' },
      ],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      defaultModelsExpandDepth: 3,
    },
  });

  // Auth hooks (currentUser decorator + onRequest)
  await fastify.register(authHooksPlugin);

  // Latency simulation
  await fastify.register(latencyPlugin);

  // API routes — all under /api/v1
  await fastify.register(async (api) => {
    await api.register(authRoutes);
    await api.register(productRoutes);
    await api.register(adminRoutes);
    await api.register(seasonDropRoutes);
    await api.register(purchaseOrderRoutes);
    await api.register(inventoryRoutes);
    await api.register(salesOrderRoutes);
    await api.register(stakeholderRoutes);
    await api.register(webhookRoutes);
    await api.register(matchingRoutes);
    await api.register(aiRoutes);
    await api.register(reportRoutes);
  }, { prefix: '/api/v1' });

  // ─── External System Mocks ──────────────────────────

  // Directory — lists all external APIs for AI agent discovery
  await fastify.register(apiDirectoryRoute, { prefix: '/external' });

  await fastify.register(sfccRoutes, {
    prefix: '/external/sfcc/shop/v24_5/organizations/acne-studios',
  });

  await fastify.register(teamworkRoutes, {
    prefix: '/external/teamwork/api/v2',
  });

  await fastify.register(blueYonderRoutes, {
    prefix: '/external/blue-yonder/api/v1',
  });

  await fastify.register(temeraRoutes, {
    prefix: '/external/temera/api/v1',
  });

  await fastify.register(d365Routes, {
    prefix: '/external/d365/data',
  });

  await fastify.register(nedapRoutes, {
    prefix: '/external/nedap/api/v2',
  });

  await fastify.register(nuorderRoutes, {
    prefix: '/external/nuorder/api/v1',
  });

  await fastify.register(centricRoutes, {
    prefix: '/external/centric/rest/v2',
  });

  await fastify.register(mediusRoutes, {
    prefix: '/external/medius/api/v1',
  });

  await fastify.register(adyenRoutes, {
    prefix: '/external/adyen/v71',
  });

  await fastify.register(klarnaRoutes, {
    prefix: '/external/klarna/payments/v1',
  });

  // ─── Brand Resources ──────────────────────────────────

  await fastify.register(brandRoutes, {
    prefix: '/brand',
  });

  // Dashboard — lightweight web UI showing API health and data
  const { getDashboardHtml } = await import('./modules/admin/dashboard.html.js');
  fastify.get('/', async (_request, reply) => {
    return reply.type('text/html').send(getDashboardHtml(`http://localhost:${config.port}`));
  });

  // Redirect /dashboard to root
  fastify.get('/dashboard', async (_request, reply) => {
    return reply.redirect('/');
  });

  // Suppress favicon 404
  fastify.get('/favicon.ico', async (_request, reply) => {
    return reply.status(204).send();
  });

  return fastify;
}

async function start() {
  const server = await buildServer();

  const stats = store.stats();
  server.log.info(`Seeded mock data: ${stats.products} products, ${stats.skus} SKUs, ${stats.purchaseOrders} POs, ${stats.salesOrders} SOs, ${stats.sopoMatches} matches`);

  try {
    await server.listen({ port: config.port, host: config.host });
    server.log.info(`\n  Acne Studios Mock API running at http://localhost:${config.port}`);
    server.log.info(`  Swagger UI: http://localhost:${config.port}/docs`);
    server.log.info(`  Seed info:  http://localhost:${config.port}/api/v1/admin/seed-info\n`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
