import type { Store } from '../Store.js';
import type { Supplier, Currency } from '../types.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';
import suppliersData from '../data/acne-suppliers.json' with { type: 'json' };

export function seedSuppliers(store: Store): void {
  for (const sup of suppliersData) {
    const s = sup as any;
    const supplier: Supplier = {
      id: generateId(),
      name: sup.name,
      code: sup.code,
      contactName: sup.contactName,
      contactEmail: sup.contactEmail,
      country: sup.country,
      leadTimeDays: sup.leadTimeDays,
      paymentTerms: sup.paymentTerms,
      currency: sup.currency as Currency,
      isActive: true,
      fairWearScore: sup.fairWearScore,
      tier: s.tier ?? 1,
      partnershipYears: s.partnershipYears ?? 5,
      orderValuePercent: s.orderValuePercent ?? 1,
      leverage: s.leverage ?? 5,
      labourRisks: s.labourRisks ?? null,
      createdAt: now().toISOString(),
      updatedAt: now().toISOString(),
    };
    store.suppliers.push(supplier);
  }
}
