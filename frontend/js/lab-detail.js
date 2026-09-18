import { LAB_ITEMS, buildWhatsAppUrl } from './data.js';

const ICONS = {
  'trending-up': '<path d="M3 17l6-6 4 4 8-8M15 7h6v6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  'bot': '<rect x="4" y="8" width="16" height="12" rx="2" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 8V4m-4 8v2m8-2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="9" cy="14" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/>',
  'book-open': '<path d="M12 6c-2-1.5-5-2-8-1v13c3-1 6-.5 8 1 2-1.5 5-2 8-1V5c-3-1-6-.5-8 1z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
  'download': '<path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  'browse': '<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/><path d="M3 12h18M12 3a15 15 0 010 18 15 15 0 010-18z" stroke="currentColor" stroke-width="2" fill="none"/>',
  'chat': '<path d="M21 11.5a8.5 8.5 0 01-8.5 8.5H4l2-4.5A8.5 8.5 0 1121 11.5z" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>',
  'check': '<path d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
};

function icon(name, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** filled buttons use the item's accent as solid background; outlined
 *  buttons just show a border — same visual language as _ActionButton
 *  in lab_item_detail_page.dart. */
function actionButton({ href, label, iconName, color, filled }) {
  const style = filled
    ? `background:${color}; color:#08090B;`
    : `background:transparent; color:${color}; border:1px solid color-mix(in srgb, ${color} 60%, transparent);`;
  return `
    <a class="btn" style="${style}" href="${href}" target="_blank" rel="noopener">
      ${icon(iconName, 16)} ${escapeHtml(label)}
    </a>`;
}

const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');
const item = LAB_ITEMS.find((i) => i.slug === slug);

const content = document.getElementById('labContent');

if (!item) {
  document.title = 'Item Not Found — Dukion';
  document.getElementById('pageTitle').textContent = 'Item Not Found — Dukion';
  let robotsTag = document.querySelector('meta[name="robots"]');
  if (!robotsTag) {
    robotsTag = document.createElement('meta');
    robotsTag.setAttribute('name', 'robots');
    document.head.appendChild(robotsTag);
  }
  robotsTag.setAttribute('content', 'noindex, nofollow');

  content.innerHTML = `
    <div class="detail-header">
      <h1 class="detail-title">Item not found</h1>
      <p class="detail-tagline">This Trading Lab item may have been removed or the link is out of date.</p>
      <a href="index.html#trading" class="btn btn--primary" style="margin-top: var(--space-6);">Back to Trading Lab</a>
    </div>`;
} else {
  const pageTitle = `${item.title} — Dukion | ${item.category}`;
  const pageDesc = item.description;
  const canonicalUrl = `https://dukion.vercel.app/lab-detail.html?slug=${item.slug}`;

  document.title = pageTitle;
  document.getElementById('pageTitle').textContent = pageTitle;
  document.getElementById('pageDescription')?.setAttribute('content', pageDesc);
  document.getElementById('pageCanonical')?.setAttribute('href', canonicalUrl);
  document.getElementById('pageOgTitle')?.setAttribute('content', pageTitle);
  document.getElementById('pageOgDescription')?.setAttribute('content', pageDesc);
  document.getElementById('pageOgUrl')?.setAttribute('content', canonicalUrl);
  document.getElementById('pageTwTitle')?.setAttribute('content', pageTitle);
  document.getElementById('pageTwDescription')?.setAttribute('content', pageDesc);

  const whatsappUrl = buildWhatsAppUrl({ projectTitle: item.title });

  // Ports the filled/outlined precedence from lab_item_detail_page.dart:
  // Download (always filled if present) -> Browse (filled only if no
  // download) -> WhatsApp/Join (filled only if neither exists above).
  const buttons = [];
  if (item.downloadUrl) {
    buttons.push(actionButton({ href: item.downloadUrl, label: 'Download', iconName: 'download', color: item.color, filled: true }));
  }
  if (item.browseUrl) {
    buttons.push(actionButton({ href: item.browseUrl, label: 'Browse', iconName: 'browse', color: item.color, filled: !item.downloadUrl }));
  }
  buttons.push(actionButton({
    href: whatsappUrl,
    label: item.category === 'Course' ? 'Join the Class' : 'Order via WhatsApp',
    iconName: 'chat',
    color: '#25D366',
    filled: !item.downloadUrl && !item.browseUrl,
  }));

  content.innerHTML = `
    <div class="detail-header">
      <span class="chip" style="background:color-mix(in srgb, ${item.color} 15%, transparent); color:${item.color}; border-color:color-mix(in srgb, ${item.color} 35%, transparent);">${item.category}</span>
      <div style="display:flex; align-items:center; gap: var(--space-4); margin-top: var(--space-5);">
        <div class="icon-tile" style="width:52px; height:52px; background:color-mix(in srgb, ${item.color} 15%, transparent); color:${item.color};">
          ${icon(item.icon, 26)}
        </div>
        <div>
          <h1 style="font-size: var(--text-2xl); font-weight: 800; line-height:1.2;">${escapeHtml(item.title)}</h1>
          <p style="color: var(--color-text-secondary); font-size: var(--text-sm); margin-top: 4px;">${escapeHtml(item.subtitle)}</p>
        </div>
      </div>
      <p class="detail-tagline">${escapeHtml(item.description)}</p>
      <div class="detail-actions">${buttons.join('')}</div>
    </div>

    <div class="detail-section" style="color: ${item.color};">
      <div class="detail-section__label">${escapeHtml(item.highlightsLabel)}</div>
      <div class="detail-highlights" style="color: var(--color-text);">
        ${item.highlights.map((h) => `
          <div class="detail-highlight">
            <span style="color:${item.color}; flex-shrink:0; margin-top:2px;">${icon('check', 18)}</span>
            <span>${escapeHtml(h)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
