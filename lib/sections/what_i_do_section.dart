import 'package:flutter/material.dart';

import '../widgets/shared_widgets.dart';

class WhatIDoSection extends StatelessWidget {
  const WhatIDoSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: AppColors.background,
      padding: sectionPadding(context),
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            eyebrow: 'What I Do',
            title: 'Build. Trade. Create. Learn.',
            subtitle:
                'Four pillars, one ecosystem — digital products, trading '
                'tools, creative work and education, all built by the same hand.',
          ),
          SizedBox(height: 32),
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              PillarCard(
                icon: Icons.apps_rounded,
                title: 'BUILD',
                subtitle: 'Apps & digital products',
              ),
              PillarCard(
                icon: Icons.candlestick_chart_rounded,
                title: 'TRADE',
                subtitle: 'Indicators, EA & trading tools',
                color: AppColors.accentAlt,
              ),
              PillarCard(
                icon: Icons.brush_rounded,
                title: 'CREATE',
                subtitle: 'Design & creative services',
              ),
              PillarCard(
                icon: Icons.school_rounded,
                title: 'LEARN',
                subtitle: 'Trading education & courses',
                color: AppColors.accentAlt,
              ),
            ],
          ),
        ],
      ),
    );
  }
}