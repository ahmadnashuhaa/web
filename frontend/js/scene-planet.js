/**
 * scene-planet.js
 *
 * Dukion Hero 3D Scene "Planet Orbiting a Star"
 * Built with Three.js (WebGL).
 *
 * Core Concept:
 * 1. Central Star (PointLight + emissive core + layered additive corona glow).
 * 2. Shaded Planet (MeshStandardMaterial with day/night terminator facing the star,
 *    procedural sci-fi texture, normal bump map, and atmospheric Fresnel rim glow).
 * 3. Portfolio Waypoints (stations along orbit from PROJECTS & LAB_ITEMS in data.js
 *    that illuminate as the planet passes by).
 * 4. Starfield background with subtle parallax.
 * 5. Camera Dolly-in approaching the planet as scroll progress -> 1.0.
 */

import { PROJECTS, LAB_ITEMS } from './data.js';

/* ==========================================================================
   TUNING CONSTANTS adjust these values freely to tweak scene aesthetics
   ========================================================================== */
export const SCENE_CONFIG = {
  // ---- Orbit Geometry ----
  ORBIT_RADIUS_X: 2.5,          // Semi-major axis (horizontal breadth of orbit)
  ORBIT_RADIUS_Z: 1.8,          // Semi-minor axis (depth of orbit)
  ORBIT_TILT_X: 0.32,           // Orbital plane tilt in radians (~18 degrees)
  ORBIT_TILT_Z: -0.15,          // Slight secondary axial tilt
  ORBIT_TURNS: 1.25,            // Total orbital rotations over 0 -> 1 scroll range

  // ---- Planet Motion & Dimensions ----
  PLANET_RADIUS: 0.52,          // Radius of the orbiting planet
  BASE_SPIN_SPEED: 0.5,         // Continuous self-spin speed (radians/sec)
  SPIN_SCROLL_BOOST: 1.6,       // Multiplier for self-spin when scrolling

  // ---- Central Star ----
  STAR_RADIUS: 0.38,            // Radius of the central star
  STAR_LIGHT_INTENSITY: 2.8,    // PointLight brightness
  STAR_LIGHT_DISTANCE: 14.0,    // PointLight reach distance
  BLOOM_MIN: 1.0,               // Corona glow scale at progress = 0
  BLOOM_MAX: 2.4,               // Corona glow scale at progress = 1 (dramatic finish)

  // ---- Camera Motion (Dolly-in) ----
  CAMERA_FOV: 45,               // Field of view in degrees
  CAMERA_FAR_DIST: 5.6,         // Starting camera distance from target (progress = 0)
  CAMERA_NEAR_DIST: 2.1,        // Final camera distance at climax (progress = 1)
  CAMERA_BASE_Y: 0.75,          // Slight vertical elevation of camera

  // ---- Starfield ----
  STAR_COUNT: 750,              // Background star points (auto-reduced on low-end)
  STAR_FIELD_RADIUS: 30,        // Sphere radius containing stars
};

/* ==========================================================================
   HELPER UTILITIES
   ========================================================================== */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInExpo(t) {
  return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
}

/**
 * Reads CSS color token from :root or fallback.
 */
function getCssColor(varName, fallbackHex) {
  if (typeof window === 'undefined') return fallbackHex;
  const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return val || fallbackHex;
}

/**
 * Generates an offscreen procedural planet texture (dark sci-fi topography,
 * subtle luminescent circuits/veins, and oceanic basins).
 */
function createProceduralPlanetTexture(primaryHex, secondaryHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  // 1. Deep space/ocean base
  const bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  bgGrad.addColorStop(0, '#090b10');
  bgGrad.addColorStop(0.5, '#0e121a');
  bgGrad.addColorStop(1, '#07080c');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 2. Continents / terrain blobs using multi-layered noise-like gradients
  const numContinents = 18;
  for (let i = 0; i < numContinents; i++) {
    const cx = ((i * 137.5) % canvas.width);
    const cy = ((i * 83.1) % (canvas.height * 0.7)) + canvas.height * 0.15;
    const rad = 45 + ((i * 47) % 110);

    const grad = ctx.createRadialGradient(cx, cy, 5, cx, cy, rad);
    grad.addColorStop(0, 'rgba(32, 38, 54, 0.85)');
    grad.addColorStop(0.6, 'rgba(20, 24, 36, 0.65)');
    grad.addColorStop(1, 'rgba(14, 18, 26, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // 3. Tech grid / bioluminescent circuit veins (matching primary & secondary accents)
  ctx.strokeStyle = primaryHex;
  ctx.lineWidth = 1.2;
  ctx.globalAlpha = 0.22;
  for (let y = 60; y < canvas.height - 60; y += 42) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x < canvas.width; x += 36) {
      const offset = ((x * 17 + y * 23) % 24) - 12;
      ctx.lineTo(x, y + offset);
    }
    ctx.stroke();
  }

  ctx.strokeStyle = secondaryHex;
  ctx.lineWidth = 1.0;
  ctx.globalAlpha = 0.18;
  for (let x = 80; x < canvas.width; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    for (let y = 0; y < canvas.height; y += 40) {
      const offset = ((x * 19 + y * 13) % 20) - 10;
      ctx.lineTo(x + offset, y);
    }
    ctx.stroke();
  }

  // 4. Subtle planetary cloud bands
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#ffffff';
  for (let j = 0; j < 5; j++) {
    const bandY = 90 + j * 75;
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, bandY, canvas.width / 2, 18 + j * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1.0;
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Creates atmospheric Fresnel glow shader material for the planet rim.
 */
function createFresnelAtmosphereMaterial(colorHex) {
  const color = new THREE.Color(colorHex);
  return new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: color },
      viewVector: { value: new THREE.Vector3() },
      intensity: { value: 1.4 },
    },
    vertexShader: `
      uniform vec3 viewVector;
      varying float vGlow;
      void main() {
        vec3 vNormal = normalize(normalMatrix * normal);
        vec3 vView = normalize(normalMatrix * viewVector);
        vGlow = pow(0.65 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float intensity;
      varying float vGlow;
      void main() {
        float alpha = clamp(vGlow * intensity, 0.0, 1.0);
        gl_FragColor = vec4(glowColor, alpha * 0.7);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
}

/**
 * Creates an additive corona bloom glow shader for the central star.
 */
function createCoronaGlowMaterial(colorHex) {
  const color = new THREE.Color(colorHex);
  return new THREE.ShaderMaterial({
    uniforms: {
      glowColor: { value: color },
      intensity: { value: 1.0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 glowColor;
      uniform float intensity;
      varying vec3 vNormal;
      void main() {
        float d = dot(vNormal, vec3(0.0, 0.0, 1.0));
        float glow = pow(clamp(d, 0.0, 1.0), 3.0) * intensity;
        gl_FragColor = vec4(glowColor * 1.5, glow * 0.85);
      }
    `,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    transparent: true,
    depthWrite: false,
  });
}

/* ==========================================================================
   MAIN FACTORY: createPlanetScene
   ========================================================================== */
export function createPlanetScene(canvas, options = {}) {
  // 1. WebGL capability check
  if (!window.WebGLRenderingContext) {
    console.warn('[Dukion 3D] WebGLRenderingContext is not supported by browser. Falling back to 2D.');
    return null;
  }
  let gl = null;
  try {
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  } catch (e) {
    console.warn('[Dukion 3D] Failed to obtain WebGL context:', e);
    return null;
  }
  if (!gl) {
    console.warn('[Dukion 3D] WebGL context unavailable on canvas. Falling back to 2D.');
    return null;
  }

  // 2. Hardware profile detection
  const isLowEnd = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || window.innerWidth < 768;
  const sphereSegments = isLowEnd ? 24 : 36;
  const starCount = isLowEnd ? 350 : SCENE_CONFIG.STAR_COUNT;
  const prefersReducedMotion = !!options.prefersReducedMotion;

  // 3. Theme color extraction
  const primaryColorHex = getCssColor('--color-primary', '#6C63FF');
  const secondaryColorHex = getCssColor('--color-secondary', '#00E5FF');
  const primaryColor = new THREE.Color(primaryColorHex);
  const secondaryColor = new THREE.Color(secondaryColorHex);

  // 4. Renderer setup
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let renderer = null;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl,
      antialias: !isLowEnd,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (err) {
    console.warn('[Dukion 3D] WebGLRenderer creation failed:', err);
    return null;
  }

  renderer.setPixelRatio(dpr);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  // 5. Scene & Camera
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    SCENE_CONFIG.CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(0, SCENE_CONFIG.CAMERA_BASE_Y, SCENE_CONFIG.CAMERA_FAR_DIST);

  // 6. Central Star
  // Star core (emissive, self-luminous)
  const starGeom = new THREE.SphereGeometry(SCENE_CONFIG.STAR_RADIUS, sphereSegments, sphereSegments);
  const starMat = new THREE.MeshBasicMaterial({
    color: primaryColor,
  });
  const starMesh = new THREE.Mesh(starGeom, starMat);
  scene.add(starMesh);

  // Star PointLight (illuminates the planet as the primary solar light source)
  const starLight = new THREE.PointLight(
    primaryColor,
    SCENE_CONFIG.STAR_LIGHT_INTENSITY,
    SCENE_CONFIG.STAR_LIGHT_DISTANCE,
    1.4
  );
  starLight.position.set(0, 0, 0);
  scene.add(starLight);

  // Ambient fill light (very subtle, so dark side stays dark like in space)
  const ambientLight = new THREE.AmbientLight(0x0f1118, 0.45);
  scene.add(ambientLight);

  // Multi-layered corona glow around star
  const coronaMat = createCoronaGlowMaterial(primaryColorHex);
  const coronaGeom = new THREE.SphereGeometry(SCENE_CONFIG.STAR_RADIUS * 1.7, 24, 24);
  const coronaMesh = new THREE.Mesh(coronaGeom, coronaMat);
  scene.add(coronaMesh);

  // Outer secondary corona halo
  const outerCoronaMat = createCoronaGlowMaterial(secondaryColorHex);
  const outerCoronaGeom = new THREE.SphereGeometry(SCENE_CONFIG.STAR_RADIUS * 2.5, 20, 20);
  const outerCoronaMesh = new THREE.Mesh(outerCoronaGeom, outerCoronaMat);
  scene.add(outerCoronaMesh);

  // 7. Planet & Atmosphere
  const planetGeom = new THREE.SphereGeometry(SCENE_CONFIG.PLANET_RADIUS, sphereSegments, sphereSegments);
  const planetTexture = createProceduralPlanetTexture(primaryColorHex, secondaryColorHex);
  const planetMat = new THREE.MeshStandardMaterial({
    map: planetTexture,
    roughness: 0.78,
    metalness: 0.22,
    bumpMap: planetTexture,
    bumpScale: 0.015,
  });
  const planetMesh = new THREE.Mesh(planetGeom, planetMat);
  scene.add(planetMesh);

  // Atmospheric rim-glow mesh (Fresnel)
  const atmosphereMat = createFresnelAtmosphereMaterial(primaryColorHex);
  const atmosphereGeom = new THREE.SphereGeometry(SCENE_CONFIG.PLANET_RADIUS * 1.06, sphereSegments, sphereSegments);
  const atmosphereMesh = new THREE.Mesh(atmosphereGeom, atmosphereMat);
  planetMesh.add(atmosphereMesh);

  // 8. Orbit Track Line
  const orbitCurvePoints = [];
  const ORBIT_SEGMENTS = 96;
  for (let i = 0; i <= ORBIT_SEGMENTS; i++) {
    const theta = (i / ORBIT_SEGMENTS) * Math.PI * 2;
    const x = Math.cos(theta) * SCENE_CONFIG.ORBIT_RADIUS_X;
    const z = Math.sin(theta) * SCENE_CONFIG.ORBIT_RADIUS_Z;
    // Apply orbital plane tilt
    const tiltedY = z * Math.sin(SCENE_CONFIG.ORBIT_TILT_X);
    const tiltedZ = z * Math.cos(SCENE_CONFIG.ORBIT_TILT_X);
    orbitCurvePoints.push(new THREE.Vector3(x, tiltedY, tiltedZ));
  }
  const orbitTrackGeom = new THREE.BufferGeometry().setFromPoints(orbitCurvePoints);
  const orbitTrackMat = new THREE.LineBasicMaterial({
    color: primaryColor,
    transparent: true,
    opacity: 0.16,
  });
  const orbitTrackLine = new THREE.Line(orbitTrackGeom, orbitTrackMat);
  scene.add(orbitTrackLine);

  // 9. Portfolio Waypoints along Orbit
  const waypointsData = [
    ...(PROJECTS || []).map((p) => ({ title: p.title, category: p.category, type: 'project' })),
    ...(LAB_ITEMS || []).map((l) => ({ title: l.title, category: l.category, type: 'lab' })),
  ];
  const totalWaypoints = Math.max(waypointsData.length, 6);
  const waypointObjects = [];

  const waypointDotGeom = new THREE.SphereGeometry(0.045, 12, 12);
  const waypointRingGeom = new THREE.RingGeometry(0.065, 0.085, 18);

  for (let i = 0; i < totalWaypoints; i++) {
    const angle = (i / totalWaypoints) * Math.PI * 2;
    const wx = Math.cos(angle) * SCENE_CONFIG.ORBIT_RADIUS_X;
    const wz = Math.sin(angle) * SCENE_CONFIG.ORBIT_RADIUS_Z;
    const wy = wz * Math.sin(SCENE_CONFIG.ORBIT_TILT_X);
    const wzTilted = wz * Math.cos(SCENE_CONFIG.ORBIT_TILT_X);

    const isDesign = i % 2 === 0;
    const wpColor = isDesign ? primaryColor : secondaryColor;

    // Beacon center dot
    const wpMat = new THREE.MeshBasicMaterial({
      color: wpColor,
      transparent: true,
      opacity: 0.45,
    });
    const wpMesh = new THREE.Mesh(waypointDotGeom, wpMat);
    wpMesh.position.set(wx, wy, wzTilted);

    // Pulse ring around beacon
    const ringMat = new THREE.MeshBasicMaterial({
      color: wpColor,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const ringMesh = new THREE.Mesh(waypointRingGeom, ringMat);
    ringMesh.position.copy(wpMesh.position);
    ringMesh.lookAt(0, 0, 0);

    scene.add(wpMesh);
    scene.add(ringMesh);

    waypointObjects.push({
      angle,
      mesh: wpMesh,
      ring: ringMesh,
      mat: wpMat,
      ringMat: ringMat,
      baseColor: wpColor,
    });
  }

  // 10. Background Starfield
  const starfieldGeom = new THREE.BufferGeometry();
  const starPositions = new Float32Array(starCount * 3);
  const starColors = new Float32Array(starCount * 3);

  for (let i = 0; i < starCount; i++) {
    const idx = i * 3;
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = SCENE_CONFIG.STAR_FIELD_RADIUS * (0.6 + 0.4 * Math.random());

    starPositions[idx] = r * Math.sin(phi) * Math.cos(theta);
    starPositions[idx + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[idx + 2] = r * Math.cos(phi);

    const tintChoice = Math.random();
    if (tintChoice > 0.85) {
      starColors[idx] = primaryColor.r;
      starColors[idx + 1] = primaryColor.g;
      starColors[idx + 2] = primaryColor.b;
    } else if (tintChoice > 0.7) {
      starColors[idx] = secondaryColor.r;
      starColors[idx + 1] = secondaryColor.g;
      starColors[idx + 2] = secondaryColor.b;
    } else {
      starColors[idx] = 0.9;
      starColors[idx + 1] = 0.92;
      starColors[idx + 2] = 1.0;
    }
  }

  starfieldGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starfieldGeom.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

  const starfieldMat = new THREE.PointsMaterial({
    size: 0.14,
    vertexColors: true,
    transparent: true,
    opacity: 0.8,
  });
  const starfield = new THREE.Points(starfieldGeom, starfieldMat);
  scene.add(starfield);

  // 11. State variables
  let planetSelfSpin = 0;
  let autoOrbitTime = 0;

  /* ==========================================================================
     UPDATE LOOP (called every frame from animations.js)
     ========================================================================== */
  function update(progress, dt) {
    // 1. Orbit Position calculation
    const scrollAngle = progress * SCENE_CONFIG.ORBIT_TURNS * Math.PI * 2;

    if (!prefersReducedMotion) {
      autoOrbitTime += dt * 0.08;
      planetSelfSpin += dt * SCENE_CONFIG.BASE_SPIN_SPEED * (1 + progress * SCENE_CONFIG.SPIN_SCROLL_BOOST);
    }

    const currentOrbitAngle = scrollAngle + autoOrbitTime;
    const ox = Math.cos(currentOrbitAngle) * SCENE_CONFIG.ORBIT_RADIUS_X;
    const oz = Math.sin(currentOrbitAngle) * SCENE_CONFIG.ORBIT_RADIUS_Z;
    const oy = oz * Math.sin(SCENE_CONFIG.ORBIT_TILT_X);
    const ozTilted = oz * Math.cos(SCENE_CONFIG.ORBIT_TILT_X);

    planetMesh.position.set(ox, oy, ozTilted);

    // Planet rotation on its own axis
    planetMesh.rotation.y = planetSelfSpin;
    planetMesh.rotation.x = SCENE_CONFIG.ORBIT_TILT_X * 0.7;

    // Update Fresnel atmosphere view vector
    atmosphereMat.uniforms.viewVector.value.subVectors(camera.position, planetMesh.position);

    // 2. Star Bloom / Corona scaling
    const bloomScale = lerp(SCENE_CONFIG.BLOOM_MIN, SCENE_CONFIG.BLOOM_MAX, progress);
    coronaMesh.scale.setScalar(bloomScale);
    outerCoronaMesh.scale.setScalar(bloomScale * 1.15);
    coronaMat.uniforms.intensity.value = 1.0 + progress * 0.7;
    outerCoronaMat.uniforms.intensity.value = 0.8 + progress * 0.5;

    // 3. Portfolio Waypoint proximity illumination
    const normalizedPlanetAngle = ((currentOrbitAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    for (let i = 0; i < waypointObjects.length; i++) {
      const wp = waypointObjects[i];
      const diff = Math.abs(normalizedPlanetAngle - wp.angle);
      const angleDistance = Math.min(diff, Math.PI * 2 - diff);

      if (angleDistance < 0.35) {
        const proximity = 1.0 - angleDistance / 0.35;
        const pulse = 1.0 + Math.sin(Date.now() * 0.008) * 0.25;
        wp.mat.opacity = lerp(0.45, 1.0, proximity);
        wp.ringMat.opacity = lerp(0.3, 0.9, proximity);
        wp.ring.scale.setScalar(1.0 + proximity * 0.8 * pulse);
        wp.mesh.scale.setScalar(1.0 + proximity * 0.5);
      } else {
        wp.mat.opacity = 0.35;
        wp.ringMat.opacity = 0.18;
        wp.ring.scale.setScalar(1.0);
        wp.mesh.scale.setScalar(1.0);
      }
    }

    // 4. Camera Dolly-in approaching the planet
    const dollyT = easeInExpo(progress);
    const cameraDist = lerp(SCENE_CONFIG.CAMERA_FAR_DIST, SCENE_CONFIG.CAMERA_NEAR_DIST, dollyT);

    const targetX = lerp(0, planetMesh.position.x * 0.7, dollyT);
    const targetY = lerp(0, planetMesh.position.y * 0.7, dollyT);
    const targetZ = lerp(0, planetMesh.position.z * 0.7, dollyT);

    camera.position.x = Math.sin(progress * 0.8) * 0.8;
    camera.position.y = SCENE_CONFIG.CAMERA_BASE_Y + Math.sin(progress * 1.2) * 0.3;
    camera.position.z = cameraDist;
    camera.lookAt(targetX, targetY, targetZ);

    // 5. Starfield subtle parallax
    starfield.rotation.y = progress * 0.12 + autoOrbitTime * 0.02;
    starfield.rotation.x = progress * 0.06;

    // Render frame
    renderer.render(scene, camera);
  }

  /* ==========================================================================
     RESIZE HANDLER
     ========================================================================== */
  function resize(w, h) {
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }

  /* ==========================================================================
     CLEANUP
     ========================================================================== */
  function dispose() {
    planetGeom.dispose();
    planetMat.dispose();
    planetTexture.dispose();
    atmosphereGeom.dispose();
    atmosphereMat.dispose();
    starGeom.dispose();
    starMat.dispose();
    coronaGeom.dispose();
    coronaMat.dispose();
    outerCoronaGeom.dispose();
    outerCoronaMat.dispose();
    orbitTrackGeom.dispose();
    orbitTrackMat.dispose();
    waypointDotGeom.dispose();
    waypointRingGeom.dispose();
    starfieldGeom.dispose();
    starfieldMat.dispose();
    renderer.dispose();
  }

  return {
    update,
    resize,
    dispose,
  };
}
