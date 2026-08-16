import 'package:flutter/material.dart';

import '../utils/launch_helper.dart';
import '../widgets/shared_widgets.dart';

class FooterSection extends StatelessWidget {
  const FooterSection({super.key, required this.onNavTap});

  final void Function(String sectionId) onNavTap;

  static const _year = 2026;

  // Replace with your real profile URLs.
  static const _socialLinks = <MapEntry<String, String>>[
    MapEntry('Instagram', 'https://instagram.com/yourname'),
    MapEntry('YouTube', 'https://youtube.com/@yourname'),
    MapEntry('GitHub', 'https://github.com/yourname'),
    MapEntry('TradingView', 'https://tradingview.com/u/yourname'),
  ];

  @override
  Widget build(BuildContext context) {
    final mobile = isMobile(context);

    const brand = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'DUKION',
          style: TextStyle(
            color: AppColors.textPrimary,
            fontWeight: FontWeight.w800,
            fontSize: 16,
            letterSpacing: 1,
          ),
        ),
        SizedBox(height: 10),
        Text(
          'Digital Projects\nTrading Tools\nCreative Services\nEducation',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.7),
        ),
      ],
    );

    final links = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _FooterLink('Projects', () => onNavTap('projects')),
        _FooterLink('Services', () => onNavTap('services')),
        _FooterLink('Trading', () => onNavTap('trading')),
        _FooterLink('Education', () => onNavTap('education')),
        _FooterLink('About', () => onNavTap('about')),
        _FooterLink('Contact', () => onNavTap('contact')),
      ],
    );

    final social = Wrap(
      spacing: 16,
      runSpacing: 12,
      children: [
        for (final entry in _socialLinks)
          _FooterLink(entry.key, () => launchUrlExternal(context, entry.value)),
      ],
    );

    return Container(
      width: double.infinity,
      color: AppColors.background,
      padding: EdgeInsets.fromLTRB(
        mobile ? 24 : 64,
        64,
        mobile ? 24 : 64,
        32,
      ),
      child: Column(
        children: [
          const Divider(color: AppColors.cardBorder),
          const SizedBox(height: 32),
          if (mobile)
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                brand,
                const SizedBox(height: 28),
                links,
                const SizedBox(height: 28),
                social,
              ],
            )
          else
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Expanded(child: brand),
                const SizedBox(width: 24),
                Expanded(child: links),
                const SizedBox(width: 24),
                Expanded(child: social),
              ],
            ),
          const SizedBox(height: 40),
          const Text(
            '© $_year dukion',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }
}

class _FooterLink extends StatefulWidget {
  const _FooterLink(this.label, this.onTap);
  final String label;
  final VoidCallback onTap;

  @override
  State<_FooterLink> createState() => _FooterLinkState();
}

class _FooterLinkState extends State<_FooterLink> {
  bool _hovering = false;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: MouseRegion(
        onEnter: (_) => setState(() => _hovering = true),
        onExit: (_) => setState(() => _hovering = false),
        cursor: SystemMouseCursors.click,
        child: GestureDetector(
          onTap: widget.onTap,
          child: Text(
            widget.label,
            style: TextStyle(
              color: _hovering ? AppColors.accent : AppColors.textSecondary,
              fontSize: 13,
              fontWeight: _hovering ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ),
      ),
    );
  }
}