/**
 * navigation.js
 * Ports app_navbar.dart:
 *  - navbar background/border fades in once scrollY > 40 (was `controller.offset > 40`)
 *  - active nav link reflects the section currently in view
 *  - mobile menu open/close with focus handling
 * Ports _scrollToSection from scroll_experience.dart:
 *  - 500ms, Curves.easeInOutCubic scroll-to-section (not the browser
 *    default `scroll-behavior: smooth`, which has no fixed duration/easing
 *    and would feel inconsistent with the rest of the hand-tuned motion).
 */

const SCROLL_THRESHOLD = 40;
const SCROLL_TO_DURATION = 500;

// Curves.easeInOutCubic equivalent
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function scrollToSection(sectionId) {
  const target = document.getElementById(sectionId);
  if (!target) return;

  const startY = window.scrollY;
  const endY = startY + target.getBoundingClientRect().top;
  const startTime = performance.now();

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    window.scrollTo(0, endY);
    return;
  }

  function step(now) {
    const elapsed = clamp01((now - startTime) / SCROLL_TO_DURATION);
    const eased = easeInOutCubic(elapsed);
    window.scrollTo(0, startY + (endY - startY) * eased);
    if (elapsed < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function initNavigation() {
  const navbar = document.getElementById('navbar');
  const menuToggle = document.getElementById('menuToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const navLinks = document.querySelectorAll('[data-nav-link]');
  const sections = document.querySelectorAll('main section[id]');

  if (!navbar) return;

  // ---- Scrolled state (mirrors AnimatedBuilder + controller.offset > 40) ----
  const onScroll = () => {
    navbar.classList.toggle('navbar--scrolled', window.scrollY > SCROLL_THRESHOLD);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- Active link tracking via IntersectionObserver ----
  if ('IntersectionObserver' in window && sections.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = entry.target.id;
          navLinks.forEach((link) => {
            const isMatch = link.getAttribute('href') === `#${id}`;
            link.setAttribute('aria-current', isMatch ? 'true' : 'false');
          });
        });
      },
      { rootMargin: '-45% 0px -45% 0px' }
    );
    sections.forEach((section) => observer.observe(section));
  }

  // ---- Mobile menu (ports showModalBottomSheet behavior) ----
  const openMenu = () => {
    mobileMenu.dataset.open = 'true';
    menuToggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    mobileMenu.querySelector('a')?.focus();
  };

  const closeMenu = () => {
    mobileMenu.dataset.open = 'false';
    menuToggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    menuToggle.focus();
  };

  menuToggle?.addEventListener('click', () => {
    const isOpen = mobileMenu.dataset.open === 'true';
    isOpen ? closeMenu() : openMenu();
  });

  mobileMenu?.querySelectorAll('[data-nav-link]').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  // ---- Wire every data-nav-link to the eased scroll-to-section ----
  document.querySelectorAll('[data-nav-link]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const sectionId = link.dataset.section;
      if (!sectionId) return;
      event.preventDefault();
      scrollToSection(sectionId);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && mobileMenu.dataset.open === 'true') {
      closeMenu();
    }
  });
}
