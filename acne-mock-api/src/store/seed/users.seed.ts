import type { Store } from '../Store.js';
import type { User, UserRole } from '../types.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';

interface UserSeed {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  locationIndex: number | null; // index into store.locations
  supplierIndex: number | null; // index into store.suppliers
}

const userSeeds: UserSeed[] = [
  { email: 'buyer@acne.mock', firstName: 'Anna', lastName: 'Karlsson', role: 'BUYER', locationIndex: 0, supplierIndex: null },
  { email: 'wholesale@acne.mock', firstName: 'Erik', lastName: 'Johansson', role: 'WHOLESALE', locationIndex: 0, supplierIndex: null },
  { email: 'storemanager@acne.mock', firstName: 'Sofia', lastName: 'Andersson', role: 'STORE_MGR', locationIndex: 3, supplierIndex: null },
  { email: 'associate@acne.mock', firstName: 'Lucas', lastName: 'Nilsson', role: 'STORE_ASSOC', locationIndex: 3, supplierIndex: null },
  { email: 'ecom@acne.mock', firstName: 'Maja', lastName: 'Lindqvist', role: 'ECOM', locationIndex: 0, supplierIndex: null },
  { email: 'warehouse@acne.mock', firstName: 'Oscar', lastName: 'Svensson', role: 'WAREHOUSE', locationIndex: 0, supplierIndex: null },
  { email: 'supplier@acne.mock', firstName: 'Marco', lastName: 'Bianchi', role: 'SUPPLIER', locationIndex: null, supplierIndex: 0 },
  { email: 'finance@acne.mock', firstName: 'Elsa', lastName: 'Gustafsson', role: 'FINANCE', locationIndex: 0, supplierIndex: null },
  { email: 'planner@acne.mock', firstName: 'Hugo', lastName: 'Berglund', role: 'PLANNER', locationIndex: 0, supplierIndex: null },
  { email: 'exec@acne.mock', firstName: 'Astrid', lastName: 'Ekström', role: 'EXEC', locationIndex: 0, supplierIndex: null },
  { email: 'cs@acne.mock', firstName: 'Nils', lastName: 'Olsson', role: 'CS_AGENT', locationIndex: 0, supplierIndex: null },
  { email: 'qa@acne.mock', firstName: 'Freja', lastName: 'Magnusson', role: 'QA', locationIndex: 0, supplierIndex: null },
  { email: 'admin@acne.mock', firstName: 'Admin', lastName: 'System', role: 'ADMIN', locationIndex: 0, supplierIndex: null },
  // Extra users for variety
  { email: 'buyer2@acne.mock', firstName: 'Linnea', lastName: 'Björk', role: 'BUYER', locationIndex: 0, supplierIndex: null },
  { email: 'store.paris@acne.mock', firstName: 'Marie', lastName: 'Dupont', role: 'STORE_MGR', locationIndex: 4, supplierIndex: null },
  { email: 'store.london@acne.mock', firstName: 'James', lastName: 'Wright', role: 'STORE_MGR', locationIndex: 5, supplierIndex: null },
  { email: 'store.nyc@acne.mock', firstName: 'Sarah', lastName: 'Mitchell', role: 'STORE_MGR', locationIndex: 6, supplierIndex: null },
  { email: 'store.tokyo@acne.mock', firstName: 'Yuki', lastName: 'Tanaka', role: 'STORE_MGR', locationIndex: 7, supplierIndex: null },
  { email: 'warehouse.na@acne.mock', firstName: 'David', lastName: 'Martinez', role: 'WAREHOUSE', locationIndex: 1, supplierIndex: null },
  { email: 'supplier.denim@acne.mock', firstName: 'Emre', lastName: 'Yilmaz', role: 'SUPPLIER', locationIndex: null, supplierIndex: 2 },
];

export function seedUsers(store: Store): void {
  const ts = now().toISOString();

  for (const seed of userSeeds) {
    const user: User = {
      id: generateId(),
      email: seed.email,
      passwordHash: 'hackathon2026', // plaintext for mock — checked directly in auth handler
      firstName: seed.firstName,
      lastName: seed.lastName,
      role: seed.role,
      isActive: true,
      locationId: seed.locationIndex !== null ? store.locations[seed.locationIndex]?.id ?? null : null,
      supplierId: seed.supplierIndex !== null ? store.suppliers[seed.supplierIndex]?.id ?? null : null,
      createdAt: ts,
      updatedAt: ts,
    };
    store.users.push(user);
  }
}
