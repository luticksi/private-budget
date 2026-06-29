import { db } from '../db'
import { categoryIdByName } from '../db/seed'
import type { Rule } from '../db/schema'

/**
 * Starter merchant dictionary. Each entry maps a substring found in a raw
 * statement descriptor to a category. These seed the built-in rules; users can
 * edit, disable, or override any of them. Matching is case-insensitive.
 *
 * Order matters for ties: more specific platforms (e.g. delivery) are listed
 * before generic names so they win at equal priority.
 */
export const STARTER_DICTIONARY: Array<{ pattern: string; category: string }> = [
  // Food delivery (listed first so it beats restaurant names within the string)
  { pattern: 'DOORDASH', category: 'Food Delivery' },
  { pattern: 'UBER EATS', category: 'Food Delivery' },
  { pattern: 'GRUBHUB', category: 'Food Delivery' },
  { pattern: 'POSTMATES', category: 'Food Delivery' },
  { pattern: 'SEAMLESS', category: 'Food Delivery' },
  { pattern: 'INSTACART', category: 'Groceries' },

  // Coffee
  { pattern: 'STARBUCKS', category: 'Coffee Shops' },
  { pattern: 'DUNKIN', category: 'Coffee Shops' },
  { pattern: 'PEET', category: 'Coffee Shops' },
  { pattern: 'BLUE BOTTLE', category: 'Coffee Shops' },
  { pattern: 'PHILZ', category: 'Coffee Shops' },

  // Fast food
  { pattern: 'MCDONALD', category: 'Fast Food' },
  { pattern: 'BURGER KING', category: 'Fast Food' },
  { pattern: 'WENDY', category: 'Fast Food' },
  { pattern: 'TACO BELL', category: 'Fast Food' },
  { pattern: 'CHICK-FIL-A', category: 'Fast Food' },
  { pattern: 'CHIPOTLE', category: 'Fast Food' },
  { pattern: 'SUBWAY', category: 'Fast Food' },
  { pattern: 'KFC', category: 'Fast Food' },
  { pattern: 'POPEYES', category: 'Fast Food' },

  // Groceries
  { pattern: 'WHOLE FOODS', category: 'Groceries' },
  { pattern: 'TRADER JOE', category: 'Groceries' },
  { pattern: 'SAFEWAY', category: 'Groceries' },
  { pattern: 'KROGER', category: 'Groceries' },
  { pattern: 'ALDI', category: 'Groceries' },
  { pattern: 'COSTCO', category: 'Groceries' },
  { pattern: 'PUBLIX', category: 'Groceries' },
  { pattern: 'WEGMANS', category: 'Groceries' },
  { pattern: 'SPROUTS', category: 'Groceries' },

  // Gas
  { pattern: 'SHELL', category: 'Gas' },
  { pattern: 'CHEVRON', category: 'Gas' },
  { pattern: 'EXXON', category: 'Gas' },
  { pattern: 'MOBIL', category: 'Gas' },
  { pattern: 'ARCO', category: 'Gas' },
  { pattern: 'VALERO', category: 'Gas' },
  { pattern: 'TEXACO', category: 'Gas' },
  { pattern: 'SUNOCO', category: 'Gas' },

  // Transport
  { pattern: 'UBER TRIP', category: 'Rideshare & Taxi' },
  { pattern: 'LYFT', category: 'Rideshare & Taxi' },

  // Travel
  { pattern: 'DELTA AIR', category: 'Flights' },
  { pattern: 'UNITED AIR', category: 'Flights' },
  { pattern: 'AMERICAN AIR', category: 'Flights' },
  { pattern: 'SOUTHWEST AIR', category: 'Flights' },
  { pattern: 'JETBLUE', category: 'Flights' },
  { pattern: 'MARRIOTT', category: 'Hotels' },
  { pattern: 'HILTON', category: 'Hotels' },
  { pattern: 'HYATT', category: 'Hotels' },
  { pattern: 'AIRBNB', category: 'Hotels' },

  // Streaming & subscriptions
  { pattern: 'NETFLIX', category: 'Streaming' },
  { pattern: 'HULU', category: 'Streaming' },
  { pattern: 'DISNEY PLUS', category: 'Streaming' },
  { pattern: 'DISNEYPLUS', category: 'Streaming' },
  { pattern: 'SPOTIFY', category: 'Streaming' },
  { pattern: 'HBO', category: 'Streaming' },
  { pattern: 'YOUTUBEPREMIUM', category: 'Streaming' },
  { pattern: 'ADOBE', category: 'Software' },
  { pattern: 'MICROSOFT', category: 'Software' },
  { pattern: 'GITHUB', category: 'Software' },
  { pattern: 'DROPBOX', category: 'Software' },

  // Utilities & telecom
  { pattern: 'COMCAST', category: 'Internet & Phone' },
  { pattern: 'XFINITY', category: 'Internet & Phone' },
  { pattern: 'VERIZON', category: 'Internet & Phone' },
  { pattern: 'T-MOBILE', category: 'Internet & Phone' },
  { pattern: 'SPECTRUM', category: 'Internet & Phone' },
  { pattern: 'PG&E', category: 'Utilities' },
  { pattern: 'PACIFIC GAS', category: 'Utilities' },
  { pattern: 'CON EDISON', category: 'Utilities' },
  { pattern: 'DUKE ENERGY', category: 'Utilities' },

  // Shopping
  { pattern: 'AMAZON', category: 'Online Shopping' },
  { pattern: 'AMZN', category: 'Online Shopping' },
  { pattern: 'TARGET', category: 'General Merchandise' },
  { pattern: 'WALMART', category: 'General Merchandise' },
  { pattern: 'BEST BUY', category: 'Electronics' },

  // Health
  { pattern: 'WALGREENS', category: 'Pharmacy' },
  { pattern: 'CVS', category: 'Pharmacy' },
  { pattern: 'RITE AID', category: 'Pharmacy' },
  { pattern: 'PLANET FITNESS', category: 'Fitness' },
  { pattern: 'EQUINOX', category: 'Fitness' },

  // Entertainment
  { pattern: 'AMC ', category: 'Movies & Events' },
  { pattern: 'TICKETMASTER', category: 'Movies & Events' },

  // Income & fees
  { pattern: 'PAYROLL', category: 'Salary' },
  { pattern: 'DIRECT DEP', category: 'Salary' },
  { pattern: 'INTEREST PAID', category: 'Interest' },
  { pattern: 'OVERDRAFT', category: 'Bank Fees' },
  { pattern: 'MONTHLY SERVICE FEE', category: 'Bank Fees' },
  { pattern: 'ATM WITHDRAWAL', category: 'ATM' },

  // Credit-card payments (also caught by transfer detection across accounts)
  { pattern: 'PAYMENT THANK YOU', category: 'Credit Card Payment' },
  { pattern: 'AUTOPAY', category: 'Credit Card Payment' },
]

const RULES_SEED_FLAG = 'seed:rules:v1'

/** Seed built-in rules from the starter dictionary. Requires categories first. */
export async function ensureRulesSeeded(): Promise<void> {
  if (await db.meta.get(RULES_SEED_FLAG)) return

  const now = Date.now()
  const rules: Rule[] = []
  for (const entry of STARTER_DICTIONARY) {
    const categoryId = await categoryIdByName(entry.category)
    if (categoryId == null) continue
    rules.push({
      field: 'rawDescription',
      match: 'contains',
      pattern: entry.pattern.toLowerCase(),
      categoryId,
      priority: 10,
      source: 'builtin',
      enabled: true,
      createdAt: now,
    })
  }

  await db.transaction('rw', db.rules, db.meta, async () => {
    if (await db.meta.get(RULES_SEED_FLAG)) return
    await db.rules.bulkAdd(rules)
    await db.meta.put({ key: RULES_SEED_FLAG, value: now })
  })
}
