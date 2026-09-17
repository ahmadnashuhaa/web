/**
 * main.js
 *
 * DUKION Galaxy 3D Super Epic Landing Page Entrypoint
 * Initializes:
 * 1. Galaxy Forming Loader (coalescing stardust intro)
 * 2. 3D Galaxy Engine (Global starfield + Hero 3D Galaxy Core)
 * 3. Ambient Micro-Cursor (Non-obstructive glowing halo)
 * 4. Navigation & Mobile Drawer
 * 5. Sections Data Rendering (Projects constellation & Trading Lab)
 * 6. Contact Form (WhatsApp prefill generator)
 * 7. Staggered Scroll Reveals
 */

import { initGalaxyLoader } from './galaxy-loader.js';
import { initGalaxyEngine } from './galaxy-engine.js';
import { initGalaxyCursor } from './galaxy-cursor.js';
import { initNavigation } from './navigation.js';
import { initSections } from './sections.js';
import { initContactForm } from './form.js';
import { initScrollReveal } from './scroll-reveal.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Launch Intro Loader
  initGalaxyLoader();

  // 2. Start Global 3D Galaxy Engine
  initGalaxyEngine();

  // 3. Ambient non-obstructive cursor
  initGalaxyCursor();

  // 4. Interface logic
  initNavigation();
  initSections();
  initContactForm();
  initScrollReveal();

  // Flag for successful load
  window.__dsGalaxyReady = true;
});
