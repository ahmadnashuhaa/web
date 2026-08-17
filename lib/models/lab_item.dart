import 'package:flutter/material.dart';

import '../widgets/shared_widgets.dart';

/// A single Trading Lab offering — an indicator, an EA/bot, or the
/// course. Holds everything needed both for the small preview card and
/// the full detail page, so there's one source of truth.
class LabItem {
  const LabItem({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.category,
    required this.description,
    required this.highlights,
    this.highlightsLabel = 'Features',
    this.downloadUrl,
    this.browseUrl,
    this.color = AppColors.accentAlt,
  });

  final String title;
  final String subtitle;
  final IconData icon;

  /// Indicator | EA / Bot | Course
  final String category;
  final Color color;

  final String description;

  /// Bullet list — feature list for indicators/EA, curriculum modules
  /// for the course.
  final List<String> highlights;

  /// Label shown above [highlights] ("Features" or "What You'll Learn").
  final String highlightsLabel;

  /// Direct link to a downloadable file (Pine Script, .ex5, .zip, etc).
  /// Null hides the Download button.
  final String? downloadUrl;

  /// Public page to browse/verify the item (TradingView script page,
  /// MQL5 Market listing, course syllabus page). Null hides the button.
  final String? browseUrl;
}

const List<LabItem> kLabItems = [
  LabItem(
    title: 'Structure & Liquidity Indicator',
    subtitle: 'TradingView • Pine Script',
    icon: Icons.show_chart_rounded,
    category: 'Indicator',
    description:
        'A Pine Script indicator that automatically marks market-structure '
        'breaks and liquidity sweeps in real time, so the read is done at a '
        'glance instead of redrawing lines every session.',
    highlights: [
      'Automatic structure break detection',
      'Liquidity sweep markers',
      'Configurable sensitivity',
      'Alerts on new signals',
    ],
    downloadUrl: 'https://example.com/downloads/structure-liquidity-indicator.pine',
    browseUrl: 'https://www.tradingview.com/u/yourname/',
  ),
  LabItem(
    title: 'Trend Momentum EA',
    subtitle: 'MetaTrader • MQL5',
    icon: Icons.smart_toy_outlined,
    category: 'EA / Bot',
    description:
        'A rule-based Expert Advisor that executes a tested intraday '
        'strategy\'s entries, stop-loss and take-profit automatically, '
        'removing hesitation and emotion from execution.',
    highlights: [
      'Rule-based entries & exits',
      'Configurable risk per trade',
      'Session & news-time filters',
      'Built-in trade logging',
    ],
    downloadUrl: 'https://example.com/downloads/trend-momentum-ea.zip',
    browseUrl: 'https://www.mql5.com/en/users/yourname',
  ),
  LabItem(
    title: 'Trading From Zero',
    subtitle: 'A structured course — market to strategy',
    icon: Icons.menu_book_rounded,
    category: 'Course',
    color: AppColors.accent,
    description:
        'Learn the market, build your strategy, and trade with a plan — a '
        'six-module course that goes from market structure fundamentals all '
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
  ),
];