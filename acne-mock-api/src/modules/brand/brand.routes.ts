import type { FastifyInstance } from 'fastify';
import {
  brandOverview, styleGuide, logoAssets, pricingGuide, storeDirectory,
  logoBlackSvg, logoWhiteSvg, facePatchSvg, logoLargeSvg,
} from './brand.handlers.js';

export async function brandRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', {
    schema: {
      tags: ['Brand Resources'],
      summary: 'Brand overview — company info, categories, key people, revenue',
      description: 'Returns comprehensive Acne Studios company information including founding history, leadership, revenue, product categories, seasonal structure, signature products, and notable collaborations. Structured for AI agent consumption.',
    },
  }, brandOverview);

  fastify.get('/style-guide', {
    schema: {
      tags: ['Brand Resources'],
      summary: 'Full brand style guide — identity, colors, typography, photography, packaging',
      description: 'Complete Acne Studios brand guidelines including visual identity, tone of voice, color palette, typography specifications, photography style, packaging materials, store design principles, and sustainability commitments.',
    },
  }, styleGuide);

  fastify.get('/logos', {
    schema: {
      tags: ['Brand Resources'],
      summary: 'Logo asset inventory with download URLs',
      description: 'Lists all available logo variants (wordmark, Face motif) with format, dimensions, and direct download URLs for SVG assets.',
    },
  }, logoAssets);

  fastify.get('/pricing', {
    schema: {
      tags: ['Brand Resources'],
      summary: 'Pricing guide — price ranges, wholesale markup, markdown policy',
      description: 'Retail price ranges by category, wholesale multiplier, exchange rates, and markdown/sale timing rules.',
    },
  }, pricingGuide);

  fastify.get('/stores', {
    schema: {
      tags: ['Brand Resources'],
      summary: 'Global store directory — regions, flagships, department store presence, marketplaces',
      description: 'Complete directory of Acne Studios retail presence: owned stores by region, flagship locations, department store partners, and online marketplace presence.',
    },
  }, storeDirectory);

  // SVG asset endpoints
  fastify.get('/assets/logo-black.svg', {
    schema: { tags: ['Brand Resources'], summary: 'Download: Logo (black on transparent)', description: 'SVG wordmark logo, black text on transparent background.' },
  }, logoBlackSvg);

  fastify.get('/assets/logo-white.svg', {
    schema: { tags: ['Brand Resources'], summary: 'Download: Logo (white on black)', description: 'SVG wordmark logo, white text on black background.' },
  }, logoWhiteSvg);

  fastify.get('/assets/face-patch.svg', {
    schema: { tags: ['Brand Resources'], summary: 'Download: Face motif SVG', description: 'The signature Face smiley used on the Face Collection.' },
  }, facePatchSvg);

  fastify.get('/assets/logo-wordmark-large.svg', {
    schema: { tags: ['Brand Resources'], summary: 'Download: Large wordmark SVG', description: 'Large-format wordmark for hero sections and print.' },
  }, logoLargeSvg);

  fastify.get('/assets/logo-black-transparent.svg', {
    schema: { tags: ['Brand Resources'], summary: 'Download: Logo (black on transparent) — alias', description: 'Same as logo-black.svg.' },
  }, logoBlackSvg);
}
