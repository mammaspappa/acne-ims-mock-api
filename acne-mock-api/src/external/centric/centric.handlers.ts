import type { FastifyRequest, FastifyReply } from 'fastify';
import { store } from '../../store/Store.js';
import colorsData from '../../store/data/acne-colors.json' with { type: 'json' };
import { generateId } from '../../utils/id.js';
import { daysAgo, now } from '../../utils/date.js';

// ─── Helpers ────────────────────────────────────────────

function centricPaginate<T>(items: T[], skip: number, limit: number) {
  const total_count = items.length;
  const data = items.slice(skip, skip + limit);
  return { items: data, total_count, skip, limit };
}

function parseCentricPagination(query: { skip?: string; limit?: string }) {
  const skip = Math.max(0, parseInt(query.skip || '0', 10));
  const limit = Math.min(200, Math.max(1, parseInt(query.limit || '100', 10)));
  return { skip, limit };
}

// Material definitions derived from product categories
const materialDefs = [
  { id: 'MAT-001', name: 'Japanese Selvedge Denim', code: 'DENIM-SEL', composition: '100% Cotton (14oz selvedge)', category: 'Denim', weight_gsm: 400, supplier_code: 'SUP-DC', country_of_origin: 'Japan', certifications: ['OEKO-TEX Standard 100', 'GOTS'], lead_time_days: 45 },
  { id: 'MAT-002', name: 'Italian Wool Blend', code: 'WOOL-IT', composition: '80% Wool, 20% Cashmere', category: 'Outerwear', weight_gsm: 350, supplier_code: 'SUP-TI', country_of_origin: 'Italy', certifications: ['RWS (Responsible Wool Standard)'], lead_time_days: 30 },
  { id: 'MAT-003', name: 'Supima Cotton Jersey', code: 'CTTN-SUP', composition: '100% Supima Cotton', category: 'T-shirts', weight_gsm: 180, supplier_code: 'SUP-EF', country_of_origin: 'Peru', certifications: ['OEKO-TEX Standard 100', 'BCI'], lead_time_days: 25 },
  { id: 'MAT-004', name: 'Kidmohair Yarn', code: 'MOH-KID', composition: '70% Kidmohair, 30% Silk', category: 'Knitwear', weight_gsm: 120, supplier_code: 'SUP-NT', country_of_origin: 'South Africa', certifications: ['RMS (Responsible Mohair Standard)'], lead_time_days: 40 },
  { id: 'MAT-005', name: 'Nappa Leather', code: 'LTHR-NAP', composition: '100% Cowhide Leather (Chrome-Free Tanned)', category: 'Outerwear', weight_gsm: 800, supplier_code: 'SUP-TI', country_of_origin: 'Italy', certifications: ['LWG Gold'], lead_time_days: 50 },
  { id: 'MAT-006', name: 'Recycled Polyester Shell', code: 'RPOLY-SH', composition: '100% Recycled Polyester', category: 'Outerwear', weight_gsm: 90, supplier_code: 'SUP-EF', country_of_origin: 'Taiwan', certifications: ['GRS (Global Recycled Standard)', 'bluesign'], lead_time_days: 20 },
  { id: 'MAT-007', name: 'Merino Wool', code: 'WOOL-MER', composition: '100% Extra-Fine Merino Wool (19.5 micron)', category: 'Knitwear', weight_gsm: 200, supplier_code: 'SUP-NT', country_of_origin: 'Australia', certifications: ['RWS', 'Mulesing-Free'], lead_time_days: 35 },
  { id: 'MAT-008', name: 'Stretch Denim', code: 'DENIM-STR', composition: '98% Cotton, 2% Elastane', category: 'Denim', weight_gsm: 340, supplier_code: 'SUP-DC', country_of_origin: 'Turkey', certifications: ['OEKO-TEX Standard 100'], lead_time_days: 30 },
  { id: 'MAT-009', name: 'Vegetable-Tanned Leather', code: 'LTHR-VEG', composition: '100% Cowhide Leather (Vegetable Tanned)', category: 'Accessories', weight_gsm: 950, supplier_code: 'SUP-TI', country_of_origin: 'Italy', certifications: ['LWG Gold', 'Pelle Conciata al Vegetale'], lead_time_days: 60 },
  { id: 'MAT-010', name: 'Portuguese Calf Suede', code: 'SUED-CLF', composition: '100% Calf Suede', category: 'Footwear', weight_gsm: 600, supplier_code: 'SUP-LF', country_of_origin: 'Portugal', certifications: ['LWG Silver'], lead_time_days: 40 },
  { id: 'MAT-011', name: 'Organic Cotton Twill', code: 'CTTN-TWL', composition: '100% Organic Cotton', category: 'Trousers', weight_gsm: 260, supplier_code: 'SUP-EF', country_of_origin: 'India', certifications: ['GOTS', 'OCS'], lead_time_days: 28 },
  { id: 'MAT-012', name: 'Shearling', code: 'SHRL-NAT', composition: '100% Natural Shearling', category: 'Outerwear', weight_gsm: 1200, supplier_code: 'SUP-TI', country_of_origin: 'Spain', certifications: ['LWG'], lead_time_days: 55 },
  { id: 'MAT-013', name: 'Organic Cotton Fleece', code: 'CTTN-FLC', composition: '100% Organic Cotton', category: 'Knitwear', weight_gsm: 320, supplier_code: 'SUP-EF', country_of_origin: 'Turkey', certifications: ['GOTS', 'OCS'], lead_time_days: 22 },
  { id: 'MAT-014', name: 'Lambswool Blend', code: 'WOOL-LMB', composition: '80% Lambswool, 20% Polyamide', category: 'Knitwear', weight_gsm: 240, supplier_code: 'SUP-NT', country_of_origin: 'Scotland', certifications: ['RWS'], lead_time_days: 35 },
  { id: 'MAT-015', name: 'Cashmere', code: 'CASH-PUR', composition: '100% Grade-A Cashmere', category: 'Knitwear', weight_gsm: 160, supplier_code: 'SUP-NT', country_of_origin: 'Mongolia', certifications: ['GCS (Good Cashmere Standard)', 'OEKO-TEX Standard 100'], lead_time_days: 50 },
  { id: 'MAT-016', name: 'Recycled Polyester Ripstop', code: 'RPOLY-RIP', composition: '100% Recycled Polyester', category: 'Outerwear', weight_gsm: 75, supplier_code: 'SUP-EF', country_of_origin: 'Taiwan', certifications: ['GRS', 'bluesign'], lead_time_days: 18 },
  { id: 'MAT-017', name: 'Silk Charmeuse', code: 'SILK-CHR', composition: '100% Mulberry Silk', category: 'T-shirts', weight_gsm: 90, supplier_code: 'SUP-TI', country_of_origin: 'Italy', certifications: ['OEKO-TEX Standard 100'], lead_time_days: 38 },
  { id: 'MAT-018', name: 'Viscose Twill', code: 'VISC-TWL', composition: '100% LENZING ECOVERO Viscose', category: 'Trousers', weight_gsm: 210, supplier_code: 'SUP-EF', country_of_origin: 'Austria', certifications: ['EU Ecolabel', 'FSC'], lead_time_days: 25 },
  { id: 'MAT-019', name: 'Elastane Blend Jersey', code: 'ELST-JRS', composition: '95% Cotton, 5% Elastane', category: 'T-shirts', weight_gsm: 200, supplier_code: 'SUP-EF', country_of_origin: 'Portugal', certifications: ['OEKO-TEX Standard 100'], lead_time_days: 20 },
  { id: 'MAT-020', name: 'Polyamide Lining', code: 'PLAM-LIN', composition: '100% Recycled Polyamide', category: 'Outerwear', weight_gsm: 55, supplier_code: 'SUP-EF', country_of_origin: 'Japan', certifications: ['GRS', 'bluesign'], lead_time_days: 15 },
  { id: 'MAT-021', name: 'Rubber Sole Compound', code: 'RUBR-SOL', composition: '70% Natural Rubber, 30% Synthetic Rubber', category: 'Footwear', weight_gsm: 1500, supplier_code: 'SUP-LF', country_of_origin: 'Italy', certifications: ['REACH Compliant'], lead_time_days: 28 },
  { id: 'MAT-022', name: 'Brass Hardware', code: 'BRSS-HW', composition: '100% Solid Brass (Nickel-Free Plating)', category: 'Accessories', weight_gsm: 0, supplier_code: 'SUP-TI', country_of_origin: 'Italy', certifications: ['REACH Compliant', 'Nickel-Free'], lead_time_days: 30 },
  { id: 'MAT-023', name: 'Sterling Silver', code: 'SLVR-925', composition: '92.5% Silver, 7.5% Copper Alloy', category: 'Accessories', weight_gsm: 0, supplier_code: 'SUP-TI', country_of_origin: 'Italy', certifications: ['REACH Compliant', 'RJC'], lead_time_days: 35 },
  { id: 'MAT-024', name: 'Suede Calfskin', code: 'SUED-CF2', composition: '100% Calf Suede (Chrome-Free)', category: 'Accessories', weight_gsm: 500, supplier_code: 'SUP-TI', country_of_origin: 'Italy', certifications: ['LWG Gold'], lead_time_days: 42 },
];

// Size range definitions
const sizeRangeDefs = [
  { id: 'SR-ALPHA', name: 'Alpha (XS-XL)', sizes: ['XS', 'S', 'M', 'L', 'XL'], type: 'APPAREL', categories: ['Outerwear', 'Knitwear', 'T-shirts', 'Trousers'] },
  { id: 'SR-ALPHA-SHORT', name: 'Alpha Short (XS-L)', sizes: ['XS', 'S', 'M', 'L'], type: 'APPAREL', categories: ['Knitwear'] },
  { id: 'SR-DENIM-W', name: 'Denim Waist (24-36)', sizes: ['24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '36'], type: 'DENIM', categories: ['Denim'] },
  { id: 'SR-FOOTWEAR', name: 'EU Footwear (36-45)', sizes: ['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'], type: 'FOOTWEAR', categories: ['Footwear'] },
  { id: 'SR-ONE-SIZE', name: 'One Size', sizes: ['OS'], type: 'ACCESSORY', categories: ['Accessories'] },
  { id: 'SR-BELT', name: 'Belt (S-L)', sizes: ['S', 'M', 'L'], type: 'ACCESSORY', categories: ['Accessories'] },
];

// ─── BOM & Revision helpers ────────────────────────────

function seededRandomC(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function generateBom(product: typeof store.products[0], primaryMaterial: typeof materialDefs[0]) {
  const rng = seededRandomC(product.id.charCodeAt(0) + product.id.charCodeAt(2) * 256);

  // Primary material always included
  const bom: Array<{
    material_id: string;
    material_name: string;
    material_code: string;
    placement: string;
    quantity_per_unit: number;
    unit: string;
    unit_cost: number;
    cost_currency: string;
  }> = [
    {
      material_id: primaryMaterial.id,
      material_name: primaryMaterial.name,
      material_code: primaryMaterial.code,
      placement: 'MAIN_BODY',
      quantity_per_unit: Math.round((1 + rng() * 2) * 100) / 100,
      unit: 'meters',
      unit_cost: Math.round((8 + rng() * 40) * 100) / 100,
      cost_currency: 'EUR',
    },
  ];

  // Add lining for outerwear
  if (product.category === 'Outerwear' || product.category === 'Denim') {
    const lining = materialDefs.find(m => m.code === 'PLAM-LIN') || materialDefs[19];
    bom.push({
      material_id: lining.id,
      material_name: lining.name,
      material_code: lining.code,
      placement: 'LINING',
      quantity_per_unit: Math.round((0.8 + rng() * 1.2) * 100) / 100,
      unit: 'meters',
      unit_cost: Math.round((3 + rng() * 8) * 100) / 100,
      cost_currency: 'EUR',
    });
  }

  // Add hardware/trims
  const hardware = materialDefs.find(m => m.code === 'BRSS-HW') || materialDefs[21];
  bom.push({
    material_id: hardware.id,
    material_name: 'Buttons & Hardware',
    material_code: hardware.code,
    placement: 'TRIMS',
    quantity_per_unit: Math.floor(2 + rng() * 6),
    unit: 'pieces',
    unit_cost: Math.round((0.5 + rng() * 3) * 100) / 100,
    cost_currency: 'EUR',
  });

  // Thread / labels
  bom.push({
    material_id: 'MAT-THR-001',
    material_name: 'Sewing Thread (Gutermann)',
    material_code: 'THRD-GUT',
    placement: 'CONSTRUCTION',
    quantity_per_unit: Math.round((50 + rng() * 100) * 10) / 10,
    unit: 'meters',
    unit_cost: 0.02,
    cost_currency: 'EUR',
  });

  bom.push({
    material_id: 'MAT-LBL-001',
    material_name: 'Woven Label + Care Label',
    material_code: 'LBL-WOVEN',
    placement: 'LABELS',
    quantity_per_unit: 2,
    unit: 'pieces',
    unit_cost: 0.35,
    cost_currency: 'EUR',
  });

  return bom;
}

function generateRevisionHistory(product: typeof store.products[0], pidx: number) {
  const rng = seededRandomC(pidx * 137 + product.id.charCodeAt(1));
  const designers = ['Anna K.', 'Jonny J.', 'Elin S.', 'Marcus W.', 'Sofia L.'];
  const changeTypes = [
    'Initial tech pack created',
    'Updated measurements for size grading',
    'Changed main fabric composition',
    'Adjusted seam allowance and construction details',
    'Final fit approval after sample review',
    'Color correction on main body',
    'Updated BOM with new supplier pricing',
    'Added sustainability certification notes',
  ];

  const numRevisions = 2 + Math.floor(rng() * 4);
  const revisions: Array<{
    version: string;
    date: string;
    changedBy: string;
    changes: string;
  }> = [];

  for (let v = 1; v <= numRevisions; v++) {
    const daysBack = (numRevisions - v) * (20 + Math.floor(rng() * 30));
    revisions.push({
      version: `${v}.0`,
      date: daysAgo(daysBack).toISOString().split('T')[0],
      changedBy: designers[Math.floor(rng() * designers.length)],
      changes: changeTypes[Math.floor(rng() * changeTypes.length)],
    });
  }

  return revisions;
}

// ─── GET /styles ────────────────────────────────────────

export async function listStyles(
  request: FastifyRequest<{
    Querystring: { season?: string; category?: string; limit?: string; skip?: string; modified_after?: string };
  }>,
  reply: FastifyReply,
) {
  const { season, category, modified_after } = request.query;
  const { skip, limit } = parseCentricPagination(request.query);

  let products = store.products;

  if (season) {
    products = products.filter(p => `${p.season}${p.seasonYear}` === season || p.season === season);
  }
  if (category) {
    products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }
  if (modified_after) {
    products = products.filter(p => p.updatedAt > modified_after);
  }

  const techPackStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'REVIEW', 'APPROVED', 'FINAL'];
  const sampleStatuses = ['NOT_REQUESTED', 'REQUESTED', 'IN_PRODUCTION', 'RECEIVED', 'APPROVED', 'REJECTED'];

  const styles = products.map((p, idx) => {
    const skus = store.skus.filter(s => s.productId === p.id);
    const styleSlug = p.styleNumber.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return {
      id: p.id,
      style_number: p.styleNumber,
      name: p.name,
      category: p.category,
      sub_category: p.subCategory,
      gender: p.gender,
      season: p.season,
      season_year: p.seasonYear,
      collection: p.collection,
      is_carry_over: p.isCarryOver,
      cost_price: p.costPrice,
      cost_currency: p.costCurrency,
      colorway_count: new Set(skus.map(s => s.colourCode)).size,
      size_count: new Set(skus.map(s => s.size)).size,
      tech_pack_status: techPackStatuses[Math.min(idx % 5, 4)],
      tech_pack_url: `https://plm.acnestudios.com/tech-packs/${styleSlug}-tp.pdf`,
      spec_sheet_url: `https://plm.acnestudios.com/spec-sheets/${styleSlug}-spec.pdf`,
      sample_status: sampleStatuses[Math.min(idx % 6, 5)],
      description: p.description,
      revision_history: generateRevisionHistory(p, idx),
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    };
  });

  return reply.send(centricPaginate(styles, skip, limit));
}

// ─── GET /styles/:id ────────────────────────────────────

export async function getStyle(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const product = store.findById(store.products, request.params.id);
  if (!product) {
    return reply.status(404).send({ error: 'Style not found' });
  }

  const skus = store.skus.filter(s => s.productId === product.id);
  const images = store.productImages.filter(i => i.productId === product.id);

  const colorways = new Map<string, { code: string; name: string; sizes: string[]; sku_count: number }>();
  for (const sku of skus) {
    if (!colorways.has(sku.colourCode)) {
      colorways.set(sku.colourCode, { code: sku.colourCode, name: sku.colour, sizes: [], sku_count: 0 });
    }
    const cw = colorways.get(sku.colourCode)!;
    cw.sizes.push(sku.size);
    cw.sku_count++;
  }

  // Determine primary material from category
  const material = materialDefs.find(m => m.category === product.category) || materialDefs[0];

  const techPackStatuses = ['NOT_STARTED', 'IN_PROGRESS', 'REVIEW', 'APPROVED', 'FINAL'];
  const sampleStatuses = ['NOT_REQUESTED', 'REQUESTED', 'IN_PRODUCTION', 'RECEIVED', 'APPROVED', 'REJECTED'];
  const pidx = store.products.indexOf(product);

  const styleSlug = product.styleNumber.toLowerCase().replace(/[^a-z0-9]/g, '-');

  return reply.send({
    id: product.id,
    style_number: product.styleNumber,
    name: product.name,
    category: product.category,
    sub_category: product.subCategory,
    gender: product.gender,
    season: product.season,
    season_year: product.seasonYear,
    collection: product.collection,
    is_carry_over: product.isCarryOver,
    cost_price: product.costPrice,
    cost_currency: product.costCurrency,
    description: product.description,
    tech_pack_status: techPackStatuses[Math.min(pidx % 5, 4)],
    tech_pack_url: `https://plm.acnestudios.com/tech-packs/${styleSlug}-tp.pdf`,
    spec_sheet_url: `https://plm.acnestudios.com/spec-sheets/${styleSlug}-spec.pdf`,
    sample_status: sampleStatuses[Math.min(pidx % 6, 5)],
    colorways: Array.from(colorways.values()),
    size_range: [...new Set(skus.map(s => s.size))],
    materials: [
      {
        id: material.id,
        name: material.name,
        composition: material.composition,
        weight_gsm: material.weight_gsm,
        placement: 'MAIN_BODY',
      },
    ],
    bom: generateBom(product, material),
    revision_history: generateRevisionHistory(product, pidx),
    images: images.map(i => ({ url: i.url, is_primary: i.isPrimary, alt_text: i.altText })),
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  });
}

// ─── GET /style_boms ───────────────────────────────────

export async function listStyleBoms(
  request: FastifyRequest<{
    Querystring: { season?: string; category?: string; limit?: string; skip?: string };
  }>,
  reply: FastifyReply,
) {
  const { season, category } = request.query;
  const { skip, limit } = parseCentricPagination(request.query);

  let products = store.products;

  if (season) {
    products = products.filter(p => `${p.season}${p.seasonYear}` === season || p.season === season);
  }
  if (category) {
    products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  const styleBoms = products.map(p => {
    const material = materialDefs.find(m => m.category === p.category) || materialDefs[0];
    const bom = generateBom(p, material);
    const totalCost = bom.reduce((sum, item) => sum + item.quantity_per_unit * item.unit_cost, 0);
    return {
      style_id: p.id,
      style_number: p.styleNumber,
      name: p.name,
      category: p.category,
      season: `${p.season}${p.seasonYear}`,
      bom,
      total_material_cost: Math.round(totalCost * 100) / 100,
      cost_currency: 'EUR',
    };
  });

  return reply.send(centricPaginate(styleBoms, skip, limit));
}

// ─── GET /seasons ───────────────────────────────────────

export async function listSeasons(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const seasonMap = new Map<string, { season: string; year: number; products: typeof store.products }>();

  for (const p of store.products) {
    const key = `${p.season}${p.seasonYear}`;
    if (!seasonMap.has(key)) {
      seasonMap.set(key, { season: p.season, year: p.seasonYear, products: [] });
    }
    seasonMap.get(key)!.products.push(p);
  }

  const seasons = Array.from(seasonMap.entries()).map(([key, data]) => {
    const statusOrder = ['PLANNING', 'DEVELOPMENT', 'PRODUCTION', 'IN_SEASON', 'ARCHIVED'];
    // Current season is IN_SEASON, previous is ARCHIVED, future is in earlier stages
    const currentYear = new Date().getFullYear();
    let status: string;
    if (data.year < currentYear) status = 'ARCHIVED';
    else if (data.year === currentYear) status = 'IN_SEASON';
    else status = 'DEVELOPMENT';

    return {
      id: key,
      name: `${data.season === 'SS' ? 'Spring/Summer' : data.season === 'AW' ? 'Autumn/Winter' : data.season} ${data.year}`,
      season: data.season,
      year: data.year,
      status,
      style_count: data.products.length,
      categories: [...new Set(data.products.map(p => p.category))],
    };
  });

  return reply.send({ items: seasons, total_count: seasons.length, skip: 0, limit: seasons.length });
}

// ─── GET /seasons/:id ───────────────────────────────────

export async function getSeason(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id } = request.params;
  const seasonMatch = id.match(/^([A-Z_]+)(\d{4})$/);
  if (!seasonMatch) {
    return reply.status(400).send({ error: 'Invalid season ID format. Expected e.g. AW2026' });
  }
  const [, season, yearStr] = seasonMatch;
  const year = parseInt(yearStr, 10);

  const products = store.products.filter(p => p.season === season && p.seasonYear === year);
  if (products.length === 0) {
    return reply.status(404).send({ error: 'Season not found' });
  }

  const currentYear = new Date().getFullYear();
  let status: string;
  if (year < currentYear) status = 'ARCHIVED';
  else if (year === currentYear) status = 'IN_SEASON';
  else status = 'DEVELOPMENT';

  return reply.send({
    id,
    name: `${season === 'SS' ? 'Spring/Summer' : season === 'AW' ? 'Autumn/Winter' : season} ${year}`,
    season,
    year,
    status,
    style_count: products.length,
    categories: [...new Set(products.map(p => p.category))],
    timeline: {
      design_start: `${year - 1}-${season === 'SS' ? '06' : '01'}-15`,
      development_start: `${year - 1}-${season === 'SS' ? '09' : '04'}-01`,
      production_start: `${year - 1}-${season === 'SS' ? '11' : '06'}-01`,
      delivery_start: `${year}-${season === 'SS' ? '01' : '07'}-15`,
      in_season_start: `${year}-${season === 'SS' ? '03' : '09'}-01`,
      markdown_start: `${year}-${season === 'SS' ? '06' : '12'}-15`,
    },
    styles: products.map(p => ({
      id: p.id,
      style_number: p.styleNumber,
      name: p.name,
      category: p.category,
    })),
  });
}

// ─── GET /materials ─────────────────────────────────────

export async function listMaterials(
  request: FastifyRequest<{ Querystring: { limit?: string; skip?: string } }>,
  reply: FastifyReply,
) {
  const { skip, limit } = parseCentricPagination(request.query);
  return reply.send(centricPaginate(materialDefs, skip, limit));
}

// ─── GET /materials/:id ─────────────────────────────────

export async function getMaterial(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const material = materialDefs.find(m => m.id === request.params.id);
  if (!material) {
    return reply.status(404).send({ error: 'Material not found' });
  }

  const supplier = store.suppliers.find(s => s.code === material.supplier_code);

  return reply.send({
    ...material,
    supplier: supplier
      ? {
          id: supplier.id,
          name: supplier.name,
          code: supplier.code,
          country: supplier.country,
          fair_wear_score: supplier.fairWearScore,
        }
      : null,
    quality_tests: [
      { test: 'Tensile Strength', result: 'PASS', tested_at: daysAgo(60).toISOString() },
      { test: 'Color Fastness', result: 'PASS', tested_at: daysAgo(58).toISOString() },
      { test: 'Pilling Resistance', result: 'PASS', tested_at: daysAgo(55).toISOString() },
    ],
  });
}

// ─── GET /colorways ─────────────────────────────────────

export async function listColorways(
  request: FastifyRequest<{ Querystring: { limit?: string; skip?: string } }>,
  reply: FastifyReply,
) {
  const { skip, limit } = parseCentricPagination(request.query);

  const colorways = colorsData.map((c, idx) => {
    const skusWithColor = store.skus.filter(s => s.colourCode === c.code);
    const productIds = [...new Set(skusWithColor.map(s => s.productId))];
    return {
      id: `CW-${c.code}`,
      name: c.name,
      code: c.code,
      hex: c.hex,
      style_count: productIds.length,
      status: 'ACTIVE',
    };
  });

  return reply.send(centricPaginate(colorways, skip, limit));
}

// ─── GET /collections ───────────────────────────────────

export async function listCollections(
  request: FastifyRequest<{ Querystring: { limit?: string; skip?: string } }>,
  reply: FastifyReply,
) {
  const { skip, limit } = parseCentricPagination(request.query);

  const collectionMap = new Map<string, typeof store.products[0][]>();
  for (const p of store.products) {
    const key = p.collection || 'Unassigned';
    if (!collectionMap.has(key)) collectionMap.set(key, []);
    collectionMap.get(key)!.push(p);
  }

  const collections = Array.from(collectionMap.entries()).map(([name, products]) => ({
    id: `COL-${name.replace(/[^A-Za-z0-9]/g, '-').toUpperCase()}`,
    name,
    style_count: products.length,
    categories: [...new Set(products.map(p => p.category))],
    seasons: [...new Set(products.map(p => `${p.season}${p.seasonYear}`))],
    status: 'ACTIVE',
  }));

  return reply.send(centricPaginate(collections, skip, limit));
}

// ─── GET /collections/:id ───────────────────────────────

export async function getCollection(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) {
  const { id } = request.params;

  // Rebuild collections
  const collectionMap = new Map<string, { id: string; name: string; products: typeof store.products[0][] }>();
  for (const p of store.products) {
    const name = p.collection || 'Unassigned';
    const colId = `COL-${name.replace(/[^A-Za-z0-9]/g, '-').toUpperCase()}`;
    if (!collectionMap.has(colId)) collectionMap.set(colId, { id: colId, name, products: [] });
    collectionMap.get(colId)!.products.push(p);
  }

  const collection = collectionMap.get(id);
  if (!collection) {
    return reply.status(404).send({ error: 'Collection not found' });
  }

  return reply.send({
    id: collection.id,
    name: collection.name,
    style_count: collection.products.length,
    categories: [...new Set(collection.products.map(p => p.category))],
    seasons: [...new Set(collection.products.map(p => `${p.season}${p.seasonYear}`))],
    status: 'ACTIVE',
    styles: collection.products.map(p => ({
      id: p.id,
      style_number: p.styleNumber,
      name: p.name,
      category: p.category,
      season: `${p.season}${p.seasonYear}`,
    })),
  });
}

// ─── GET /suppliers ─────────────────────────────────────

export async function listSuppliers(
  request: FastifyRequest<{ Querystring: { limit?: string; skip?: string } }>,
  reply: FastifyReply,
) {
  const { skip, limit } = parseCentricPagination(request.query);

  const auditStatuses = ['PASSED', 'PASSED_WITH_OBSERVATIONS', 'PENDING'];
  const complianceStatuses = ['COMPLIANT', 'MINOR_NON_CONFORMANCE', 'COMPLIANT'];

  const suppliers = store.suppliers.map((s, idx) => ({
    id: s.id,
    name: s.name,
    code: s.code,
    contact_name: s.contactName,
    contact_email: s.contactEmail,
    country: s.country,
    lead_time_days: s.leadTimeDays,
    payment_terms: s.paymentTerms,
    currency: s.currency,
    fair_wear_score: s.fairWearScore,
    is_active: s.isActive,
    factory_audit_status: auditStatuses[idx % 3],
    factory_audit_date: daysAgo(90 + idx * 30).toISOString().split('T')[0],
    compliance_status: complianceStatuses[idx % 3],
    sustainability_certifications: [
      'Fair Wear Foundation',
      ...(s.fairWearScore === 'A+' || s.fairWearScore === 'A' ? ['SA8000'] : []),
      ...(idx % 2 === 0 ? ['ISO 14001'] : []),
    ],
    material_categories: materialDefs
      .filter(m => m.supplier_code === s.code)
      .map(m => m.category),
    created_at: s.createdAt,
    updated_at: s.updatedAt,
  }));

  return reply.send(centricPaginate(suppliers, skip, limit));
}

// ─── GET /size_ranges ───────────────────────────────────

export async function listSizeRanges(
  request: FastifyRequest<{ Querystring: { limit?: string; skip?: string } }>,
  reply: FastifyReply,
) {
  const { skip, limit } = parseCentricPagination(request.query);
  return reply.send(centricPaginate(sizeRangeDefs, skip, limit));
}
