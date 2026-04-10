import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import { generateId } from '../../utils/id.js';
import { daysAgo, now } from '../../utils/date.js';

// ─── In-memory DPP store (seeded on first access) ────

interface DigitalProductPassport {
  passportId: string;
  skuId: string;
  productId: string;
  serialNumber: string;
  nfcTagId: string;
  qrCodeUrl: string;
  status: 'draft' | 'active' | 'archived';
  productInfo: {
    name: string;
    styleNumber: string;
    category: string;
    gender: string;
    colour: string;
    size: string;
    season: string;
    seasonYear: number;
    collection: string | null;
    madeIn: string;
    retailPrice: number;
    currency: string;
  };
  materials: Array<{
    name: string;
    percentage: number;
    origin: string;
    certified: boolean;
    certification: string | null;
    recycledContent: number;
  }>;
  sustainability: {
    carbonFootprintKg: number;
    waterUsageLiters: number;
    recyclabilityScore: number;
    durabilityRating: string;
    repairabilityIndex: number;
    circularityScore: number;
  };
  careInstructions: string[];
  endOfLifeInstructions: {
    recyclable: boolean;
    recyclingGuidance: string;
    takeback: string;
    donationSuggestion: string;
    materialRecovery: string[];
  };
  supplyChainEvents: SupplyChainEvent[];
  blockchainHash: string;
  createdAt: string;
  updatedAt: string;
}

interface SupplyChainEvent {
  id: string;
  eventType: string;
  location: string;
  timestamp: string;
  details: Record<string, unknown>;
  verifiedOnChain: boolean;
}

interface StockCountRecord {
  id: string;
  locationId: string;
  countedAt: string;
  totalItems: number;
  matchedItems: number;
  discrepancies: number;
  accuracyPercent: number;
  items: Array<{ gtin: string; expected: number; counted: number; difference: number }>;
}

let passports: DigitalProductPassport[] = [];
let stockCounts: StockCountRecord[] = [];
let seeded = false;

// Material profiles by product category
const MATERIAL_PROFILES: Record<string, Array<{ name: string; pct: number; origin: string; cert: string | null; recycled: number }>> = {
  'Outerwear': [
    { name: 'Virgin Wool', pct: 80, origin: 'Italy', cert: 'RWS (Responsible Wool Standard)', recycled: 0 },
    { name: 'Polyamide', pct: 15, origin: 'Germany', cert: null, recycled: 30 },
    { name: 'Elastane', pct: 5, origin: 'Japan', cert: null, recycled: 0 },
  ],
  'Denim': [
    { name: 'Organic Cotton', pct: 98, origin: 'Turkey', cert: 'GOTS (Global Organic Textile Standard)', recycled: 0 },
    { name: 'Elastane', pct: 2, origin: 'Japan', cert: null, recycled: 0 },
  ],
  'Knitwear': [
    { name: 'Mohair', pct: 47, origin: 'South Africa', cert: 'RMS (Responsible Mohair Standard)', recycled: 0 },
    { name: 'Polyamide', pct: 40, origin: 'Italy', cert: null, recycled: 25 },
    { name: 'Wool', pct: 13, origin: 'New Zealand', cert: 'RWS', recycled: 0 },
  ],
  'T-shirts': [
    { name: 'Organic Cotton', pct: 100, origin: 'India', cert: 'GOTS', recycled: 0 },
  ],
  'Trousers': [
    { name: 'Virgin Wool', pct: 70, origin: 'Italy', cert: 'RWS', recycled: 0 },
    { name: 'Polyester', pct: 25, origin: 'Taiwan', cert: 'GRS (Global Recycled Standard)', recycled: 100 },
    { name: 'Elastane', pct: 5, origin: 'Japan', cert: null, recycled: 0 },
  ],
  'Accessories': [
    { name: 'Full-Grain Leather', pct: 100, origin: 'Italy', cert: 'LWG Gold (Leather Working Group)', recycled: 0 },
  ],
  'Footwear': [
    { name: 'Full-Grain Leather', pct: 60, origin: 'Portugal', cert: 'LWG Silver', recycled: 0 },
    { name: 'Rubber', pct: 30, origin: 'Brazil', cert: 'FSC', recycled: 15 },
    { name: 'Textile Lining', pct: 10, origin: 'Italy', cert: null, recycled: 40 },
  ],
};

const CARE_INSTRUCTIONS: Record<string, string[]> = {
  'Outerwear': ['Dry clean only', 'Do not tumble dry', 'Cool iron if needed', 'Store on a padded hanger'],
  'Denim': ['Machine wash cold (30°C)', 'Wash inside out', 'Do not bleach', 'Hang dry', 'Wash infrequently to preserve colour'],
  'Knitwear': ['Hand wash only (30°C)', 'Lay flat to dry', 'Do not wring', 'Store folded, not hung'],
  'T-shirts': ['Machine wash cold (30°C)', 'Tumble dry low', 'Iron on low heat'],
  'Trousers': ['Machine wash cold (30°C)', 'Do not bleach', 'Hang dry', 'Iron on medium heat'],
  'Accessories': ['Wipe with dry cloth', 'Store in dust bag', 'Avoid prolonged sun exposure', 'Apply leather conditioner periodically'],
  'Footwear': ['Wipe with damp cloth', 'Use shoe trees when storing', 'Apply leather balm monthly', 'Avoid prolonged moisture'],
};

const MANUFACTURING_COUNTRIES: Record<string, string> = {
  'Outerwear': 'Italy', 'Denim': 'Turkey', 'Knitwear': 'Sweden',
  'T-shirts': 'Portugal', 'Trousers': 'China', 'Accessories': 'Italy', 'Footwear': 'Portugal',
};

const END_OF_LIFE: Record<string, { recyclingGuidance: string; materialRecovery: string[] }> = {
  'Outerwear': { recyclingGuidance: 'Remove buttons and zippers before textile recycling. Wool content can be mechanically recycled.', materialRecovery: ['Wool fibre recovery', 'Metal button/zipper reclamation'] },
  'Denim': { recyclingGuidance: 'Cotton denim is fully recyclable. Remove metal rivets and leather patches if present.', materialRecovery: ['Cotton fibre recovery', 'Metal rivet reclamation'] },
  'Knitwear': { recyclingGuidance: 'Mohair and wool blends can be recycled via mechanical fibre separation. Do not mix with synthetic-only streams.', materialRecovery: ['Mohair fibre recovery', 'Wool fibre recovery'] },
  'T-shirts': { recyclingGuidance: '100% organic cotton — fully recyclable in textile recycling streams. Cut off care labels before recycling.', materialRecovery: ['Cotton fibre recovery'] },
  'Trousers': { recyclingGuidance: 'Mixed fibres — separate wool and polyester components at a specialist recycler.', materialRecovery: ['Wool fibre recovery', 'Polyester pellet reclamation'] },
  'Accessories': { recyclingGuidance: 'Leather goods should be taken to a leather-specialist recycler or donated for reuse.', materialRecovery: ['Leather fibre recovery'] },
  'Footwear': { recyclingGuidance: 'Separate sole from upper at a shoe recycling facility. Rubber soles can be ground for playground surfacing.', materialRecovery: ['Leather fibre recovery', 'Rubber granulate', 'Textile lining recovery'] },
};

function seedPassports() {
  if (seeded) return;
  seeded = true;
  passports = [];

  // Create a DPP for every SKU — full coverage for EU ESPR compliance
  const skusToPassport = store.skus;

  for (const sku of skusToPassport) {
    const product = store.products.find(p => p.id === sku.productId);
    if (!product) continue;

    const materials = (MATERIAL_PROFILES[product.category] || MATERIAL_PROFILES['T-shirts']).map(m => ({
      name: m.name,
      percentage: m.pct,
      origin: m.origin,
      certified: !!m.cert,
      certification: m.cert,
      recycledContent: m.recycled,
    }));

    const madeIn = MANUFACTURING_COUNTRIES[product.category] || 'Portugal';
    const carbonBase = product.category === 'Outerwear' ? 25 : product.category === 'Denim' ? 18 : product.category === 'Footwear' ? 15 : product.category === 'Accessories' ? 12 : 8;
    const waterBase = product.category === 'Denim' ? 7500 : product.category === 'Outerwear' ? 3000 : product.category === 'Knitwear' ? 2500 : 1500;

    const events: SupplyChainEvent[] = [
      { id: generateId(), eventType: 'raw_material_sourced', location: materials[0].origin, timestamp: daysAgo(180 + Math.floor(Math.random() * 60)).toISOString(), details: { supplier: materials[0].name + ' supplier', batchId: `BATCH-${generateId().slice(0, 8)}` }, verifiedOnChain: true },
      { id: generateId(), eventType: 'manufacturing_started', location: madeIn, timestamp: daysAgo(120 + Math.floor(Math.random() * 30)).toISOString(), details: { factoryName: `Acne Studios ${madeIn} Facility`, factoryId: `FAC-${madeIn.slice(0, 2).toUpperCase()}-001` }, verifiedOnChain: true },
      { id: generateId(), eventType: 'quality_check_passed', location: madeIn, timestamp: daysAgo(100 + Math.floor(Math.random() * 20)).toISOString(), details: { inspector: 'QA Team', grade: 'A' }, verifiedOnChain: true },
      { id: generateId(), eventType: 'manufacturing_completed', location: madeIn, timestamp: daysAgo(90 + Math.floor(Math.random() * 15)).toISOString(), details: { lineNumber: Math.floor(Math.random() * 5) + 1 }, verifiedOnChain: true },
      { id: generateId(), eventType: 'shipped', location: madeIn, timestamp: daysAgo(80 + Math.floor(Math.random() * 10)).toISOString(), details: { carrier: 'DHL', trackingNumber: `DHL${Math.floor(Math.random() * 9000000000) + 1000000000}`, destination: 'Stockholm' }, verifiedOnChain: true },
      { id: generateId(), eventType: 'warehouse_received', location: 'Stockholm, Sweden', timestamp: daysAgo(60 + Math.floor(Math.random() * 15)).toISOString(), details: { warehouseId: store.locations[0]?.id, inspectionPassed: true }, verifiedOnChain: true },
    ];

    const passport: DigitalProductPassport = {
      passportId: `DPP-${sku.sku}`,
      skuId: sku.id,
      productId: product.id,
      serialNumber: `SN-${generateId().slice(0, 12).toUpperCase()}`,
      nfcTagId: sku.rfidTag || `NFC-${generateId().slice(0, 16)}`,
      qrCodeUrl: `https://dpp.acnestudios.mock/verify/${sku.sku}`,
      status: 'active',
      productInfo: {
        name: product.name,
        styleNumber: product.styleNumber,
        category: product.category,
        gender: product.gender,
        colour: sku.colour,
        size: sku.size,
        season: product.season,
        seasonYear: product.seasonYear,
        collection: product.collection,
        madeIn,
        retailPrice: sku.retailPrice,
        currency: 'SEK',
      },
      materials,
      sustainability: {
        carbonFootprintKg: Math.round((carbonBase + Math.random() * 5) * 10) / 10,
        waterUsageLiters: Math.round(waterBase + Math.random() * 500),
        recyclabilityScore: Math.round((0.5 + Math.random() * 0.4) * 100) / 100,
        durabilityRating: ['A', 'A', 'B+', 'A-'][Math.floor(Math.random() * 4)],
        repairabilityIndex: Math.round((6 + Math.random() * 3) * 10) / 10,
        circularityScore: Math.round((0.4 + Math.random() * 0.4) * 100) / 100,
      },
      careInstructions: CARE_INSTRUCTIONS[product.category] || CARE_INSTRUCTIONS['T-shirts'],
      endOfLifeInstructions: {
        recyclable: true,
        recyclingGuidance: (END_OF_LIFE[product.category] || END_OF_LIFE['T-shirts']).recyclingGuidance,
        takeback: 'Return to any Acne Studios store for our garment take-back programme. Items in good condition are resold via Acne Archive; others are recycled.',
        donationSuggestion: 'Donate wearable items to a local charity or textile collection point.',
        materialRecovery: (END_OF_LIFE[product.category] || END_OF_LIFE['T-shirts']).materialRecovery,
      },
      supplyChainEvents: events,
      blockchainHash: `0x${Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')}`,
      createdAt: daysAgo(90).toISOString(),
      updatedAt: daysAgo(Math.floor(Math.random() * 30)).toISOString(),
    };
    passports.push(passport);
  }
}

// ─── Handlers ─────────────────────────────────────────

export async function listPassports(request: FastifyRequest<{ Querystring: { productId?: string; season?: string; status?: string; limit?: number; offset?: number } }>, reply: FastifyReply) {
  seedPassports();
  let results = passports;
  const { productId, season, status, limit = 50, offset = 0 } = request.query;
  if (productId) results = results.filter(p => p.productId === productId);
  if (season) results = results.filter(p => p.productInfo.season === season);
  if (status) results = results.filter(p => p.status === status);
  const total = results.length;
  const page = results.slice(offset, offset + limit);
  return reply.send({ data: page.map(p => ({ passportId: p.passportId, skuId: p.skuId, productName: p.productInfo.name, status: p.status, nfcTagId: p.nfcTagId, qrCodeUrl: p.qrCodeUrl })), pagination: { offset, limit, total } });
}

export async function getPassport(request: FastifyRequest<{ Params: { passportId: string } }>, reply: FastifyReply) {
  seedPassports();
  const passport = passports.find(p => p.passportId === request.params.passportId);
  if (!passport) return reply.status(404).send({ error: 'Passport not found' });
  return reply.send({ data: passport });
}

export async function createPassport(request: FastifyRequest<{ Body: { skuId: string; serialNumber?: string; nfcTagId?: string } }>, reply: FastifyReply) {
  seedPassports();
  const { skuId, serialNumber, nfcTagId } = request.body;
  const sku = store.findById(store.skus, skuId);
  if (!sku) return reply.status(404).send({ error: 'SKU not found' });
  const product = store.findById(store.products, sku.productId);
  if (!product) return reply.status(404).send({ error: 'Product not found' });

  const passport: DigitalProductPassport = {
    passportId: `DPP-${sku.sku}-${generateId().slice(0, 6)}`,
    skuId: sku.id, productId: product.id,
    serialNumber: serialNumber || `SN-${generateId().slice(0, 12).toUpperCase()}`,
    nfcTagId: nfcTagId || sku.rfidTag || `NFC-${generateId().slice(0, 16)}`,
    qrCodeUrl: `https://dpp.acnestudios.mock/verify/${sku.sku}`,
    status: 'draft',
    productInfo: { name: product.name, styleNumber: product.styleNumber, category: product.category, gender: product.gender, colour: sku.colour, size: sku.size, season: product.season, seasonYear: product.seasonYear, collection: product.collection, madeIn: MANUFACTURING_COUNTRIES[product.category] || 'Portugal', retailPrice: sku.retailPrice, currency: 'SEK' },
    materials: (MATERIAL_PROFILES[product.category] || MATERIAL_PROFILES['T-shirts']).map(m => ({ name: m.name, percentage: m.pct, origin: m.origin, certified: !!m.cert, certification: m.cert, recycledContent: m.recycled })),
    sustainability: { carbonFootprintKg: 10, waterUsageLiters: 2000, recyclabilityScore: 0.6, durabilityRating: 'B+', repairabilityIndex: 7.0, circularityScore: 0.5 },
    careInstructions: CARE_INSTRUCTIONS[product.category] || [],
    endOfLifeInstructions: {
      recyclable: true,
      recyclingGuidance: (END_OF_LIFE[product.category] || END_OF_LIFE['T-shirts']).recyclingGuidance,
      takeback: 'Return to any Acne Studios store for our garment take-back programme.',
      donationSuggestion: 'Donate wearable items to a local charity or textile collection point.',
      materialRecovery: (END_OF_LIFE[product.category] || END_OF_LIFE['T-shirts']).materialRecovery,
    },
    supplyChainEvents: [],
    blockchainHash: `0x${Array.from({ length: 64 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('')}`,
    createdAt: now().toISOString(), updatedAt: now().toISOString(),
  };
  passports.push(passport);
  return reply.status(201).send({ data: passport });
}

export async function getPassportByNfc(request: FastifyRequest<{ Params: { nfcTagId: string } }>, reply: FastifyReply) {
  seedPassports();
  const passport = passports.find(p => p.nfcTagId === request.params.nfcTagId);
  if (!passport) return reply.status(404).send({ error: 'No passport found for this NFC tag' });
  return reply.send({ data: passport });
}

export async function verifyPassport(request: FastifyRequest<{ Params: { passportId: string } }>, reply: FastifyReply) {
  seedPassports();
  const passport = passports.find(p => p.passportId === request.params.passportId);
  if (!passport) return reply.status(404).send({ error: 'Passport not found' });
  return reply.send({
    data: {
      passportId: passport.passportId,
      verified: true,
      authenticityStatus: 'AUTHENTIC',
      blockchainHash: passport.blockchainHash,
      chainOfCustody: passport.supplyChainEvents.length,
      lastVerified: now().toISOString(),
      product: { name: passport.productInfo.name, styleNumber: passport.productInfo.styleNumber },
    },
  });
}

export async function listEvents(request: FastifyRequest<{ Params: { passportId: string } }>, reply: FastifyReply) {
  seedPassports();
  const passport = passports.find(p => p.passportId === request.params.passportId);
  if (!passport) return reply.status(404).send({ error: 'Passport not found' });
  return reply.send({ data: passport.supplyChainEvents });
}

export async function addEvent(request: FastifyRequest<{ Params: { passportId: string }; Body: { eventType: string; location: string; details?: Record<string, unknown> } }>, reply: FastifyReply) {
  seedPassports();
  const passport = passports.find(p => p.passportId === request.params.passportId);
  if (!passport) return reply.status(404).send({ error: 'Passport not found' });
  const event: SupplyChainEvent = { id: generateId(), eventType: request.body.eventType, location: request.body.location, timestamp: now().toISOString(), details: request.body.details || {}, verifiedOnChain: true };
  passport.supplyChainEvents.push(event);
  passport.updatedAt = now().toISOString();
  return reply.status(201).send({ data: event });
}

export async function getComplianceStatus(_request: FastifyRequest, reply: FastifyReply) {
  seedPassports();
  const totalProducts = store.products.length;
  const withDpp = new Set(passports.map(p => p.productId)).size;
  return reply.send({
    data: {
      regulation: 'EU ESPR (Ecodesign for Sustainable Products Regulation)',
      mandatoryDate: '2028-07-01',
      registryOperationalDate: '2026-07-01',
      currentStatus: 'voluntary_compliance',
      coverage: { totalProducts, productsWithDpp: withDpp, coveragePercent: Math.round((withDpp / totalProducts) * 100), totalPassports: passports.length },
      compliance: { materialTraceability: true, carbonFootprint: true, repairabilityIndex: true, recycledContent: true, durabilityRating: true, careInstructions: true, supplyChainEvents: true, blockchainVerification: true },
      pendingActions: [
        { action: 'Complete DPP for remaining products', deadline: '2026-12-31', priority: 'high' },
        { action: 'Register with EU DPP central registry', deadline: '2026-07-01', priority: 'critical' },
        { action: 'Add end-of-life recycling instructions', deadline: '2027-06-01', priority: 'medium' },
      ],
    },
  });
}

export async function listMaterials(request: FastifyRequest<{ Querystring: { category?: string; certified?: boolean; limit?: number } }>, reply: FastifyReply) {
  seedPassports();
  const { category, certified, limit = 50 } = request.query;

  const allMaterials = new Map<string, { name: string; usedInCategories: string[]; origins: string[]; certifications: string[]; avgRecycledContent: number; productCount: number }>();

  for (const passport of passports) {
    for (const mat of passport.materials) {
      const key = mat.name;
      const existing = allMaterials.get(key);
      if (existing) {
        if (!existing.usedInCategories.includes(passport.productInfo.category)) existing.usedInCategories.push(passport.productInfo.category);
        if (!existing.origins.includes(mat.origin)) existing.origins.push(mat.origin);
        if (mat.certification && !existing.certifications.includes(mat.certification)) existing.certifications.push(mat.certification);
        existing.avgRecycledContent = (existing.avgRecycledContent * existing.productCount + mat.recycledContent) / (existing.productCount + 1);
        existing.productCount++;
      } else {
        allMaterials.set(key, { name: mat.name, usedInCategories: [passport.productInfo.category], origins: [mat.origin], certifications: mat.certification ? [mat.certification] : [], avgRecycledContent: mat.recycledContent, productCount: 1 });
      }
    }
  }

  let results = Array.from(allMaterials.values());
  if (category) results = results.filter(m => m.usedInCategories.includes(category));
  if (certified !== undefined) results = results.filter(m => certified ? m.certifications.length > 0 : m.certifications.length === 0);

  return reply.send({ data: results.slice(0, limit), total: results.length });
}
