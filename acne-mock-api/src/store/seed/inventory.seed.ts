import type { Store } from '../Store.js';
import type { StockLevel } from '../types.js';
import { generateId } from '../../utils/id.js';
import { now, daysAgo } from '../../utils/date.js';

export function seedInventory(store: Store): void {
  const ts = now().toISOString();
  const warehouses = store.locations.filter(l => l.type === 'WAREHOUSE');
  const stores = store.locations.filter(l => l.type === 'STORE');

  // Only stock a subset of SKUs at each location for realism
  for (const sku of store.skus) {
    // All SKUs stocked at main EU warehouse
    const mainWarehouse = warehouses[0];
    if (mainWarehouse) {
      const qtyOnHand = 20 + Math.floor(Math.random() * 80);
      const stockLevel: StockLevel = {
        id: generateId(),
        skuId: sku.id,
        locationId: mainWarehouse.id,
        quantityOnHand: qtyOnHand,
        quantityAllocated: Math.floor(Math.random() * Math.min(10, qtyOnHand)),
        quantityInTransit: Math.floor(Math.random() * 5),
        quantityOnOrder: Math.floor(Math.random() * 30),
        reorderPoint: 15,
        reorderQuantity: 30,
        lastCountedAt: daysAgo(Math.floor(Math.random() * 14)).toISOString(),
        updatedAt: ts,
      };
      store.stockLevels.push(stockLevel);
    }

    // Regional warehouses get ~60% of SKUs
    for (const wh of warehouses.slice(1)) {
      if (Math.random() > 0.6) continue;
      const qtyOnHand = 5 + Math.floor(Math.random() * 40);
      store.stockLevels.push({
        id: generateId(),
        skuId: sku.id,
        locationId: wh.id,
        quantityOnHand: qtyOnHand,
        quantityAllocated: Math.floor(Math.random() * Math.min(5, qtyOnHand)),
        quantityInTransit: Math.floor(Math.random() * 3),
        quantityOnOrder: 0,
        reorderPoint: 8,
        reorderQuantity: 20,
        lastCountedAt: daysAgo(Math.floor(Math.random() * 14)).toISOString(),
        updatedAt: ts,
      });
    }

    // Stores get ~30% of SKUs (curated assortment)
    for (const st of stores) {
      if (Math.random() > 0.3) continue;
      const qtyOnHand = 1 + Math.floor(Math.random() * 8);
      store.stockLevels.push({
        id: generateId(),
        skuId: sku.id,
        locationId: st.id,
        quantityOnHand: qtyOnHand,
        quantityAllocated: 0,
        quantityInTransit: Math.random() > 0.8 ? Math.floor(Math.random() * 3) : 0,
        quantityOnOrder: 0,
        reorderPoint: 2,
        reorderQuantity: 5,
        lastCountedAt: daysAgo(Math.floor(Math.random() * 7)).toISOString(),
        updatedAt: ts,
      });
    }
  }
}
