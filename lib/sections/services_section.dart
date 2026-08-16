import 'package:flutter/material.dart';

import '../widgets/shared_widgets.dart';

/// Services framed as problem -> solution, per the site's positioning:
/// not a rigid price list, but "here's what I fix and how" — a flexible
/// quote is handled separately in [ContactSection].
class ServicesSection extends StatelessWidget {
  const ServicesSection({super.key, this.onGetQuote});

  /// Called when a service card's CTA is tapped — typically wired to
  /// scroll down to the Contact section.
  final VoidCallback? onGetQuote;

  static const _services = [
    _ServiceItem(
      icon: Icons.apps_rounded,
      title: 'Digital Products',
      problem: "You have an idea but no working app to show for it.",
      solution:
          'I design and build a polished, production-ready Flutter app '
          'end-to-end — from first wireframe to a store-ready build.',
      color: AppColors.accent,
    ),
    _ServiceItem(
      icon: Icons.candlestick_chart_rounded,
      title: 'Trading Tools',
      problem:
          'Your strategy works on paper, but manual execution is '
          'inconsistent under pressure.',
      solution:
          'I build indicators and rule-based bots (Pine Script / MQL5) '
          'that read and execute your exact plan, every single time.',
      color: AppColors.accentAlt,
    ),
    _ServiceItem(
      icon: Icons.brush_rounded,
      title: 'Creative & Brand',
      problem:
          "Every post and slide looks like it's from a different brand.",
      solution:
          'I put together a reusable identity system — logo, color, '
          'type and templates — so everything after stays on-brand.',
      color: AppColors.accent,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final mobile = isMobile(context);

    return Container(
      color: AppColors.background,
      padding: sectionPadding(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            eyebrow: 'Services',
            title: "What I fix, and how I fix it.",
            subtitle:
                "No rigid price list — every project is scoped around what "
                "you actually need. Here's the shape of the work I take on.",
          ),
          const SizedBox(height: 32),
          Wrap(
            spacing: 20,
            runSpacing: 20,
            children: [
              for (final s in _services)
                _ServiceCard(
                  item: s,
                  width: mobile ? double.infinity : 360,
                  onGetQuote: onGetQuote,
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ServiceItem {
  const _ServiceItem({
    required this.icon,
    required this.title,
    required this.problem,
    required this.solution,
    required this.color,
  });

  final IconData icon;
  final String title;
  final String problem;
  final String solution;
  final Color color;
}

class _ServiceCard extends StatelessWidget {
  const _ServiceCard({
    required this.item,
    required this.width,
    required this.onGetQuote,
  });

  final _ServiceItem item;
  final double width;
  final VoidCallback? onGetQuote;

  @override
  Widget build(BuildContext context) {
    return HoverCard(
      width: width,
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: item.color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(item.icon, color: item.color, size: 22),
          ),
          const SizedBox(height: 18),
          Text(
            item.title,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 16,
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'THE PROBLEM',
            style: TextStyle(
              color: item.color,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            item.problem,
            style: const TextStyle(
              color: AppColors.textSecondary,
              fontSize: 13,
              height: 1.5,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'THE FIX',
            style: TextStyle(
              color: item.color,
              fontSize: 11,
              fontWeight: FontWeight.w700,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            item.solution,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontSize: 13,
              height: 1.5,
            ),
          ),
          if (onGetQuote != null) ...[
            const SizedBox(height: 18),
            GestureDetector(
              onTap: onGetQuote,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Get a quote',
                    style: TextStyle(
                      color: item.color,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Icon(Icons.arrow_forward, size: 13, color: item.color),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
