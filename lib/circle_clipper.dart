import 'dart:math';
import 'dart:ui';

import 'package:flutter/material.dart';

/// A [CustomClipper] that clips its child to a circle whose radius grows
/// from [minRadius] to a radius large enough to cover the whole screen,
/// driven by [progress] (0.0 -> closed, 1.0 -> fully open).
///
/// The growth is passed through [curve] (default [Curves.easeInExpo]) so
/// the reveal feels slow at first, then accelerates dramatically — giving
/// the "exponential expansion" feel requested.
class CircleRevealClipper extends CustomClipper<Path> {
  CircleRevealClipper({
    required this.progress,
    this.minRadius = 90,
    this.curve = Curves.easeInExpo,
  });

  /// 0.0 -> circle is at [minRadius] (fully closed / just the porthole)
  /// 1.0 -> circle covers the full diagonal of the screen (fully open)
  final double progress;

  final double minRadius;
  final Curve curve;

  @override
  Path getClip(Size size) {
    final center = Offset(size.width / 2, size.height / 2);

    // Radius that guarantees the circle covers every corner of the screen.
    final maxRadius =
        sqrt(size.width * size.width + size.height * size.height) / 2 + 40;

    final t = curve.transform(progress.clamp(0.0, 1.0));
    final radius = lerpDouble(minRadius, maxRadius, t)!;

    return Path()..addOval(Rect.fromCircle(center: center, radius: radius));
  }

  @override
  bool shouldReclip(covariant CircleRevealClipper oldClipper) {
    return oldClipper.progress != progress ||
        oldClipper.minRadius != minRadius;
  }
}