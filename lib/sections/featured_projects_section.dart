import 'package:flutter/material.dart';

import '../models/project.dart';
import '../widgets/shared_widgets.dart';
import 'project_detail_page.dart';

class FeaturedProjectsSection extends StatefulWidget {
  const FeaturedProjectsSection({super.key});

  @override
  State<FeaturedProjectsSection> createState() =>
      _FeaturedProjectsSectionState();
}

class _FeaturedProjectsSectionState extends State<FeaturedProjectsSection> {
  String _filter = 'All';

  static const _categories = ['All', 'Apps', 'Trading', 'Design'];

  void _openProject(Project project) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (context) => ProjectDetailPage(project: project)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final visible = _filter == 'All'
        ? kProjects
        : kProjects.where((p) => p.category == _filter).toList();

    return Container(
      color: AppColors.background,
      padding: sectionPadding(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SectionHeader(
            eyebrow: 'Selected Works',
            title: 'Featured Projects',
            subtitle:
                'A collection of things I\'ve built, designed and experimented with.',
          ),
          const SizedBox(height: 24),
          Wrap(
            spacing: 10,
            children: [
              for (final c in _categories)
                _FilterChip(
                  label: c,
                  selected: _filter == c,
                  onTap: () => setState(() => _filter = c),
                ),
            ],
          ),
          const SizedBox(height: 28),
          SizedBox(
            height: 300,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics(),
              ),
              itemCount: visible.length,
              separatorBuilder: (_, __) => const SizedBox(width: 16),
              itemBuilder: (context, i) {
                final p = visible[i];
                return ProjectCard(
                  title: p.title,
                  tech: p.techStack.join(' • '),
                  description: p.tagline,
                  previewColor: p.color,
                  imageUrl: p.imageUrl,
                  onTap: () => _openProject(p),
                );
              },
            ),
          ),
          const SizedBox(height: 20),
          Row(
            children: [
              Text(
                'View all ${kProjects.length}+ projects',
                style: const TextStyle(
                  color: AppColors.accent,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              const SizedBox(width: 4),
              const Icon(Icons.arrow_forward, size: 14, color: AppColors.accent),
            ],
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: selected ? AppColors.accent : AppColors.card,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.accent : AppColors.cardBorder,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.black : AppColors.textSecondary,
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
