import 'dart:math';

import 'package:flutter/material.dart';

import 'widgets/shared_widgets.dart';

/// ... (komentar tidak berubah)
class Scene3DWidget extends StatefulWidget {
  const Scene3DWidget({
    super.key,
    required this.scrollProgress,
    this.particleCount = 480,
    this.accentColor = AppColors.accent,
  });

  final double scrollProgress;
  final int particleCount;
  final Color accentColor;
  
  @override
  State<Scene3DWidget> createState() => _Scene3DWidgetState();
}

class _Scene3DWidgetState extends State<Scene3DWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ticker;
  late final List<_Particle3D> _particles;

  @override
  void initState() {
    super.initState();
    _particles = _generateSpherePoints(widget.particleCount);
    _ticker = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 40),
    )..repeat();
  }

  @override
  void dispose() {
    _ticker.dispose();
    super.dispose();
  }

  /// Fibonacci sphere distribution -> evenly spaced points on a unit sphere.
  List<_Particle3D> _generateSpherePoints(int count) {
    final particles = <_Particle3D>[];
    final goldenAngle = pi * (3 - sqrt(5));
    for (int i = 0; i < count; i++) {
      final y = 1 - (i / (count - 1)) * 2;
      final radiusAtY = sqrt(1 - y * y);
      final theta = goldenAngle * i;
      final x = cos(theta) * radiusAtY;
      final z = sin(theta) * radiusAtY;
      particles.add(_Particle3D(x, y, z));
    }
    return particles;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ticker,
      builder: (context, _) {
        final autoRotation = _ticker.value * 2 * pi;
        // Extra rotation & scale driven purely by scroll position — this
        // is what makes the object "respond" as the circle opens.
        final scrollRotation = widget.scrollProgress * pi * 1.5;
        final scale = 1.0 + widget.scrollProgress * 0.9;

        return CustomPaint(
          size: Size.infinite,
          painter: _SpherePainter(
            particles: _particles,
            rotationY: autoRotation + scrollRotation,
            rotationX: widget.scrollProgress * 0.6,
            scale: scale,
            accentColor: widget.accentColor,
          ),
        );
      },
    );
  }
}

class _Particle3D {
  const _Particle3D(this.x, this.y, this.z);
  final double x, y, z;
}

class _Projected {
  const _Projected(this.sx, this.sy, this.z, this.perspective);
  final double sx, sy, z, perspective;
}

class _SpherePainter extends CustomPainter {
  _SpherePainter({
    required this.particles,
    required this.rotationY,
    required this.rotationX,
    required this.scale,
    required this.accentColor,
  });

  final List<_Particle3D> particles;
  final double rotationY;
  final double rotationX;
  final double scale;
  final Color accentColor;

  static const double _cameraDistance = 2.6;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final baseRadius = min(size.width, size.height) * 0.32 * scale;

    final cosY = cos(rotationY);
    final sinY = sin(rotationY);
    final cosX = cos(rotationX);
    final sinX = sin(rotationX);

    // Rotate + project every point, then depth-sort (painter's algorithm)
    // so particles further away are drawn first.
    final projected = <_Projected>[];
    for (final p in particles) {
      final x1 = p.x * cosY - p.z * sinY;
      final z1 = p.x * sinY + p.z * cosY;

      final y2 = p.y * cosX - z1 * sinX;
      final z2 = p.y * sinX + z1 * cosX;

      final perspective = _cameraDistance / (_cameraDistance + z2);
      final sx = center.dx + x1 * baseRadius * perspective;
      final sy = center.dy + y2 * baseRadius * perspective;

      projected.add(_Projected(sx, sy, z2, perspective));
    }
    projected.sort((a, b) => a.z.compareTo(b.z));

    for (final pr in projected) {
      final depthFactor = pr.perspective.clamp(0.4, 1.6);
      final radius = 1.4 * depthFactor;
      final opacity = (0.25 + 0.75 * ((pr.z + 1) / 2)).clamp(0.0, 1.0);

      final paint = Paint()
        ..color = Color.lerp(Colors.white, accentColor, 0.5)!
            .withValues(alpha: opacity)
        ..style = PaintingStyle.fill;

      canvas.drawCircle(Offset(pr.sx, pr.sy), radius, paint);
    }

    // Soft glow core behind the particles.
    final glowPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          accentColor.withValues(alpha: 0.25),
          accentColor.withValues(alpha: 0),
        ],
      ).createShader(Rect.fromCircle(center: center, radius: baseRadius * 1.3));
    canvas.drawCircle(center, baseRadius * 1.3, glowPaint);
  }

  @override
  bool shouldRepaint(covariant _SpherePainter oldDelegate) => true;
}

// ---------------------------------------------------------------------
// OPTIONAL UPGRADE PATH: real GLSL FragmentShader
// ---------------------------------------------------------------------
// If you want a true GPU shader instead of the CPU particle painter above:
//   1. Add a `shaders:` section in pubspec.yaml pointing to a `.frag` file
//      compiled with `flutter_shader_compiler` (built into the Flutter SDK
//      via `dart run flutter_shader_compiler` on recent SDKs).
//   2. Load it with `FragmentProgram.fromAsset('shaders/sphere.frag')`.
//   3. Feed `scrollProgress` in as a uniform (e.g. uniform[0]) and sample
//      it inside the shader to distort/rotate the rendered surface.
//   4. Paint it with `ui.Paint()..shader = fragmentProgram.fragmentShader()`
//      inside a CustomPainter, same as _SpherePainter above.
// This keeps circle_clipper.dart and scroll_experience.dart untouched —
// only this file's internals would change.