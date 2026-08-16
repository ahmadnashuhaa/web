import 'dart:math' as math;
import 'package:flutter/material.dart';

/// A small ring indicator that shows how far the circle-reveal has
/// progressed (0-100%). Purely cosmetic feedback so the user understands
/// "keep scrolling" vs "you've arrived" — fades out once progress hits 1.0
/// since at that point the mask has already handed off to normal content.
class ScrollProgressIndicator extends StatelessWidget {
  const ScrollProgressIndicator({
    super.key,
    required this.progress,
    this.size = 56,
    this.color = const Color(0xFF00E5FF),
  });

  final double progress; // 0.0 -> 1.0
  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    // Fade the whole indicator out over the last 15% of the reveal so it
    // doesn't linger once Section 2 has taken over.
    final double opacity = (1.0 - ((progress - 0.85) / 0.15)).clamp(0.0, 1.0);
    if (opacity == 0.0) return const SizedBox.shrink();

    return Opacity(
      opacity: opacity,
      child: SizedBox(
        width: size,
        height: size,
        child: Stack(
          alignment: Alignment.center,
          children: [
            CustomPaint(
              size: Size.square(size),
              painter: _RingPainter(progress: progress, color: color),
            ),
            Text(
              '${(progress * 100).round()}%',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.9),
                fontSize: size * 0.22,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({required this.progress, required this.color});

  final double progress;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Offset center = size.center(Offset.zero);
    final double radius = size.width / 2 - 3;

    final Paint track = Paint()
      ..color = Colors.white.withValues(alpha: 0.12)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3;
    canvas.drawCircle(center, radius, track);

    final Paint arc = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round;

    const double start = -math.pi / 2; // 12 o'clock
    final double sweep = 2 * math.pi * progress.clamp(0.0, 1.0);
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      start,
      sweep,
      false,
      arc,
    );
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.color != color;
}