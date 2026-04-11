import { faker } from '@faker-js/faker';
import type { Season } from '../types.js';
import colorsData from '../data/acne-colors.json' with { type: 'json' };

// ─── Style template used by the season drop engine ──────
export interface GeneratedStyle {
  styleNumber: string;
  name: string;
  category: string;
  subCategory: string | null;
  gender: string;
  costPrice: number;
  retailPrice: number;
  collection: string;
  isCarryOver: boolean;
  colors: string[];
  sizes: string[];
}

// ─── Category definitions ───────────────────────────────

interface CategoryDef {
  category: string;
  subCategories: string[];
  genders: string[];
  costRange: [number, number];
  retailRange: [number, number];
  collections: string[];
  sizes: string[][];
  stylePrefix: string;
  ssWeight: number;   // likelihood in SS season
  awWeight: number;   // likelihood in AW season
}

const CATEGORIES: CategoryDef[] = [
  {
    category: 'Outerwear',
    subCategories: ['Wool Coat', 'Puffer', 'Parka', 'Bomber', 'Trench Coat', 'Leather Jacket', 'Shearling', 'Denim Jacket'],
    genders: ['Women', 'Men', 'Unisex'],
    costRange: [2500, 5000], retailRange: [8500, 18000],
    collections: ['Main Collection'],
    sizes: [['XS', 'S', 'M', 'L', 'XL'], ['S', 'M', 'L', 'XL']],
    stylePrefix: 'COAT',
    ssWeight: 0.3, awWeight: 1.0,
  },
  {
    category: 'Denim',
    subCategories: ['Regular Fit', 'Relaxed Fit', 'Slim Fit', 'Bootcut', 'Straight Leg', 'Wide Leg', 'Cropped'],
    genders: ['Women', 'Men', 'Unisex'],
    costRange: [1300, 2800], retailRange: [4500, 10000],
    collections: ['Blå Konst'],
    sizes: [['27', '28', '29', '30', '31', '32', '33', '34'], ['24', '25', '26', '27', '28', '29', '30', '31', '32']],
    stylePrefix: 'DNM',
    ssWeight: 0.7, awWeight: 0.6,
  },
  {
    category: 'Knitwear',
    subCategories: ['Cardigan', 'Crew Neck', 'Turtleneck', 'V-Neck', 'Oversized Sweater', 'Vest', 'Pullover', 'Wrap Cardigan'],
    genders: ['Women', 'Men', 'Unisex'],
    costRange: [900, 2200], retailRange: [3000, 7000],
    collections: ['Main Collection'],
    sizes: [['XS', 'S', 'M', 'L'], ['S', 'M', 'L', 'XL']],
    stylePrefix: 'KNIT',
    ssWeight: 0.2, awWeight: 1.0,
  },
  {
    category: 'T-shirts',
    subCategories: ['Patch Tee', 'Logo Tee', 'Oversized Tee', 'Slim Tee', 'Print Tee', 'Long Sleeve', 'Hoodie', 'Sweatshirt'],
    genders: ['Women', 'Men', 'Unisex'],
    costRange: [300, 800], retailRange: [1000, 3500],
    collections: ['Main Collection', 'Face Collection'],
    sizes: [['XS', 'S', 'M', 'L', 'XL'], ['S', 'M', 'L', 'XL']],
    stylePrefix: 'TOPS',
    ssWeight: 1.0, awWeight: 0.5,
  },
  {
    category: 'Trousers',
    subCategories: ['Wool Trouser', 'Chino', 'Wide Leg', 'Pleated', 'Cargo', 'Tailored'],
    genders: ['Women', 'Men', 'Unisex'],
    costRange: [800, 1300], retailRange: [2600, 4500],
    collections: ['Main Collection'],
    sizes: [['XS', 'S', 'M', 'L'], ['28', '30', '32', '34', '36']],
    stylePrefix: 'TROU',
    ssWeight: 0.6, awWeight: 0.7,
  },
  {
    category: 'Accessories',
    subCategories: ['Shoulder Bag', 'Tote Bag', 'Card Holder', 'Wallet', 'Belt', 'Scarf'],
    genders: ['Women', 'Unisex'],
    costRange: [400, 6000], retailRange: [1500, 21000],
    collections: ['Main Collection'],
    sizes: [['OS']],
    stylePrefix: 'ACCS',
    ssWeight: 0.5, awWeight: 0.5,
  },
  {
    category: 'Footwear',
    subCategories: ['Boot', 'Sneaker', 'Ankle Boot', 'Loafer', 'Sandal', 'Derby'],
    genders: ['Women', 'Men', 'Unisex'],
    costRange: [1000, 2200], retailRange: [3500, 7500],
    collections: ['Main Collection'],
    sizes: [['36', '37', '38', '39', '40', '41', '42', '43', '44', '45'], ['39', '40', '41', '42', '43', '44', '45']],
    stylePrefix: 'FOOT',
    ssWeight: 0.6, awWeight: 0.7,
  },
];

// Acne Studios style first names (used for product naming)
const STYLE_NAMES = [
  'Alva', 'Birk', 'Cleo', 'Dag', 'Elsa', 'Frej', 'Greta', 'Hjalmar',
  'Ines', 'Joar', 'Karin', 'Lars', 'Maja', 'Nils', 'Ottilia', 'Pelle',
  'Runa', 'Sigrid', 'Tove', 'Ulf', 'Vera', 'Wilma', 'Ylva', 'Zara',
  'Arvid', 'Britt', 'Caspian', 'Disa', 'Ebbe', 'Fiona', 'Gustav', 'Hedda',
  'Ivar', 'Juni', 'Knut', 'Liv', 'Milo', 'Nora', 'Oskar', 'Petra',
];

const ALL_COLORS = colorsData.map(c => c.code);

// ─── AW-biased colors (darker palette) ─────────────────
const AW_COLORS = ['BLK', 'NVY', 'SGR', 'BUR', 'CML', 'OAT', 'HGR'];
// ─── SS-biased colors (lighter palette) ─────────────────
const SS_COLORS = ['OWH', 'PBL', 'DPK', 'ECR', 'OAT', 'BLK', 'RST'];

let styleSeq = 0;

export function generateSeasonStyles(
  season: Season,
  seasonYear: number,
  count: number = 20 + Math.floor(Math.random() * 10),
): GeneratedStyle[] {
  const isSS = season === 'SS' || season === 'RESORT';
  const styles: GeneratedStyle[] = [];
  const usedNames = new Set<string>();

  // Weight categories by season type
  const weightedCats = CATEGORIES.map(c => ({
    ...c,
    weight: isSS ? c.ssWeight : c.awWeight,
  }));
  const totalWeight = weightedCats.reduce((s, c) => s + c.weight, 0);

  for (let i = 0; i < count; i++) {
    // Pick category weighted by season
    let roll = Math.random() * totalWeight;
    let cat = weightedCats[0];
    for (const c of weightedCats) {
      roll -= c.weight;
      if (roll <= 0) { cat = c; break; }
    }

    const subCategory = faker.helpers.arrayElement(cat.subCategories);
    const gender = faker.helpers.arrayElement(cat.genders);
    const genderCode = gender === 'Women' ? 'WN' : gender === 'Men' ? 'MN' : 'UX';

    // Pick a unique Acne-style name
    let name: string;
    do {
      const firstName = faker.helpers.arrayElement(STYLE_NAMES);
      name = `${firstName} ${subCategory}`;
    } while (usedNames.has(name));
    usedNames.add(name);

    styleSeq++;
    const styleNumber = `FN-${genderCode}-${cat.stylePrefix}${String(900000 + styleSeq).padStart(6, '0')}`;

    const costPrice = cat.costRange[0] + Math.floor(Math.random() * (cat.costRange[1] - cat.costRange[0]));
    const retailPrice = cat.retailRange[0] + Math.floor(Math.random() * (cat.retailRange[1] - cat.retailRange[0]));

    // Pick 2-4 colors, biased by season palette
    const palette = isSS ? SS_COLORS : AW_COLORS;
    const colorCount = 2 + Math.floor(Math.random() * 2);
    const colors: string[] = [];
    // First color always from palette
    colors.push(faker.helpers.arrayElement(palette));
    while (colors.length < colorCount) {
      const c = Math.random() < 0.7
        ? faker.helpers.arrayElement(palette)
        : faker.helpers.arrayElement(ALL_COLORS);
      if (!colors.includes(c)) colors.push(c);
    }

    const sizes = faker.helpers.arrayElement(cat.sizes);
    const collection = faker.helpers.arrayElement(cat.collections);

    styles.push({
      styleNumber,
      name,
      category: cat.category,
      subCategory,
      gender,
      costPrice,
      retailPrice,
      collection,
      isCarryOver: false,
      colors,
      sizes,
    });
  }

  return styles;
}
