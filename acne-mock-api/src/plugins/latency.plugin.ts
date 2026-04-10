import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';

let currentLatencyMs = config.latencyMs;

export function setLatency(ms: number): void {
  currentLatencyMs = ms;
}

export function getLatency(): number {
  return currentLatencyMs;
}

const PRESETS: Record<string, number> = {
  none: 0,
  fast: 75,
  realistic: 250,
  slow: 1000,
};

export function getPresets(): Record<string, number> {
  return { ...PRESETS };
}

export function setLatencyPreset(preset: string): boolean {
  if (preset in PRESETS) {
    currentLatencyMs = PRESETS[preset];
    return true;
  }
  return false;
}

export async function latencyPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onSend', async (request, _reply, payload) => {
    // Per-request override via header
    const headerLatency = request.headers['x-mock-latency'];
    const latency = headerLatency ? parseInt(String(headerLatency), 10) : currentLatencyMs;

    if (latency > 0) {
      // Add Gaussian jitter ±20%
      const jitter = latency * 0.2 * (Math.random() * 2 - 1);
      const delay = Math.max(0, Math.round(latency + jitter));
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    return payload;
  });
}
