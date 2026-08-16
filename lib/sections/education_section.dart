import 'package:flutter/material.dart';

import '../widgets/shared_widgets.dart';

class EducationSection extends StatelessWidget {
  const EducationSection({super.key});

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
            eyebrow: 'Education',
            title: 'Learn. Practice. Improve.',
            subtitle: 'Articles, tutorials and trading material — free to read.',
          ),
          const SizedBox(height: 28),
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              _EduTile(
                width: mobile ? double.infinity : 360,
                tag: 'Article',
                title: 'Reading Market Structure Like a Trader',
                minutes: '6 min read',
              ),
              _EduTile(
                width: mobile ? double.infinity : 360,
                tag: 'Tutorial',
                title: 'Building a Pine Script Indicator from Scratch',
                minutes: '10 min read',
              ),
              _EduTile(
                width: mobile ? double.infinity : 360,
                tag: 'Trading Material',
                title: 'Risk Management Before Strategy',
                minutes: '5 min read',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _EduTile extends StatelessWidget {
  const _EduTile({
    required this.width,
    required this.tag,
    required this.title,
    required this.minutes,
  });

  final double width;
  final String tag;
  final String title;
  final String minutes;

  @override
  Widget build(BuildContext context) {
    return HoverCard(
      width: width,
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ChipTag(tag, color: AppColors.accentAlt),
          const SizedBox(height: 14),
          Text(
            title,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 15,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 10),
          Text(minutes, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
        ],
      ),
    );
  }
}
