export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  latencyMs: parseInt(process.env.MOCK_LATENCY_MS || '0', 10),
  jwtSecret: process.env.JWT_SECRET || 'acne-hackathon-2026',
  logLevel: (process.env.LOG_LEVEL || 'info') as 'info' | 'debug' | 'warn' | 'error',
} as const;
