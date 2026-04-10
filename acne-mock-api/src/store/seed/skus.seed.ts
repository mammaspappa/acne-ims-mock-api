import type { Store } from '../Store.js';
import type { SKU } from '../types.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';
import stylesData from '../data/acne-styles.json' with { type: 'json' };
import colorsData from '../data/acne-colors.json' with { type: 'json' };

const colorMap = new Map(colorsData.map(c => [c.code, c]));

let barcodeCounter = 5901234560001;

export function seedSkus(store: Store): void {
  const ts = now().toISOString();

  for (let pi = 0; pi < store.products.length; pi++) {
    const product = store.products[pi];
    const style = stylesData[pi];
    if (!style) continue;

    for (const colorCode of style.colors) {
      const color = colorMap.get(colorCode);
      if (!color) continue;

      for (let si = 0; si < style.sizes.length; si++) {
        const size = style.sizes[si];
        const skuCode = `${style.styleNumber}-${colorCode}-${size}`;

        const sku: SKU = {
          id: generateId(),
          productId: product.id,
          sku: skuCode,
          barcode: String(barcodeCounter++),
          rfidTag: `E200${generateId().slice(0, 16).toUpperCase()}`,
          colour: color.name,
          colourCode: colorCode,
          size,
          sizeIndex: si,
          wholesalePrice: Math.round(style.retailPrice * 0.5),
          retailPrice: style.retailPrice,
          priceCurrency: 'SEK',
          weight: style.category === 'Footwear' ? 0.85 : style.category === 'Outerwear' ? 1.2 : 0.35,
          isActive: true,
          createdAt: ts,
          updatedAt: ts,
        };
        store.skus.push(sku);
      }
    }
  }
}
