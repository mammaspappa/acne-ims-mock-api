import type { Store } from '../Store.js';
import type { Location } from '../types.js';
import { generateId } from '../../utils/id.js';
import { now } from '../../utils/date.js';
import locationsData from '../data/acne-locations.json' with { type: 'json' };

export function seedLocations(store: Store): void {
  for (const loc of locationsData) {
    const location: Location = {
      id: generateId(),
      name: loc.name,
      type: loc.type,
      address: loc.address,
      city: loc.city,
      country: loc.country,
      countryCode: loc.countryCode,
      region: loc.region,
      timezone: loc.timezone,
      isActive: true,
      createdAt: now().toISOString(),
    };
    store.locations.push(location);
  }
}
