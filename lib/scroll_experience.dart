import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import 'circle_clipper.dart';
import 'scene_3d_widget.dart';
import 'sections/about_section.dart';
import 'sections/contact_section.dart';
import 'sections/currently_building_section.dart';
import 'sections/education_section.dart';
import 'sections/featured_projects_section.dart';
import 'sections/footer_section.dart';
import 'sections/services_section.dart';
import 'sections/trading_lab_section.dart';
import 'sections/what_i_do_section.dart';
import 'widgets/app_navbar.dart';
import 'widgets/shared_widgets.dart';

/// Maps [value] from the range [start, end] to 0..1, clamped. Used
/// everywhere below to build smooth fade / slide curves instead of hard
/// on/off switches — this is the core fix for the "lockscreen unlock"
/// snap the circle-to-content transition used to have.
double _rangeToUnit(double value, double start, double end) {
  if (end == start) return value >= end ? 1.0 : 0.0;
  return ((value - start) / (end - start)).clamp(0.0, 1.0);
}

class ScrollExperience extends StatefulWidget {
  const ScrollExperience({super.key});

  @override
  State<ScrollExperience> createState() => _ScrollExperienceState();
}

class _ScrollExperienceState extends State<ScrollExperience>
    with SingleTickerProviderStateMixin {
  final ScrollController _controller = ScrollController();

  /// Smoothed 0.0 -> 1.0 value actually used for rendering the hero.
  /// Wrapped in a ValueNotifier so only the widgets that read it rebuild
  /// every frame — not the whole ScrollExperience tree.
  final ValueNotifier<double> _progress = ValueNotifier<double>(0.0);

  /// Raw target computed straight from the scroll offset. The rendered
  /// [_progress] chases this value smoothly instead of snapping to it.
  double _target = 0.0;
  Duration _lastTick = Duration.zero;
  late final Ticker _ticker;

  static const double _smoothingStiffness = 14.0;

  /// Distance (px) over which the reveal plays out. Derived from the
  /// viewport height (see didChangeDependencies) so the timing feels
  /// consistent on every screen size, and so the reveal finishes right
  /// around the moment content is scrolling into place — no dead gap of
  /// scrolling through nothing, no overlay lingering past its welcome.
  double _revealDistance = 900;

  // Anchors used for navbar / footer "scroll to section" navigation.
  final _keyProjects = GlobalKey();
  final _keyServices = GlobalKey();
  final _keyTrading = GlobalKey();
  final _keyEducation = GlobalKey();
  final _keyAbout = GlobalKey();
  final _keyContact = GlobalKey();

  @override
  void initState() {
    super.initState();
    _controller.addListener(_handleScroll);
    _ticker = createTicker(_onTick)..start();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _revealDistance = MediaQuery.of(context).size.height * 0.95;
  }

  void _handleScroll() {
    final offset = _controller.offset;
    _target = (offset / _revealDistance).clamp(0.0, 1.0);
  }

  /// Frame-rate-independent exponential smoothing:
  ///   current += (target - current) * (1 - e^(-stiffness * dt))
  void _onTick(Duration elapsed) {
    final double dt =
        ((elapsed - _lastTick).inMicroseconds / Duration.microsecondsPerSecond)
            .clamp(0.0, 0.1);
    _lastTick = elapsed;

    final double current = _progress.value;
    final double diff = _target - current;

    if (diff.abs() < 0.0006) {
      if (current != _target) _progress.value = _target;
      return;
    }

    final double t = 1 - math.exp(-_smoothingStiffness * dt);
    _progress.value = current + diff * t;
  }

  @override
  void dispose() {
    _controller
      ..removeListener(_handleScroll)
      ..dispose();
    _ticker.dispose();
    _progress.dispose();
    super.dispose();
  }

  GlobalKey? _keyFor(String sectionId) {
    switch (sectionId) {
      case 'projects':
        return _keyProjects;
      case 'services':
        return _keyServices;
      case 'trading':
        return _keyTrading;
      case 'education':
        return _keyEducation;
      case 'about':
        return _keyAbout;
      case 'contact':
        return _keyContact;
    }
    return null;
  }

  void _scrollToSection(String sectionId) {
    final key = _keyFor(sectionId);
    final ctx = key?.currentContext;
    if (ctx == null) return;
    Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeInOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    return Scaffold(
      backgroundColor: AppColors.background,
      body: Stack(
        children: [
          // ---------------------------------------------------------
          // Layer 1: the actual scrollable content (behind everything).
          // Every real section lives in ONE Column inside ONE
          // SliverToBoxAdapter (rather than one sliver per section) so
          // a single fade + slide-up transform can be applied to all of
          // it at once, in sync with the hero overlay's own fade-out —
          // that overlap is what creates the crossfade / "merge" feel
          // instead of a hard cut.
          // ---------------------------------------------------------
          CustomScrollView(
            controller: _controller,
            physics: const BouncingScrollPhysics(
              parent: AlwaysScrollableScrollPhysics(),
            ),
            slivers: [
              // Reserved space for the hero / circle-reveal phase.
              SliverToBoxAdapter(child: SizedBox(height: screenHeight)),

              SliverToBoxAdapter(
                child: ValueListenableBuilder<double>(
                  valueListenable: _progress,
                  builder: (context, progress, child) {
                    // Content starts appearing a little before the
                    // overlay is fully gone (0.78) and is fully settled
                    // by the time progress hits 1.0.
                    final t = _rangeToUnit(progress, 0.78, 1.0);
                    return Opacity(
                      opacity: t,
                      child: Transform.translate(
                        offset: Offset(0, (1 - t) * 32),
                        child: child,
                      ),
                    );
                  },
                  child: Column(
                    children: [
                      const WhatIDoSection(),
                      KeyedSubtree(
                        key: _keyProjects,
                        child: const FeaturedProjectsSection(),
                      ),
                      KeyedSubtree(
                        key: _keyTrading,
                        child: const TradingLabSection(),
                      ),
                      KeyedSubtree(
                        key: _keyServices,
                        child: ServicesSection(
                          onGetQuote: () => _scrollToSection('contact'),
                        ),
                      ),
                      KeyedSubtree(
                        key: _keyEducation,
                        child: const EducationSection(),
                      ),
                      KeyedSubtree(
                        key: _keyAbout,
                        child: const AboutSection(),
                      ),
                      const CurrentlyBuildingSection(),
                      KeyedSubtree(
                        key: _keyContact,
                        child: const ContactSection(),
                      ),
                      FooterSection(onNavTap: _scrollToSection),
                    ],
                  ),
                ),
              ),
            ],
          ),

          // ---------------------------------------------------------
          // Layer 2: fixed hero overlay containing the circle-clipped
          // 3D scene. Fades out gradually (with a slight zoom-out) over
          // the tail end of the scroll instead of vanishing on a single
          // frame, so it visually dissolves into Layer 1 as that
          // fades/slides in above — this is the actual fix for the
          // "lockscreen unlock" snap.
          // ---------------------------------------------------------
          ValueListenableBuilder<double>(
            valueListenable: _progress,
            builder: (context, progress, _) {
              // Overlay starts dissolving at 0.72 and is fully gone by
              // 0.97 — chosen to overlap with the content fade-in
              // window (0.78 -> 1.0) above, so there's a real crossfade
              // in the middle instead of a gap or a hard swap.
              final fadeOut = _rangeToUnit(progress, 0.72, 0.97);
              final opacity = 1 - fadeOut;
              if (opacity <= 0) return const SizedBox.shrink();

              return IgnorePointer(
                child: Opacity(
                  opacity: opacity,
                  child: Transform.scale(
                    // Subtle "zoom past" as it dissolves, instead of a
                    // flat fade — reinforces the feeling of scrolling
                    // *through* the circle into the page.
                    scale: 1 + fadeOut * 0.18,
                    child: Container(
                      width: double.infinity,
                      height: double.infinity,
                      color: AppColors.background,
                      child: ClipPath(
                        clipper: CircleRevealClipper(progress: progress),
                        child: Scene3DWidget(scrollProgress: progress),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),

          // ---------------------------------------------------------
          // Layer 3: hero headline + CTA buttons, fades out quickly as
          // the circle starts opening.
          // ---------------------------------------------------------
          ValueListenableBuilder<double>(
            valueListenable: _progress,
            builder: (context, progress, _) {
              return IgnorePointer(
                // Only block taps once the reveal has meaningfully
                // started — right at the top the hero buttons
                // underneath must stay tappable.
                ignoring: progress > 0.03,
                child: Opacity(
                  opacity: (1 - progress * 1.6).clamp(0.0, 1.0),
                  child: _HeroText(
                    progress: progress,
                    onExploreProjects: () => _scrollToSection('projects'),
                    onServices: () => _scrollToSection('services'),
                  ),
                ),
              );
            },
          ),

          // Scroll hint, only shown right at the very top.
          ValueListenableBuilder<double>(
            valueListenable: _progress,
            builder: (context, progress, _) {
              if (progress >= 0.05) return const SizedBox.shrink();
              return const Positioned(
                bottom: 32,
                left: 0,
                right: 0,
                child: _ScrollHint(),
              );
            },
          ),

          // ---------------------------------------------------------
          // Layer 4: fixed navbar, always on top, wired to scroll-to
          // navigation.
          // ---------------------------------------------------------
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: AppNavBar(
              controller: _controller,
              onNavTap: _scrollToSection,
              onContactTap: () => _scrollToSection('contact'),
            ),
          ),
        ],
      ),
    );
  }
}
class _HeroText extends StatelessWidget {
  const _HeroText({
    required this.progress,
    required this.onExploreProjects,
    required this.onServices,
  });

  final double progress;
  final VoidCallback onExploreProjects;
  final VoidCallback onServices;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            'WELCOME\nDUKION',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 42,
              fontWeight: FontWeight.w700,
              height: 1.15,
              letterSpacing: -0.5,
              color: Colors.white.withValues(
                alpha: (1 - progress * 2).clamp(0.0, 1.0),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Digital Projects, Trading Tools & Creative Services',
            style: TextStyle(
              fontSize: 14,
              color: Colors.white.withValues(
                alpha: (0.7 - progress * 2).clamp(0.0, 0.7),
              ),
            ),
          ),
          const SizedBox(height: 28),
          Opacity(
            opacity: (1 - progress * 3).clamp(0.0, 1.0),
            child: Wrap(
              spacing: 12,
              alignment: WrapAlignment.center,
              children: [
                PrimaryButton(label: 'Explore Projects', onPressed: onExploreProjects),
                PrimaryButton(
                  label: 'My Services',
                  filled: false,
                  onPressed: onServices,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
class _ScrollHint extends StatelessWidget {
  const _ScrollHint();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        children: [
          Text(
            'SCROLL',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.5),
              fontSize: 12,
              letterSpacing: 3,
            ),
          ),
          const SizedBox(height: 6),
          const Icon(Icons.keyboard_arrow_down, color: Colors.white54),
        ],
      ),
    );
  }
}
