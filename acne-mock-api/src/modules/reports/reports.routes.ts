import type { FastifyInstance } from 'fastify';
import {
  seasonalBuySummary,
  openToBuy,
  sellThrough,
  fulfillmentSla,
  grossMargin,
  supplierPerformance,
  stockAging,
  matchHealth,
  executiveKpis,
} from './reports.handlers.js';
import {
  seasonalBuySummarySchema,
  openToBuySchema,
  sellThroughSchema,
  fulfillmentSlaSchema,
  grossMarginSchema,
  supplierPerformanceSchema,
  stockAgingSchema,
  matchHealthSchema,
  executiveKpisSchema,
} from './reports.schemas.js';

export async function reportRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/reports/seasonal-buy-summary', {
    schema: {
      ...seasonalBuySummarySchema,
      tags: ['Reports'],
      summary: 'Seasonal buy summary',
      description: 'Returns PO spend versus budget breakdown by season, category, and supplier. Includes status distribution of purchase orders.',
    },
  }, seasonalBuySummary);

  fastify.get('/reports/open-to-buy', {
    schema: {
      ...openToBuySchema,
      tags: ['Reports'],
      summary: 'Open-to-buy report',
      description: 'Shows remaining budget by category for the specified season. Calculates committed spend from active purchase orders against category-level budgets.',
    },
  }, openToBuy);

  fastify.get('/reports/sell-through', {
    schema: {
      ...sellThroughSchema,
      tags: ['Reports'],
      summary: 'Sell-through analysis',
      description: 'Calculates sell-through rates (units sold / units received) broken down by channel and category. Supports filtering by channel, category, and season.',
    },
  }, sellThrough);

  fastify.get('/reports/fulfillment-sla', {
    schema: {
      ...fulfillmentSlaSchema,
      tags: ['Reports'],
      summary: 'Fulfillment SLA compliance',
      description: 'Reports the percentage of orders shipped within the target SLA window. Default target is 3 days. Breakdown by channel included.',
    },
  }, fulfillmentSla);

  fastify.get('/reports/gross-margin', {
    schema: {
      ...grossMarginSchema,
      tags: ['Reports'],
      summary: 'Gross margin report',
      description: 'Calculates revenue minus COGS (cost of goods sold) with margin percentages. Breakdowns by sales channel and product category.',
    },
  }, grossMargin);

  fastify.get('/reports/supplier-performance', {
    schema: {
      ...supplierPerformanceSchema,
      tags: ['Reports'],
      summary: 'Supplier performance scorecard',
      description: 'Evaluates supplier performance including on-time delivery rate, average lead time, defect rate, total units ordered/received, and total spend.',
    },
  }, supplierPerformance);

  fastify.get('/reports/stock-aging', {
    schema: {
      ...stockAgingSchema,
      tags: ['Reports'],
      summary: 'Stock aging analysis',
      description: 'Analyzes inventory age distribution across aging buckets (0-30, 31-60, 61-90, 91-180, 180+ days). Shows the oldest stock items by SKU and location.',
    },
  }, stockAging);

  fastify.get('/reports/match-health', {
    schema: {
      ...matchHealthSchema,
      tags: ['Reports'],
      summary: 'SO-PO match health dashboard',
      description: 'Reports overall match rate, auto-confirm rate, average match score, status distribution, and recent matching run history.',
    },
  }, matchHealth);

  fastify.get('/reports/executive-kpis', {
    schema: {
      ...executiveKpisSchema,
      tags: ['Reports'],
      summary: 'Executive KPI dashboard',
      description: 'Returns a comprehensive KPI dashboard including revenue by channel, inventory levels and value, order counts, supplier/location stats, and AI system health metrics.',
    },
  }, executiveKpis);
}
