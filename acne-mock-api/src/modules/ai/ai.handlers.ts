import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import type { Season } from '../../store/types.js';
import { paginate, parsePagination } from '../../utils/pagination.js';
import { filterItems } from '../../utils/filter.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';
import { getHistoricalSales } from '../../store/seed/history.seed.js';

// ─── GET /ai/forecasts ──────────────────────────────────

export async function listForecasts(
  request: FastifyRequest<{
    Querystring: {
      skuId?: string;
      locationId?: string;
      season?: string;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { skuId, locationId, season } = request.query;

  let forecasts = store.demandForecasts;

  forecasts = filterItems(forecasts as unknown as Record<string, unknown>[], {
    ...(skuId && { skuId }),
    ...(locationId && { locationId }),
    ...(season && { season }),
  }) as unknown as typeof forecasts;

  const pagination = parsePagination(request.query);
  return reply.send(paginate(forecasts, pagination));
}

// ─── GET /ai/forecasts/:skuId ───────────────────────────

export async function getForecastBySku(
  request: FastifyRequest<{ Params: { skuId: string } }>,
  reply: FastifyReply
) {
  const { skuId } = request.params;

  const sku = store.findById(store.skus, skuId);
  if (!sku) {
    return reply.status(404).send({ error: 'SKU not found' });
  }

  const product = store.findById(store.products, sku.productId);

  const forecasts = store.demandForecasts
    .filter(f => f.skuId === skuId)
    .sort((a, b) => new Date(a.forecastDate).getTime() - new Date(b.forecastDate).getTime());

  if (forecasts.length === 0) {
    return reply.status(404).send({ error: 'No forecasts found for this SKU' });
  }

  const totalPredictedDemand = forecasts.reduce((sum, f) => sum + f.predictedDemand, 0);
  const avgConfidenceLow = Math.round(forecasts.reduce((sum, f) => sum + f.confidenceLow, 0) / forecasts.length);
  const avgConfidenceHigh = Math.round(forecasts.reduce((sum, f) => sum + f.confidenceHigh, 0) / forecasts.length);

  return reply.send({
    skuId,
    sku: sku.sku,
    productName: product?.name ?? 'Unknown',
    forecasts,
    summary: {
      totalPredictedDemand,
      avgConfidenceLow,
      avgConfidenceHigh,
      weeksForecasted: forecasts.length,
      modelVersion: forecasts[0].modelVersion,
    },
  });
}

// ─── GET /ai/recommendations ────────────────────────────

export async function listRecommendations(
  request: FastifyRequest<{
    Querystring: {
      type?: string;
      status?: string;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { type, status } = request.query;

  let recs = store.aiRecommendations;

  recs = filterItems(recs as unknown as Record<string, unknown>[], {
    ...(type && { type }),
    ...(status && { status }),
  }) as unknown as typeof recs;

  const pagination = parsePagination(request.query);
  return reply.send(paginate(recs, pagination));
}

// ─── POST /ai/recommendations/:id/accept ────────────────

export async function acceptRecommendation(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const rec = store.findById(store.aiRecommendations, request.params.id);
  if (!rec) {
    return reply.status(404).send({ error: 'Recommendation not found' });
  }

  if (rec.status !== 'PENDING') {
    return reply.status(400).send({
      error: `Cannot accept recommendation with status '${rec.status}'. Only PENDING recommendations can be accepted.`,
    });
  }

  const ts = now().toISOString();
  const updated = store.update(store.aiRecommendations, rec.id, {
    status: 'ACCEPTED',
    acceptedById: 'system',
    acceptedAt: ts,
  });

  return reply.send(updated);
}

// ─── POST /ai/recommendations/:id/dismiss ───────────────

export async function dismissRecommendation(
  request: FastifyRequest<{
    Params: { id: string };
    Body: { reason?: string } | undefined;
  }>,
  reply: FastifyReply
) {
  const rec = store.findById(store.aiRecommendations, request.params.id);
  if (!rec) {
    return reply.status(404).send({ error: 'Recommendation not found' });
  }

  if (rec.status !== 'PENDING') {
    return reply.status(400).send({
      error: `Cannot dismiss recommendation with status '${rec.status}'. Only PENDING recommendations can be dismissed.`,
    });
  }

  const updated = store.update(store.aiRecommendations, rec.id, {
    status: 'DISMISSED',
  });

  // Store reason in reasoning
  const body = request.body as { reason?: string } | undefined;
  if (body?.reason && updated) {
    updated.reasoning = {
      ...updated.reasoning,
      dismissalReason: body.reason,
    };
  }

  return reply.send(updated);
}

// ─── GET /ai/anomalies ──────────────────────────────────

export async function listAnomalies(
  request: FastifyRequest<{
    Querystring: {
      type?: string;
      severity?: string;
      isResolved?: boolean;
      page?: number;
      limit?: number;
    };
  }>,
  reply: FastifyReply
) {
  const { type, severity, isResolved } = request.query;

  let anomalies = store.anomalyAlerts;

  anomalies = filterItems(anomalies as unknown as Record<string, unknown>[], {
    ...(type && { type }),
    ...(severity && { severity }),
    ...(isResolved !== undefined && { isResolved }),
  }) as unknown as typeof anomalies;

  const pagination = parsePagination(request.query);
  return reply.send(paginate(anomalies, pagination));
}

// ─── POST /ai/anomalies/:id/resolve ─────────────────────

export async function resolveAnomaly(
  request: FastifyRequest<{
    Params: { id: string };
  }>,
  reply: FastifyReply
) {
  const anomaly = store.findById(store.anomalyAlerts, request.params.id);
  if (!anomaly) {
    return reply.status(404).send({ error: 'Anomaly not found' });
  }

  if (anomaly.isResolved) {
    return reply.status(400).send({ error: 'Anomaly is already resolved' });
  }

  const ts = now().toISOString();
  const updated = store.update(store.anomalyAlerts, anomaly.id, {
    isResolved: true,
    resolvedById: 'system',
    resolvedAt: ts,
  });

  return reply.send(updated);
}

// ─── GET /ai/models ─────────────────────────────────────

export async function listModels(
  _request: FastifyRequest,
  reply: FastifyReply
) {
  return reply.send({ data: store.modelRegistry });
}

// ─── POST /ai/models/:name/retrain ──────────────────────

export async function retrainModel(
  request: FastifyRequest<{ Params: { name: string } }>,
  reply: FastifyReply
) {
  const { name } = request.params;

  const model = store.modelRegistry.find(m => m.modelName === name);
  if (!model) {
    return reply.status(404).send({ error: `Model '${name}' not found in registry` });
  }

  const ts = now().toISOString();
  const currentMajor = parseInt(model.version.split('.')[0], 10);
  const currentMinor = parseInt(model.version.split('.')[1], 10);
  const newVersion = `${currentMajor}.${currentMinor + 1}.0`;

  const newEntry = {
    id: generateId(),
    modelName: model.modelName,
    version: newVersion,
    status: 'TRAINING',
    metrics: {},
    hyperparameters: model.hyperparameters,
    trainingDataRange: {
      from: model.trainingDataRange.from,
      to: ts,
      recordCount: ((model.trainingDataRange as Record<string, unknown>).recordCount as number ?? 50000) + 5000,
    },
    artifactPath: `s3://acne-ml-models/${model.modelName}/v${newVersion}/`,
    trainedAt: ts,
    activatedAt: null,
    createdAt: ts,
  };

  store.insert(store.modelRegistry, newEntry);

  return reply.send({
    ...newEntry,
    message: `Retraining triggered for model '${name}'. New version ${newVersion} is now in TRAINING status.`,
  });
}

// ─── GET /ai/matching/scores ────────────────────────────

export async function getMatchingScores(
  request: FastifyRequest<{
    Querystring: { page?: number; limit?: number };
  }>,
  reply: FastifyReply
) {
  // Return current proposed matches with their neural scoring details
  const proposedMatches = store.sopoMatches
    .filter(m => m.status === 'PROPOSED' || m.status === 'AUTO_CONFIRMED')
    .map(m => ({
      matchId: m.id,
      salesOrderId: m.salesOrderId,
      purchaseOrderId: m.purchaseOrderId,
      skuId: m.skuId,
      quantityMatched: m.quantityMatched,
      matchScore: m.matchScore,
      matchFactors: m.matchFactors,
      status: m.status,
      proposedBy: m.proposedBy,
      expectedFulfillDate: m.expectedFulfillDate,
      createdAt: m.createdAt,
    }));

  const pagination = parsePagination(request.query);
  return reply.send(paginate(proposedMatches, pagination));
}

// ─── GET /ai/insights/season/:season/:year ──────────────

export async function getSeasonalInsights(
  request: FastifyRequest<{ Params: { season: string; year: number } }>,
  reply: FastifyReply
) {
  const { season, year } = request.params;
  const seasonYear = Number(year);

  // Demand summary
  const seasonForecasts = store.demandForecasts.filter(
    f => f.season === season && f.seasonYear === seasonYear
  );

  const totalForecastedUnits = seasonForecasts.reduce((sum, f) => sum + f.predictedDemand, 0);

  // Aggregate forecasts by SKU and pick top 5
  const skuDemand = new Map<string, number>();
  for (const f of seasonForecasts) {
    skuDemand.set(f.skuId, (skuDemand.get(f.skuId) ?? 0) + f.predictedDemand);
  }
  const topSkus = Array.from(skuDemand.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([skuId, demand]) => {
      const sku = store.findById(store.skus, skuId);
      const product = sku ? store.findById(store.products, sku.productId) : undefined;
      return {
        skuId,
        sku: sku?.sku ?? 'Unknown',
        productName: product?.name ?? 'Unknown',
        forecastedDemand: demand,
      };
    });

  const avgConfidence = seasonForecasts.length > 0
    ? Math.round(
        (seasonForecasts.reduce((sum, f) => sum + (f.confidenceHigh - f.confidenceLow), 0) /
          seasonForecasts.length) * 100
      ) / 100
    : 0;

  // Recommendations summary
  const allRecs = store.aiRecommendations;
  const pendingRecs = allRecs.filter(r => r.status === 'PENDING');
  const acceptedRecs = allRecs.filter(r => r.status === 'ACCEPTED');
  const dismissedRecs = allRecs.filter(r => r.status === 'DISMISSED');

  const recByType: Record<string, number> = {};
  for (const r of allRecs) {
    recByType[r.type] = (recByType[r.type] ?? 0) + 1;
  }

  // Anomalies summary
  const allAnomalies = store.anomalyAlerts;
  const unresolvedAnomalies = allAnomalies.filter(a => !a.isResolved);
  const bySeverity: Record<string, number> = {};
  for (const a of allAnomalies) {
    bySeverity[a.severity] = (bySeverity[a.severity] ?? 0) + 1;
  }

  // Matching performance
  const allMatches = store.sopoMatches;
  const avgScore = allMatches.length > 0
    ? Math.round((allMatches.reduce((sum, m) => sum + m.matchScore, 0) / allMatches.length) * 100) / 100
    : 0;
  const autoConfirmed = allMatches.filter(m => m.status === 'AUTO_CONFIRMED').length;
  const autoConfirmRate = allMatches.length > 0
    ? Math.round((autoConfirmed / allMatches.length) * 100) / 100
    : 0;

  // Historical sales context
  const history = getHistoricalSales();
  const recentWeeks = history.slice(-100);
  const totalHistoricalRevenue = recentWeeks.reduce((sum, r) => sum + r.revenue, 0);

  return reply.send({
    season,
    year: seasonYear,
    demandSummary: {
      totalForecastedUnits,
      topSkus,
      avgConfidence,
      forecastCount: seasonForecasts.length,
    },
    recommendations: {
      total: allRecs.length,
      pending: pendingRecs.length,
      accepted: acceptedRecs.length,
      dismissed: dismissedRecs.length,
      byType: recByType,
    },
    anomalies: {
      total: allAnomalies.length,
      unresolved: unresolvedAnomalies.length,
      bySeverity,
    },
    matchingPerformance: {
      totalMatches: allMatches.length,
      avgScore,
      autoConfirmRate,
    },
    historicalContext: {
      recentWeeksAnalyzed: recentWeeks.length,
      totalRevenue: Math.round(totalHistoricalRevenue * 100) / 100,
    },
  });
}
