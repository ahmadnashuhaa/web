/**
 * galaxy-loader.js
 *
 * "Galaxy Forming" Intro Screen
 * Cosmic particles coalesce into the glowing DUKION emblem (~1.2s), then
 * smoothly dissolve to reveal the galactic landing page.
 * Auto-skips if already visited in this session, or on user click/tap.
 */

export function initGalaxyLoader() {
  const loaderEl = document.getElementById('galaxyLoader');
  if (!loaderEl) return;

  // Skip if already seen this session or user requested reduced motion
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const alreadyVisited = sessionStorage.getItem('dukion_galaxy_visited');

  function dismissLoader() {
    loaderEl.classList.add('loader--hidden');
    setTimeout(() => {
      if (loaderEl.parentNode) {
        loaderEl.style.display = 'none';
      }
    }, 600);
    sessionStorage.setItem('dukion_galaxy_visited', 'true');
  }

  if (alreadyVisited || prefersReduced) {
    dismissLoader();
    return;
  }

  // Allow clicking anywhere to skip
  loaderEl.addEventListener('click', dismissLoader);

  const canvas = document.getElementById('loaderCanvas');
  if (!canvas) {
    setTimeout(dismissLoader, 800);
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    setTimeout(dismissLoader, 800);
    return;
  }

  const w = (canvas.width = window.innerWidth);
  const h = (canvas.height = window.innerHeight);
  const cx = w / 2;
  const cy = h / 2;

  // Generate targets forming the "DUKION" letters via offscreen render
  const offCanvas = document.createElement('canvas');
  offCanvas.width = 600;
  offCanvas.height = 160;
  const offCtx = offCanvas.getContext('2d');
  offCtx.fillStyle = '#FFFFFF';
  offCtx.font = '900 64px "Space Grotesk", sans-serif';
  offCtx.textAlign = 'center';
  offCtx.textBaseline = 'middle';
  offCtx.fillText('DUKION', 300, 80);

  const imgData = offCtx.getImageData(0, 0, 600, 160);
  const targets = [];
  const step = 6;
  for (let y = 0; y < 160; y += step) {
    for (let x = 0; x < 600; x += step) {
      const idx = (y * 600 + x) * 4;
      if (imgData.data[idx + 3] > 128) {
        targets.push({
          x: cx + (x - 300),
          y: cy + (y - 80),
        });
      }
    }
  }

  // Particle swarm
  const particles = [];
  const count = Math.min(targets.length, 360);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 300 + Math.random() * 450;
    particles.push({
      x: cx + Math.cos(angle) * dist,
      y: cy + Math.sin(angle) * dist,
      tx: targets[i % targets.length].x,
      ty: targets[i % targets.length].y,
      vx: 0,
      vy: 0,
      size: Math.random() * 2.2 + 1.2,
      color: i % 3 === 0 ? '#22D3EE' : i % 3 === 1 ? '#7C3AED' : '#F8FAFC',
    });
  }

  let startTime = performance.now();
  const DURATION = 1300; // 1.3 seconds max

  function frame(now) {
    const elapsed = now - startTime;
    const t = Math.min(elapsed / DURATION, 1.0);

    ctx.clearRect(0, 0, w, h);

    // Coalescing spring motion
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += (p.tx - p.x) * (0.04 + ease * 0.08);
      p.y += (p.ty - p.y) * (0.04 + ease * 0.08);

      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    if (t < 1.0) {
      requestAnimationFrame(frame);
    } else {
      setTimeout(dismissLoader, 150);
    }
  }

  requestAnimationFrame(frame);
}
