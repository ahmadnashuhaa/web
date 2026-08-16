import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

import 'scroll_experience.dart';
import 'widgets/shared_widgets.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Digital Studio',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0A0A0A),
        fontFamily: 'Inter',
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.accent,
          brightness: Brightness.dark,
        ),
      ),
      scrollBehavior: const _SmoothScrollBehavior(),
      home: const ScrollExperience(),
    );
  }
}

/// Enables mouse-drag / trackpad scrolling on Web & Desktop, so the
/// circle-scroll experience feels natural even without a touch screen,
/// and forces smooth bouncing physics everywhere so no scrollable in the
/// app defaults back to the stiffer platform-clamped behavior.
class _SmoothScrollBehavior extends MaterialScrollBehavior {
  const _SmoothScrollBehavior();

  @override
  Set<PointerDeviceKind> get dragDevices => {
        PointerDeviceKind.touch,
        PointerDeviceKind.mouse,
        PointerDeviceKind.trackpad,
        PointerDeviceKind.stylus,
      };

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) {
    return const BouncingScrollPhysics(
      parent: AlwaysScrollableScrollPhysics(),
    );
  }
}
