/**
 * galaxy-cursor.js
 *
 * Non-obstructive ambient micro-glow cursor.
 * - 22px subtle halo with mix-blend-mode: screen and pointer-events: none.
 * - Will NEVER cover or obstruct text or buttons.
 * - Auto-disabled on touch devices / tablets.
 */

export function initGalaxyCursor() {
  // Disable on touch devices or reduced motion
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(hover: none)').matches) return;

  const cursor = document.getElementById('cursorGlow');
  if (!cursor) return;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let currentX = mouseX;
  let currentY = mouseY;
  let isHoveringInteractive = false;

  cursor.style.display = 'block';

  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });

  // Detect interactive elements to gently pulse cursor
  document.addEventListener('mouseover', (e) => {
    const target = e.target;
    if (
      target.closest('a, button, .card, .chip, .pillar-card, .service-card, .project-card, .edu-tile, input, textarea')
    ) {
      isHoveringInteractive = true;
      cursor.classList.add('cursor--interactive');
    }
  }, { passive: true });

  document.addEventListener('mouseout', (e) => {
    const target = e.target;
    if (
      target.closest('a, button, .card, .chip, .pillar-card, .service-card, .project-card, .edu-tile, input, textarea')
    ) {
      isHoveringInteractive = false;
      cursor.classList.remove('cursor--interactive');
    }
  }, { passive: true });

  function render() {
    // Smooth lerp (stiffness ~ 0.2)
    currentX += (mouseX - currentX) * 0.2;
    currentY += (mouseY - currentY) * 0.2;

    cursor.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) translate(-50%, -50%)`;

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}
