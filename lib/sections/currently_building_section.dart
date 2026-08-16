import 'package:flutter/material.dart';

import '../widgets/shared_widgets.dart';

class CurrentlyBuildingSection extends StatelessWidget {
  const CurrentlyBuildingSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.background,
      padding: sectionPadding(context),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            eyebrow: 'Now',
            title: 'Currently Building',
            subtitle: "What I'm actively working on, updated as it moves.",
          ),
          SizedBox(height: 24),
          _BuildRow(
            emoji: '🚧',
            title: 'Personal Finance & Investment App',
            tech: 'Flutter · SQLite · Riverpod',
            status: 'In Development',
            statusColor: AppColors.accent,
          ),
          _BuildRow(
            emoji: '📈',
            title: 'Trading Indicator V2',
            tech: 'Pine Script',
            status: 'Testing',
            statusColor: AppColors.accentAlt,
          ),
        ],
      ),
    );
  }
}

class _BuildRow extends StatelessWidget {
  const _BuildRow({
    required this.emoji,
    required this.title,
    required this.tech,
    required this.status,
    required this.statusColor,
  });

  final String emoji;
  final String title;
  final String tech;
  final String status;
  final Color statusColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.cardBorder),
      ),
      child: Row(
        children: [
          Text(emoji, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 3),
                Text(tech, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: statusColor.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
                ),
                const SizedBox(width: 6),
                Text(
                  status,
                  style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w700),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
