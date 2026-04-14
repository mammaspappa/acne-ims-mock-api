import type { Store } from '../Store.js';
import type { Customer, CustomerProfile, SOChannel, Currency } from '../types.js';
import { generateId } from '../../utils/id.js';
import { faker } from '@faker-js/faker';

// Behavior profile distribution (realistic for luxury brand)
const PROFILE_DISTRIBUTION: Array<{ profile: CustomerProfile; weight: number }> = [
  { profile: 'VIC', weight: 5 },            // 5% — top-tier, high frequency, high spend
  { profile: 'REGULAR', weight: 20 },       // 20% — consistent buyers, medium spend
  { profile: 'RETURNING', weight: 20 },     // 20% — 2-4 purchases/year
  { profile: 'BARGAIN_HUNTER', weight: 15 },// 15% — price sensitive, higher returns
  { profile: 'TOURIST', weight: 40 },       // 40% — one-time or rare buyers
];

// Realistic country distribution for Acne customers (based on store network)
const COUNTRY_DISTRIBUTION: Array<{ countryCode: string; country: string; currency: Currency; weight: number }> = [
  { countryCode: 'SE', country: 'Sweden', currency: 'SEK', weight: 8 },
  { countryCode: 'US', country: 'United States', currency: 'USD', weight: 18 },
  { countryCode: 'FR', country: 'France', currency: 'EUR', weight: 10 },
  { countryCode: 'GB', country: 'United Kingdom', currency: 'GBP', weight: 10 },
  { countryCode: 'DE', country: 'Germany', currency: 'EUR', weight: 9 },
  { countryCode: 'JP', country: 'Japan', currency: 'JPY', weight: 12 },
  { countryCode: 'KR', country: 'South Korea', currency: 'KRW', weight: 8 },
  { countryCode: 'CN', country: 'China', currency: 'CNY', weight: 7 },
  { countryCode: 'IT', country: 'Italy', currency: 'EUR', weight: 5 },
  { countryCode: 'AU', country: 'Australia', currency: 'AUD', weight: 4 },
  { countryCode: 'HK', country: 'Hong Kong', currency: 'HKD', weight: 3 },
  { countryCode: 'SG', country: 'Singapore', currency: 'SGD', weight: 3 },
  { countryCode: 'DK', country: 'Denmark', currency: 'EUR', weight: 2 },
  { countryCode: 'NO', country: 'Norway', currency: 'EUR', weight: 1 },
];

const CATEGORIES = ['Outerwear', 'Denim', 'Knitwear', 'Accessories', 'Footwear', 'T-shirts', 'Trousers'];

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[0];
}

function profileSettings(profile: CustomerProfile): {
  returnRate: number;
  preferredChannel: SOChannel;
  tier: Customer['tier'];
  monthsBack: number; // how far back to place firstOrderAt
} {
  switch (profile) {
    case 'VIC':
      return {
        returnRate: 0.04,
        preferredChannel: faker.helpers.arrayElement(['CLIENTELING', 'RETAIL_STORE', 'ECOMMERCE'] as SOChannel[]),
        tier: faker.helpers.arrayElement(['GOLD', 'GOLD', 'PLATINUM', 'SILVER'] as Array<Customer['tier']>),
        monthsBack: 12 + Math.floor(Math.random() * 48), // 1-5 years
      };
    case 'REGULAR':
      return {
        returnRate: 0.10,
        preferredChannel: faker.helpers.arrayElement(['ECOMMERCE', 'RETAIL_STORE', 'ECOMMERCE'] as SOChannel[]),
        tier: faker.helpers.arrayElement(['BRONZE', 'SILVER', null, null] as Array<Customer['tier']>),
        monthsBack: 6 + Math.floor(Math.random() * 24), // 6 months - 2.5 years
      };
    case 'RETURNING':
      return {
        returnRate: 0.12,
        preferredChannel: faker.helpers.arrayElement(['ECOMMERCE', 'ECOMMERCE', 'MARKETPLACE'] as SOChannel[]),
        tier: null,
        monthsBack: 3 + Math.floor(Math.random() * 18), // 3-21 months
      };
    case 'BARGAIN_HUNTER':
      return {
        returnRate: 0.28,
        preferredChannel: faker.helpers.arrayElement(['ECOMMERCE', 'MARKETPLACE'] as SOChannel[]),
        tier: null,
        monthsBack: 2 + Math.floor(Math.random() * 12), // 2-14 months
      };
    case 'TOURIST':
    default:
      return {
        returnRate: 0.15,
        preferredChannel: faker.helpers.arrayElement(['ECOMMERCE', 'RETAIL_STORE', 'MARKETPLACE'] as SOChannel[]),
        tier: null,
        monthsBack: Math.floor(Math.random() * 18), // 0-18 months
      };
  }
}

export function seedCustomers(store: Store, count: number = 3000): void {
  const customers: Customer[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const { profile } = pickWeighted(PROFILE_DISTRIBUTION);
    const country = pickWeighted(COUNTRY_DISTRIBUTION);
    const settings = profileSettings(profile);
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const fullName = `${firstName} ${lastName}`;
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();

    // First order date — cap at seed time
    const firstOrderAt = new Date(now.getTime() - settings.monthsBack * 30 * 86400000);
    const preferredCategory = profile === 'VIC' || profile === 'REGULAR'
      ? faker.helpers.arrayElement(CATEGORIES)
      : null;

    const customer: Customer = {
      id: generateId(),
      email,
      firstName,
      lastName,
      fullName,
      city: faker.location.city(),
      country: country.country,
      countryCode: country.countryCode,
      currency: country.currency,
      profile,
      tier: settings.tier,
      preferredChannel: settings.preferredChannel,
      preferredCategory,
      firstOrderAt: firstOrderAt.toISOString(),
      lastOrderAt: null,  // Will be updated by simulation as orders are placed
      totalOrders: 0,
      totalSpentSek: 0,
      returnRate: settings.returnRate,
      createdAt: firstOrderAt.toISOString(),
      updatedAt: firstOrderAt.toISOString(),
    };
    customers.push(customer);
  }

  store.customers = customers;
}
