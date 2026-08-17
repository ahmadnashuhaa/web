import 'package:flutter/material.dart';

import '../widgets/shared_widgets.dart';

/// A single portfolio project, holding everything needed both for the
/// small preview card on the homepage AND the full case-study detail
/// page (problem / solution / features / tech stack), so there is one
/// source of truth instead of duplicating project data in two places.
class Project {
  const Project({
    required this.title,
    required this.tagline,
    required this.category,
    required this.color,
    required this.techStack,
    required this.problem,
    required this.solution,
    required this.features,
    this.downloadUrl,
    this.imageUrl,
  });

  final String title;

  /// Short one-line description shown on the preview card.
  final String tagline;

  /// Apps | Trading | Design
  final String category;
  final Color color;
  final List<String> techStack;

  /// "Problem" section of the case study.
  final String problem;

  /// "Solution" section of the case study.
  final String solution;

  /// Bullet list shown under "Features".
  final List<String> features;

  /// Direct link to a downloadable file (zip, apk, indicator script,
  /// etc). When null, the download button is hidden for that project.
  final String? downloadUrl;

  /// Preview photo. Accepts EITHER:
  ///  - a local asset path, e.g. 'assets/images/my-app.jpg'
  ///    (must be registered under `assets:` in pubspec.yaml)
  ///  - a full network URL, e.g. 'https://example.com/shot.jpg'
  /// When null, a gradient placeholder is shown instead.
  final String? imageUrl;
}

/// The single source of truth for every featured project — used by
/// [FeaturedProjectsSection] to render preview cards and by
/// [ProjectDetailPage] to render the full case study when one is tapped.
const List<Project> kProjects = [
  Project(
    title: 'Personal Finance App',
    tagline:
        'Track cash flow, expenses and an investment portfolio in one place.',
    category: 'Apps',
    color: AppColors.accent,
    techStack: ['Flutter', 'Dart', 'SQLite', 'Riverpod'],
    problem:
        'How can users manage their cash flow and investments in one place, '
        'without juggling a spreadsheet and three different apps?',
    solution:
        'A single Flutter app that combines expense tracking, income logging '
        'and an investment portfolio view — all stored locally with SQLite '
        'and kept reactive through Riverpod, so the numbers update instantly '
        'as new transactions come in.',
    features: [
      'Expense tracking',
      'Income tracking',
      'Investment portfolio overview',
      'Dividend tracking',
      'Built-in investment calculator',
    ],
    downloadUrl: 'https://github.com/ahmadnashuhaa/web/releases/download/v1.1.0/app-release.apk.sha1',
    imageUrl: 'assets/images/ft1.jpeg',
  ),
  Project(
    title: 'Trading Signal Indicator',
    tagline: 'A custom signal indicator highlighting liquidity & structure shifts.',
    category: 'Trading',
    color: AppColors.accentAlt,
    techStack: ['TradingView', 'Pine Script'],
    problem:
        'Manually spotting liquidity grabs and market-structure shifts on '
        'the chart is slow and easy to miss in fast-moving sessions.',
    solution:
        'A Pine Script indicator that automatically marks structure breaks '
        'and liquidity sweeps in real time, so the read is done at a glance '
        'instead of redrawing lines every session.',
    features: [
      'Automatic structure break detection',
      'Liquidity sweep markers',
      'Configurable sensitivity',
      'Alerts on new signals',
    ],
    downloadUrl: 'https://drive.google.com/file/d/16rf4LGBZ_VW3k7qMUvK_RPIeLReZrLHi/view?usp=drive_link',
    imageUrl: 'assets/images/ft2.jpeg',
  ),
  Project(
    title: 'Trading EA / Bot',
    tagline: 'Rule-based execution bot for a tested intraday strategy.',
    category: 'Trading',
    color: AppColors.accentAlt,
    techStack: ['MetaTrader', 'MQL5'],
    problem:
        'A profitable, backtested strategy is only useful if it is executed '
        'exactly the same way every single time — something manual trading '
        'struggles with under pressure.',
    solution:
        'An Expert Advisor that executes the strategy\'s entry, stop-loss '
        'and take-profit rules automatically, removing hesitation and '
        'emotion from execution.',
    features: [
      'Rule-based entries & exits',
      'Configurable risk per trade',
      'Session & news-time filters',
      'Built-in trade logging',
    ],
    downloadUrl: 'https://drive.google.com/file/d/15DiEAWYQRx9cqJmU1lmjilgrxMxwNqqT/view?usp=drive_link',
    imageUrl: 'assets/images/ft3.jpeg',
  ),
  Project(
    title: 'Brand Identity Set',
    tagline: 'Logo, color system and social templates for a client brand.',
    category: 'Design',
    color: AppColors.accent,
    techStack: ['Figma', 'Illustrator'],
    problem:
        'The client had a product but no consistent visual identity — every '
        'post and slide looked like it came from a different brand.',
    solution:
        'A complete identity system: logo, color palette, type pairing and a '
        'set of reusable social templates so every future post stays on-brand '
        'without starting from scratch each time.',
    features: [
      'Primary & secondary logo marks',
      'Color & typography system',
      'Social media templates',
      'Brand usage guide',
    ],
    downloadUrl: 'https://wa.me/p/26806408655694071/62882010480693',
    imageUrl: 'assets/images/ft4.jpeg',
  ),
];