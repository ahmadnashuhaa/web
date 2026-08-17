import 'package:flutter/material.dart';

import '../models/lab_item.dart';
import '../utils/launch_helper.dart';
import '../widgets/shared_widgets.dart';
import 'lab_item_detail_page.dart';

/// A visually distinct, full-width dark-gradient section — this is the
/// "variation" the doc recommends so the eye gets a new rhythm as the
/// user scrolls past uniform card sections.
class TradingLabSection extends StatelessWidget {
  const TradingLabSection({super.key});

  void _openDetail(BuildContext context, LabItem item) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (context) => LabItemDetailPage(item: item)),
    );
  }

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
                'Tap any item to see full details — download the file, '
                'browse it live, or order directly via WhatsApp.',
            accentColor: AppColors.accentAlt,
          ),
          const SizedBox(height: 32),
          Wrap(
            spacing: 16,
            runSpacing: 16,
            children: [
              for (final item in kLabItems)
                _LabCard(
                  item: item,
                  width: mobile ? double.infinity : 320,
                  onTap: () => _openDetail(context, item),
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
    required this.item,
    required this.width,
    required this.onTap,
  });

  final LabItem item;
  final double width;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return HoverCard(
      width: width,
      padding: const EdgeInsets.all(24),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
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
              const Spacer(),
              // Quick-action icons — let the person download/browse
              // right from the card without opening the detail page.
              if (item.downloadUrl != null)
                _QuickIcon(
                  icon: Icons.download_rounded,
                  color: item.color,
                  tooltip: 'Download',
                  onTap: () => launchUrlExternal(context, item.downloadUrl!),
                ),
              if (item.browseUrl != null)
                _QuickIcon(
                  icon: Icons.travel_explore_rounded,
                  color: item.color,
                  tooltip: 'Browse',
                  onTap: () => launchUrlExternal(context, item.browseUrl!),
                ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            item.title,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 17,
            ),
          ),
          const SizedBox(height: 6),
          Text(item.subtitle, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          const SizedBox(height: 18),
          Row(
            children: [
              Text(
                'View details',
                style: TextStyle(
                  color: item.color,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
              const SizedBox(width: 4),
              Icon(Icons.arrow_forward, size: 14, color: item.color),
            ],
          ),
        ],
      ),
    );
  }
}

/// Small tappable icon used for the quick Download/Browse actions
/// directly on the card — stops the tap from bubbling up so it doesn't
/// also trigger the card's own onTap (which opens the detail page).
class _QuickIcon extends StatelessWidget {
  const _QuickIcon({
    required this.icon,
    required this.color,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String tooltip;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        shape: const CircleBorder(),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(6),
            child: Icon(icon, size: 18, color: color.withValues(alpha: 0.85)),
          ),
        ),
      ),
    );
  }
}