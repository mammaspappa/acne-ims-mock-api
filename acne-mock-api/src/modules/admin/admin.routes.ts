import type { FastifyInstance } from 'fastify';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { healthHandler, resetHandler, seedInfoHandler, setLatencyHandler, timeTravelHandler } from './admin.handlers.js';
import { getDashboardHtml } from './dashboard.html.js';
import { getSimulationState, getSimulationLog, startSimulation, stopSimulation, validatePassphrase } from './simulation.js';
import { getScenarioCatalog, getActiveScenarios, activateScenario, deactivateScenario } from './scenarios.js';

export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/admin/health', {
    schema: {
      tags: ['Admin'],
      summary: 'Health check',
      description: 'Returns server status and data statistics.',
    },
  }, healthHandler);

  fastify.post('/admin/reset', {
    schema: {
      tags: ['Admin'],
      summary: 'Reset all data to seed state',
      description: 'Restores all collections to their initial seeded values. Useful when hackathon teams want a fresh start.',
    },
  }, resetHandler);

  fastify.get('/admin/seed-info', {
    schema: {
      tags: ['Admin'],
      summary: 'Get seed data information',
      description: 'Returns all test user credentials, sample entity IDs, and API documentation links.',
    },
  }, seedInfoHandler);

  fastify.post('/admin/latency', {
    schema: {
      tags: ['Admin'],
      summary: 'Set simulated response latency',
      description: 'Set latency by preset (none, fast, realistic, slow) or exact milliseconds. Per-request override available via X-Mock-Latency header.',
      body: {
        type: 'object',
        properties: {
          preset: { type: 'string', enum: ['none', 'fast', 'realistic', 'slow'] },
          ms: { type: 'number', minimum: 0 },
        },
      },
    },
  }, setLatencyHandler);

  fastify.post('/admin/time-travel', {
    schema: {
      tags: ['Admin'],
      summary: 'Change the mock server clock',
      description: 'Set a specific date or advance by N days. Affects seasonal calculations, forecast relevance, and PO delivery timing. Send empty body to reset to real time.',
      body: {
        type: 'object',
        properties: {
          date: { type: 'string', format: 'date-time' },
          advanceDays: { type: 'number' },
        },
      },
    },
  }, timeTravelHandler);

  // ─── Simulation ───────────────────────────────────────

  fastify.get('/admin/simulation', {
    schema: {
      tags: ['Admin'],
      summary: 'Get simulation status',
      description: 'Returns current simulation state: running, events generated, recent event log.',
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send(getSimulationState());
  });

  fastify.get('/admin/simulation/log', {
    schema: {
      tags: ['Admin'],
      summary: 'Get simulation event log',
      description: 'Returns the full simulation event log with pagination. Events are sorted newest-first.',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', default: 50 },
          offset: { type: 'number', default: 0 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { limit?: number; offset?: number } }>, reply: FastifyReply) => {
    return reply.send(getSimulationLog(request.query.limit || 50, request.query.offset || 0));
  });

  fastify.post('/admin/simulation/start', {
    schema: {
      tags: ['Admin'],
      summary: 'Start the business day simulation',
      description: 'Starts generating realistic mock events across all external systems. Requires passphrase "acne-hackathon-simulate-2026".\n\n**Options:**\n- `durationHours`: 0.5–720 (default 8). Use 0 for continuous (runs until stopped).\n- `speedMultiplier`: 1–1000 (default 1). Examples: 1=real-time, 10=10x, 60=8h→8min, 500=8h→58sec, 1000=8h→29sec.\n- `autoScenarios`: boolean (default false). When true, random disruptive scenarios are automatically triggered at random intervals during the simulation.\n\n**Presets:** `{ durationHours: 0, speedMultiplier: 100, autoScenarios: true }` = continuous fast stream with random disruptions.',
      body: {
        type: 'object',
        required: ['passphrase'],
        properties: {
          passphrase: { type: 'string' },
          durationHours: { type: 'number', default: 8, minimum: 0, maximum: 720, description: '0 = continuous (runs until manually stopped)' },
          speedMultiplier: { type: 'number', default: 1, minimum: 1, maximum: 1000, description: '1 = real-time, 100 = fast stream, 1000 = max speed' },
          autoScenarios: { type: 'boolean', default: false, description: 'Auto-trigger random scenarios at random intervals' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { passphrase: string; durationHours?: number; speedMultiplier?: number; autoScenarios?: boolean } }>, reply: FastifyReply) => {
    const { passphrase, durationHours = 8, speedMultiplier = 1, autoScenarios = false } = request.body;

    if (!validatePassphrase(passphrase)) {
      return reply.status(403).send({ error: 'Invalid passphrase', hint: 'The passphrase is documented in the API reference.' });
    }

    const effectiveDuration = durationHours === 0 ? 87600 : durationHours; // 0 = 10 years (effectively infinite)
    const started = await startSimulation(effectiveDuration, speedMultiplier, autoScenarios);
    if (!started) {
      return reply.status(409).send({ error: 'Simulation already running', state: getSimulationState() });
    }

    const continuous = durationHours === 0;
    const scenarioNote = autoScenarios ? ' Random scenarios will be triggered automatically.' : '';
    return reply.send({
      status: 'started',
      message: continuous
        ? `Simulation started in continuous mode at ${speedMultiplier}x speed. Will run until manually stopped.${scenarioNote}`
        : `Simulation started. Generating events for ${durationHours} hours at ${speedMultiplier}x speed.${scenarioNote}`,
      ...getSimulationState(),
    });
  });

  fastify.post('/admin/simulation/stop', {
    schema: {
      tags: ['Admin'],
      summary: 'Stop the business day simulation',
      description: 'Stops event generation. Requires the passphrase.',
      body: {
        type: 'object',
        required: ['passphrase'],
        properties: {
          passphrase: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { passphrase: string } }>, reply: FastifyReply) => {
    if (!validatePassphrase(request.body.passphrase)) {
      return reply.status(403).send({ error: 'Invalid passphrase' });
    }

    stopSimulation();
    return reply.send({
      status: 'stopped',
      ...getSimulationState(),
    });
  });

  // ─── Scenarios ──────────────────────────────────────────

  fastify.get('/admin/simulation/scenarios', {
    schema: {
      tags: ['Admin'],
      summary: 'List available scenarios',
      description: 'Returns the full catalog of 16 scenarios that can be activated during a simulation. Each entry includes description, affected business areas, configurable parameters, and defaults.',
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ scenarios: getScenarioCatalog() });
  });

  fastify.get('/admin/simulation/scenarios/active', {
    schema: {
      tags: ['Admin'],
      summary: 'List currently active scenarios',
      description: 'Returns all scenarios that are currently running or have been resolved during this simulation session.',
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ active: getActiveScenarios() });
  });

  fastify.post('/admin/simulation/scenarios/activate', {
    schema: {
      tags: ['Admin'],
      summary: 'Activate a scenario during simulation',
      description: 'Starts a scenario that injects disruptive events into the simulation. Requires a running simulation.\n\n**Available scenarios:** VIRAL_PRODUCT, CELEBRITY_ENDORSEMENT, FLASH_SALE_GONE_WRONG, GEOPOLITICAL_DISRUPTION, MARKET_RECESSION, GLOBAL_ECONOMIC_SLOWDOWN, CURRENCY_CRISIS, SUPPLIER_DISRUPTION, LOGISTICS_BOTTLENECK, RAW_MATERIAL_SHORTAGE, QUALITY_CRISIS, COUNTERFEIT_SURGE, WAREHOUSE_OUTAGE, PAYMENT_PROVIDER_OUTAGE, CYBER_INCIDENT, WEATHER_ANOMALY, SEASON_LAUNCH\n\n**Severity levels:** LOW, MEDIUM, HIGH, CRITICAL — controls event frequency and intensity.\n\nAll parameters except passphrase and scenarioId are optional — sensible random values are chosen if omitted.',
      body: {
        type: 'object',
        required: ['passphrase', 'scenarioId'],
        properties: {
          passphrase: { type: 'string' },
          scenarioId: { type: 'string' },
          severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
          durationMinutes: { type: 'number', minimum: 1 },
          market: { type: 'string', description: 'ISO country code (e.g., US, FR, JP, CN)' },
          region: { type: 'string', enum: ['EU', 'NA', 'APAC'] },
          productId: { type: 'string' },
          supplierId: { type: 'string' },
          locationId: { type: 'string' },
          category: { type: 'string' },
          provider: { type: 'string', description: 'Payment provider: Adyen or Klarna' },
          material: { type: 'string', description: 'Raw material name' },
          weatherType: { type: 'string', enum: ['unseasonably_warm', 'unseasonably_cold', 'extreme_heat', 'prolonged_rain', 'freak_snowstorm'] },
          discountPercent: { type: 'number', minimum: 5, maximum: 80 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { passphrase: string; scenarioId: string; [key: string]: unknown } }>, reply: FastifyReply) => {
    const { passphrase, scenarioId, ...params } = request.body;

    if (!validatePassphrase(passphrase)) {
      return reply.status(403).send({ error: 'Invalid passphrase' });
    }

    if (!getSimulationState().running) {
      return reply.status(409).send({ error: 'Simulation is not running. Start the simulation first before activating scenarios.' });
    }

    const result = activateScenario(scenarioId, params);
    if (!result) {
      return reply.status(400).send({
        error: `Unknown scenario: "${scenarioId}"`,
        availableScenarios: getScenarioCatalog().map(s => s.id),
      });
    }

    return reply.send({
      status: 'activated',
      message: `Scenario "${result.name}" activated at ${result.severity} severity. Expires at ${result.expiresAt}.`,
      scenario: result,
    });
  });

  fastify.post('/admin/simulation/scenarios/:instanceId/deactivate', {
    schema: {
      tags: ['Admin'],
      summary: 'Deactivate a running scenario',
      description: 'Manually stops a scenario before its natural expiration. Use the instanceId from the activation response.',
      params: {
        type: 'object',
        required: ['instanceId'],
        properties: {
          instanceId: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['passphrase'],
        properties: {
          passphrase: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { instanceId: string }; Body: { passphrase: string } }>, reply: FastifyReply) => {
    if (!validatePassphrase(request.body.passphrase)) {
      return reply.status(403).send({ error: 'Invalid passphrase' });
    }

    const result = deactivateScenario(request.params.instanceId);
    if (!result) {
      return reply.status(404).send({ error: 'Active scenario not found with that instanceId' });
    }

    return reply.send({
      status: 'deactivated',
      message: `Scenario "${result.name}" deactivated after generating ${result.eventsGenerated} events.`,
      scenario: result,
    });
  });
}
