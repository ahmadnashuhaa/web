import 'package:flutter/material.dart';

import '../utils/launch_helper.dart';
import '../widgets/shared_widgets.dart';

class ContactSection extends StatefulWidget {
  const ContactSection({super.key});

  @override
  State<ContactSection> createState() => _ContactSectionState();
}

class _ContactSectionState extends State<ContactSection> {
  final _descriptionController = TextEditingController();

  String? _selectedNeed;
  String? _selectedBudget;

  static const _needs = [
    'Design',
    'Summary',
    'Website / App',
    'Trading Indicator',
    'EA / Bot',
    'Other',
  ];

  static const _budgets = [
    '< Rp500K',
    'Rp500K – 2M',
    'Rp2M – 5M',
    '> Rp5M',
  ];

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  void _orderViaWhatsApp() {
    if (_selectedNeed == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select what you need first.')),
      );
      return;
    }
    openWhatsAppOrder(
      context,
      need: _selectedNeed,
      budget: _selectedBudget,
      description: _descriptionController.text,
    );
  }

  @override
  Widget build(BuildContext context) {
    final mobile = isMobile(context);

    return Container(
      width: double.infinity,
      color: AppColors.background,
      padding: sectionPadding(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          const SectionHeader(
            eyebrow: "Let's Work",
            title: 'Have a project in mind?',
            subtitle: "Fill in a few details and I'll open a WhatsApp chat "
                'with everything prefilled — fast and direct.',
            alignCenter: true,
          ),
          const SizedBox(height: 36),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 620),
            child: Container(
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
                    'What do you need?',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      for (final need in _needs)
                        _SelectableChip(
                          label: need,
                          selected: _selectedNeed == need,
                          onTap: () => setState(() => _selectedNeed = need),
                        ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Tell me about your project',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _descriptionController,
                    maxLines: 4,
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 13),
                    decoration: InputDecoration(
                      hintText: 'What are you trying to achieve? (optional)',
                      hintStyle: const TextStyle(color: AppColors.textSecondary),
                      filled: true,
                      fillColor: AppColors.background,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.cardBorder),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.cardBorder),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: const BorderSide(color: AppColors.accent),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Text(
                    'Budget',
                    style: TextStyle(
                      color: AppColors.textPrimary,
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      for (final b in _budgets)
                        _SelectableChip(
                          label: b,
                          selected: _selectedBudget == b,
                          onTap: () => setState(() => _selectedBudget = b),
                        ),
                    ],
                  ),
                  const SizedBox(height: 28),
                  SizedBox(
                    width: mobile ? double.infinity : null,
                    child: Center(
                      child: PrimaryButton(
                        label: 'Order via WhatsApp',
                        color: const Color(0xFF25D366),
                        onPressed: _orderViaWhatsApp,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SelectableChip extends StatelessWidget {
  const _SelectableChip({
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
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: selected ? AppColors.accent.withValues(alpha: 0.15) : AppColors.background,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: selected ? AppColors.accent : AppColors.cardBorder,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              selected ? Icons.check_circle : Icons.circle_outlined,
              size: 14,
              color: selected ? AppColors.accent : AppColors.textSecondary,
            ),
            const SizedBox(width: 6),
            Text(
              label,
              style: TextStyle(
                color: selected ? AppColors.accent : AppColors.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}