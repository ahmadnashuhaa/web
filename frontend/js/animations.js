/**
 * animations.js
 *
 * Ports (with the same constants/timings, not approximations):
 *   - scroll_experience.dart  -> smoothed scroll-progress state machine,
 *     hero overlay fade/scale, content fade/slide, hero-text fade,
 *     scroll-hint visibility
 *   - circle_clipper.dart     -> CircleRevealClipper (easeInExpo radius growth)
 *   - scene_3d_widget.dart    -> Fibonacci-sphere particle scene
 *
 * Everything is driven by ONE smoothed `progress` value (0 -> 1), exactly
 * like the Flutter version's ValueNotifier<double>, updated once per
 * animation frame via exponential smoothing so it "chases" the scroll
 * target instead of snapping to it.
 */

import { createPlanetScene } from './scene-planet.js';

// ---- Shared helpers (ports `_rangeToUnit` from scroll_experience.dart) ----
function rangeToUnit(value, start, end) {
  if (end === start) return value >= end ? 1 : 0;
  return clamp((value - start) / (end - start), 0, 1);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// easeInExpo, matching Flutter's Curves.easeInExpo
function easeInExpo(t) {
  return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
}

export function initAnimations() {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const heroOverlay = document.getElementById('heroOverlay');
  const heroMask = document.getElementById('heroMask');
  const heroText = document.getElementById('heroText');
  const heroTitle = document.getElementById('heroTitle');
  const heroSubtitle = document.getElementById('heroSubtitle');
  const heroActions = document.getElementById('heroActions');
  const scrollHint = document.getElementById('scrollHint');
  const heroSpacer = document.getElementById('heroSpacer');
  const contentWrapper = document.getElementById('contentWrapper');
  const canvas = document.getElementById('sceneCanvas');

  if (!heroOverlay || !canvas) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  // ---- 3D Scene Initialization with Canvas 2D Fallback ----
  // IMPORTANT: We must NOT request 2d context before WebGL, as canvas context type is immutable.
  let planetScene = null;
  let ctx = null;

  if (typeof THREE !== 'undefined') {
    planetScene = createPlanetScene(canvas, { prefersReducedMotion });
  }

  if (!planetScene) {
    console.info('[Dukion] WebGL 3D inactive. Running Canvas 2D particle sphere fallback.');
    ctx = canvas.getContext('2d');
  }

  // ---- State (ports _ScrollExperienceState fields) ----
  let target = 0;      // raw value from scroll offset
  let progress = 0;     // smoothed value actually used for rendering
  let revealDistance = window.innerHeight * 0.95;
  let lastTime = null;
  const SMOOTHING_STIFFNESS = 14.0;

  let overlayHidden = false;

  function resize() {
    revealDistance = window.innerHeight * 0.95;
    heroSpacer.style.height = `${window.innerHeight}px`;

    if (planetScene) {
      planetScene.resize(window.innerWidth, window.innerHeight);
    } else if (ctx) {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function handleScroll() {
    target = clamp(window.scrollY / revealDistance, 0, 1);
  }

  // ---- Scene3DWidget port (FALLBACK): Fibonacci sphere + perspective projection ----
  const PARTICLE_COUNT = 480;
  const CAMERA_DISTANCE = 2.6;
  const AUTO_ROTATE_SECONDS = 40; // one full 2π rotation per 40s, matches AnimationController

  function generateSpherePoints(count) {
    const points = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < count; i++) {
      const y = 1 - (i / (count - 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = goldenAngle * i;
      points.push({
        x: Math.cos(theta) * radiusAtY,
        y,
        z: Math.sin(theta) * radiusAtY,
      });
    }
    return points;
  }

  const particles = generateSpherePoints(PARTICLE_COUNT);
  const accentColor = { r: 108, g: 99, b: 255 }; // AppColors.accent (#6C63FF)

  let autoRotation = 0;
  let sceneActive = true;

  function drawFallback2D(dt) {
    if (!ctx) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    if (sceneActive && !prefersReducedMotion) {
      autoRotation += (2 * Math.PI / AUTO_ROTATE_SECONDS) * dt;
    }

    const scrollRotation = progress * Math.PI * 1.5;
    const scale = 1 + progress * 0.9;
    const rotationY = autoRotation + scrollRotation;
    const rotationX = progress * 0.6;

    const cx = w / 2;
    const cy = h / 2;
    const baseRadius = Math.min(w, h) * 0.32 * scale;

    const cosY = Math.cos(rotationY), sinY = Math.sin(rotationY);
    const cosX = Math.cos(rotationX), sinX = Math.sin(rotationX);

    const projected = particles.map((p) => {
      const x1 = p.x * cosY - p.z * sinY;
      const z1 = p.x * sinY + p.z * cosY;
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;
      const perspective = CAMERA_DISTANCE / (CAMERA_DISTANCE + z2);
      return {
        sx: cx + x1 * baseRadius * perspective,
        sy: cy + y2 * baseRadius * perspective,
        z: z2,
        perspective,
      };
    });
    projected.sort((a, b) => a.z - b.z);

    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 1.3);
    glow.addColorStop(0, `rgba(${accentColor.r},${accentColor.g},${accentColor.b},0.25)`);
    glow.addColorStop(1, `rgba(${accentColor.r},${accentColor.g},${accentColor.b},0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, baseRadius * 1.3, 0, Math.PI * 2);
    ctx.fill();

    for (const pr of projected) {
      const depthFactor = clamp(pr.perspective, 0.4, 1.6);
      const radius = 1.4 * depthFactor;
      const opacity = clamp(0.25 + 0.75 * ((pr.z + 1) / 2), 0, 1);

      const r = Math.round((255 + accentColor.r) / 2);
      const g = Math.round((255 + accentColor.g) / 2);
      const b = Math.round((255 + accentColor.b) / 2);

      ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
      ctx.beginPath();
      ctx.arc(pr.sx, pr.sy, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawScene(dt) {
    if (planetScene) {
      planetScene.update(progress, dt);
    } else if (ctx) {
      drawFallback2D(dt);
    }
  }

  // ---- Circle reveal (ports circle_clipper.dart) ----
  const MIN_RADIUS = 90;

  function applyCircleClip() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const maxRadius = Math.sqrt(w * w + h * h) / 2 + 40;
    const t = easeInExpo(progress);
    const radius = lerp(MIN_RADIUS, maxRadius, t);
    heroMask.style.clipPath = `circle(${radius}px at 50% 50%)`;
  }

  // ---- Per-frame update (ports the 4 ValueListenableBuilder layers) ----
  function applyFrame() {
    // Layer 1: content fade/slide — rangeToUnit(progress, 0.78, 1.0)
    const contentT = rangeToUnit(progress, 0.78, 1.0);
    contentWrapper.style.opacity = String(contentT);
    contentWrapper.style.transform = `translateY(${(1 - contentT) * 32}px)`;

    // Layer 2: overlay fade/scale — rangeToUnit(progress, 0.72, 0.97)
    const fadeOut = rangeToUnit(progress, 0.72, 0.97);
    const overlayOpacity = 1 - fadeOut;
    if (overlayOpacity <= 0) {
      if (!overlayHidden) {
        heroOverlay.style.visibility = 'hidden';
        overlayHidden = true;
        sceneActive = false; // stop paying the render cost once fully gone
      }
    } else {
      if (overlayHidden) {
        heroOverlay.style.visibility = 'visible';
        overlayHidden = false;
        sceneActive = true;
      }
      heroOverlay.style.opacity = String(overlayOpacity);
      heroOverlay.style.transform = `scale(${1 + fadeOut * 0.18})`;
      heroOverlay.style.pointerEvents = progress > 0.03 ? 'none' : 'auto';
    }
    applyCircleClip();

    // Layer 3: hero text — separate fade rates per element, ported exactly
    heroText.style.opacity = String(clamp(1 - progress * 1.6, 0, 1));
    heroText.style.pointerEvents = progress > 0.03 ? 'none' : 'auto';
    heroTitle.style.opacity = String(clamp(1 - progress * 2, 0, 1));
    heroSubtitle.style.opacity = String(clamp(0.7 - progress * 2, 0, 0.7) / 0.7);
    heroActions.style.opacity = String(clamp(1 - progress * 3, 0, 1));

    // Scroll hint — visible only right at the top
    scrollHint.style.opacity = progress >= 0.05 ? '0' : '1';
    scrollHint.style.pointerEvents = progress >= 0.05 ? 'none' : 'auto';
  }

  // ---- Main ticker (ports _onTick's exponential smoothing) ----
  function tick(now) {
    if (lastTime === null) lastTime = now;
    const dt = clamp((now - lastTime) / 1000, 0, 0.1);
    lastTime = now;

    if (prefersReducedMotion) {
      progress = target;
    } else {
      const diff = target - progress;
      if (Math.abs(diff) < 0.0006) {
        progress = target;
      } else {
        const t = 1 - Math.exp(-SMOOTHING_STIFFNESS * dt);
        progress += diff * t;
      }
    }

    applyFrame();
    if (sceneActive || !overlayHidden) {
      drawScene(dt);
    }

    requestAnimationFrame(tick);
  }

  resize();
  handleScroll();
  applyFrame();
  drawScene(0);

  window.addEventListener('resize', resize);
  window.addEventListener('scroll', handleScroll, { passive: true });
  requestAnimationFrame(tick);

  // Marks successful init so the classic-script safety net in index.html
  // knows the module actually loaded and ran (see the fallback script
  // right before </body>).
  window.__dsAnimationsReady = true;

  return { prefersReducedMotion };
}
