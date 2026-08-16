# Circle Scroll Experience (Flutter)

A dark, minimalist, futuristic scroll experience: a circular mask frames a
rotating "particle sphere" 3D scene; as the user scrolls, the circle expands
exponentially to reveal the rest of the page while the sphere rotates and
scales up ("camera push-in").

## Project structure

```
lib/
  main.dart              # App entry point + dark theme
  circle_clipper.dart    # CustomClipper<Path> — the expanding circle mask
  scene_3d_widget.dart   # Pseudo-3D particle sphere (CustomPainter)
  scroll_experience.dart # Wires ScrollController -> clip radius + 3D transform
```

## Run it

```bash
flutter create . --platforms=web,ios,android   # if you need platform folders
flutter pub get
flutter run -d chrome     # or any connected device
```

Requires Flutter 3.19+ (Dart 3.3+). No native plugins, no shader
compilation step — pure Dart/Flutter, so it runs identically on Web,
Desktop, and Mobile.

## Why CustomPainter instead of flutter_scene / GLSL fragment shaders?

`flutter_scene` and raw `FragmentShader`/`.frag` pipelines are real options,
but they add a build-time shader compilation step and, as of today, spottier
Web support than pure Dart canvas drawing. For a scroll-driven decorative
scene like this, a perspective-projected particle field drawn with
`CustomPainter` gives ~the same visual payoff (depth, rotation, glow,
scaling) with zero extra build tooling and guaranteed cross-platform parity.
The `Scene3DWidget` API (`progress` in, transformed scene out) is intentionally
the same shape you'd use for a `flutter_scene` `SceneController` or a
`FragmentProgram`-backed painter, so you can swap the internals later
without touching `scroll_experience.dart`.

## How the scroll listener drives the circle radius

This is the core mechanic, all inside `scroll_experience.dart`:

1. **One scroll surface.** A single `CustomScrollView` holds the entire
   page. Its first sliver is an empty, tall `SliverToBoxAdapter` — its
   height (`revealScrollExtent`, 900px by default) is *the distance you
   have to scroll* for the circle to go from closed to fully open. Real
   content (`_NextSection`, `_FooterSection`) comes after it.

2. **Reading the offset.** A `ScrollController` is attached to that scroll
   view. Its listener, `_handleScroll()`, fires on every scroll delta and
   computes:

   ```dart
   final double raw = _controller.offset / revealScrollExtent;
   final double clamped = clampProgress(raw); // clamps to [0, 1]
   ```

   So at `offset = 0` progress is `0.0`; at `offset = 900` (or more)
   progress is `1.0` and stays there.

3. **Cheap, targeted rebuilds.** Instead of calling `setState()` on the
   whole page (which would rebuild the scroll view, hero text, sections —
   everything) on *every single scroll pixel*, the progress value is
   pushed into a `ValueNotifier<double> _progress`. Only the
   `ValueListenableBuilder` that wraps the circle + 3D scene actually
   rebuilds per tick — the scroll view and static sections are untouched.

4. **Progress → radius (exponential easing).** That same `progress` value
   is handed to `CircleRevealClipper`:

   ```dart
   CircleRevealClipper(progress: progress, minRadius: 60, curve: Curves.easeInExpo)
   ```

   Inside `circle_clipper.dart`, `getClip()`:
   - computes `maxRadius`, the distance from the circle's center to the
     farthest screen corner (so the circle is guaranteed to fully cover
     the viewport at `progress = 1.0`),
   - runs `progress` through `Curves.easeInExpo` (barely moves at first,
     then rushes outward — this is the "expands exponentially" feel),
   - linearly interpolates between `minRadius` (closed state) and
     `maxRadius` (open state) using that eased value,
   - returns a `Path` with a single circle (`addOval`) at that radius.

   `ClipPath` uses this path every rebuild to mask its child (the 3D
   scene), so visually you get a circular "porthole" that grows.

5. **Progress → 3D transform.** The exact same `progress` also drives
   `Scene3DWidget`: rotation speed gets an extra `progress * 1.5π` kick and
   scale grows as `1.0 + progress * 0.9`, so the sphere visibly spins up
   and "pushes toward camera" in sync with the circle opening — both
   effects are driven by one shared value, so they can never drift out of
   sync.

6. **Handoff to normal content.** Once `progress` hits `1.0`, the circle
   mask is larger than the screen (fully invisible as a shape) and the
   hero text has faded out (`opacity: (1 - progress * 1.6).clamp(0, 1)`,
   which reaches 0 opacity before progress even hits 1, for a clean
   handoff). From there, scrolling behaves like an ordinary page — the
   user is now scrolling `_NextSection` / `_FooterSection` beneath the
   (now invisible) pinned overlay layer.

### Tuning it
- **Reveal speed:** change `revealScrollExtent` (smaller = faster reveal per pixel scrolled).
- **Easing feel:** swap `Curves.easeInExpo` for `Curves.easeOutBack`, `Curves.elasticOut`, etc.
- **Starting circle size:** `minRadius` in `CircleRevealClipper`.
- **Sphere density / color:** `particleCount`, `baseColor`, `accentColor` on `Scene3DWidget`.
