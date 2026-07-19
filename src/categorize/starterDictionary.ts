import { db } from '../db'
import { categoryIdByName } from '../db/seed'
import type { Rule, RuleMatch } from '../db/schema'

/**
 * Starter merchant dictionary. Each entry maps a substring (or, for short /
 * collision-prone names, a word-boundary regex) found in a raw statement
 * descriptor to a category. These seed the built-in rules; users can edit,
 * disable, or override any of them. Matching is case-insensitive.
 *
 * Priority tiers (user/learned rules sit at 100 and outrank all of these):
 * - OVERRIDE (15): disambiguators that must beat a same-brand or overlapping
 *   brand rule ("COSTCO GAS" before "COSTCO", "XBOX" before "MICROSOFT").
 * - BRAND (10, the default): a specific merchant.
 * - GENERIC (5): keyword fallbacks ("PIZZA", "SALON", "PARKING") that only
 *   apply when no brand rule matched.
 * Within a tier, earlier entries win ties, so more specific patterns are
 * listed first.
 *
 * Income-kind targets (Salary, Refunds…) are additionally guarded by the
 * engine: they only apply to genuine bank deposits.
 *
 * Deliberately absent: P2P processors (PayPal, Venmo, Zelle, Cash App) — the
 * descriptor says who moved the money, not what it was for, so any guess
 * would be wrong as often as right.
 */

const OVERRIDE = 15
const GENERIC = 5

interface StarterEntry {
  pattern: string
  category: string
  /** Defaults to 'contains'. Use 'regex' when a substring would false-match. */
  match?: RuleMatch
  /** Defaults to BRAND (10). */
  priority?: number
}

export const STARTER_DICTIONARY: StarterEntry[] = [
  // ---- Overrides: specific pattern must beat an overlapping brand rule ----
  { pattern: 'uber\\W*eats', match: 'regex', category: 'Food Delivery', priority: OVERRIDE },
  { pattern: 'COSTCO GAS', category: 'Gas', priority: OVERRIDE },
  { pattern: 'PRIME VIDEO', category: 'Streaming', priority: OVERRIDE },
  { pattern: '(amazon|amzn).{0,3}prime', match: 'regex', category: 'Memberships', priority: OVERRIDE },
  { pattern: 'AMAZON MUSIC', category: 'Streaming', priority: OVERRIDE },
  { pattern: 'AMAZON FRESH', category: 'Groceries', priority: OVERRIDE },
  { pattern: 'XBOX', category: 'Games', priority: OVERRIDE },
  { pattern: 'DELTA DENTAL', category: 'Doctor & Dental', priority: OVERRIDE },
  { pattern: 'ALAMO DRAFTHOUSE', category: 'Movies & Events', priority: OVERRIDE },
  { pattern: 'SOUTHWEST GAS', category: 'Utilities', priority: OVERRIDE }, // not the airline
  { pattern: 'ATM FEE', category: 'Bank Fees', priority: OVERRIDE },
  { pattern: 'TURBOTAX', category: 'Taxes', priority: OVERRIDE },
  // "IRS TREAS ... TAX REF" is a refund; income guard limits it to deposits,
  // so tax *payments* fall through to the IRS rule below.
  { pattern: 'TAX REF', category: 'Refunds & Reimbursements', priority: OVERRIDE },

  // ---- Food delivery ----
  { pattern: 'DOORDASH', category: 'Food Delivery' },
  { pattern: 'GRUBHUB', category: 'Food Delivery' },
  { pattern: 'POSTMATES', category: 'Food Delivery' },
  { pattern: 'SEAMLESS', category: 'Food Delivery' },
  { pattern: 'TRYCAVIAR', category: 'Food Delivery' },
  { pattern: 'DELIVEROO', category: 'Food Delivery' },
  { pattern: 'SKIPTHEDISHES', category: 'Food Delivery' },

  // ---- Coffee ----
  { pattern: 'STARBUCKS', category: 'Coffee Shops' },
  { pattern: 'DUNKIN', category: 'Coffee Shops' },
  { pattern: 'PEET', category: 'Coffee Shops' },
  { pattern: 'BLUE BOTTLE', category: 'Coffee Shops' },
  { pattern: 'PHILZ', category: 'Coffee Shops' },
  { pattern: 'CARIBOU COFFEE', category: 'Coffee Shops' },
  { pattern: 'DUTCH BROS', category: 'Coffee Shops' },
  { pattern: 'TIM HORTON', category: 'Coffee Shops' },
  { pattern: 'LA COLOMBE', category: 'Coffee Shops' },

  // ---- Fast food ----
  { pattern: 'MCDONALD', category: 'Fast Food' },
  { pattern: 'BURGER KING', category: 'Fast Food' },
  { pattern: 'WENDY', category: 'Fast Food' },
  { pattern: 'TACO BELL', category: 'Fast Food' },
  { pattern: 'CHICK-FIL-A', category: 'Fast Food' },
  { pattern: 'CHICKFILA', category: 'Fast Food' },
  { pattern: 'CHIPOTLE', category: 'Fast Food' },
  { pattern: 'SUBWAY', category: 'Fast Food' },
  { pattern: 'KFC', category: 'Fast Food' },
  { pattern: 'POPEYES', category: 'Fast Food' },
  { pattern: 'ARBY', category: 'Fast Food' },
  { pattern: 'SONIC DRIVE', category: 'Fast Food' },
  { pattern: 'JACK IN THE BOX', category: 'Fast Food' },
  { pattern: 'FIVE GUYS', category: 'Fast Food' },
  { pattern: 'IN-N-OUT', category: 'Fast Food' },
  { pattern: 'IN N OUT', category: 'Fast Food' },
  { pattern: 'WHATABURGER', category: 'Fast Food' },
  { pattern: 'PANDA EXPRESS', category: 'Fast Food' },
  { pattern: 'PANERA', category: 'Fast Food' },
  { pattern: 'JIMMY JOHN', category: 'Fast Food' },
  { pattern: 'JERSEY MIKE', category: 'Fast Food' },
  { pattern: 'FIREHOUSE SUBS', category: 'Fast Food' },
  { pattern: 'POTBELLY', category: 'Fast Food' },
  { pattern: 'WINGSTOP', category: 'Fast Food' },
  { pattern: 'RAISING CANE', category: 'Fast Food' },
  { pattern: 'culver.?s', match: 'regex', category: 'Fast Food' }, // not Culver City
  { pattern: 'DAIRY QUEEN', category: 'Fast Food' },
  { pattern: 'ZAXBY', category: 'Fast Food' },
  { pattern: 'BOJANGLES', category: 'Fast Food' },
  { pattern: 'DEL TACO', category: 'Fast Food' },
  { pattern: "carl'?s jr", match: 'regex', category: 'Fast Food' },
  { pattern: 'HARDEE', category: 'Fast Food' },
  { pattern: 'WHITE CASTLE', category: 'Fast Food' },
  { pattern: 'LITTLE CAESAR', category: 'Fast Food' },
  { pattern: 'DOMINO', category: 'Fast Food' },
  { pattern: 'PIZZA HUT', category: 'Fast Food' },
  { pattern: 'PAPA JOHN', category: 'Fast Food' },
  { pattern: 'PAPA MURPHY', category: 'Fast Food' },
  { pattern: 'QDOBA', category: 'Fast Food' },
  { pattern: 'SHAKE SHACK', category: 'Fast Food' },
  { pattern: 'SMOOTHIE KING', category: 'Fast Food' },
  { pattern: 'JAMBA', category: 'Fast Food' },
  { pattern: 'CRUMBL', category: 'Fast Food' },

  // ---- Restaurants ----
  { pattern: 'OLIVE GARDEN', category: 'Restaurants' },
  { pattern: 'APPLEBEE', category: 'Restaurants' },
  { pattern: "chili'?s", match: 'regex', category: 'Restaurants' },
  { pattern: 'OUTBACK', category: 'Restaurants' },
  { pattern: 'TEXAS ROADHOUSE', category: 'Restaurants' },
  { pattern: 'RED LOBSTER', category: 'Restaurants' },
  { pattern: 'BUFFALO WILD WINGS', category: 'Restaurants' },
  { pattern: 'CHEESECAKE FACTORY', category: 'Restaurants' },
  { pattern: 'CRACKER BARREL', category: 'Restaurants' },
  { pattern: 'IHOP', category: 'Restaurants' },
  { pattern: 'DENNY', category: 'Restaurants' },
  { pattern: 'WAFFLE HOUSE', category: 'Restaurants' },
  { pattern: 'RED ROBIN', category: 'Restaurants' },
  { pattern: 'p\\.?f\\.? chang', match: 'regex', category: 'Restaurants' },
  { pattern: 'TGI FRIDAY', category: 'Restaurants' },
  { pattern: 'RUBY TUESDAY', category: 'Restaurants' },
  { pattern: 'LONGHORN', category: 'Restaurants' },
  // Toast POS prefix — used almost exclusively by restaurants.
  { pattern: 'TST*', category: 'Restaurants', priority: GENERIC },

  // ---- Alcohol ----
  { pattern: 'TOTAL WINE', category: 'Alcohol & Bars' },
  { pattern: 'BEVMO', category: 'Alcohol & Bars' },

  // ---- Groceries ----
  { pattern: 'INSTACART', category: 'Groceries' },
  { pattern: 'WHOLE FOODS', category: 'Groceries' },
  { pattern: 'WHOLEFDS', category: 'Groceries' },
  { pattern: 'TRADER JOE', category: 'Groceries' },
  { pattern: 'SAFEWAY', category: 'Groceries' },
  { pattern: 'KROGER', category: 'Groceries' },
  { pattern: '\\baldi\\b', match: 'regex', category: 'Groceries' }, // not VIVALDI
  { pattern: 'COSTCO', category: 'Groceries' },
  { pattern: 'PUBLIX', category: 'Groceries' },
  { pattern: 'WEGMANS', category: 'Groceries' },
  { pattern: 'SPROUTS', category: 'Groceries' },
  { pattern: 'ALBERTSONS', category: 'Groceries' },
  { pattern: '\\bvons\\b', match: 'regex', category: 'Groceries' }, // not DEVONSHIRE
  { pattern: 'RALPHS', category: 'Groceries' },
  { pattern: 'FOOD LION', category: 'Groceries' },
  { pattern: 'HARRIS TEETER', category: 'Groceries' },
  { pattern: 'MEIJER', category: 'Groceries' },
  { pattern: 'hy-?vee', match: 'regex', category: 'Groceries' },
  { pattern: 'WINCO', category: 'Groceries' },
  { pattern: 'H-E-B', category: 'Groceries' },
  { pattern: '\\bheb\\b', match: 'regex', category: 'Groceries' },
  { pattern: 'LIDL', category: 'Groceries' },
  { pattern: 'FRED MEYER', category: 'Groceries' },
  { pattern: "sam'?s ?club", match: 'regex', category: 'Groceries' },
  { pattern: 'KING SOOPERS', category: 'Groceries' },
  { pattern: 'STOP & SHOP', category: 'Groceries' },
  { pattern: 'SHOPRITE', category: 'Groceries' },
  { pattern: 'PIGGLY WIGGLY', category: 'Groceries' },
  { pattern: 'winn[ -]dixie', match: 'regex', category: 'Groceries' },
  { pattern: 'jewel[ -]osco', match: 'regex', category: 'Groceries' },
  { pattern: 'GIANT EAGLE', category: 'Groceries' },
  { pattern: 'STATER BROS', category: 'Groceries' },

  // ---- Gas & convenience ----
  { pattern: '\\bshell\\b', match: 'regex', category: 'Gas' },
  { pattern: 'CHEVRON', category: 'Gas' },
  { pattern: 'EXXON', category: 'Gas' },
  { pattern: '\\bmobil\\b', match: 'regex', category: 'Gas' }, // not T-MOBILE
  { pattern: '\\barco\\b', match: 'regex', category: 'Gas' }, // not MARCO'S
  { pattern: 'VALERO', category: 'Gas' },
  { pattern: 'TEXACO', category: 'Gas' },
  { pattern: 'SUNOCO', category: 'Gas' },
  { pattern: '\\bbp\\b', match: 'regex', category: 'Gas' },
  { pattern: 'CIRCLE K', category: 'Gas' },
  { pattern: 'CIRCLEK', category: 'Gas' },
  { pattern: '7.?eleven', match: 'regex', category: 'Gas' },
  { pattern: 'WAWA', category: 'Gas' },
  { pattern: 'SHEETZ', category: 'Gas' },
  { pattern: 'QUIKTRIP', category: 'Gas' },
  { pattern: 'RACETRAC', category: 'Gas' },
  { pattern: 'SPEEDWAY', category: 'Gas' },
  { pattern: "casey'?s", match: 'regex', category: 'Gas' },
  { pattern: 'MURPHY USA', category: 'Gas' },
  { pattern: 'MURPHY EXPRESS', category: 'Gas' },
  { pattern: "love'?s travel", match: 'regex', category: 'Gas' },
  { pattern: 'PILOT TRAVEL', category: 'Gas' },
  { pattern: 'CONOCO', category: 'Gas' },
  { pattern: 'PHILLIPS 66', category: 'Gas' },
  { pattern: 'KWIK TRIP', category: 'Gas' },

  // ---- Rideshare & transit ----
  { pattern: '\\buber\\b', match: 'regex', category: 'Rideshare & Taxi' }, // eats handled above
  { pattern: 'LYFT', category: 'Rideshare & Taxi' },
  { pattern: '\\bmta\\b', match: 'regex', category: 'Public Transit' },
  { pattern: '\\bbart\\b', match: 'regex', category: 'Public Transit' },
  { pattern: 'WMATA', category: 'Public Transit' },
  { pattern: 'SEPTA', category: 'Public Transit' },
  { pattern: 'MBTA', category: 'Public Transit' },
  { pattern: '\\bmarta\\b', match: 'regex', category: 'Public Transit' },
  { pattern: '\\bcta\\b', match: 'regex', category: 'Public Transit' },
  { pattern: 'NJ TRANSIT', category: 'Public Transit' },
  { pattern: 'CALTRAIN', category: 'Public Transit' },
  { pattern: 'AMTRAK', category: 'Public Transit' },
  { pattern: 'SOUND TRANSIT', category: 'Public Transit' },
  { pattern: 'METROCARD', category: 'Public Transit' },

  // ---- Parking & tolls ----
  { pattern: 'PARKMOBILE', category: 'Parking & Tolls' },
  { pattern: 'SPOTHERO', category: 'Parking & Tolls' },
  { pattern: 'PAYBYPHONE', category: 'Parking & Tolls' },
  { pattern: 'e-?z ?pass', match: 'regex', category: 'Parking & Tolls' },
  { pattern: 'FASTRAK', category: 'Parking & Tolls' },
  { pattern: 'SUNPASS', category: 'Parking & Tolls' },
  { pattern: 'TXTAG', category: 'Parking & Tolls' },
  { pattern: 'i-?pass\\b', match: 'regex', category: 'Parking & Tolls' },

  // ---- Auto ----
  { pattern: 'AUTOZONE', category: 'Auto & Maintenance' },
  { pattern: "o'?reilly", match: 'regex', category: 'Auto & Maintenance' },
  { pattern: 'ADVANCE AUTO', category: 'Auto & Maintenance' },
  { pattern: 'NAPA AUTO', category: 'Auto & Maintenance' },
  { pattern: 'JIFFY LUBE', category: 'Auto & Maintenance' },
  { pattern: 'VALVOLINE', category: 'Auto & Maintenance' },
  { pattern: 'DISCOUNT TIRE', category: 'Auto & Maintenance' },
  { pattern: 'LES SCHWAB', category: 'Auto & Maintenance' },
  { pattern: 'FIRESTONE', category: 'Auto & Maintenance' },
  { pattern: 'GOODYEAR', category: 'Auto & Maintenance' },
  { pattern: 'MIDAS', category: 'Auto & Maintenance' },
  { pattern: 'PEP BOYS', category: 'Auto & Maintenance' },
  { pattern: '\\bdmv\\b', match: 'regex', category: 'Auto & Maintenance' },

  // ---- Housing ----
  { pattern: 'MORTGAGE', category: 'Rent & Mortgage' },
  { pattern: 'mr\\.? cooper', match: 'regex', category: 'Rent & Mortgage' },
  { pattern: 'PG&E', category: 'Utilities' },
  { pattern: 'PGANDE', category: 'Utilities' },
  { pattern: 'PACIFIC GAS', category: 'Utilities' },
  { pattern: 'CON ED', category: 'Utilities' },
  { pattern: 'DUKE ENERGY', category: 'Utilities' },
  { pattern: 'SOCAL EDISON', category: 'Utilities' },
  { pattern: 'SO CAL EDISON', category: 'Utilities' },
  { pattern: 'SOCALGAS', category: 'Utilities' },
  { pattern: 'SO CAL GAS', category: 'Utilities' },
  { pattern: 'GEORGIA POWER', category: 'Utilities' },
  { pattern: 'FLORIDA POWER', category: 'Utilities' },
  { pattern: '\\bfpl\\b', match: 'regex', category: 'Utilities' },
  { pattern: 'NATIONAL GRID', category: 'Utilities' },
  { pattern: 'XCEL ENERGY', category: 'Utilities' },
  { pattern: 'DOMINION ENERGY', category: 'Utilities' },
  { pattern: 'SDG&E', category: 'Utilities' },
  { pattern: 'CENTERPOINT', category: 'Utilities' },
  { pattern: 'AMEREN', category: 'Utilities' },
  { pattern: 'ENTERGY', category: 'Utilities' },
  { pattern: 'PSE&G', category: 'Utilities' },
  { pattern: 'PSEG', category: 'Utilities' },
  { pattern: 'NV ENERGY', category: 'Utilities' },
  { pattern: 'WASTE MANAGEMENT', category: 'Utilities' },
  { pattern: 'WASTE MGMT', category: 'Utilities' },
  { pattern: 'REPUBLIC SERVICES', category: 'Utilities' },
  { pattern: 'RECOLOGY', category: 'Utilities' },

  // ---- Internet & phone ----
  { pattern: 'COMCAST', category: 'Internet & Phone' },
  { pattern: 'XFINITY', category: 'Internet & Phone' },
  { pattern: 'VERIZON', category: 'Internet & Phone' },
  { pattern: 't-?mobile', match: 'regex', category: 'Internet & Phone' },
  { pattern: 'METROPCS', category: 'Internet & Phone' },
  { pattern: 'SPECTRUM', category: 'Internet & Phone' },
  { pattern: 'AT&T', category: 'Internet & Phone' },
  { pattern: '\\batt\\b', match: 'regex', category: 'Internet & Phone' },
  { pattern: '\\bcox\\b', match: 'regex', category: 'Internet & Phone' },
  { pattern: 'CENTURYLINK', category: 'Internet & Phone' },
  { pattern: 'FRONTIER COMM', category: 'Internet & Phone' },
  { pattern: 'MINT MOBILE', category: 'Internet & Phone' },
  { pattern: 'CRICKET WIRELESS', category: 'Internet & Phone' },
  { pattern: 'BOOST MOBILE', category: 'Internet & Phone' },
  { pattern: 'US CELLULAR', category: 'Internet & Phone' },
  { pattern: 'google\\W*fi\\b', match: 'regex', category: 'Internet & Phone' },
  { pattern: 'STRAIGHT TALK', category: 'Internet & Phone' },
  { pattern: 'STARLINK', category: 'Internet & Phone' },

  // ---- Streaming ----
  { pattern: 'NETFLIX', category: 'Streaming' },
  { pattern: 'HULU', category: 'Streaming' },
  { pattern: 'disney ?(\\+|plus)', match: 'regex', category: 'Streaming' },
  { pattern: 'SPOTIFY', category: 'Streaming' },
  { pattern: 'HBO', category: 'Streaming' },
  { pattern: 'YOUTUBE', category: 'Streaming' },
  { pattern: 'PARAMOUNT', category: 'Streaming' },
  { pattern: 'PEACOCK', category: 'Streaming' },
  { pattern: 'SIRIUSXM', category: 'Streaming' },
  { pattern: 'SIRIUS XM', category: 'Streaming' },
  { pattern: 'AUDIBLE', category: 'Streaming' },
  { pattern: 'CRUNCHYROLL', category: 'Streaming' },
  { pattern: 'TWITCH', category: 'Streaming' },

  // ---- Software & subscriptions ----
  { pattern: 'ADOBE', category: 'Software' },
  { pattern: 'MICROSOFT', category: 'Software' },
  { pattern: 'GITHUB', category: 'Software' },
  { pattern: 'DROPBOX', category: 'Software' },
  { pattern: 'APPLE.COM/BILL', category: 'Software' },
  { pattern: 'OPENAI', category: 'Software' },
  { pattern: 'CHATGPT', category: 'Software' },
  { pattern: 'ANTHROPIC', category: 'Software' },
  { pattern: 'CLAUDE.AI', category: 'Software' },
  { pattern: '\\bcanva\\b', match: 'regex', category: 'Software' }, // not CANVAS
  { pattern: '\\bnotion\\b', match: 'regex', category: 'Software' }, // not NOTIONS
  { pattern: 'FIGMA', category: 'Software' },
  { pattern: 'ZOOM.US', category: 'Software' },
  { pattern: 'ATLASSIAN', category: 'Software' },
  { pattern: 'JETBRAINS', category: 'Software' },
  { pattern: '1PASSWORD', category: 'Software' },
  { pattern: 'LASTPASS', category: 'Software' },
  { pattern: 'NORDVPN', category: 'Software' },
  { pattern: 'EXPRESSVPN', category: 'Software' },
  { pattern: 'GODADDY', category: 'Software' },
  { pattern: 'NAMECHEAP', category: 'Software' },
  { pattern: 'SQUARESPACE', category: 'Software' },
  { pattern: 'WORDPRESS', category: 'Software' },
  { pattern: 'WIX.COM', category: 'Software' },
  { pattern: 'DIGITALOCEAN', category: 'Software' },
  { pattern: 'CLOUDFLARE', category: 'Software' },
  { pattern: 'google\\W*one\\b', match: 'regex', category: 'Software' },
  { pattern: 'GOOGLE STORAGE', category: 'Software' },
  { pattern: 'GOOGLE PLAY', category: 'Software' },

  // ---- Memberships ----
  { pattern: '\\baaa\\b', match: 'regex', category: 'Memberships' },
  { pattern: 'PATREON', category: 'Memberships' },

  // ---- Fitness ----
  { pattern: 'EQUINOX', category: 'Fitness' },
  { pattern: 'ORANGETHEORY', category: 'Fitness' },
  { pattern: 'ORANGE THEORY', category: 'Fitness' },
  { pattern: 'YMCA', category: 'Fitness' },
  { pattern: 'PELOTON', category: 'Fitness' },
  { pattern: 'CLASSPASS', category: 'Fitness' },

  // ---- Health ----
  { pattern: 'WALGREENS', category: 'Pharmacy' },
  { pattern: '\\bcvs\\b', match: 'regex', category: 'Pharmacy' },
  { pattern: 'RITE AID', category: 'Pharmacy' },
  { pattern: 'DUANE READE', category: 'Pharmacy' },
  { pattern: 'GOODRX', category: 'Pharmacy' },
  { pattern: 'LABCORP', category: 'Doctor & Dental' },
  { pattern: 'QUEST DIAGNOSTIC', category: 'Doctor & Dental' },
  { pattern: 'KAISER', category: 'Doctor & Dental' },
  { pattern: 'ONE MEDICAL', category: 'Doctor & Dental' },

  // ---- Insurance ----
  { pattern: 'GEICO', category: 'Insurance' },
  { pattern: 'PROGRESSIVE', category: 'Insurance' },
  { pattern: 'STATE FARM', category: 'Insurance' },
  { pattern: 'ALLSTATE', category: 'Insurance' },
  { pattern: 'LIBERTY MUTUAL', category: 'Insurance' },
  { pattern: 'FARMERS INS', category: 'Insurance' },
  { pattern: 'NATIONWIDE', category: 'Insurance' },
  { pattern: 'AETNA', category: 'Insurance' },
  { pattern: 'CIGNA', category: 'Insurance' },
  { pattern: 'BLUE CROSS', category: 'Insurance' },
  { pattern: 'BLUE SHIELD', category: 'Insurance' },
  { pattern: '\\bbcbs\\b', match: 'regex', category: 'Insurance' },
  { pattern: 'UNITEDHEALTH', category: 'Insurance' },
  { pattern: 'UNITED HEALTH', category: 'Insurance' },
  { pattern: 'HUMANA', category: 'Insurance' },
  { pattern: 'METLIFE', category: 'Insurance' },

  // ---- Clothing ----
  { pattern: 'OLD NAVY', category: 'Clothing' },
  { pattern: '\\bgap\\b', match: 'regex', category: 'Clothing' },
  { pattern: 'BANANA REPUBLIC', category: 'Clothing' },
  { pattern: 'H&M', category: 'Clothing' },
  { pattern: '\\bzara\\b', match: 'regex', category: 'Clothing' },
  { pattern: 'UNIQLO', category: 'Clothing' },
  { pattern: 'NORDSTROM', category: 'Clothing' },
  { pattern: "\\bmacy'?s\\b", match: 'regex', category: 'Clothing' }, // not PHARMACY
  { pattern: "kohl'?s\\b", match: 'regex', category: 'Clothing' }, // not KOHLER
  { pattern: 'tj ?maxx', match: 'regex', category: 'Clothing' },
  { pattern: 'MARSHALLS', category: 'Clothing' },
  { pattern: 'ROSS DRESS', category: 'Clothing' },
  { pattern: 'ROSS STORES', category: 'Clothing' },
  { pattern: 'BURLINGTON STORES', category: 'Clothing' }, // bare BURLINGTON is a city
  { pattern: '\\bnike\\b', match: 'regex', category: 'Clothing' },
  { pattern: 'ADIDAS', category: 'Clothing' },
  { pattern: 'LULULEMON', category: 'Clothing' },
  { pattern: 'ANTHROPOLOGIE', category: 'Clothing' },
  { pattern: 'URBAN OUTFITTERS', category: 'Clothing' },
  { pattern: 'FOREVER 21', category: 'Clothing' },
  { pattern: "victoria'?s ?secret", match: 'regex', category: 'Clothing' },
  { pattern: 'SHEIN', category: 'Clothing' },
  { pattern: 'FOOT LOCKER', category: 'Clothing' },
  { pattern: 'DSW', category: 'Clothing' },
  { pattern: 'AMERICAN EAGLE', category: 'Clothing' },
  { pattern: 'ABERCROMBIE', category: 'Clothing' },

  // ---- Electronics ----
  { pattern: 'best ?buy', match: 'regex', category: 'Electronics' },
  { pattern: 'MICRO CENTER', category: 'Electronics' },
  { pattern: 'NEWEGG', category: 'Electronics' },
  { pattern: 'B&H PHOTO', category: 'Electronics' },
  { pattern: 'APPLE STORE', category: 'Electronics' },

  // ---- General merchandise ----
  { pattern: 'TARGET', category: 'General Merchandise' },
  { pattern: 'wal-?mart', match: 'regex', category: 'General Merchandise' },
  { pattern: 'WM SUPERCENTER', category: 'General Merchandise' },
  { pattern: 'DOLLAR GENERAL', category: 'General Merchandise' },
  { pattern: 'DOLLAR TREE', category: 'General Merchandise' },
  { pattern: 'FAMILY DOLLAR', category: 'General Merchandise' },
  { pattern: 'FIVE BELOW', category: 'General Merchandise' },
  { pattern: 'BIG LOTS', category: 'General Merchandise' },
  { pattern: 'IKEA', category: 'General Merchandise' },
  { pattern: 'GOODWILL', category: 'General Merchandise' },

  // ---- Online shopping ----
  { pattern: 'AMAZON', category: 'Online Shopping' },
  { pattern: 'AMZN', category: 'Online Shopping' },
  { pattern: 'EBAY', category: 'Online Shopping' },
  { pattern: '\\betsy\\b', match: 'regex', category: 'Online Shopping' }, // not BETSY
  { pattern: 'WAYFAIR', category: 'Online Shopping' },
  { pattern: 'OVERSTOCK', category: 'Online Shopping' },
  { pattern: 'TEMU', category: 'Online Shopping' },
  { pattern: 'ALIEXPRESS', category: 'Online Shopping' },
  { pattern: 'WISH.COM', category: 'Online Shopping' },

  // ---- Home maintenance ----
  { pattern: 'home ?depot', match: 'regex', category: 'Home Maintenance' },
  { pattern: "lowe'?s\\b", match: 'regex', category: 'Home Maintenance' },
  { pattern: 'ACE HARDWARE', category: 'Home Maintenance' },
  { pattern: 'ACE HDWE', category: 'Home Maintenance' },
  { pattern: 'MENARDS', category: 'Home Maintenance' },
  { pattern: 'HARBOR FREIGHT', category: 'Home Maintenance' },
  { pattern: 'SHERWIN', category: 'Home Maintenance' },
  { pattern: 'TRACTOR SUPPLY', category: 'Home Maintenance' },
  { pattern: 'TRUE VALUE', category: 'Home Maintenance' },
  { pattern: '\\borkin\\b', match: 'regex', category: 'Home Maintenance' }, // not WORKING
  { pattern: 'TERMINIX', category: 'Home Maintenance' },

  // ---- Games ----
  { pattern: 'STEAMGAMES', category: 'Games' },
  { pattern: '\\bsteam\\b', match: 'regex', category: 'Games' },
  { pattern: 'PLAYSTATION', category: 'Games' },
  { pattern: 'NINTENDO', category: 'Games' },
  { pattern: 'GAMESTOP', category: 'Games' },
  { pattern: 'EPIC GAMES', category: 'Games' },
  { pattern: 'RIOT GAMES', category: 'Games' },
  { pattern: 'BLIZZARD', category: 'Games' },
  { pattern: 'ROBLOX', category: 'Games' },
  { pattern: 'DISCORD', category: 'Games' },

  // ---- Hobbies ----
  { pattern: "michael'?s\\b", match: 'regex', category: 'Hobbies' },
  { pattern: 'HOBBY LOBBY', category: 'Hobbies' },
  { pattern: 'jo-?ann\\b', match: 'regex', category: 'Hobbies' }, // not JOANNE
  { pattern: 'barnes ?&? ?noble', match: 'regex', category: 'Hobbies' },
  { pattern: 'BASS PRO', category: 'Hobbies' },
  { pattern: 'CABELA', category: 'Hobbies' },
  { pattern: '\\brei\\b', match: 'regex', category: 'Hobbies' },
  { pattern: "dick'?s sport", match: 'regex', category: 'Hobbies' },
  { pattern: 'ACADEMY SPORTS', category: 'Hobbies' },
  { pattern: 'GUITAR CENTER', category: 'Hobbies' },

  // ---- Movies & events ----
  { pattern: '\\bamc\\b', match: 'regex', category: 'Movies & Events' },
  { pattern: 'TICKETMASTER', category: 'Movies & Events' },
  { pattern: 'REGAL', category: 'Movies & Events' },
  { pattern: 'CINEMARK', category: 'Movies & Events' },
  { pattern: 'FANDANGO', category: 'Movies & Events' },
  { pattern: 'STUBHUB', category: 'Movies & Events' },
  { pattern: 'EVENTBRITE', category: 'Movies & Events' },
  { pattern: 'LIVE NATION', category: 'Movies & Events' },
  { pattern: 'LIVENATION', category: 'Movies & Events' },
  { pattern: 'SEATGEEK', category: 'Movies & Events' },
  { pattern: 'TOPGOLF', category: 'Movies & Events' },

  // ---- Travel ----
  { pattern: 'DELTA AIR', category: 'Flights' },
  { pattern: 'UNITED AIR', category: 'Flights' },
  { pattern: 'AMERICAN AIR', category: 'Flights' },
  { pattern: 'SOUTHWEST AIR', category: 'Flights' },
  { pattern: 'SOUTHWES', category: 'Flights' }, // truncated card descriptor
  { pattern: 'JETBLUE', category: 'Flights' },
  { pattern: 'ALASKA AIR', category: 'Flights' },
  { pattern: 'SPIRIT AIR', category: 'Flights' },
  { pattern: 'FRONTIER AIR', category: 'Flights' },
  { pattern: 'ALLEGIANT', category: 'Flights' },
  { pattern: 'HAWAIIAN AIR', category: 'Flights' },
  { pattern: 'EXPEDIA', category: 'Flights' },
  { pattern: 'PRICELINE', category: 'Flights' },
  { pattern: 'ORBITZ', category: 'Flights' },
  { pattern: 'TRAVELOCITY', category: 'Flights' },
  { pattern: 'MARRIOTT', category: 'Hotels' },
  { pattern: 'HILTON', category: 'Hotels' },
  { pattern: 'HYATT', category: 'Hotels' },
  { pattern: 'AIRBNB', category: 'Hotels' },
  { pattern: 'VRBO', category: 'Hotels' },
  { pattern: 'BOOKING.COM', category: 'Hotels' },
  { pattern: 'HOTELS.COM', category: 'Hotels' },
  { pattern: 'HOLIDAY INN', category: 'Hotels' },
  { pattern: 'BEST WESTERN', category: 'Hotels' },
  { pattern: 'HAMPTON INN', category: 'Hotels' },
  { pattern: 'WYNDHAM', category: 'Hotels' },
  { pattern: 'MOTEL 6', category: 'Hotels' },
  { pattern: 'LA QUINTA', category: 'Hotels' },
  { pattern: 'SHERATON', category: 'Hotels' },
  { pattern: '\\bwestin\\b', match: 'regex', category: 'Hotels' }, // not WESTINGHOUSE
  { pattern: 'DOUBLETREE', category: 'Hotels' },
  { pattern: 'EMBASSY SUITES', category: 'Hotels' },
  { pattern: 'EXTENDED STAY', category: 'Hotels' },
  { pattern: 'HERTZ', category: 'Car Rental' },
  { pattern: '\\bavis\\b', match: 'regex', category: 'Car Rental' },
  { pattern: 'ENTERPRISE RENT', category: 'Car Rental' },
  { pattern: 'BUDGET RENT', category: 'Car Rental' },
  { pattern: 'NATIONAL CAR', category: 'Car Rental' },
  { pattern: '\\balamo\\b', match: 'regex', category: 'Car Rental' }, // Drafthouse overridden above
  { pattern: 'THRIFTY', category: 'Car Rental' },
  { pattern: '\\bturo\\b', match: 'regex', category: 'Car Rental' }, // not NATUROPATH
  { pattern: 'ZIPCAR', category: 'Car Rental' },
  { pattern: 'rent.?a.?car', match: 'regex', category: 'Car Rental' },

  // ---- Personal care ----
  { pattern: 'SEPHORA', category: 'Personal Care' },
  { pattern: '\\bulta\\b', match: 'regex', category: 'Personal Care' },
  { pattern: 'MASSAGE', category: 'Personal Care' },
  { pattern: 'GREAT CLIPS', category: 'Personal Care' },
  { pattern: 'SUPERCUTS', category: 'Personal Care' },
  { pattern: 'SPORT CLIPS', category: 'Personal Care' },
  { pattern: 'EUROPEAN WAX', category: 'Personal Care' },

  // ---- Education & childcare ----
  { pattern: 'UDEMY', category: 'Education' },
  { pattern: 'COURSERA', category: 'Education' },
  { pattern: 'SKILLSHARE', category: 'Education' },
  { pattern: 'MASTERCLASS', category: 'Education' },
  { pattern: 'DUOLINGO', category: 'Education' },
  { pattern: 'CHEGG', category: 'Education' },
  { pattern: 'KHAN ACADEMY', category: 'Education' },
  { pattern: 'KINDERCARE', category: 'Education' },

  // ---- Gifts & donations ----
  { pattern: 'GOFUNDME', category: 'Gifts & Donations' },
  { pattern: 'RED CROSS', category: 'Gifts & Donations' },
  { pattern: 'SALVATION ARMY', category: 'Gifts & Donations' },
  { pattern: 'st\\.? jude', match: 'regex', category: 'Gifts & Donations' },
  { pattern: 'UNITED WAY', category: 'Gifts & Donations' },
  { pattern: 'UNICEF', category: 'Gifts & Donations' },
  { pattern: '1.?800.?flowers', match: 'regex', category: 'Gifts & Donations' },
  { pattern: 'EDIBLE ARRANGEMENTS', category: 'Gifts & Donations' },

  // ---- Pets ----
  { pattern: '\\bchewy\\b', match: 'regex', category: 'Pets' },
  { pattern: 'PETCO', category: 'Pets' },
  { pattern: 'PETSMART', category: 'Pets' },
  { pattern: 'PET SUPPLIES', category: 'Pets' },
  { pattern: 'BANFIELD', category: 'Pets' },

  // ---- Taxes ----
  { pattern: '\\birs\\b', match: 'regex', category: 'Taxes' },
  { pattern: 'USATAXPYMT', category: 'Taxes' },
  { pattern: 'h ?& ?r block', match: 'regex', category: 'Taxes' },
  { pattern: 'HRBLOCK', category: 'Taxes' },
  { pattern: 'FRANCHISE TAX', category: 'Taxes' },
  { pattern: 'dep(t\\.?|artment) of revenue', match: 'regex', category: 'Taxes' },
  { pattern: 'PROPERTY TAX', category: 'Taxes' },
  { pattern: 'TAX COLLECTOR', category: 'Taxes' },

  // ---- Loans & BNPL ----
  { pattern: 'NELNET', category: 'Loans' },
  { pattern: 'MOHELA', category: 'Loans' },
  { pattern: 'NAVIENT', category: 'Loans' },
  { pattern: 'AIDVANTAGE', category: 'Loans' },
  { pattern: 'SALLIE MAE', category: 'Loans' },
  { pattern: 'GREAT LAKES ED', category: 'Loans' }, // bare GREAT LAKES hits breweries
  { pattern: 'GLELSI', category: 'Loans' },
  { pattern: '\\baffirm\\b', match: 'regex', category: 'Loans' },
  { pattern: 'KLARNA', category: 'Loans' },
  { pattern: 'AFTERPAY', category: 'Loans' },
  { pattern: 'SEZZLE', category: 'Loans' },

  // ---- Investments (transfer-kind: excluded from spending) ----
  { pattern: 'ROBINHOOD', category: 'Investments' },
  { pattern: 'COINBASE', category: 'Investments' },
  { pattern: 'FIDELITY', category: 'Investments' },
  { pattern: 'VANGUARD', category: 'Investments' },
  { pattern: 'SCHWAB', category: 'Investments' },
  { pattern: 'ETRADE', category: 'Investments' },
  { pattern: 'E*TRADE', category: 'Investments' },
  { pattern: 'WEALTHFRONT', category: 'Investments' },
  { pattern: 'BETTERMENT', category: 'Investments' },
  { pattern: 'ACORNS', category: 'Investments' },
  { pattern: 'WEBULL', category: 'Investments' },
  { pattern: 'MERRILL', category: 'Investments' },
  { pattern: 'AMERITRADE', category: 'Investments' },
  { pattern: 'INTERACTIVE BROKERS', category: 'Investments' },
  { pattern: 'CRYPTO.COM', category: 'Investments' },

  // ---- Postage & shipping ----
  { pattern: '\\busps\\b', match: 'regex', category: 'Postage & Shipping' },
  { pattern: 'US POSTAL', category: 'Postage & Shipping' },
  { pattern: 'POST OFFICE', category: 'Postage & Shipping' },
  { pattern: 'FEDEX', category: 'Postage & Shipping' },
  { pattern: 'UPS STORE', category: 'Postage & Shipping' },
  { pattern: '\\bups\\b', match: 'regex', category: 'Postage & Shipping' },
  { pattern: 'STAMPS.COM', category: 'Postage & Shipping' },

  // ---- Income (engine guard: deposits into non-credit accounts only) ----
  { pattern: 'PAYROLL', category: 'Salary' },
  { pattern: 'DIRECT DEP', category: 'Salary' },
  { pattern: 'DIR DEP', category: 'Salary' },
  { pattern: '\\bgusto\\b', match: 'regex', category: 'Salary' },
  { pattern: '\\badp\\b', match: 'regex', category: 'Salary' },
  { pattern: 'PAYCHEX', category: 'Salary' },
  { pattern: 'SALARY', category: 'Salary' },
  { pattern: 'INTEREST PAID', category: 'Interest' },
  { pattern: 'INTEREST PAYMENT', category: 'Interest' },
  { pattern: 'DIVIDEND', category: 'Other Income' },
  { pattern: 'SSA TREAS', category: 'Other Income' },
  { pattern: 'SOC SEC', category: 'Other Income' },
  { pattern: 'UNEMPLOYMENT', category: 'Other Income' },
  { pattern: 'REFUND', category: 'Refunds & Reimbursements' },
  { pattern: 'REIMBURS', category: 'Refunds & Reimbursements' },

  // ---- Fees ----
  { pattern: 'OVERDRAFT', category: 'Bank Fees' },
  { pattern: 'MONTHLY SERVICE FEE', category: 'Bank Fees' },
  { pattern: 'MAINTENANCE FEE', category: 'Bank Fees' },
  { pattern: 'SERVICE CHARGE', category: 'Bank Fees' },
  { pattern: 'NSF FEE', category: 'Bank Fees' },
  { pattern: 'LATE FEE', category: 'Bank Fees' },
  { pattern: 'ANNUAL FEE', category: 'Bank Fees' },
  { pattern: 'FOREIGN TRANSACTION FEE', category: 'Bank Fees' },
  { pattern: 'WIRE TRANSFER FEE', category: 'Bank Fees' },
  { pattern: 'INTEREST CHARGE', category: 'Interest Charges' },
  { pattern: 'PURCHASE INTEREST', category: 'Interest Charges' },
  { pattern: 'FINANCE CHARGE', category: 'Interest Charges' },
  { pattern: 'ATM WITHDRAWAL', category: 'ATM' },
  { pattern: '\\batm\\b', match: 'regex', category: 'ATM', priority: GENERIC },

  // ---- Credit-card payments (also caught by transfer detection) ----
  { pattern: 'PAYMENT THANK YOU', category: 'Credit Card Payment' },
  { pattern: 'PAYMENT RECEIVED', category: 'Credit Card Payment' },
  { pattern: 'AUTOPAY', category: 'Credit Card Payment' },
  { pattern: 'e-?payment', match: 'regex', category: 'Credit Card Payment' },
  { pattern: 'CARDMEMBER SERV', category: 'Credit Card Payment' },
  { pattern: 'CHASE CREDIT CRD', category: 'Credit Card Payment' },
  { pattern: 'CRCARDPMT', category: 'Credit Card Payment' },

  // ==== Generic keyword fallbacks (priority 5) ====
  // Food & drink
  { pattern: 'RESTAURANT', category: 'Restaurants', priority: GENERIC },
  { pattern: 'PIZZA', category: 'Restaurants', priority: GENERIC },
  { pattern: 'PIZZERIA', category: 'Restaurants', priority: GENERIC },
  { pattern: 'TAQUERIA', category: 'Restaurants', priority: GENERIC },
  { pattern: 'SUSHI', category: 'Restaurants', priority: GENERIC },
  { pattern: 'RAMEN', category: 'Restaurants', priority: GENERIC },
  { pattern: '\\bpho\\b', match: 'regex', category: 'Restaurants', priority: GENERIC },
  { pattern: '\\bthai\\b', match: 'regex', category: 'Restaurants', priority: GENERIC },
  { pattern: '\\bburgers?\\b', match: 'regex', category: 'Restaurants', priority: GENERIC },
  { pattern: 'STEAKHOUSE', category: 'Restaurants', priority: GENERIC },
  { pattern: 'BISTRO', category: 'Restaurants', priority: GENERIC },
  { pattern: '\\bdiner\\b', match: 'regex', category: 'Restaurants', priority: GENERIC },
  { pattern: '\\bgrille?\\b', match: 'regex', category: 'Restaurants', priority: GENERIC },
  { pattern: 'CANTINA', category: 'Restaurants', priority: GENERIC },
  { pattern: 'TRATTORIA', category: 'Restaurants', priority: GENERIC },
  { pattern: 'EATERY', category: 'Restaurants', priority: GENERIC },
  { pattern: 'KITCHEN', category: 'Restaurants', priority: GENERIC },
  { pattern: '\\bdeli\\b', match: 'regex', category: 'Restaurants', priority: GENERIC },
  { pattern: 'ICE CREAM', category: 'Restaurants', priority: GENERIC },
  { pattern: 'CATERING', category: 'Restaurants', priority: GENERIC },
  { pattern: '\\bbbq\\b', match: 'regex', category: 'Restaurants', priority: GENERIC },
  { pattern: 'BARBECUE', category: 'Restaurants', priority: GENERIC },
  { pattern: 'BARBEQUE', category: 'Restaurants', priority: GENERIC },
  { pattern: 'COFFEE', category: 'Coffee Shops', priority: GENERIC },
  { pattern: '\\bcafe\\b', match: 'regex', category: 'Coffee Shops', priority: GENERIC },
  { pattern: 'ESPRESSO', category: 'Coffee Shops', priority: GENERIC },
  { pattern: '\\bboba\\b', match: 'regex', category: 'Coffee Shops', priority: GENERIC },
  { pattern: 'BUBBLE TEA', category: 'Coffee Shops', priority: GENERIC },
  { pattern: 'DONUT', category: 'Coffee Shops', priority: GENERIC },
  { pattern: 'DOUGHNUT', category: 'Coffee Shops', priority: GENERIC },
  { pattern: 'BAGEL', category: 'Coffee Shops', priority: GENERIC },
  { pattern: 'BAKERY', category: 'Restaurants', priority: GENERIC },
  { pattern: 'LIQUOR', category: 'Alcohol & Bars', priority: GENERIC },
  { pattern: 'BREWERY', category: 'Alcohol & Bars', priority: GENERIC },
  { pattern: 'BREWING', category: 'Alcohol & Bars', priority: GENERIC },
  { pattern: 'TAPROOM', category: 'Alcohol & Bars', priority: GENERIC },
  { pattern: 'WINERY', category: 'Alcohol & Bars', priority: GENERIC },
  { pattern: 'TAVERN', category: 'Alcohol & Bars', priority: GENERIC },
  { pattern: '\\bpub\\b', match: 'regex', category: 'Alcohol & Bars', priority: GENERIC },
  { pattern: '\\bbar\\b', match: 'regex', category: 'Alcohol & Bars', priority: GENERIC },
  { pattern: 'GROCER', category: 'Groceries', priority: GENERIC },
  { pattern: 'SUPERMARKET', category: 'Groceries', priority: GENERIC },
  { pattern: "farmer'?s market", match: 'regex', category: 'Groceries', priority: GENERIC },
  { pattern: 'FOOD MART', category: 'Groceries', priority: GENERIC },
  // Transport
  { pattern: '\\bfuel\\b', match: 'regex', category: 'Gas', priority: GENERIC },
  { pattern: 'GAS STATION', category: 'Gas', priority: GENERIC },
  { pattern: 'PETROLEUM', category: 'Gas', priority: GENERIC },
  { pattern: '\\btaxi\\b', match: 'regex', category: 'Rideshare & Taxi', priority: GENERIC },
  { pattern: '\\btransit\\b', match: 'regex', category: 'Public Transit', priority: GENERIC },
  { pattern: 'PARKING', category: 'Parking & Tolls', priority: GENERIC },
  { pattern: '\\btolls?\\b', match: 'regex', category: 'Parking & Tolls', priority: GENERIC },
  { pattern: 'TOLLWAY', category: 'Parking & Tolls', priority: GENERIC },
  { pattern: 'TURNPIKE', category: 'Parking & Tolls', priority: GENERIC },
  { pattern: 'CAR WASH', category: 'Auto & Maintenance', priority: GENERIC },
  { pattern: 'CARWASH', category: 'Auto & Maintenance', priority: GENERIC },
  { pattern: 'AUTO REPAIR', category: 'Auto & Maintenance', priority: GENERIC },
  { pattern: '\\btires?\\b', match: 'regex', category: 'Auto & Maintenance', priority: GENERIC },
  // Housing & utilities
  { pattern: '\\brent\\b', match: 'regex', category: 'Rent & Mortgage', priority: GENERIC },
  { pattern: '\\bhoa\\b', match: 'regex', category: 'Rent & Mortgage', priority: GENERIC },
  { pattern: 'PROPERTY MANAGEMENT', category: 'Rent & Mortgage', priority: GENERIC },
  { pattern: 'UTILIT', category: 'Utilities', priority: GENERIC },
  { pattern: 'SEWER', category: 'Utilities', priority: GENERIC },
  { pattern: 'CITY OF', category: 'Utilities', priority: GENERIC },
  { pattern: 'HARDWARE', category: 'Home Maintenance', priority: GENERIC },
  { pattern: 'PLUMBING', category: 'Home Maintenance', priority: GENERIC },
  { pattern: 'ROOFING', category: 'Home Maintenance', priority: GENERIC },
  { pattern: 'PEST CONTROL', category: 'Home Maintenance', priority: GENERIC },
  { pattern: 'LANDSCAP', category: 'Home Maintenance', priority: GENERIC },
  { pattern: '\\blawn\\b', match: 'regex', category: 'Home Maintenance', priority: GENERIC },
  // Health & personal
  { pattern: 'PHARMAC', category: 'Pharmacy', priority: GENERIC },
  { pattern: 'DENTAL', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'DENTIST', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'ORTHODONT', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'MEDICAL', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'CLINIC', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'URGENT CARE', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'HOSPITAL', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'DERMATOLOG', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'CHIROPRACT', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'OPTOMETR', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'OPTICAL', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'PHYSICAL THERAPY', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'PEDIATRIC', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'RADIOLOGY', category: 'Doctor & Dental', priority: GENERIC },
  { pattern: 'INSURANCE', category: 'Insurance', priority: GENERIC },
  { pattern: 'INS PREM', category: 'Insurance', priority: GENERIC },
  { pattern: 'FITNESS', category: 'Fitness', priority: GENERIC },
  { pattern: '\\bgym\\b', match: 'regex', category: 'Fitness', priority: GENERIC },
  { pattern: 'YOGA', category: 'Fitness', priority: GENERIC },
  { pattern: 'PILATES', category: 'Fitness', priority: GENERIC },
  { pattern: 'CROSSFIT', category: 'Fitness', priority: GENERIC },
  { pattern: 'MARTIAL ARTS', category: 'Fitness', priority: GENERIC },
  { pattern: 'ATHLETIC CLUB', category: 'Fitness', priority: GENERIC },
  { pattern: 'SALON', category: 'Personal Care', priority: GENERIC },
  { pattern: 'BARBER', category: 'Personal Care', priority: GENERIC },
  { pattern: '\\bspa\\b', match: 'regex', category: 'Personal Care', priority: GENERIC },
  { pattern: '\\bnails?\\b', match: 'regex', category: 'Personal Care', priority: GENERIC },
  { pattern: 'DRY CLEAN', category: 'Personal Care', priority: GENERIC },
  { pattern: 'CLEANERS', category: 'Personal Care', priority: GENERIC },
  { pattern: 'LAUNDR', category: 'Personal Care', priority: GENERIC },
  { pattern: 'TATTOO', category: 'Personal Care', priority: GENERIC },
  // Travel & entertainment
  { pattern: 'AIRLINE', category: 'Flights', priority: GENERIC },
  { pattern: 'AIRWAYS', category: 'Flights', priority: GENERIC },
  { pattern: 'HOTEL', category: 'Hotels', priority: GENERIC },
  { pattern: 'MOTEL', category: 'Hotels', priority: GENERIC },
  { pattern: '\\binn\\b', match: 'regex', category: 'Hotels', priority: GENERIC },
  { pattern: 'RESORT', category: 'Hotels', priority: GENERIC },
  { pattern: 'CINEMA', category: 'Movies & Events', priority: GENERIC },
  { pattern: '\\btheat(er|re)s?\\b', match: 'regex', category: 'Movies & Events', priority: GENERIC },
  { pattern: 'MUSEUM', category: 'Movies & Events', priority: GENERIC },
  { pattern: '\\bzoo\\b', match: 'regex', category: 'Movies & Events', priority: GENERIC },
  { pattern: 'AQUARIUM', category: 'Movies & Events', priority: GENERIC },
  { pattern: 'BOWLING', category: 'Movies & Events', priority: GENERIC },
  { pattern: 'BOOKSTORE', category: 'Hobbies', priority: GENERIC },
  // Education, kids, giving, pets
  { pattern: 'UNIVERSITY', category: 'Education', priority: GENERIC },
  { pattern: '\\bcollege\\b', match: 'regex', category: 'Education', priority: GENERIC },
  { pattern: 'TUITION', category: 'Education', priority: GENERIC },
  { pattern: 'SCHOOL', category: 'Education', priority: GENERIC },
  { pattern: '\\bacademy\\b', match: 'regex', category: 'Education', priority: GENERIC },
  { pattern: 'DAYCARE', category: 'Education', priority: GENERIC },
  { pattern: 'CHILDCARE', category: 'Education', priority: GENERIC },
  { pattern: 'PRESCHOOL', category: 'Education', priority: GENERIC },
  { pattern: 'MONTESSORI', category: 'Education', priority: GENERIC },
  { pattern: 'DONATION', category: 'Gifts & Donations', priority: GENERIC },
  { pattern: 'DONATE', category: 'Gifts & Donations', priority: GENERIC },
  { pattern: 'CHARIT', category: 'Gifts & Donations', priority: GENERIC },
  { pattern: '\\bchurch\\b', match: 'regex', category: 'Gifts & Donations', priority: GENERIC },
  { pattern: '\\bministr(y|ies)\\b', match: 'regex', category: 'Gifts & Donations', priority: GENERIC },
  { pattern: 'TITHE', category: 'Gifts & Donations', priority: GENERIC },
  { pattern: 'FLORIST', category: 'Gifts & Donations', priority: GENERIC },
  { pattern: 'VETERINAR', category: 'Pets', priority: GENERIC },
  { pattern: 'ANIMAL HOSPITAL', category: 'Pets', priority: GENERIC },
  { pattern: '\\bpets?\\b', match: 'regex', category: 'Pets', priority: GENERIC },
  // Money
  { pattern: 'MEMBERSHIP', category: 'Memberships', priority: GENERIC },
  { pattern: 'TAX PAYMENT', category: 'Taxes', priority: GENERIC },
  { pattern: 'STUDENT LOAN', category: 'Loans', priority: GENERIC },
  { pattern: 'STUDENT LN', category: 'Loans', priority: GENERIC },
  { pattern: 'LOAN PAYMENT', category: 'Loans', priority: GENERIC },
  { pattern: 'LOAN PMT', category: 'Loans', priority: GENERIC },
  { pattern: '\\bloan\\b', match: 'regex', category: 'Loans', priority: GENERIC },
]

// v2: expanded dictionary (regex support, priority tiers, ~10x the coverage).
const RULES_SEED_FLAG = 'seed:rules:v2'

/**
 * Seed built-in rules from the starter dictionary. Requires categories first.
 * Idempotent and upgrade-safe: rules are matched by (match, pattern), so a v1
 * user keeps their existing (possibly edited) rules and only gains new ones.
 */
export async function ensureRulesSeeded(): Promise<void> {
  if (await db.meta.get(RULES_SEED_FLAG)) return

  const now = Date.now()
  const rules: Rule[] = []
  for (const entry of STARTER_DICTIONARY) {
    const categoryId = await categoryIdByName(entry.category)
    if (categoryId == null) continue
    const match = entry.match ?? 'contains'
    rules.push({
      field: 'rawDescription',
      match,
      // Lowercasing a regex would corrupt metacharacters like \W.
      pattern: match === 'regex' ? entry.pattern : entry.pattern.toLowerCase(),
      categoryId,
      priority: entry.priority ?? 10,
      source: 'builtin',
      enabled: true,
      createdAt: now,
    })
  }

  await db.transaction('rw', db.rules, db.meta, async () => {
    if (await db.meta.get(RULES_SEED_FLAG)) return
    const existing = new Set(
      (await db.rules.toArray()).map((r) => `${r.match}:${r.pattern}`),
    )
    const missing = rules.filter((r) => !existing.has(`${r.match}:${r.pattern}`))
    if (missing.length) await db.rules.bulkAdd(missing)
    await db.meta.put({ key: RULES_SEED_FLAG, value: now })
  })
}
