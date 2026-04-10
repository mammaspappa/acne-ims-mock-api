import type { FastifyRequest, FastifyReply } from 'fastify';

// ─── Brand Overview ───────────────────────────────────

export async function brandOverview(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    company: {
      legalName: 'Acne Studios AB',
      brandName: 'Acne Studios',
      tagline: 'Ambition to Create Novel Expressions',
      originalAcronym: 'Associated Computer Nerd Enterprises',
      founded: 1996,
      foundedIn: 'Stockholm, Sweden',
      founder: 'Jonny Johansson',
      creativeDirector: 'Jonny Johansson',
      ceo: 'Mattias Magnusson',
      executiveChairman: 'Mikael Schiller',
      cfo: 'Hendrik Bitterschulte',
      headquarters: {
        address: 'Floragatan 13',
        city: 'Stockholm',
        country: 'Sweden',
        postalCode: '114 31',
        description: 'Former Czechoslovak embassy — a brutalist building designed by Jan Bočan, relocated to in 2019 from Gamla stan.',
      },
      employees: 700,
      annualRevenue: {
        sek: 2_340_000_000,
        eur: 206_000_000,
        usd: 215_000_000,
        fiscalYear: '2019/20',
        note: 'Most recent publicly available figures',
      },
      ownedStores: 60,
      wholesalePartners: 800,
      countriesPresent: 50,
      ecomSites: 20,
      website: 'https://www.acnestudios.com',
      instagram: '@acnestudios',
      publication: {
        name: 'Acne Paper',
        description: 'Biannual magazine covering art, fashion, photography, design, architecture, academia, and culture',
        notableContributors: ['Carine Roitfeld', 'David Lynch', 'Tilda Swinton'],
      },
    },
    ownership: {
      majority: 'Jonny Johansson & Mikael Schiller',
      investors: [
        { name: 'IDG Capital', stake: '30.1%', since: 2018 },
        { name: 'I.T Group', stake: '10.9%', since: 2018 },
      ],
      status: 'Privately held',
    },
    categories: [
      { name: 'Ready-to-Wear', subcategories: ['Outerwear', 'Knitwear', 'T-shirts & Tops', 'Trousers', 'Dresses', 'Shirts'] },
      { name: 'Denim', subcategories: ['Regular Fit', 'Slim Fit', 'Relaxed Fit', 'Bootcut', 'Straight Leg', 'Skinny Fit', 'Cropped', 'Wide Leg'], collectionName: 'Blå Konst' },
      { name: 'Footwear', subcategories: ['Boots', 'Sneakers', 'Loafers', 'Ankle Boots', 'Hiking Boots'] },
      { name: 'Accessories', subcategories: ['Bags', 'Wallets', 'Card Holders', 'Belts', 'Scarves', 'Hats', 'Eyewear'] },
      { name: 'Face Collection', subcategories: ['T-shirts', 'Sweatshirts', 'Hoodies', 'Beanies', 'Caps'], description: 'Signature smiley face motif — timeless basics with a distinctive mark' },
    ],
    seasons: {
      perYear: 4,
      names: ['Spring/Summer (SS)', 'Autumn/Winter (AW)', 'Resort', 'Pre-Fall'],
      currentSeason: { name: 'AW2026', status: 'Pre-production & buying' },
      previousSeason: { name: 'SS2026', status: 'In stores' },
    },
    signatureProducts: [
      { name: 'Musubi Bag', description: 'Inspired by the traditional Japanese obi sash with twisted Musubi knots. Available in mini, midi, and tote sizes.', priceRange: '$1,450–$2,300 USD', iconic: true },
      { name: '1996 Jeans', description: 'Relaxed fit straight leg — the original Acne Studios silhouette from the founding year.', priceRange: '$540–$580 USD', iconic: true },
      { name: 'Face Patch Tee', description: 'Minimal tee with the signature Face smiley patch. Gateway product for new customers.', priceRange: '$170 USD', iconic: true },
      { name: 'Denim Jacket', description: 'Staple outerwear piece, available in washed, coated, and relaxed fits.', priceRange: '$850–$1,700 USD', iconic: true },
      { name: 'Fairview Face Sweatshirt', description: 'Crew neck sweatshirt with Face patch. One of the most gifted Acne items.', priceRange: '$400 USD', iconic: true },
    ],
    notableCollaborations: [
      { partner: 'Fjällräven', year: 2018, description: 'Outdoor gear capsule collection' },
      { partner: 'Russell Westbrook / NBA', year: 2019, description: 'Streetwear-meets-luxury basketball collection' },
      { partner: 'Lanvin', year: 2017, description: 'High fashion capsule' },
      { partner: 'Bianchi Bicycles', year: 2014, description: 'Limited-edition bicycles' },
      { partner: 'Carl Malmsten', year: 2015, description: 'Swedish furniture collaboration' },
    ],
  });
}

// ─── Style Guide ──────────────────────────────────────

export async function styleGuide(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    brandIdentity: {
      philosophy: 'Acne Studios is a multidisciplinary luxury fashion house based in Stockholm, Sweden. Founded in 1996, the brand embodies the creative collectivism of founder Jonny Johansson\'s original vision — where fashion, art, photography, and culture intersect.',
      values: [
        'Creative ambiguity — embracing contradictions between masculine/feminine, utilitarian/luxurious, raw/refined',
        'Scandinavian minimalism with artistic edge',
        'Quality materials and responsible production',
        'Inclusive sizing and gender-fluid design',
        'Cultural curiosity beyond fashion',
      ],
      tonOfVoice: {
        personality: ['Understated', 'Intelligent', 'Witty', 'Culturally aware', 'Never pretentious'],
        doSay: ['Explore', 'Discover', 'Expression', 'Craft', 'Studio'],
        dontSay: ['Luxury', 'Exclusive', 'Must-have', 'Trendy', 'Affordable'],
        writingStyle: 'Concise, lowercase-leaning, with intentional use of negative space. Headlines are often single words or short phrases. Body copy is informative but never overexplains.',
      },
    },
    logo: {
      primary: {
        name: 'Acne Studios wordmark',
        description: 'The Acne Studios logotype is set in a custom typeface. The wordmark uses clean, geometric letterforms with consistent stroke width. Always presented in a single line.',
        usage: 'Use on all official communications, product labels, packaging, and digital touchpoints',
        variants: [
          { name: 'Black on white', file: '/brand/assets/logo-black.svg', background: '#FFFFFF', foreground: '#000000' },
          { name: 'White on black', file: '/brand/assets/logo-white.svg', background: '#000000', foreground: '#FFFFFF' },
          { name: 'Black on transparent', file: '/brand/assets/logo-black-transparent.svg', background: 'transparent', foreground: '#000000' },
        ],
        minimumSize: { print: '15mm width', digital: '80px width' },
        clearSpace: 'Minimum clear space equal to the cap height of the "A" in Acne on all sides',
      },
      face: {
        name: 'Face motif',
        description: 'The signature Face smiley — a simple, hand-drawn expression used on the Face Collection. Two dots for eyes, a line for the mouth. Deliberately imperfect.',
        usage: 'Face Collection products, social media, casual brand touchpoints',
        variants: [
          { name: 'Face patch', file: '/brand/assets/face-patch.svg', description: 'Embroidered patch version used on garments' },
          { name: 'Face icon', file: '/brand/assets/face-icon.svg', description: 'Digital icon version' },
        ],
      },
      donts: [
        'Do not stretch, rotate, or skew the logo',
        'Do not add effects (shadows, gradients, outlines)',
        'Do not change the typeface or letterspacing',
        'Do not place the logo on busy backgrounds without sufficient contrast',
        'Do not use the Face motif as a replacement for the wordmark',
      ],
    },
    colors: {
      primary: [
        { name: 'Acne Black', hex: '#000000', rgb: '0, 0, 0', usage: 'Primary brand color, text, logos' },
        { name: 'Acne White', hex: '#FFFFFF', rgb: '255, 255, 255', usage: 'Backgrounds, negative space' },
      ],
      secondary: [
        { name: 'Warm Grey', hex: '#A09E9C', rgb: '160, 158, 156', usage: 'Secondary text, subtle UI elements' },
        { name: 'Light Grey', hex: '#E8E6E3', rgb: '232, 230, 227', usage: 'Backgrounds, dividers, cards' },
        { name: 'Off-White', hex: '#FAF9F6', rgb: '250, 249, 246', usage: 'Paper-like backgrounds, packaging' },
      ],
      accent: [
        { name: 'Dusty Pink', hex: '#D4A5A5', rgb: '212, 165, 165', usage: 'Seasonal accent, Face Collection, women\'s marketing' },
        { name: 'Powder Blue', hex: '#B0C4DE', rgb: '176, 196, 222', usage: 'Seasonal accent, Blå Konst denim' },
      ],
      productPalette: [
        { name: 'Black', code: 'BLK', hex: '#000000' },
        { name: 'Off-White', code: 'OWH', hex: '#FAF9F6' },
        { name: 'Oatmeal Melange', code: 'OAT', hex: '#D4C5A9' },
        { name: 'Dusty Pink', code: 'DPK', hex: '#D4A5A5' },
        { name: 'Powder Blue', code: 'PBL', hex: '#B0C4DE' },
        { name: 'Slate Grey', code: 'SGR', hex: '#708090' },
        { name: 'Burgundy', code: 'BUR', hex: '#722F37' },
        { name: 'Camel', code: 'CML', hex: '#C19A6B' },
        { name: 'Navy', code: 'NVY', hex: '#1B2A4A' },
        { name: 'Hunter Green', code: 'HGR', hex: '#355E3B' },
        { name: 'Rust', code: 'RST', hex: '#B7410E' },
        { name: 'Ecru', code: 'ECR', hex: '#C2B280' },
      ],
    },
    typography: {
      primary: {
        name: 'Acne Studios custom typeface',
        fallback: 'Helvetica Neue, Arial, sans-serif',
        usage: 'Logo, headlines, hero text',
        characteristics: 'Geometric, clean, consistent stroke width, slightly condensed',
      },
      body: {
        name: 'Helvetica Neue',
        weights: ['Light (300)', 'Regular (400)', 'Medium (500)', 'Bold (700)'],
        usage: 'Body copy, UI text, product descriptions',
        sizing: {
          desktop: { body: '14px', small: '12px', h1: '48px', h2: '32px', h3: '24px' },
          mobile: { body: '14px', small: '11px', h1: '32px', h2: '24px', h3: '18px' },
        },
      },
      guidelines: [
        'Prefer lowercase for headlines and navigation',
        'Use uppercase sparingly — only for very short labels (e.g., "NEW", "SALE")',
        'Line height: 1.5 for body, 1.1 for headlines',
        'Letter spacing: 0.02em for body, 0.05em for uppercase labels',
      ],
    },
    photography: {
      style: 'Clean, editorial, with a sense of narrative. Natural lighting preferred. Models should appear authentic and unconventionally beautiful.',
      backgrounds: ['White studio', 'Neutral grey', 'Architectural brutalist', 'Outdoor Nordic landscapes'],
      donts: [
        'No heavy retouching or airbrushing',
        'No overly posed or commercial styling',
        'No excessive color grading or filters',
        'No stock photography aesthetic',
      ],
      productPhotography: {
        angles: ['Front', 'Back', 'Detail/closeup', 'Styled/on-model'],
        background: 'Pure white (#FFFFFF) or light grey (#F5F5F5)',
        lighting: 'Soft, even, no harsh shadows',
        resolution: 'Minimum 2400px on longest edge',
      },
    },
    packaging: {
      materials: 'FSC-certified paper and cardboard. Soy-based inks. No single-use plastic.',
      shoppingBag: { color: 'Black or white', material: 'Recycled paper', handle: 'Twisted paper or ribbon' },
      giftBox: { color: 'Matte black', interior: 'Black tissue paper', closure: 'Ribbon or magnetic' },
      garmentBag: { color: 'White', material: 'Organic cotton or recycled polyester' },
      careLabel: 'Woven labels with style number, composition, care instructions, and country of origin',
      nfcTag: 'Embedded NFC chip linking to Digital Product Passport (Temera DPP)',
    },
    storeDesign: {
      concept: 'Each store has a unique character reflecting its city, yet shares common Acne Studios design DNA.',
      keyElements: [
        'Monochromatic marble or concrete surfaces',
        'Minimalist fixtures with gallery-like spacing',
        'Art installations (rotating, often by emerging artists)',
        'Statement lighting (often custom or industrial)',
        'Natural materials: wood, stone, metal',
      ],
      flagshipArchitects: 'Sophie Hicks Architects (multiple locations)',
      referencestores: [
        { city: 'Stockholm', architect: 'Sophie Hicks', notable: 'Norrmalmstorg — interconnected rooms, marble, monochromatic' },
        { city: 'Paris', architect: 'Sophie Hicks', notable: 'Corner position, arched partitions, gallery atmosphere' },
        { city: 'New York', architect: 'Sophie Hicks', notable: '7,000 sq ft Greene Street, doubles as art venue' },
        { city: 'Tokyo', architect: 'Custom', notable: 'Three-story Aoyama flagship (2025), layered like the city itself' },
      ],
    },
    sustainability: {
      commitments: [
        'Climate positive by 2030',
        'All cotton organic or recycled by 2025 (achieved)',
        'RFID-tagged garments for inventory accuracy and circularity',
        'Digital Product Passports (Temera) for EU ESPR compliance',
        'Fair Wear Foundation member',
        'No fur, no angora, no exotic skins',
      ],
      certifications: ['GOTS', 'RWS', 'RMS', 'GRS', 'LWG', 'OEKO-TEX', 'Fair Wear'],
      circularPrograms: [
        { name: 'Acne Studios Archive', description: 'Resale platform for pre-owned Acne Studios garments' },
        { name: 'Repair Service', description: 'In-store repair for extending garment life' },
      ],
    },
  });
}

// ─── Logo Assets ──────────────────────────────────────

export async function logoAssets(_request: FastifyRequest, reply: FastifyReply) {
  // Generate SVG logos on-the-fly
  return reply.send({
    assets: [
      {
        name: 'logo-black',
        format: 'svg',
        url: '/brand/assets/logo-black.svg',
        width: 200,
        height: 24,
        background: '#FFFFFF',
      },
      {
        name: 'logo-white',
        format: 'svg',
        url: '/brand/assets/logo-white.svg',
        width: 200,
        height: 24,
        background: '#000000',
      },
      {
        name: 'face-patch',
        format: 'svg',
        url: '/brand/assets/face-patch.svg',
        width: 40,
        height: 40,
        description: 'The Face smiley motif used on the Face Collection',
      },
      {
        name: 'logo-wordmark-large',
        format: 'svg',
        url: '/brand/assets/logo-wordmark-large.svg',
        width: 400,
        height: 48,
      },
    ],
  });
}

// SVG generators
export async function logoBlackSvg(_request: FastifyRequest, reply: FastifyReply) {
  return reply.type('image/svg+xml').send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 24" width="200" height="24">
  <text x="0" y="20" font-family="Helvetica Neue, Arial, sans-serif" font-size="20" font-weight="400" letter-spacing="4" fill="#000000">ACNE STUDIOS</text>
</svg>`);
}

export async function logoWhiteSvg(_request: FastifyRequest, reply: FastifyReply) {
  return reply.type('image/svg+xml').send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 24" width="200" height="24">
  <rect width="200" height="24" fill="#000000"/>
  <text x="0" y="20" font-family="Helvetica Neue, Arial, sans-serif" font-size="20" font-weight="400" letter-spacing="4" fill="#FFFFFF">ACNE STUDIOS</text>
</svg>`);
}

export async function facePatchSvg(_request: FastifyRequest, reply: FastifyReply) {
  return reply.type('image/svg+xml').send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
  <circle cx="20" cy="20" r="18" fill="none" stroke="#000" stroke-width="1.5"/>
  <circle cx="14" cy="16" r="2" fill="#000"/>
  <circle cx="26" cy="16" r="2" fill="#000"/>
  <path d="M12 26 Q20 30 28 26" fill="none" stroke="#000" stroke-width="1.5" stroke-linecap="round"/>
</svg>`);
}

export async function logoLargeSvg(_request: FastifyRequest, reply: FastifyReply) {
  return reply.type('image/svg+xml').send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 48" width="400" height="48">
  <text x="0" y="40" font-family="Helvetica Neue, Arial, sans-serif" font-size="40" font-weight="300" letter-spacing="8" fill="#000000">ACNE STUDIOS</text>
</svg>`);
}

// ─── Pricing Guide ────────────────────────────────────

export async function pricingGuide(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    currency: { base: 'SEK', primaryMarkets: ['SEK', 'EUR', 'USD', 'GBP', 'JPY', 'KRW', 'CNY'] },
    exchangeRates: {
      note: 'Approximate rates used for pricing — actual rates from D365',
      SEKEUR: 0.088, SEKUSD: 0.096, SEKGBP: 0.076, SEKJPY: 14.5, SEKKRW: 128, SEKCNY: 0.69,
    },
    wholesaleMarkup: {
      standardMultiplier: 2.0,
      note: 'Wholesale price is approximately 50% of retail. Negotiated discounts range 0-15% for key accounts.',
    },
    retailPriceRanges: {
      'T-shirts & Tops': { min: 1100, max: 3200, currency: 'SEK', usdMin: 155, usdMax: 450 },
      'Knitwear': { min: 3200, max: 6500, currency: 'SEK', usdMin: 450, usdMax: 920 },
      'Denim': { min: 4600, max: 10000, currency: 'SEK', usdMin: 460, usdMax: 1000 },
      'Trousers': { min: 2800, max: 4200, currency: 'SEK', usdMin: 400, usdMax: 600 },
      'Outerwear': { min: 8500, max: 17000, currency: 'SEK', usdMin: 850, usdMax: 1700 },
      'Footwear': { min: 3800, max: 7200, currency: 'SEK', usdMin: 380, usdMax: 720 },
      'Bags': { min: 7500, max: 23000, currency: 'SEK', usdMin: 750, usdMax: 2300 },
      'Small Leather Goods': { min: 1600, max: 2400, currency: 'SEK', usdMin: 160, usdMax: 240 },
      'Face Collection': { min: 1100, max: 3200, currency: 'SEK', usdMin: 155, usdMax: 450 },
    },
    markdownPolicy: {
      timing: 'End-of-season (January for AW, July for SS)',
      firstMarkdown: '20-30% off',
      secondMarkdown: '40-50% off',
      finalClearance: 'Up to 60% off',
      neverDiscounted: ['Musubi bags (core styles)', 'Face Collection basics', 'Core denim (1996, North, Climb)'],
    },
  });
}

// ─── Store Directory ──────────────────────────────────

export async function storeDirectory(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send({
    totalStores: 60,
    regions: {
      europe: {
        count: 15,
        countries: ['Sweden', 'France', 'United Kingdom', 'Italy', 'Germany', 'Denmark', 'Norway', 'Belgium'],
        flagships: ['Stockholm Norrmalmstorg', 'Paris Froissart', 'London Dover Street', 'Milan Piazza del Carmine', 'Berlin Potsdamer Straße'],
      },
      northAmerica: {
        count: 9,
        countries: ['United States'],
        cities: ['New York (2)', 'Los Angeles', 'San Francisco', 'Miami', 'Las Vegas', 'Costa Mesa', 'Cabazon (outlet)'],
        flagships: ['New York Greene Street', 'Los Angeles Melrose'],
      },
      asiaPacific: {
        count: 36,
        countries: ['Japan', 'South Korea', 'China', 'Hong Kong', 'Singapore', 'Australia', 'Thailand', 'Taiwan'],
        flagships: ['Tokyo Aoyama', 'Seoul Cheongdam', 'Beijing Sanlitun', 'Shanghai HKRI Taikoo Hui'],
        chinaStores: 14,
        japanStores: 10,
        koreaStores: 6,
      },
    },
    departmentStorePresence: [
      'Selfridges (London)', 'Le Bon Marché (Paris)', 'Nordstrom (US)', 'Barneys (US, historical)',
      'Isetan Mitsukoshi (Tokyo)', 'Hankyu (Osaka, Kobe)', 'Shinsegae (Seoul, Busan)',
      'Lane Crawford (Hong Kong)', 'SKP (Beijing, Chengdu)', 'NK (Stockholm)',
      'KaDeWe (Berlin)', 'Hyundai (Seoul)',
    ],
    marketplaces: ['Farfetch', 'SSENSE', 'mytheresa', 'NET-A-PORTER', 'Mr Porter', 'FWRD', '24S'],
  });
}
