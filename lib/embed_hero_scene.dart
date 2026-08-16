import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import 'circle_clipper.dart';
import 'scene_3d_widget.dart';
import 'scroll_progress_indicator.dart';
import 'web_bridge.dart';

/// The embed entry point used when this app is loaded inside an <iframe>
/// on the JS website (`?embed=true`).
///
/// Unlike [ScrollExperience], this widget owns NO scroll surface of its
/// own — the parent page's scroll position is the single source of truth.
/// It just:
///   1. Listens to [ScrollBridge] for progress updates from the parent.
///   2. Smooths that value with the same exponential-ease Ticker used in
///      the standalone app (see scroll_experience.dart for the rationale).
///   3. Feeds the smoothed value into the same [CircleRevealClipper] +
///      [Scene3DWidget] pair — the visual logic is 100% reused.
class EmbedHeroScene extends StatefulWidget {
  const EmbedHeroScene({super.key, this.expectedParentOrigin});

  /// Pass your site's real origin in production, e.g.
  /// `https://yourdomain.com` — see [ScrollBridge.listen] for why.
  final String? expectedParentOrigin;

  @override
  State<EmbedHeroScene> createState() => _EmbedHeroSceneState();
}

class _EmbedHeroSceneState extends State<EmbedHeroScene>
    with SingleTickerProviderStateMixin {
  final ValueNotifier<double> _progress = ValueNotifier<double>(0.0);
  double _target = 0.0;
  Duration _lastTick = Duration.zero;
  late final Ticker _ticker;
  StreamSubscription<double>? _sub;

  static const double _smoothingStiffness = 12.0;

  @override
  void initState() {
    super.initState();
    ScrollBridge.instance.listen(expectedOrigin: widget.expectedParentOrigin);
    _sub = ScrollBridge.instance.progressStream.listen((value) {
      _target = value;
    });
    _ticker = createTicker(_onTick)..start();
  }

  void _onTick(Duration elapsed) {
    final double dt =
        ((elapsed - _lastTick).inMicroseconds / Duration.microsecondsPerSecond)
            .clamp(0.0, 0.1);
    _lastTick = elapsed;

    final double current = _progress.value;
    final double diff = _target - current;
    if (diff.abs() < 0.0005) {
      if (current != _target) _progress.value = _target;
      return;
    }
    final double t = 1 - math.exp(-_smoothingStiffness * dt);
    _progress.value = current + diff * t;
  }

  @override
  void dispose() {
    _ticker.dispose();
    _sub?.cancel();
    _progress.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      body: ValueListenableBuilder<double>(
        valueListenable: _progress,
        builder: (context, progress, _) {
          return Stack(
            children: [
              Opacity(
                opacity: progress,
                child: Container(
                  decoration: const BoxDecoration(
                    gradient: RadialGradient(
                      colors: [Color(0xFF141026), Color(0xFF0A0A0A)],
                      radius: 1.2,
                    ),
                  ),
                ),
              ),
              ClipPath(
                clipper: CircleRevealClipper(
                  progress: progress,
                  minRadius: 60,
                  curve: Curves.easeInExpo,
                ),
                child: Container(
                  color: const Color(0xFF0A0A0A),
                  child: Scene3DWidget(scrollProgress: progress),
                ),
              ),
              Positioned(
                right: 24,
                bottom: 32,
                child: ScrollProgressIndicator(progress: progress),
              ),
            ],
          );
        },
      ),
    );
  }
}