import 'package:flutter/material.dart';

import 'shared_widgets.dart';

/// Fixed top navigation bar. Stays transparent while the hero circle is
/// still closed, then fades in a solid background once the user has
/// scrolled past the hero — this is driven by [controller] directly so
/// it stays in sync with the actual scroll position without needing its
/// own state management.
class AppNavBar extends StatelessWidget {
  const AppNavBar({
    super.key,
    required this.controller,
    required this.onNavTap,
    required this.onContactTap,
  });

  final ScrollController controller;

  /// Called with the section id ('projects', 'services', ...) when a
  /// nav item is tapped.
  final void Function(String sectionId) onNavTap;
  final VoidCallback onContactTap;

  static const _items = <MapEntry<String, String>>[
    MapEntry('projects', 'Projects'),
    MapEntry('services', 'Services'),
    MapEntry('trading', 'Trading'),
    MapEntry('education', 'Education'),
    MapEntry('about', 'About'),
  ];

  @override
  Widget build(BuildContext context) {
    final mobile = isMobile(context);

    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final scrolled = controller.hasClients && controller.offset > 40;

        return AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          decoration: BoxDecoration(
            color: scrolled
                ? AppColors.background.withValues(alpha: 0.85)
                : Colors.transparent,
            border: Border(
              bottom: BorderSide(
                color: scrolled
                    ? AppColors.cardBorder
                    : Colors.transparent,
              ),
            ),
          ),
          padding: EdgeInsets.symmetric(
            horizontal: mobile ? 20 : 48,
            vertical: 16,
          ),
          child: Row(
            children: [
              const Text(
                'DUKION',
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                  letterSpacing: 1,
                ),
              ),
              const Spacer(),
              if (!mobile) ...[
                for (final item in _items)
                  _NavLink(
                    label: item.value,
                    onTap: () => onNavTap(item.key),
                  ),
                const SizedBox(width: 12),
                PrimaryButton(
                  label: "Let's Work Together",
                  onPressed: onContactTap,
                ),
              ] else
                PrimaryButton(
                  label: 'Menu',
                  filled: false,
                  onPressed: () => _showMobileMenu(context),
                ),
            ],
          ),
        );
      },
    );
  }

  void _showMobileMenu(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final item in _items)
                  ListTile(
                    title: Text(
                      item.value,
                      style: const TextStyle(color: AppColors.textPrimary),
                    ),
                    onTap: () {
                      Navigator.pop(context);
                      onNavTap(item.key);
                    },
                  ),
                ListTile(
                  title: const Text(
                    "Let's Work Together",
                    style: TextStyle(
                      color: AppColors.accent,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    onContactTap();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _NavLink extends StatefulWidget {
  const _NavLink({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  State<_NavLink> createState() => _NavLinkState();
}

class _NavLinkState extends State<_NavLink> {
  bool _hovering = false;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: MouseRegion(
        onEnter: (_) => setState(() => _hovering = true),
        onExit: (_) => setState(() => _hovering = false),
        cursor: SystemMouseCursors.click,
        child: GestureDetector(
          onTap: widget.onTap,
          child: Text(
            widget.label,
            style: TextStyle(
              color: _hovering ? AppColors.textPrimary : AppColors.textSecondary,
              fontSize: 13,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }
}