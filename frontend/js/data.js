/**
 * data.js
 * Ports project.dart (kProjects) and lab_item.dart (kLabItems) verbatim.
 * Both the section preview cards and the detail pages read from these
 * two arrays, so content only ever needs to be edited in one place.
 */

export const PROJECTS = [
  {
    slug: 'personal-finance-app',
    title: 'Personal Finance App',
    tagline: 'Track cash flow, expenses and an investment portfolio in one place.',
    category: 'Apps',
    color: 'var(--color-primary)',
    techStack: ['Flutter', 'Dart', 'SQLite', 'Riverpod'],
    problem:
      'How can users manage their cash flow and investments in one place, ' +
      'without juggling a spreadsheet and three different apps?',
    solution:
      'A single Flutter app that combines expense tracking, income logging ' +
      'and an investment portfolio view — all stored locally with SQLite ' +
      'and kept reactive through Riverpod, so the numbers update instantly ' +
      'as new transactions come in.',
    features: [
      'Expense tracking',
      'Income tracking',
      'Investment portfolio overview',
      'Dividend tracking',
      'Built-in investment calculator',
    ],
    downloadUrl: 'https://github.com/ahmadnashuhaa/web/releases/download/v1.2.0/app-release.apk',
    imageUrl: 'assets/images/ft1.jpeg',
  },
  {
    slug: 'trading-signal-indicator',
    title: 'Trading Signal Indicator',
    tagline: 'A custom signal indicator highlighting liquidity & structure shifts.',
    category: 'Trading',
    color: 'var(--color-secondary)',
    techStack: ['TradingView', 'Pine Script'],
    problem:
      'Manually spotting liquidity grabs and market-structure shifts on ' +
      'the chart is slow and easy to miss in fast-moving sessions.',
    solution:
      'A Pine Script indicator that automatically marks structure breaks ' +
      'and liquidity sweeps in real time, so the read is done at a glance ' +
      'instead of redrawing lines every session.',
    features: [
      'Automatic structure break detection',
      'Liquidity sweep markers',
      'Configurable sensitivity',
      'Alerts on new signals',
    ],
    downloadUrl: 'https://drive.google.com/file/d/16rf4LGBZ_VW3k7qMUvK_RPIeLReZrLHi/view?usp=drive_link',
    imageUrl: 'assets/images/ft2.jpeg',
  },
  {
    slug: 'trading-ea-bot',
    title: 'Trading EA / Bot',
    tagline: 'Rule-based execution bot for a tested intraday strategy.',
    category: 'Trading',
    color: 'var(--color-secondary)',
    techStack: ['MetaTrader', 'MQL5'],
    problem:
      'A profitable, backtested strategy is only useful if it is executed ' +
      'exactly the same way every single time — something manual trading ' +
      'struggles with under pressure.',
    solution:
      "An Expert Advisor that executes the strategy's entry, stop-loss " +
      'and take-profit rules automatically, removing hesitation and ' +
      'emotion from execution.',
    features: [
      'Rule-based entries & exits',
      'Configurable risk per trade',
      'Session & news-time filters',
      'Built-in trade logging',
    ],
    downloadUrl: 'https://drive.google.com/file/d/15DiEAWYQRx9cqJmU1lmjilgrxMxwNqqT/view?usp=drive_link',
    imageUrl: 'assets/images/ft3.jpeg',
  },
  {
    slug: 'brand-identity-set',
    title: 'Brand Identity Set',
    tagline: 'Logo, color system and social templates for a client brand.',
    category: 'Design',
    color: 'var(--color-primary)',
    techStack: ['Figma', 'Illustrator'],
    problem:
      'The client had a product but no consistent visual identity — every ' +
      'post and slide looked like it came from a different brand.',
    solution:
      'A complete identity system: logo, color palette, type pairing and a ' +
      'set of reusable social templates so every future post stays on-brand ' +
      'without starting from scratch each time.',
    features: [
      'Primary & secondary logo marks',
      'Color & typography system',
      'Social media templates',
      'Brand usage guide',
    ],
    downloadUrl: 'https://wa.me/p/26806408655694071/62882010480693',
    imageUrl: 'assets/images/ft4.jpeg',
  },
];

export const LAB_ITEMS = [
  {
    slug: 'structure-liquidity-indicator',
    title: 'Structure & Liquidity Indicator',
    subtitle: 'TradingView • Pine Script',
    icon: 'trending-up',
    category: 'Indicator',
    color: 'var(--color-secondary)',
    description:
      'A Pine Script indicator that automatically marks market-structure ' +
      'breaks and liquidity sweeps in real time, so the read is done at a ' +
      'glance instead of redrawing lines every session.',
    highlights: [
      'Automatic structure break detection',
      'Liquidity sweep markers',
      'Configurable sensitivity',
      'Alerts on new signals',
    ],
    highlightsLabel: 'Features',
    downloadUrl: 'https://example.com/downloads/structure-liquidity-indicator.pine',
    browseUrl: 'https://www.tradingview.com/u/yourname/',
  },
  {
    slug: 'trend-momentum-ea',
    title: 'Trend Momentum EA',
    subtitle: 'MetaTrader • MQL5',
    icon: 'bot',
    category: 'EA / Bot',
    color: 'var(--color-secondary)',
    description:
      'A rule-based Expert Advisor that executes a tested intraday ' +
      "strategy's entries, stop-loss and take-profit automatically, " +
      'removing hesitation and emotion from execution.',
    highlights: [
      'Rule-based entries & exits',
      'Configurable risk per trade',
      'Session & news-time filters',
      'Built-in trade logging',
    ],
    highlightsLabel: 'Features',
    downloadUrl: 'https://example.com/downloads/trend-momentum-ea.zip',
    browseUrl: 'https://www.mql5.com/en/users/yourname',
  },
  {
    slug: 'trading-from-zero',
    title: 'Trading From Zero',
    subtitle: 'A structured course — market to strategy',
    icon: 'book-open',
    category: 'Course',
    color: 'var(--color-primary)',
    description:
      'Learn the market, build your strategy, and trade with a plan — a ' +
      'six-module course that goes from market structure fundamentals all ' +
      'the way to backtesting and live analysis.',
    highlights: [
      '01 · Market Structure',
      '02 · Support & Resistance',
      '03 · Liquidity',
      '04 · Risk Management',
      '05 · Trading Psychology',
      '06 · Strategy Development & Backtesting',
    ],
    highlightsLabel: "What You'll Learn",
    browseUrl: 'https://example.com/courses/trading-from-zero',
  },
];

export const WHATSAPP_NUMBER = '62882010480693';

/**
 * Ports openWhatsAppOrder from launch_helper.dart — builds the same
 * prefilled message shape from whichever pieces are provided.
 */
export function buildWhatsAppUrl({ projectTitle, need, budget, description } = {}) {
  const lines = ['Halo, saya ingin memesan project.'];
  if (projectTitle) lines.push(`Project: ${projectTitle}`);
  if (need) lines.push(`Kebutuhan: ${need}`);
  if (budget) lines.push(`Budget: ${budget}`);
  if (description && description.trim()) lines.push(`Detail: ${description.trim()}`);

  const message = lines.join('\n');
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}
