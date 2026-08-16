import 'package:flutter/material.dart';

/// Centralized design tokens so every section pulls from the same
/// palette instead of hardcoding hex values everywhere.
class AppColors {
  AppColors._();

  static const background = Color(0xFF0A0A0A);
  static const card = Color(0xFF12161B);
  static const cardBorder = Color(0x0FFFFFFF); // white @ 6%
  static const textPrimary = Color(0xFFF5F5F5);
  static const textSecondary = Color(0xFF8B949E);
  static const accent = Color(0xFF6C63FF); // primary (build/create/design)
  static const accentAlt = Color(0xFF00E5FF); // secondary (trading)
}

/// True when the viewport is narrow enough that sections should stack
/// vertically / use single-column layouts instead of rows & wide grids.
bool isMobile(BuildContext context) => MediaQuery.of(context).size.width < 800;

/// Horizontal padding that scales with viewport width, capped so content
/// never stretches edge-to-edge on very large desktop screens.
EdgeInsets sectionPadding(BuildContext context) {
  final width = MediaQuery.of(context).size.width;
  final horizontal = width < 800 ? 24.0 : (width > 1400 ? 120.0 : 64.0);
  return EdgeInsets.symmetric(horizontal: horizontal, vertical: 96);
}

/// Standard "EYEBROW / Title / subtitle" header used at the top of every
/// content section, so scanning the page top-to-bottom feels consistent.
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.eyebrow,
    required this.title,
    this.subtitle,
    this.accentColor = AppColors.accent,
    this.alignCenter = false,
  });

  final String eyebrow;
  final String title;
  final String? subtitle;
  final Color accentColor;
  final bool alignCenter;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment:
          alignCenter ? CrossAxisAlignment.center : CrossAxisAlignment.start,
      children: [
        Text(
          eyebrow.toUpperCase(),
          style: TextStyle(
            color: accentColor,
            fontSize: 13,
            fontWeight: FontWeight.w700,
            letterSpacing: 3,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          title,
          textAlign: alignCenter ? TextAlign.center : TextAlign.start,
          style: const TextStyle(
            color: AppColors.textPrimary,
            fontSize: 34,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.5,
            height: 1.15,
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 12),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Text(
              subtitle!,
              textAlign: alignCenter ? TextAlign.center : TextAlign.start,
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 15,
                height: 1.5,
              ),
            ),
          ),
        ],
      ],
    );
  }
}

/// A small rounded tag/chip — used for tech stacks, skills, categories.
class ChipTag extends StatelessWidget {
  const ChipTag(this.label, {super.key, this.color = AppColors.accent});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

/// The base card shell (dark surface + subtle border + hover lift) reused
/// by pillar cards, project cards, service cards, and trading cards.
class HoverCard extends StatefulWidget {
  const HoverCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(20),
    this.width,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsets padding;
  final double? width;

  @override
  State<HoverCard> createState() => _HoverCardState();
}

class _HoverCardState extends State<HoverCard> {
  bool _hovering = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _hovering = true),
      onExit: (_) => setState(() => _hovering = false),
      cursor:
          widget.onTap != null ? SystemMouseCursors.click : MouseCursor.defer,
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
          width: widget.width,
          padding: widget.padding,
          transform: Matrix4.translationValues(0, _hovering ? -4 : 0, 0),
          decoration: BoxDecoration(
            color: AppColors.card,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: _hovering
                  ? AppColors.accent.withValues(alpha: 0.4)
                  : AppColors.cardBorder,
            ),
            boxShadow: _hovering
                ? [
                    BoxShadow(
                      color: AppColors.accent.withValues(alpha: 0.15),
                      blurRadius: 24,
                      offset: const Offset(0, 12),
                    ),
                  ]
                : const [],
          ),
          child: widget.child,
        ),
      ),
    );
  }
}

/// Pillar card used in "What I Do" (BUILD / TRADE / CREATE / LEARN).
class PillarCard extends StatelessWidget {
  const PillarCard({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.color = AppColors.accent,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return HoverCard(
      width: 220,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 14),
          Text(
            title,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.bold,
              fontSize: 16,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

/// Project preview card used in "Featured Projects".
class ProjectCard extends StatelessWidget {
  const ProjectCard({
    super.key,
    required this.title,
    required this.tech,
    required this.description,
    this.previewColor = AppColors.accent,
    this.onTap,
  });

  final String title;
  final String tech;
  final String description;
  final Color previewColor;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return HoverCard(
      width: 280,
      padding: const EdgeInsets.all(16),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            height: 120,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  previewColor.withValues(alpha: 0.35),
                  AppColors.background,
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            title,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 15,
            ),
          ),
          const SizedBox(height: 4),
          Text(tech, style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
          const SizedBox(height: 8),
          Text(
            description,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(color: AppColors.textSecondary, fontSize: 12, height: 1.4),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(
                'View Project',
                style: TextStyle(color: previewColor, fontWeight: FontWeight.w600, fontSize: 12),
              ),
              const SizedBox(width: 4),
              Icon(Icons.arrow_forward, size: 14, color: previewColor),
            ],
          ),
        ],
      ),
    );
  }
}

/// Primary call-to-action button used across the site (hero, navbar, CTA).
class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.filled = true,
    this.color = AppColors.accent,
  });

  final String label;
  final VoidCallback onPressed;
  final bool filled;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: filled ? color : Colors.transparent,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onPressed,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: filled ? null : Border.all(color: color.withValues(alpha: 0.5)),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: filled ? Colors.black : color,
              fontWeight: FontWeight.w700,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }
}