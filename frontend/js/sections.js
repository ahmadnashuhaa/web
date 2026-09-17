/**
 * sections.js
 *
 * Renders data-driven sections (Featured Projects, Trading Lab) from js/data.js
 * with the new Galaxy / Constellation card styling and category color coding.
 */

import { PROJECTS, LAB_ITEMS } from './data.js';
import { refreshScrollReveal } from './scroll-reveal.js';

const ICONS = {
  'download': '<path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  'browse': '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M3 12h18M12 3a15 15 0 010 18 15 15 0 010-18z" stroke="currentColor" stroke-width="2" fill="none"/>',
  'arrow': '<path d="M5 12h14m0 0l-6-6m6 6l-6 6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  'trending-up': '<path d="M3 17l6-6 4 4 8-8M15 7h6v6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  'bot': '<rect x="4" y="8" width="16" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 8V4m-4 8v2m8-2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/>',
  'book-open': '<path d="M12 6c-2-1.5-5-2-8-1v13c3-1 6-.5 8 1 2-1.5 5-2 8-1V5c-3-1-6-.5-8 1z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
};

function icon(name, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getCategoryClass(cat) {
  if (cat === 'Apps') return 'chip--violet';
  if (cat === 'Trading') return 'chip--cyan';
  if (cat === 'Design') return 'chip--magenta';
  return 'chip--gold';
}

/* ---- Featured Projects ("Constellation of Work") ---- */
function renderProjects(filter) {
  const container = document.getElementById('projectScroller');
  if (!container) return;

  const visible = filter === 'All' ? PROJECTS : PROJECTS.filter((p) => p.category === filter);

  container.innerHTML = visible.map((p) => {
    const chipClass = getCategoryClass(p.category);
    return `
      <a class="project-card reveal" href="project-detail.html?slug=${p.slug}">
        <div class="project-card__image-wrap">
          <img class="project-card__img" src="${p.imageUrl}" alt="${escapeHtml(p.title)} preview" loading="lazy" />
          <span class="chip ${chipClass} project-card__badge">${p.category}</span>
        </div>
        <div class="project-card__body">
          <h3 class="project-card__title">${escapeHtml(p.title)}</h3>
          <p class="project-card__tagline">${escapeHtml(p.tagline)}</p>
          <div class="project-card__tech">
            ${p.techStack.map(t => `<span class="tech-tag">${escapeHtml(t)}</span>`).join('')}
          </div>
          <span class="project-card__link">View Project ${icon('arrow', 14)}</span>
        </div>
      </a>
    `;
  }).join('');

  refreshScrollReveal();
}

function initProjectsSection() {
  const filterRow = document.getElementById('projectFilters');
  if (!filterRow) return;

  renderProjects('All');

  filterRow.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-filter]');
    if (!btn) return;
    filterRow.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    renderProjects(btn.dataset.filter);
  });

  const viewAll = document.getElementById('viewAllProjects');
  viewAll?.addEventListener('click', (event) => {
    event.preventDefault();
    filterRow.querySelectorAll('[data-filter]').forEach((b) =>
      b.setAttribute('aria-pressed', b.dataset.filter === 'All' ? 'true' : 'false')
    );
    renderProjects('All');
  });
}

/* ---- Trading Lab Items ---- */
function renderLabItems() {
  const grid = document.getElementById('labGrid');
  if (!grid) return;

  grid.innerHTML = LAB_ITEMS.map((item) => `
    <div class="lab-card reveal" tabindex="0" role="link" data-href="lab-detail.html?slug=${item.slug}">
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div class="icon-tile icon-tile--cyan">
          ${icon(item.icon, 22)}
        </div>
        <span class="chip chip--cyan">${escapeHtml(item.category)}</span>
      </div>
      <h3 class="lab-card__title">${escapeHtml(item.title)}</h3>
      <p class="lab-card__desc">${escapeHtml(item.description)}</p>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: var(--space-3); border-top: 1px solid var(--color-border);">
        <span style="font-size: var(--text-xs); color: var(--color-cyan); font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
          Explore Tool ${icon('arrow', 13)}
        </span>
        <div style="display: flex; gap: var(--space-2);" onclick="event.stopPropagation()">
          ${item.downloadUrl ? `<a href="${item.downloadUrl}" target="_blank" rel="noopener" style="color: var(--color-text-secondary);" title="Download">${icon('download', 18)}</a>` : ''}
          ${item.browseUrl ? `<a href="${item.browseUrl}" target="_blank" rel="noopener" style="color: var(--color-text-secondary);" title="Browse">${icon('browse', 18)}</a>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  refreshScrollReveal();

  grid.querySelectorAll('[data-href]').forEach((card) => {
    const go = () => { window.location.href = card.dataset.href; };
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });
}

export function initSections() {
  initProjectsSection();
  renderLabItems();
}
