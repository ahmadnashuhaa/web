import 'package:flutter/material.dart';

import '../models/lab_item.dart';
import '../utils/launch_helper.dart';
import '../widgets/shared_widgets.dart';

/// Full detail page for a single Trading Lab item — pushed when a lab
/// card is tapped. Shows the description, a highlights list (features
/// or curriculum depending on the item), and up to three actions:
/// Download, Browse, and Order via WhatsApp.
class LabItemDetailPage extends StatelessWidget {
  const LabItemDetailPage({super.key, required this.item});

  final LabItem item;

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
                    ChipTag(item.category, color: item.color),
                    const SizedBox(height: 18),
                    Row(
                      children: [
                        Container(
                          width: 52,
                          height: 52,
                          decoration: BoxDecoration(
                            color: item.color.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Icon(item.icon, color: item.color, size: 26),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.title,
                                style: const TextStyle(
                                  color: AppColors.textPrimary,
                                  fontSize: 26,
                                  fontWeight: FontWeight.w800,
                                  height: 1.2,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                item.subtitle,
                                style: const TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 600),
                      child: Text(
                        item.description,
                        style: const TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 15,
                          height: 1.7,
                        ),
                      ),
                    ),
                    const SizedBox(height: 28),

                    // Action row — only shows buttons for links that exist.
                    Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        if (item.downloadUrl != null)
                          _ActionButton(
                            icon: Icons.download_rounded,
                            label: 'Download',
                            color: item.color,
                            filled: true,
                            onTap: () => launchUrlExternal(context, item.downloadUrl!),
                          ),
                        if (item.browseUrl != null)
                          _ActionButton(
                            icon: Icons.travel_explore_rounded,
                            label: 'Browse',
                            color: item.color,
                            filled: item.downloadUrl == null,
                            onTap: () => launchUrlExternal(context, item.browseUrl!),
                          ),
                        _ActionButton(
                          icon: Icons.chat_bubble_rounded,
                          label: item.category == 'Course'
                              ? 'Join the Class'
                              : 'Order via WhatsApp',
                          color: const Color(0xFF25D366),
                          filled: item.downloadUrl == null && item.browseUrl == null,
                          onTap: () => openWhatsAppOrder(
                            context,
                            projectTitle: item.title,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 48),

                    Row(
                      children: [
                        Container(width: 3, height: 16, color: item.color),
                        const SizedBox(width: 10),
                        Text(
                          item.highlightsLabel.toUpperCase(),
                          style: TextStyle(
                            color: item.color,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 2,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 560),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final h in item.highlights)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Icon(Icons.check_circle, size: 18, color: item.color),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      h,
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
                'Back to Trading Lab',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

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