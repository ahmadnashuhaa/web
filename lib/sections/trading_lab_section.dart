import 'package:flutter/material.dart';

import '../widgets/shared_widgets.dart';

/// A visually distinct, full-width dark-gradient section — this is the
/// "variation" the doc recommends so the eye gets a new rhythm as the
/// user scrolls past uniform card sections.
class TradingLabSection extends StatelessWidget {
  const TradingLabSection({super.key});

  @override
  Widget build(BuildContext context) {
    final mobile = isMobile(context);

    return Container(
      width: double.infinity,
      padding: sectionPadding(context),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF0A0A0A), Color(0xFF10161C), Color(0xFF0A0A0A)],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            eyebrow: 'Trading Lab',
            title: 'Tools, indicators & education for traders.',
            subtitle:
                'Everything I use and sell for reading the market, executing '
                'a plan, and learning the craft from zero.',
            accentColor: AppColors.accentAlt,
          ),
          const SizedBox(height: 32),
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              _LabCard(
                icon: Icons.show_chart_rounded,
                title: 'Indicators',
                subtitle: 'TradingView • Pine Script',
                cta: 'Explore →',
                width: mobile ? double.infinity : 320,
              ),
              _LabCard(
                icon: Icons.smart_toy_outlined,
                title: 'EA / Bots',
                subtitle: 'MetaTrader • Automated execution',
                cta: 'Explore →',
                width: mobile ? double.infinity : 320,
              ),
              _LabCard(
                icon: Icons.menu_book_rounded,
                title: 'Trading From Zero',
                subtitle: 'A structured course — market to strategy',
                cta: 'Join the Class →',
                width: mobile ? double.infinity : 320,
                highlighted: true,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _LabCard extends StatelessWidget {
  const _LabCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.cta,
    required this.width,
    this.highlighted = false,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String cta;
  final double width;
  final bool highlighted;

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
              color: AppColors.accentAlt.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppColors.accentAlt, size: 22),
          ),
          const SizedBox(height: 18),
          Text(
            title,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 17,
            ),
          ),
          const SizedBox(height: 6),
          Text(subtitle, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          const SizedBox(height: 18),
          if (highlighted)
            PrimaryButton(label: cta, color: AppColors.accentAlt, onPressed: () {})
          else
            Text(
              cta,
              style: const TextStyle(
                color: AppColors.accentAlt,
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
        ],
      ),
    );
  }
}