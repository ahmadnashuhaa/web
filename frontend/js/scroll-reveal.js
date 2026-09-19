/**
 * scroll-reveal.js
 * Adopts the scroll-triggered reveal pattern from the Finpay reference:
 * section headers and cards fade + lift in as they cross into view,
 * instead of all being visible immediately on load. Kept subtle and
 * fast (see --duration-slow) rather than a dramatic entrance per the
 * "less but better" direction, this is a polish detail, not a feature.
 *
 * Usage: add class="reveal" to any element. Elements inside a
 * container with class="reveal-group" get a small staggered delay
 * based on their index, so e.g. a row of cards doesn't pop in as one
 * flat block.
 */

let observer = null;

export function initScrollReveal(root = document) {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const targets = root.querySelectorAll('.reveal:not(.is-visible)');

  if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );
  }

  targets.forEach((el, i) => {
    const group = el.closest('.reveal-group');
    if (group) {
      const siblings = Array.from(group.querySelectorAll('.reveal'));
      const index = siblings.indexOf(el);
      el.style.transitionDelay = `${Math.min(index, 6) * 110}ms`;
    }
    observer.observe(el);
  });
}

/** Re-scan for new .reveal elements after dynamic content is injected
 *  (e.g. project/lab cards rendered by sections.js). */
export function refreshScrollReveal() {
  initScrollReveal(document);
}
