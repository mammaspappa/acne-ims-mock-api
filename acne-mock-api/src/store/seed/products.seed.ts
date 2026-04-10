import type { Store } from '../Store.js';
import type { Product, ProductImage, Season } from '../types.js';
import { generateId } from '../../utils/id.js';
import { daysAgo } from '../../utils/date.js';
import stylesData from '../data/acne-styles.json' with { type: 'json' };

// Distribute products across seasons realistically
// - Carry-over styles appear in AW2026 but were introduced earlier
// - Non-carry-over items are split across seasons to simulate a real catalog
const seasonAssignments: Array<{ season: Season; year: number }> = [
  // Outerwear: mostly AW
  { season: 'AW', year: 2026 }, { season: 'AW', year: 2026 }, { season: 'AW', year: 2026 }, { season: 'AW', year: 2026 },
  { season: 'PRE_FALL', year: 2026 }, { season: 'AW', year: 2026 }, { season: 'AW', year: 2025 }, { season: 'SS', year: 2026 },
  // Denim: spans seasons (carry-over heavy)
  { season: 'AW', year: 2025 }, { season: 'SS', year: 2025 }, { season: 'AW', year: 2026 }, { season: 'SS', year: 2026 },
  { season: 'AW', year: 2026 }, { season: 'SS', year: 2026 }, { season: 'AW', year: 2025 }, { season: 'AW', year: 2026 },
  { season: 'SS', year: 2026 }, { season: 'AW', year: 2026 }, { season: 'SS', year: 2025 }, { season: 'AW', year: 2025 },
  // Knitwear: AW-heavy
  { season: 'AW', year: 2026 }, { season: 'AW', year: 2026 }, { season: 'AW', year: 2025 }, { season: 'AW', year: 2025 },
  { season: 'AW', year: 2026 }, { season: 'PRE_FALL', year: 2026 }, { season: 'AW', year: 2026 }, { season: 'AW', year: 2026 },
  // T-shirts: SS-heavy + carry-over
  { season: 'SS', year: 2026 }, { season: 'SS', year: 2025 }, { season: 'SS', year: 2026 }, { season: 'SS', year: 2026 },
  { season: 'SS', year: 2026 }, { season: 'AW', year: 2026 }, { season: 'SS', year: 2025 }, { season: 'SS', year: 2026 },
  // Trousers: mixed
  { season: 'AW', year: 2025 }, { season: 'SS', year: 2026 }, { season: 'AW', year: 2026 }, { season: 'SS', year: 2026 },
  { season: 'AW', year: 2026 },
  // Accessories: carry-over heavy
  { season: 'AW', year: 2024 }, { season: 'AW', year: 2025 }, { season: 'SS', year: 2025 }, { season: 'AW', year: 2025 },
  { season: 'AW', year: 2026 }, { season: 'SS', year: 2026 },
  // Footwear: mixed
  { season: 'AW', year: 2025 }, { season: 'AW', year: 2026 }, { season: 'SS', year: 2026 }, { season: 'AW', year: 2026 },
  { season: 'AW', year: 2025 },
];

const imageBaseUrl = 'https://mock-cdn.acnestudios.mock/images';

export function seedProducts(store: Store): void {
  for (let i = 0; i < stylesData.length; i++) {
    const style = stylesData[i];
    const sa = seasonAssignments[i] || { season: 'AW' as Season, year: 2026 };

    // Carry-over styles get their introduction season but are flagged as carry-over
    const introSeason = style.isCarryOver ? seasonAssignments[Math.max(0, i - 4)] || sa : sa;

    const product: Product = {
      id: generateId(),
      styleNumber: style.styleNumber,
      name: style.name,
      category: style.category,
      subCategory: style.subCategory,
      gender: style.gender,
      season: sa.season,
      seasonYear: sa.year,
      collection: style.collection,
      isCarryOver: style.isCarryOver,
      costPrice: style.costPrice,
      costCurrency: 'SEK',
      description: buildDescription(style, sa),
      createdAt: daysAgo(style.isCarryOver ? 400 + Math.floor(Math.random() * 200) : 60 + Math.floor(Math.random() * 90)).toISOString(),
      updatedAt: daysAgo(Math.floor(Math.random() * 30)).toISOString(),
    };
    store.products.push(product);

    // Generate product images (2-4 per product)
    const imageCount = 2 + Math.floor(Math.random() * 3);
    for (let img = 0; img < imageCount; img++) {
      store.productImages.push({
        id: generateId(),
        productId: product.id,
        url: `${imageBaseUrl}/${style.styleNumber.toLowerCase()}_${img + 1}.jpg`,
        altText: `${style.name} - ${img === 0 ? 'Front' : img === 1 ? 'Back' : img === 2 ? 'Detail' : 'Styled'}`,
        isPrimary: img === 0,
        sortOrder: img,
      });
    }
  }
}

function buildDescription(
  style: { name: string; subCategory: string | null; category: string; gender: string; collection: string | null; costPrice: number; retailPrice: number; isCarryOver: boolean },
  sa: { season: Season; year: number }
): string {
  const seasonName = sa.season === 'SS' ? 'Spring/Summer' : sa.season === 'AW' ? 'Autumn/Winter' : sa.season === 'PRE_FALL' ? 'Pre-Fall' : sa.season;
  const parts = [
    `${style.name}.`,
    style.subCategory ? `${style.gender}'s ${style.subCategory.toLowerCase()}.` : `${style.gender}'s ${style.category.toLowerCase()}.`,
    `From the ${style.collection || 'Main Collection'}, ${seasonName} ${sa.year}.`,
  ];
  if (style.isCarryOver) {
    parts.push('Core continuity style — available across seasons.');
  }
  if (style.category === 'Denim') {
    parts.push('Part of the Blå Konst denim programme. 100% organic cotton selvedge.');
  }
  if (style.category === 'Outerwear' && style.costPrice > 4000) {
    parts.push('Premium construction with Italian-sourced materials. Fully lined.');
  }
  if (style.category === 'Knitwear') {
    parts.push('Responsibly sourced yarns. Hand-finished details.');
  }
  return parts.join(' ');
}
