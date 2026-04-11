import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { now } from '../../utils/date.js';
import { validatePassphrase } from './simulation.js';
import {
  executeSeasonDrop,
  checkCalendarDrops,
  getSeasonDrops,
  getSeasonDrop,
  getSeasonCalendar,
  loadDefaultCalendar,
  seasonLabel,
} from './season-drop.js';
import type { Season, SeasonCalendarEntry } from '../../store/types.js';

const VALID_SEASONS: Season[] = ['SS', 'AW', 'RESORT', 'PRE_FALL', 'CAPSULE'];

export async function seasonDropRoutes(fastify: FastifyInstance): Promise<void> {

  // ─── Manual drop trigger ──────────────────────────────

  fastify.post('/admin/season-drop', {
    schema: {
      tags: ['Admin'],
      summary: 'Trigger a season drop',
      description: 'Manually launches a new season collection — creates products, SKUs, initial inventory, and purchase orders. Requires passphrase.',
      body: {
        type: 'object',
        required: ['passphrase', 'season', 'seasonYear'],
        properties: {
          passphrase: { type: 'string' },
          season: { type: 'string', enum: VALID_SEASONS },
          seasonYear: { type: 'number', minimum: 2025, maximum: 2035 },
          styleCount: { type: 'number', minimum: 5, maximum: 60 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { passphrase: string; season: string; seasonYear: number; styleCount?: number } }>, reply: FastifyReply) => {
    const { passphrase, season, seasonYear, styleCount } = request.body;

    if (!validatePassphrase(passphrase)) {
      return reply.status(403).send({ error: 'Invalid passphrase', hint: 'The passphrase is documented in the API reference.' });
    }

    try {
      const result = executeSeasonDrop(store, season as Season, seasonYear, 'MANUAL', now().toISOString(), { styleCount });
      return reply.status(201).send({
        status: 'completed',
        message: `Season drop ${season} ${seasonYear} executed successfully`,
        drop: result.drop,
        summary: {
          productsCreated: result.products.length,
          skusCreated: result.skus.length,
          purchaseOrdersCreated: result.purchaseOrders.length,
          inventoryAllocated: result.drop.inventoryAllocated,
          sampleProducts: result.products.slice(0, 5).map(p => ({ id: p.id, name: p.name, styleNumber: p.styleNumber, category: p.category })),
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Season drop failed';
      return reply.status(409).send({ error: message });
    }
  });

  // ─── List all drops ───────────────────────────────────

  fastify.get('/admin/season-drops', {
    schema: {
      tags: ['Admin'],
      summary: 'List all season drops',
      description: 'Returns history of all season drops (manual, calendar, and seed).',
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ drops: getSeasonDrops(store) });
  });

  // ─── Get drop by ID ──────────────────────────────────

  fastify.get('/admin/season-drops/:id', {
    schema: {
      tags: ['Admin'],
      summary: 'Get season drop details',
      description: 'Returns details of a specific season drop including stats.',
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const drop = getSeasonDrop(store, request.params.id);
    if (!drop) {
      return reply.status(404).send({ error: 'Season drop not found' });
    }
    const products = store.products
      .filter(p => p.season === drop.season && p.seasonYear === drop.seasonYear)
      .map(p => ({ id: p.id, name: p.name, styleNumber: p.styleNumber, category: p.category }));
    return reply.send({ drop, products });
  });

  // ─── Calendar CRUD ────────────────────────────────────

  fastify.get('/admin/season-calendar', {
    schema: {
      tags: ['Admin'],
      summary: 'Get the season drop calendar',
      description: 'Returns the schedule of upcoming and past season drops. Calendar drops fire automatically when the simulation clock or time-travel passes the scheduled date.',
    },
  }, async (_request: FastifyRequest, reply: FastifyReply) => {
    loadDefaultCalendar(store);
    const calendar = getSeasonCalendar(store);
    const annotated = calendar.map(entry => {
      const drop = store.seasonDrops.find(
        d => d.season === entry.season && d.seasonYear === entry.seasonYear && d.status === 'COMPLETED',
      );
      return {
        ...entry,
        dropped: !!drop,
        dropId: drop?.id || null,
      };
    });
    return reply.send({ calendar: annotated, currentDate: now().toISOString() });
  });

  // ─── Add calendar entry ───────────────────────────────

  fastify.post('/admin/season-calendar', {
    schema: {
      tags: ['Admin'],
      summary: 'Add a season drop to the calendar',
      description: 'Schedules a new season drop. It will auto-fire when simulation or time-travel passes the drop date.',
      body: {
        type: 'object',
        required: ['passphrase', 'season', 'seasonYear', 'dropDate'],
        properties: {
          passphrase: { type: 'string' },
          season: { type: 'string', enum: VALID_SEASONS },
          seasonYear: { type: 'number', minimum: 2025, maximum: 2035 },
          dropDate: { type: 'string', format: 'date', description: 'ISO date (YYYY-MM-DD)' },
          label: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { passphrase: string; season: string; seasonYear: number; dropDate: string; label?: string } }>, reply: FastifyReply) => {
    const { passphrase, season, seasonYear, dropDate, label } = request.body;
    if (!validatePassphrase(passphrase)) {
      return reply.status(403).send({ error: 'Invalid passphrase' });
    }

    loadDefaultCalendar(store);

    const exists = store.seasonCalendar.find(e => e.season === season && e.seasonYear === seasonYear);
    if (exists) {
      return reply.status(409).send({ error: `Calendar entry for ${season} ${seasonYear} already exists`, entry: exists });
    }

    const entry: SeasonCalendarEntry = {
      season: season as Season,
      seasonYear,
      label: label || seasonLabel(season as Season, seasonYear),
      dropDate,
      enabled: true,
    };
    store.seasonCalendar.push(entry);
    return reply.status(201).send({ status: 'created', entry });
  });

  // ─── Remove calendar entry ────────────────────────────

  fastify.delete('/admin/season-calendar/:season/:seasonYear', {
    schema: {
      tags: ['Admin'],
      summary: 'Remove a season from the drop calendar',
      description: 'Removes a scheduled season drop. Does not undo drops that already happened.',
      params: {
        type: 'object',
        required: ['season', 'seasonYear'],
        properties: {
          season: { type: 'string' },
          seasonYear: { type: 'string' },
        },
      },
      body: {
        type: 'object',
        required: ['passphrase'],
        properties: { passphrase: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Params: { season: string; seasonYear: string }; Body: { passphrase: string } }>, reply: FastifyReply) => {
    if (!validatePassphrase(request.body.passphrase)) {
      return reply.status(403).send({ error: 'Invalid passphrase' });
    }
    const yearNum = parseInt(request.params.seasonYear, 10);
    const idx = store.seasonCalendar.findIndex(
      e => e.season === request.params.season && e.seasonYear === yearNum,
    );
    if (idx === -1) {
      return reply.status(404).send({ error: 'Calendar entry not found' });
    }
    const removed = store.seasonCalendar.splice(idx, 1)[0];
    return reply.send({ status: 'removed', entry: removed });
  });

  // ─── Force calendar check ─────────────────────────────

  fastify.post('/admin/season-calendar/check', {
    schema: {
      tags: ['Admin'],
      summary: 'Force a calendar drop check',
      description: 'Checks the calendar against the current mock time and executes any drops that are due. Requires passphrase.',
      body: {
        type: 'object',
        required: ['passphrase'],
        properties: { passphrase: { type: 'string' } },
      },
    },
  }, async (request: FastifyRequest<{ Body: { passphrase: string } }>, reply: FastifyReply) => {
    if (!validatePassphrase(request.body.passphrase)) {
      return reply.status(403).send({ error: 'Invalid passphrase' });
    }
    loadDefaultCalendar(store);
    const results = checkCalendarDrops(store, now());
    if (results.length === 0) {
      return reply.send({ status: 'ok', message: 'No drops due at current time', currentDate: now().toISOString() });
    }
    return reply.send({
      status: 'ok',
      message: `${results.length} season drop(s) executed`,
      drops: results.map(r => ({
        id: r.drop.id,
        label: r.drop.label,
        productsCreated: r.drop.productsCreated,
        skusCreated: r.drop.skusCreated,
      })),
      currentDate: now().toISOString(),
    });
  });
}
