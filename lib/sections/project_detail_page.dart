import 'package:flutter/material.dart';

import '../models/project.dart';
import '../utils/launch_helper.dart';
import '../widgets/shared_widgets.dart';

/// Full case-study page for a single project — pushed on top of the main
/// scroll experience when a [ProjectCard] is tapped. Mirrors the layout
/// recommended in the doc: title, tags, big preview, Problem, Solution,
/// Features checklist, Tech Stack, and a closing CTA back to Contact.
class ProjectDetailPage extends StatelessWidget {
  const ProjectDetailPage({super.key, required this.project});

  final Project project;

  @override
  Widget build(BuildContext context) {
    final mobile = isMobile(context);
    final horizontal = mobile ? 24.0 : 120.0;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: SafeArea(
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(
            parent: AlwaysScrollableScrollPhysics(),
          ),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(horizontal, 24, horizontal, 0),
                child: _BackButton(onTap: () => Navigator.of(context).pop()),
              ),
            ),
            SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(horizontal, 32, horizontal, 64),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    ChipTag(project.category, color: project.color),
                    const SizedBox(height: 18),
                    Text(
                      project.title,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 38,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.5,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 14),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 560),
                      child: Text(
                        project.tagline,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 15,
                          height: 1.6,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final tech in project.techStack)
                          ChipTag(tech, color: AppColors.textSecondary),
                      ],
                    ),
                    const SizedBox(height: 28),
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        if (project.downloadUrl != null)
                          _ActionButton(
                            icon: Icons.download_rounded,
                            label: 'Download Project',
                            color: project.color,
                            filled: true,
                            onTap: () =>
                                launchUrlExternal(context, project.downloadUrl!),
                          ),
                        _ActionButton(
                          icon: Icons.chat_bubble_rounded,
                          label: 'Order via WhatsApp',
                          color: const Color(0xFF25D366),
                          filled: project.downloadUrl == null,
                          onTap: () => openWhatsAppOrder(
                            context,
                            projectTitle: project.title,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 40),

                    // Large preview placeholder — swap for a real
                    // screenshot/Image.asset once you have one.
                    Container(
                      height: mobile ? 220 : 380,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(20),
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            project.color.withValues(alpha: 0.35),
                            AppColors.card,
                          ],
                        ),
                        border: Border.all(color: AppColors.cardBorder),
                      ),
                    ),
                    const SizedBox(height: 56),

                    _CaseStudySection(
                      title: 'Problem',
                      accentColor: project.color,
                      child: Text(
                        project.problem,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 15,
                          height: 1.7,
                        ),
                      ),
                    ),
                    const SizedBox(height: 40),

                    _CaseStudySection(
                      title: 'Solution',
                      accentColor: project.color,
                      child: Text(
                        project.solution,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 15,
                          height: 1.7,
                        ),
                      ),
                    ),
                    const SizedBox(height: 40),

                    _CaseStudySection(
                      title: 'Features',
                      accentColor: project.color,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final feature in project.features)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(Icons.check_circle, size: 18, color: project.color),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      feature,
                                      style: const TextStyle(
                                        color: AppColors.textPrimary,
                                        fontSize: 14,
                                        height: 1.5,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 56),

                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(28),
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(color: AppColors.cardBorder),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Want something like this?',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.w700,
                              fontSize: 18,
                            ),
                          ),
                          const SizedBox(height: 8),
                          const Text(
                            "Tell me what you're building — I'll get back to you with an estimate.",
                            style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.5),
                          ),
                          const SizedBox(height: 20),
                          PrimaryButton(
                            label: 'Order via WhatsApp',
                            color: project.color,
                            onPressed: () => openWhatsAppOrder(
                              context,
                              projectTitle: project.title,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CaseStudySection extends StatelessWidget {
  const _CaseStudySection({
    required this.title,
    required this.child,
    required this.accentColor,
  });

  final String title;
  final Widget child;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(width: 3, height: 16, color: accentColor),
            const SizedBox(width: 10),
            Text(
              title.toUpperCase(),
              style: TextStyle(
                color: accentColor,
                fontSize: 13,
                fontWeight: FontWeight.w700,
                letterSpacing: 2,
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 640),
          child: child,
        ),
      ],
    );
  }
}

class _BackButton extends StatelessWidget {
  const _BackButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.card,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: const Padding(
          padding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.arrow_back, size: 16, color: AppColors.textSecondary),
              SizedBox(width: 8),
              Text(
                'Back to Projects',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Icon + label pill button used for Download / Order-via-WhatsApp
/// actions. `filled: true` gives a solid background (primary action),
/// `filled: false` gives an outlined look (secondary action).
class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
    this.filled = true,
  });

  final IconData icon;
  final String label;
  final Color color;
  final bool filled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: filled ? color : Colors.transparent,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: filled ? null : Border.all(color: color.withValues(alpha: 0.6)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 16, color: filled ? Colors.black : color),
              const SizedBox(width: 8),
              Text(
                label,
                style: TextStyle(
                  color: filled ? Colors.black : color,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}