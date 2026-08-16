import 'package:flutter/material.dart';

import '../widgets/shared_widgets.dart';

class AboutSection extends StatelessWidget {
  const AboutSection({super.key});

  static const _skills = [
    'Flutter',
    'Dart',
    'Trading',
    'Pine Script',
    'UI Design',
    'SQLite',
    'Riverpod',
  ];

  @override
  Widget build(BuildContext context) {
    final mobile = isMobile(context);
    const intro = SectionHeader(
      eyebrow: 'About',
      title: 'I build digital products, trading tools\nand creative solutions.',
      subtitle:
          "I'm interested in technology, financial markets and design "
          '— and I like shipping things people actually use.',
    );
    const details = _AboutDetails(skills: _skills);

    return Container(
      color: AppColors.background,
      padding: sectionPadding(context),
      child: mobile
          ? const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                intro,
                SizedBox(height: 32),
                details,
              ],
            )
          : const Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Expanded(child: intro),
                SizedBox(width: 48),
                Expanded(child: details),
              ],
            ),
    );
  }
}

class _AboutDetails extends StatelessWidget {
  const _AboutDetails({required this.skills});
  final List<String> skills;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Currently working on',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 13,
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 12),
        const _WorkBullet('Financial applications'),
        const _WorkBullet('Trading indicators'),
        const _WorkBullet('Trading tools'),
        const _WorkBullet('Digital products'),
        const SizedBox(height: 28),
        const Text(
          'Skills',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w700,
            fontSize: 13,
            letterSpacing: 1,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [for (final s in skills) ChipTag(s)],
        ),
      ],
    );
  }
}

class _WorkBullet extends StatelessWidget {
  const _WorkBullet(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          const Icon(Icons.circle, size: 6, color: AppColors.accent),
          const SizedBox(width: 10),
          Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 14)),
        ],
      ),
    );
  }
}
