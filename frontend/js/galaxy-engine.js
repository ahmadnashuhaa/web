/**
 * galaxy-engine.js
 *
 * DUKION Galaxy Engine 3D Celestial System built with Three.js.
 *
 * Responsibilities:
 * 1. Global multi-layer celestial starfield (distant slow stars + near twinkling stars + comets).
 * 2. Hero Galaxy Core 3D:
 *    - Glowing central planet with atmospheric Fresnel shader & corona.
 *    - Orbiting accretion ring & mini-satellites.
 *    - Subtle mouse-parallax reaction (5-8° tilt) that stays behind/beside headline text.
 * 3. Scroll parallax integration across entire page depth.
 * 4. Automatic performance adaptation (low-end / mobile downsizing, IntersectionObserver pausing).
 * 5. WebGL fallback to 2D starry canvas if unsupported.
 */

export function initGalaxyEngine() {
  const canvas = document.getElementById('galaxyCanvas');
  if (!canvas) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.innerWidth < 768;
  const isLowEnd = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || isMobile;

  // WebGL availability check
  if (!window.WebGLRenderingContext) {
    init2DFallback(canvas);
    return;
  }

  let gl = null;
  try {
    gl = canvas.getContext('webgl', { powerPreference: 'high-performance', alpha: true }) ||
         canvas.getContext('experimental-webgl');
  } catch (e) {
    init2DFallback(canvas);
    return;
  }

  if (!gl || typeof THREE === 'undefined') {
    init2DFallback(canvas);
    return;
  }

  // ---- Three.js Setup ----
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const renderer = new THREE.WebGLRenderer({
    canvas,
    context: gl,
    antialias: !isLowEnd,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 0, 10);

  // ---- Palette ----
  const COLOR_VIOLET = new THREE.Color(0x7C3AED);
  const COLOR_CYAN = new THREE.Color(0x22D3EE);
  const COLOR_MAGENTA = new THREE.Color(0xD946EF);
  const COLOR_GOLD = new THREE.Color(0xFBBF24);

  // =========================================================================
  // 1. GLOBAL MULTI-LAYER STARFIELD
  // =========================================================================
  const starCount = isLowEnd ? 450 : 1100;
  const starfieldGeom = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    const idx = i * 3;
    // Spread in a wide cylinder along Z depth
    starPositions[idx] = (Math.random() - 0.5) * 70;
    starPositions[idx + 1] = (Math.random() - 0.5) * 50;
    starPositions[idx + 2] = -10 - Math.random() * 80;

    const tintRand = Math.random();
    if (tintRand > 0.88) {
      starColors[idx] = COLOR_CYAN.r;
      starColors[idx + 1] = COLOR_CYAN.g;
      starColors[idx + 2] = COLOR_CYAN.b;
      starSizes[i] = 2.4;
    } else if (tintRand > 0.76) {
      starColors[idx] = COLOR_VIOLET.r;
      starColors[idx + 1] = COLOR_VIOLET.g;
      starColors[idx + 2] = COLOR_VIOLET.b;
      starSizes[i] = 2.0;
    } else if (tintRand > 0.68) {
      starColors[idx] = COLOR_GOLD.r;
      starColors[idx + 1] = COLOR_GOLD.g;
      starColors[idx + 2] = COLOR_GOLD.b;
      starSizes[i] = 2.2;
    } else {
      starColors[idx] = 0.94;
      starColors[idx + 1] = 0.96;
      starColors[idx + 2] = 1.0;
      starSizes[i] = 1.4;
    }
  }

  starfieldGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starfieldGeom.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starfieldMat = new THREE.PointsMaterial({
    size: 0.18,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
  });
  const starfield = new THREE.Points(starfieldGeom, starfieldMat);
  scene.add(starfield);

  // =========================================================================
  // 2. HERO GALAXY CORE (Planet + Accretion Rings + Corona)
  // =========================================================================
  const galaxyCoreGroup = new THREE.Group();
  // Positioned slightly to the right on desktop, centered on mobile
  galaxyCoreGroup.position.set(isMobile ? 0 : 2.8, isMobile ? 1.0 : 0.2, 0);
  scene.add(galaxyCoreGroup);

  // A. Procedural Planet Texture (Authentic Planetary Globe with Lat/Long Grid)
  const planetCanvas = document.createElement('canvas');
  planetCanvas.width = 1024;
  planetCanvas.height = 512;
  const pCtx = planetCanvas.getContext('2d');

  // 1. Deep celestial atmosphere gradient (Saturn/Neptune inspired)
  const pGrad = pCtx.createLinearGradient(0, 0, 0, 512);
  pGrad.addColorStop(0, '#060814');     // North polar cap (deep space navy)
  pGrad.addColorStop(0.25, '#0c1228');
  pGrad.addColorStop(0.5, '#121838');    // Equatorial zone
  pGrad.addColorStop(0.75, '#0c1228');
  pGrad.addColorStop(1, '#050711');     // South polar cap
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, 1024, 512);

  // 2. Horizontal atmospheric cloud / gas bands (NOT radial, NOT eye-like)
  const cloudBands = [
    { y: 80, h: 42, color: 'rgba(79, 70, 229, 0.14)' },
    { y: 155, h: 58, color: 'rgba(124, 58, 237, 0.16)' },
    { y: 235, h: 64, color: 'rgba(34, 211, 238, 0.12)' },
    { y: 320, h: 50, color: 'rgba(124, 58, 237, 0.15)' },
    { y: 400, h: 40, color: 'rgba(79, 70, 229, 0.12)' },
  ];
  cloudBands.forEach((band) => {
    pCtx.fillStyle = band.color;
    pCtx.beginPath();
    pCtx.moveTo(0, band.y);
    for (let x = 0; x <= 1024; x += 32) {
      const wave = Math.sin(x * 0.02) * 6 + Math.sin(x * 0.05) * 3;
      pCtx.lineTo(x, band.y + wave);
    }
    for (let x = 1024; x >= 0; x -= 32) {
      const wave = Math.sin(x * 0.02) * 6 + Math.sin(x * 0.05) * 3;
      pCtx.lineTo(x, band.y + band.h + wave);
    }
    pCtx.closePath();
    pCtx.fill();
  });

  // 3. Planetary Latitude Parallels (horizontal grid lines across globe)
  pCtx.strokeStyle = 'rgba(34, 211, 238, 0.22)';
  pCtx.lineWidth = 1.2;
  const latitudes = [64, 128, 192, 256, 320, 384, 448]; // Equator at 256
  latitudes.forEach((y) => {
    pCtx.beginPath();
    pCtx.moveTo(0, y);
    pCtx.lineTo(1024, y);
    pCtx.stroke();
  });

  // 4. Planetary Longitude Meridians (vertical grid lines from pole to pole)
  pCtx.strokeStyle = 'rgba(124, 58, 237, 0.18)';
  pCtx.lineWidth = 1.0;
  for (let x = 0; x < 1024; x += 1024 / 12) { // 12 meridians (every 30 deg)
    pCtx.beginPath();
    pCtx.moveTo(x, 0);
    pCtx.lineTo(x, 512);
    pCtx.stroke();
  }

  // 5. Asymmetric telemetry data nodes (3-4 tiny scattered city/station dots, NO eye shape)
  const dataNodes = [
    { x: 230, y: 160, color: '#22D3EE', r: 2.5 },
    { x: 680, y: 310, color: '#FBBF24', r: 2.0 },
    { x: 840, y: 190, color: '#D946EF', r: 2.2 },
    { x: 420, y: 370, color: '#22D3EE', r: 1.8 },
  ];
  dataNodes.forEach((node) => {
    // Soft outer glow
    const g = pCtx.createRadialGradient(node.x, node.y, 0, node.x, node.y, 7);
    g.addColorStop(0, node.color);
    g.addColorStop(0.4, node.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    pCtx.fillStyle = g;
    pCtx.beginPath();
    pCtx.arc(node.x, node.y, 7, 0, Math.PI * 2);
    pCtx.fill();

    // Solid core
    pCtx.fillStyle = '#FFFFFF';
    pCtx.beginPath();
    pCtx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
    pCtx.fill();
  });

  const planetTexture = new THREE.CanvasTexture(planetCanvas);
  planetTexture.wrapS = THREE.RepeatWrapping;
  planetTexture.wrapT = THREE.ClampToEdgeWrapping;

  // B. Planet Mesh (Matte diffuse planetary body NO sharp white specular highlight!)
  const planetGeom = new THREE.SphereGeometry(1.35, isLowEnd ? 28 : 40, isLowEnd ? 28 : 40);
  const planetMat = new THREE.MeshStandardMaterial({
    map: planetTexture,
    roughness: 0.88, // Diffuse planetary surface prevents single bright specular catchlight
    metalness: 0.05,
    bumpMap: planetTexture,
    bumpScale: 0.012,
    transparent: false,
    depthWrite: true,
  });
  const planetMesh = new THREE.Mesh(planetGeom, planetMat);
  galaxyCoreGroup.add(planetMesh);

  // C. Subtle Atmospheric Rim Glow (thin Fresnel silhouette on planet edge)
  const atmosphereMat = new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: COLOR_VIOLET },
      viewVector: { value: new THREE.Vector3(0, 0, 10) },
    },
    vertexShader: `
      uniform vec3 viewVector;
      varying float vGlow;
      void main() {
        vec3 vNormal = normalize(normalMatrix * normal);
        vec3 vView = normalize(normalMatrix * viewVector);
        vGlow = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      varying float vGlow;
      void main() {
        gl_FragColor = vec4(glowColor * 1.2, clamp(vGlow * 1.2, 0.0, 0.65));
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const atmosphereGeom = new THREE.SphereGeometry(1.38, isLowEnd ? 24 : 32, isLowEnd ? 24 : 32);
  const atmosphereMesh = new THREE.Mesh(atmosphereGeom, atmosphereMat);
  planetMesh.add(atmosphereMesh);

  // D. Saturn-Style Planetary Rings (Tilted Ellipse with Real Depth Occlusion)
  // Inner radius 1.70 (leaves gap outside sphere radius 1.35), Outer radius 3.10
  const ringGeom = new THREE.RingGeometry(1.70, 3.10, isLowEnd ? 48 : 80, 2);
  const ringMat = new THREE.ShaderMaterial({
    uniforms: {
      colorCore: { value: new THREE.Color(0x22D3EE) },  // Cyan/ice core
      colorEdge: { value: new THREE.Color(0x7C3AED) },  // Violet outer border
      colorWhite: { value: new THREE.Color(0xF8FAFC) }, // Bright dense ring bands
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 colorCore;
      uniform vec3 colorEdge;
      uniform vec3 colorWhite;
      varying vec2 vUv;
      void main() {
        // Compute distance from center of planar ring geometry
        float dist = length(vUv - vec2(0.5)) * 2.0;
        float innerEdge = 0.548; // 1.70 / 3.10
        float outerEdge = 1.0;

        if (dist < innerEdge || dist > outerEdge) {
          discard;
        }

        // Normalized radial position from 0 (inner edge) to 1 (outer edge)
        float t = (dist - innerEdge) / (outerEdge - innerEdge);

        // Cassini Division (dark gap in Saturn's rings)
        float cassini = smoothstep(0.0, 0.025, abs(t - 0.68));

        // Fine concentric ripples (rings of dust particles)
        float ripples = 0.85 + 0.15 * sin(t * 70.0);

        // Color gradient across ring bands
        vec3 col = mix(colorEdge, colorCore, sin(t * 3.14159));
        if (t > 0.28 && t < 0.64) {
          col = mix(col, colorWhite, 0.45); // Bright B-Ring
        }

        // Smooth opacity falloff at inner & outer edges
        float alpha = smoothstep(0.0, 0.05, t) * smoothstep(1.0, 0.94, t) * cassini * ripples * 0.85;

        gl_FragColor = vec4(col, alpha);
      }
    `,
    side: THREE.DoubleSide,
    transparent: true,
    depthTest: true,  // Crucial: back of ring is occluded by the 3D sphere!
    depthWrite: false,
    blending: THREE.NormalBlending, // Natural alpha blending so sphere hides back half
  });
  const ringMesh = new THREE.Mesh(ringGeom, ringMat);

  // Tilt ring ~18 degrees relative to horizontal (Saturn inclination)
  // Euler order: X rotation lays it flat (tilted ~18° from line of sight), Z rotation angles the horizontal axis
  ringMesh.rotation.set(Math.PI * 0.41, 0, -0.32);
  galaxyCoreGroup.add(ringMesh);

  // E. 4 Orbital Satellites (Moons orbiting outside the ring in deep space)
  const satellites = [];
  const satelliteColors = [COLOR_VIOLET, COLOR_CYAN, COLOR_MAGENTA, COLOR_GOLD];
  const satGeom = new THREE.SphereGeometry(0.075, 12, 12);
  for (let i = 0; i < 4; i++) {
    const sMat = new THREE.MeshBasicMaterial({ color: satelliteColors[i] });
    const sMesh = new THREE.Mesh(satGeom, sMat);
    galaxyCoreGroup.add(sMesh);
    satellites.push({
      mesh: sMesh,
      angle: (i / 4) * Math.PI * 2,
      speed: 0.32 + i * 0.06,
      radiusX: 3.6 + i * 0.25, // Orbit outside the rings (radius > 3.10)
      radiusZ: 2.2 + i * 0.18,
    });
  }

  // F. Lights: Directional Sun Light from side/top (Casts majestic planetary crescent, NO eye pupil!)
  const sunLight = new THREE.DirectionalLight(0x22D3EE, 2.4);
  sunLight.position.set(-9, 5, 4); // Lit from upper-left, creates realistic crescent day/night
  scene.add(sunLight);

  const ambientFill = new THREE.AmbientLight(0x0a0e22, 0.9); // Ambient space glow
  scene.add(ambientFill);

  const rimBackLight = new THREE.DirectionalLight(0x7C3AED, 1.2);
  rimBackLight.position.set(8, -4, -3); // Subtle violet back rim
  scene.add(rimBackLight);

  // =========================================================================
  // 3. SHOOTING STARS / COMETS
  // =========================================================================
  const cometGeom = new THREE.BufferGeometry();
  const cometPositions = new Float32Array(6);
  cometGeom.setAttribute('position', new THREE.BufferAttribute(cometPositions, 3));
  const cometMat = new THREE.LineBasicMaterial({
    color: 0x22D3EE,
    transparent: true,
    opacity: 0,
    linewidth: 2,
  });
  const cometLine = new THREE.Line(cometGeom, cometMat);
  scene.add(cometLine);

  let cometActive = false;
  let cometTimer = 0;
  let cometProgress = 0;
  let cometStart = new THREE.Vector3();
  let cometEnd = new THREE.Vector3();

  function triggerComet() {
    cometActive = true;
    cometProgress = 0;
    const startX = (Math.random() - 0.5) * 30;
    const startY = 10 + Math.random() * 8;
    const startZ = -5 - Math.random() * 15;
    cometStart.set(startX, startY, startZ);
    cometEnd.set(startX + 14 + Math.random() * 8, startY - 12 - Math.random() * 6, startZ);
    cometMat.opacity = 0.85;
  }

  // =========================================================================
  // 4. MOUSE PARALLAX & SCROLL TRACKING
  // =========================================================================
  let mouseTargetX = 0;
  let mouseTargetY = 0;
  let mouseCurrentX = 0;
  let mouseCurrentY = 0;

  function onMouseMove(e) {
    if (prefersReducedMotion) return;
    const nx = (e.clientX / window.innerWidth) * 2 - 1;
    const ny = -(e.clientY / window.innerHeight) * 2 + 1;
    mouseTargetX = nx * 0.12; // 5-8 degrees max tilt
    mouseTargetY = ny * 0.08;
  }
  window.addEventListener('mousemove', onMouseMove, { passive: true });

  let scrollY = 0;
  let maxScroll = 1000;
  function onScroll() {
    scrollY = window.scrollY;
    maxScroll = Math.max(document.body.scrollHeight - window.innerHeight, 1);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Visibility tracking via IntersectionObserver
  let isHeroVisible = true;
  const heroSection = document.getElementById('hero');
  if (heroSection && window.IntersectionObserver) {
    const observer = new IntersectionObserver(
      (entries) => {
        isHeroVisible = entries[0].isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(heroSection);
  }

  // =========================================================================
  // 5. RENDER LOOP
  // =========================================================================
  let lastTime = performance.now();
  let coreRotationY = 0;

  function animate(now) {
    requestAnimationFrame(animate);

    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Skip heavy scene updates if tab is hidden
    if (document.hidden) return;

    // Smooth mouse lerp
    mouseCurrentX += (mouseTargetX - mouseCurrentX) * 0.05;
    mouseCurrentY += (mouseTargetY - mouseCurrentY) * 0.05;

    // Global starfield scroll parallax
    const scrollProgress = scrollY / maxScroll;
    starfield.position.y = scrollY * 0.006;
    starfield.rotation.y = scrollY * 0.0003;

    // Comet lifecycle
    cometTimer += dt;
    if (!cometActive && cometTimer > 6.0 && Math.random() < 0.015) {
      triggerComet();
      cometTimer = 0;
    }
    if (cometActive) {
      cometProgress += dt * 2.2;
      if (cometProgress >= 1.0) {
        cometActive = false;
        cometMat.opacity = 0;
      } else {
        const headX = THREE.MathUtils.lerp(cometStart.x, cometEnd.x, cometProgress);
        const headY = THREE.MathUtils.lerp(cometStart.y, cometEnd.y, cometProgress);
        const headZ = THREE.MathUtils.lerp(cometStart.z, cometEnd.z, cometProgress);

        const tailT = Math.max(0, cometProgress - 0.18);
        const tailX = THREE.MathUtils.lerp(cometStart.x, cometEnd.x, tailT);
        const tailY = THREE.MathUtils.lerp(cometStart.y, cometEnd.y, tailT);
        const tailZ = THREE.MathUtils.lerp(cometStart.z, cometEnd.z, tailT);

        const pos = cometGeom.attributes.position.array;
        pos[0] = tailX; pos[1] = tailY; pos[2] = tailZ;
        pos[3] = headX; pos[4] = headY; pos[5] = headZ;
        cometGeom.attributes.position.needsUpdate = true;
        cometMat.opacity = Math.sin(cometProgress * Math.PI) * 0.9;
      }
    }

    // Hero Galaxy Core update (only if in view)
    if (isHeroVisible) {
      if (!prefersReducedMotion) {
        coreRotationY += dt * 0.28;
        planetMesh.rotation.y = coreRotationY;
        // Ring maintains fixed realistic Saturn tilt angle (~18°) without wobbling

        // Satellites motion
        for (let i = 0; i < satellites.length; i++) {
          const sat = satellites[i];
          sat.angle += dt * sat.speed;
          const sx = Math.cos(sat.angle) * sat.radiusX;
          const sz = Math.sin(sat.angle) * sat.radiusZ;
          const sy = sz * Math.sin(Math.PI * 0.25);
          sat.mesh.position.set(sx, sy, sz * Math.cos(Math.PI * 0.25));
        }
      }

      // Gentle mouse parallax tilt
      galaxyCoreGroup.rotation.y = mouseCurrentX * 0.8;
      galaxyCoreGroup.rotation.x = -mouseCurrentY * 0.6;
    }

    renderer.render(scene, camera);
  }

  requestAnimationFrame(animate);

  // Window resize handler
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);

    const mobileCheck = w < 768;
    galaxyCoreGroup.position.set(mobileCheck ? 0 : 2.8, mobileCheck ? 1.0 : 0.2, 0);
  }
  window.addEventListener('resize', onResize);
}

/**
 * Lightweight 2D canvas fallback if WebGL is unavailable.
 */
function init2DFallback(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const stars = [];
  for (let i = 0; i < 240; i++) {
    stars.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.6 + 0.4,
      alpha: Math.random() * 0.7 + 0.3,
      speed: Math.random() * 0.15 + 0.05,
    });
  }

  function draw() {
    ctx.fillStyle = '#05060F';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const s of stars) {
      s.y -= s.speed;
      if (s.y < 0) s.y = canvas.height;
      ctx.fillStyle = `rgba(248, 250, 252, ${s.alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  draw();
}
