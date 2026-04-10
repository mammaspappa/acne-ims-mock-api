import type { FastifyInstance } from 'fastify';
import {
  runMatchingHandler,
  listProposals,
  getProposal,
  confirmProposal,
  rejectProposal,
  bulkConfirm,
  unmatchedSOs,
  unmatchedPOCapacity,
  matchingHealth,
  matchingTimeline,
  listRuns,
} from './matching.handlers.js';
import {
  runMatchingSchema,
  listProposalsSchema,
  getProposalSchema,
  confirmProposalSchema,
  rejectProposalSchema,
  bulkConfirmSchema,
  unmatchedSOsSchema,
  unmatchedPOCapacitySchema,
  matchingHealthSchema,
  matchingTimelineSchema,
  listRunsSchema,
} from './matching.schemas.js';

export async function matchingRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/matching/run', {
    schema: {
      ...runMatchingSchema,
      tags: ['Matching'],
      summary: 'Trigger a matching run',
      description:
        'Run the SO↔PO matching engine. Optionally filter by season, seasonYear, or skuId. ' +
        'Creates SOPOMatch proposals (score >= 0.50) and auto-confirms matches scoring >= 0.85. ' +
        'Returns the MatchingRun summary and all newly created match records.',
    },
  }, runMatchingHandler);

  fastify.get('/matching/proposals', {
    schema: {
      ...listProposalsSchema,
      tags: ['Matching'],
      summary: 'List match proposals',
      description:
        'List all SO↔PO match proposals with optional filters for status, skuId, salesOrderId, purchaseOrderId, ' +
        'and score range. Results are sorted by match score descending.',
    },
  }, listProposals);

  fastify.get('/matching/proposals/:id', {
    schema: {
      ...getProposalSchema,
      tags: ['Matching'],
      summary: 'Get match proposal details',
      description:
        'Returns full match details including scoring factor breakdown, linked SO/PO/SKU entities, ' +
        'and line-level information.',
    },
  }, getProposal);

  fastify.post('/matching/proposals/:id/confirm', {
    schema: {
      ...confirmProposalSchema,
      tags: ['Matching'],
      summary: 'Confirm a match proposal',
      description:
        'Confirm a PROPOSED match. Only matches in PROPOSED status can be confirmed. ' +
        'Updates status to CONFIRMED with confirmer and timestamp.',
    },
  }, confirmProposal);

  fastify.post('/matching/proposals/:id/reject', {
    schema: {
      ...rejectProposalSchema,
      tags: ['Matching'],
      summary: 'Reject a match proposal',
      description:
        'Reject a PROPOSED match with a reason. Only matches in PROPOSED status can be rejected. ' +
        'The rejection reason is stored for analytics and model improvement.',
    },
  }, rejectProposal);

  fastify.post('/matching/bulk-confirm', {
    schema: {
      ...bulkConfirmSchema,
      tags: ['Matching'],
      summary: 'Bulk confirm matches above threshold',
      description:
        'Confirm all PROPOSED matches with a score at or above the given threshold (default: 0.85). ' +
        'Returns the count and list of confirmed matches.',
    },
  }, bulkConfirm);

  fastify.get('/matching/unmatched-sos', {
    schema: {
      ...unmatchedSOsSchema,
      tags: ['Matching'],
      summary: 'List unmatched SO lines',
      description:
        'Returns SO lines that have unallocated quantity and no active match proposal. ' +
        'Useful for identifying demand that needs sourcing attention. Filterable by season, seasonYear, and channel.',
    },
  }, unmatchedSOs);

  fastify.get('/matching/unmatched-po-capacity', {
    schema: {
      ...unmatchedPOCapacitySchema,
      tags: ['Matching'],
      summary: 'List unmatched PO capacity',
      description:
        'Returns PO lines with available (unmatched) quantity. Shows supply that has not yet been ' +
        'allocated to any SO. Filterable by season, seasonYear, and supplierId.',
    },
  }, unmatchedPOCapacity);

  fastify.get('/matching/health', {
    schema: {
      ...matchingHealthSchema,
      tags: ['Matching'],
      summary: 'Matching health scorecard',
      description:
        'Seasonal matching health overview: match rate, average score, status breakdown, and per-channel statistics. ' +
        'Filterable by season and seasonYear.',
    },
  }, matchingHealth);

  fastify.get('/matching/timeline', {
    schema: {
      ...matchingTimelineSchema,
      tags: ['Matching'],
      summary: 'PO arrival vs SO deadline timeline',
      description:
        'Day-by-day timeline showing PO arrival quantities vs SO deadline quantities for the next N days (default: 60). ' +
        'The gapUnits field shows demand minus supply for each day. Filterable by season and seasonYear.',
    },
  }, matchingTimeline);

  fastify.get('/matching/runs', {
    schema: {
      ...listRunsSchema,
      tags: ['Matching'],
      summary: 'List matching run history',
      description:
        'Returns the history of matching engine runs, sorted by most recent first. ' +
        'Each run includes statistics on matches proposed, auto-confirmed, and unmatched.',
    },
  }, listRuns);
}
