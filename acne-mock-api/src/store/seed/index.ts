import type { Store } from '../Store.js';
import { seedLocations } from './locations.seed.js';
import { seedSuppliers } from './suppliers.seed.js';
import { seedUsers } from './users.seed.js';
import { seedProducts } from './products.seed.js';
import { seedSkus } from './skus.seed.js';
import { seedInventory } from './inventory.seed.js';
import { seedModelRegistry } from './model-registry.seed.js';
import { seedCustomers } from './customers.seed.js';
import { runSeedSimulation } from '../../modules/admin/simulation.js';

export function seedAll(store: Store): void {
  // ── Phase 1: Static master data ──────────────────
  seedLocations(store);
  seedSuppliers(store);
  seedUsers(store);
  seedProducts(store);
  seedSkus(store);
  seedInventory(store);      // Initial warehouse stock levels
  seedModelRegistry(store);  // AI model registry (static)
  seedCustomers(store, 3000);// Persistent customers with behavior profiles

  // ── Phase 2: Simulate 30 days of business ────────
  // Runs the simulation engine synchronously to generate
  // consistent cross-system data: POs, SOs, payments,
  // shipments, RFID scans, stock movements, matches,
  // forecasts, anomalies — all properly linked.
  runSeedSimulation(30, store);
}
