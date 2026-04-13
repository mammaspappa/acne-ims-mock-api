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

  // ─── AI Agent Discovery ──────────────────────────────
  // llms.txt standard (https://llmstxt.org) — Markdown summary for LLM consumers
  fastify.get('/llms.txt', async (_request, reply) => {
    const md = `# Acne Studios IMS — Mock API

> Hackathon mock server simulating the full supply chain and retail operations of Acne Studios, a Swedish luxury fashion house. 80+ retail stores, 20+ e-commerce sites, and ~800 wholesale partners across 50+ countries.

Base URL: \`${_request.protocol}://${_request.hostname}\`
All API endpoints: \`/api/v1/\`
Swagger UI: \`/docs\`
OpenAPI spec: \`/docs/json\`

## What this server does

This is a fully-simulated IMS (Inventory Management System) with:
- **In-memory data store** — seeded by running 30 days of business through the simulation engine
- **Live simulation engine** — generates realistic cross-system events in real time
- **16 external system mocks** — SFCC, Teamwork POS, Blue Yonder WMS, Nedap RFID, NuORDER, Centric PLM, Medius AP, Adyen, Klarna, Temera DPP, D365 ERP
- **20 disruption scenarios** — viral products, supplier disruptions, fraud rings, etc. (invisible to API consumers — discoverable only through data analysis)
- **Cross-system event chains** — one event triggers realistic cascades (e.g. ecom order → payment auth → OMS → WMS pick → carrier dispatch → RFID scan → delivery → DPP scan)

## Authentication

Optional. All endpoints default to ADMIN role with full access.
To test RBAC: \`POST /api/v1/auth/login\` with any seeded user email and password \`hackathon2026\`.

## Key endpoint groups

- \`/api/v1/products\` — product catalog and SKUs (54 products, 729 SKUs)
- \`/api/v1/purchase-orders\` — PO lifecycle with full state machine
- \`/api/v1/sales-orders\` — SO lifecycle (ECOMMERCE, WHOLESALE, CLIENTELING, RETAIL_STORE channels)
- \`/api/v1/inventory/levels\` — stock levels across all locations
- \`/api/v1/inventory/movements\` — audit trail of every stock change
- \`/api/v1/matching\` — intelligent SO↔PO matching engine with scoring
- \`/api/v1/stakeholders/suppliers\` — 15 real suppliers based on Acne sustainability reports
- \`/api/v1/ai/forecasts\`, \`/ai/recommendations\`, \`/ai/anomalies\` — AI-generated intelligence
- \`/api/v1/reports\` — analytics and KPIs

## External system mocks (11)

Each mock exposes a realistic subset of the real vendor's API at:
- \`/external/sfcc/...\` — Salesforce Commerce Cloud
- \`/external/teamwork/...\` — Teamwork Commerce (POS/OMS)
- \`/external/blue-yonder/...\` — Blue Yonder WMS
- \`/external/nedap/...\` — Nedap iD Cloud (RFID)
- \`/external/nuorder/...\` — NuORDER (B2B wholesale)
- \`/external/centric/...\` — Centric PLM
- \`/external/medius/...\` — Medius AP automation
- \`/external/temera/...\` — Temera Digital Product Passport
- \`/external/d365/...\` — Microsoft Dynamics 365 ERP
- \`/external/adyen/...\` — Adyen payments
- \`/external/klarna/...\` — Klarna payments

Machine-readable directory: \`/external\`

## Simulation control

Passphrase: \`acne-hackathon-simulate-2026\`

- \`GET /api/v1/admin/simulation\` — current state, event count, sim clock
- \`POST /api/v1/admin/simulation/start\` — start event generation. Body: \`{ passphrase, durationHours, speedMultiplier, autoScenarios?, startDate? }\`
- \`POST /api/v1/admin/simulation/stop\` — stop and clear
- \`GET /api/v1/admin/simulation/log?limit=50\` — recent generated events
- \`POST /api/v1/admin/reset\` — restore all data to seed state

## Scenarios (facilitator-only)

20 disruption scenarios that generate invisible data-level anomalies (no marker fields — must be discovered through analysis):

- Demand: VIRAL_PRODUCT, CELEBRITY_ENDORSEMENT, FLASH_SALE_GONE_WRONG
- Market: GEOPOLITICAL_DISRUPTION, MARKET_RECESSION, GLOBAL_ECONOMIC_SLOWDOWN, CURRENCY_CRISIS
- Supply: SUPPLIER_DISRUPTION, LOGISTICS_BOTTLENECK, RAW_MATERIAL_SHORTAGE
- Quality: QUALITY_CRISIS, COUNTERFEIT_SURGE, SIZING_DEFECT, SIZE_CURVE_ERROR
- Operational: WAREHOUSE_OUTAGE, PAYMENT_PROVIDER_OUTAGE, CYBER_INCIDENT, EMPLOYEE_FRAUD_RING
- External: WEATHER_ANOMALY, SEASON_LAUNCH

- \`GET /api/v1/admin/simulation/scenarios\` — catalog
- \`POST /api/v1/admin/simulation/scenarios/activate\` — trigger one
- \`GET /api/v1/admin/simulation/scenarios/active\` — active instances

## Key concepts for AI agents

1. **All data is in-memory** — \`POST /api/v1/admin/reset\` restores to seed state.
2. **Simulated time (simClock)** advances independently from wall clock when the simulation is running. Use it for time-sensitive analysis.
3. **Cross-system events are chained** with realistic delays — one SFCC order creates a trail across 6+ systems over hours/days of sim time.
4. **Scenarios are hidden** from API responses. Detecting them requires cross-system correlation, statistical anomaly detection, and pattern recognition.
5. **Sizes and seasons matter** — orders are weighted by a realistic size bell curve and seasonal demand patterns.
6. **Currency conversion** — ecom and POS prices are converted to local currency based on customer country.

## Quick discovery

- \`GET /api/v1/admin/health\` — current data stats (record counts per collection)
- \`GET /api/v1/admin/seed-info\` — test user credentials, sample IDs, example requests
- \`GET /ai-context.json\` — structured context for AI agents
- \`GET /docs/json\` — full OpenAPI 3 spec (all endpoints + schemas)

## Sample workflow

\`\`\`
# 1. Get current state
curl ${_request.protocol}://${_request.hostname}/api/v1/admin/health

# 2. Browse products
curl ${_request.protocol}://${_request.hostname}/api/v1/products?limit=10

# 3. Start simulation
curl -X POST ${_request.protocol}://${_request.hostname}/api/v1/admin/simulation/start \\
  -H 'Content-Type: application/json' \\
  -d '{"passphrase":"acne-hackathon-simulate-2026","durationHours":168,"speedMultiplier":500}'

# 4. Watch events stream
curl ${_request.protocol}://${_request.hostname}/api/v1/admin/simulation/log?limit=50

# 5. Analyze data (sales orders, stock movements, etc.)
curl ${_request.protocol}://${_request.hostname}/api/v1/sales-orders?limit=20
curl ${_request.protocol}://${_request.hostname}/api/v1/inventory/movements?limit=20
\`\`\`
`;
    return reply.type('text/markdown; charset=utf-8').send(md);
  });

  // Structured JSON context for programmatic AI agent discovery
  fastify.get('/ai-context.json', async (_request, reply) => {
    const baseUrl = `${_request.protocol}://${_request.hostname}`;
    const stats = store.stats();
    const ctx = {
      name: 'Acne Studios IMS — Mock API',
      version: '1.0.0',
      description: 'Hackathon mock server simulating the full supply chain and retail operations of Acne Studios.',
      baseUrl,
      apiBase: `${baseUrl}/api/v1`,
      docs: {
        swagger: `${baseUrl}/docs`,
        openapi: `${baseUrl}/docs/json`,
        llmsTxt: `${baseUrl}/llms.txt`,
        apiReference: `${baseUrl}/api/v1/admin/seed-info`,
      },
      auth: {
        required: false,
        defaultRole: 'ADMIN',
        loginEndpoint: `${baseUrl}/api/v1/auth/login`,
        testPassword: 'hackathon2026',
      },
      simulation: {
        passphrase: 'acne-hackathon-simulate-2026',
        status: `${baseUrl}/api/v1/admin/simulation`,
        start: `${baseUrl}/api/v1/admin/simulation/start`,
        stop: `${baseUrl}/api/v1/admin/simulation/stop`,
        log: `${baseUrl}/api/v1/admin/simulation/log`,
        reset: `${baseUrl}/api/v1/admin/reset`,
      },
      scenarios: {
        note: 'Scenarios inject data-level anomalies that are invisible in API responses. Detecting them is part of the hackathon challenge.',
        catalog: `${baseUrl}/api/v1/admin/simulation/scenarios`,
        active: `${baseUrl}/api/v1/admin/simulation/scenarios/active`,
        activate: `${baseUrl}/api/v1/admin/simulation/scenarios/activate`,
      },
      stats,
      coreEntities: {
        products: { endpoint: `${baseUrl}/api/v1/products`, count: stats.products },
        skus: { endpoint: `${baseUrl}/api/v1/skus`, count: stats.skus },
        locations: { endpoint: `${baseUrl}/api/v1/admin/seed-info`, count: stats.locations },
        suppliers: { endpoint: `${baseUrl}/api/v1/stakeholders/suppliers`, count: stats.suppliers },
        purchaseOrders: { endpoint: `${baseUrl}/api/v1/purchase-orders`, count: stats.purchaseOrders },
        salesOrders: { endpoint: `${baseUrl}/api/v1/sales-orders`, count: stats.salesOrders },
        stockLevels: { endpoint: `${baseUrl}/api/v1/inventory/levels`, count: stats.stockLevels },
        stockMovements: { endpoint: `${baseUrl}/api/v1/inventory/movements` },
        matches: { endpoint: `${baseUrl}/api/v1/matching/proposals`, count: stats.sopoMatches },
      },
      externalSystems: {
        directory: `${baseUrl}/external`,
        sfcc: `${baseUrl}/external/sfcc/shop/v24_5/organizations/acne-studios`,
        teamwork: `${baseUrl}/external/teamwork/api/v2`,
        blueYonder: `${baseUrl}/external/blue-yonder/api/v1`,
        nedap: `${baseUrl}/external/nedap/api/v2`,
        nuorder: `${baseUrl}/external/nuorder/api/v1`,
        centric: `${baseUrl}/external/centric/rest/v2`,
        medius: `${baseUrl}/external/medius/api/v1`,
        temera: `${baseUrl}/external/temera/api/v1`,
        d365: `${baseUrl}/external/d365/data`,
        adyen: `${baseUrl}/external/adyen/v71`,
        klarna: `${baseUrl}/external/klarna/payments/v1`,
      },
      conventions: {
        inMemory: 'All data is in-memory. POST /api/v1/admin/reset restores seed state.',
        simulatedTime: 'simClock advances independently when simulation is running — use it for time-sensitive analysis.',
        crossSystemChains: 'Events cascade across systems with realistic delays (payment → OMS → WMS → carrier → RFID → DPP).',
        hiddenScenarios: 'Scenarios generate data-level anomalies with no marker fields — detection requires statistical analysis.',
        seasonalDemand: 'Products are weighted by current season (outerwear in AW, t-shirts in SS).',
        sizeDistribution: 'Orders follow a realistic size bell curve (M=30%, L=25%, S=20%).',
        localCurrency: 'Ecom and POS prices are converted to customer\'s local currency.',
      },
    };
    return reply.send(ctx);
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
