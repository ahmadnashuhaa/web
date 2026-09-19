import { PROJECTS, buildWhatsAppUrl } from './data.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

const params = new URLSearchParams(window.location.search);
const slug = params.get('slug');
const project = PROJECTS.find((p) => p.slug === slug);

const content = document.getElementById('projectContent');

if (!project) {
  document.title = 'Project Not Found Dukion';
  document.getElementById('pageTitle').textContent = 'Project Not Found Dukion';
  let robotsTag = document.querySelector('meta[name="robots"]');
  if (!robotsTag) {
    robotsTag = document.createElement('meta');
    robotsTag.setAttribute('name', 'robots');
    document.head.appendChild(robotsTag);
  }
  robotsTag.setAttribute('content', 'noindex, nofollow');

  content.innerHTML = `
    <div class="detail-header">
      <h1 class="detail-title">Project not found</h1>
      <p class="detail-tagline">This project may have been removed or the link is out of date.</p>
      <a href="index.html#projects" class="btn btn--primary" style="margin-top: var(--space-6);">Back to Projects</a>
    </div>`;
} else {
  const pageTitle = `${project.title} Dukion | ${project.category}`;
  const pageDesc = project.tagline;
  const canonicalUrl = `https://dukion.vercel.app/project-detail.html?slug=${project.slug}`;

  document.title = pageTitle;
  document.getElementById('pageTitle').textContent = pageTitle;
  document.getElementById('pageDescription')?.setAttribute('content', pageDesc);
  document.getElementById('pageCanonical')?.setAttribute('href', canonicalUrl);
  document.getElementById('pageOgTitle')?.setAttribute('content', pageTitle);
  document.getElementById('pageOgDescription')?.setAttribute('content', pageDesc);
  document.getElementById('pageOgUrl')?.setAttribute('content', canonicalUrl);
  document.getElementById('pageTwTitle')?.setAttribute('content', pageTitle);
  document.getElementById('pageTwDescription')?.setAttribute('content', pageDesc);

  const whatsappUrl = buildWhatsAppUrl({ projectTitle: project.title });

  content.innerHTML = `
    <div class="detail-header">
      <span class="chip" style="background:color-mix(in srgb, ${project.color} 15%, transparent); color:${project.color}; border-color:color-mix(in srgb, ${project.color} 35%, transparent);">${project.category}</span>
      <h1 class="detail-title">${escapeHtml(project.title)}</h1>
      <p class="detail-tagline">${escapeHtml(project.tagline)}</p>
      <div class="detail-techstack">
        ${project.techStack.map((t) => `<span class="chip" style="color: var(--color-text-secondary); background: var(--color-surface-elevated); border-color: var(--color-border);">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div class="detail-actions">
        ${project.downloadUrl ? `<a class="btn btn--primary" style="background:${project.color};" href="${project.downloadUrl}" target="_blank" rel="noopener">Download Project</a>` : ''}
        <a class="btn ${project.downloadUrl ? 'btn--secondary' : 'btn--whatsapp'}" href="${whatsappUrl}" target="_blank" rel="noopener">Order via WhatsApp</a>
      </div>
    </div>

    <div class="detail-hero-image">
      <img src="${project.imageUrl}" alt="${escapeHtml(project.title)} preview" />
    </div>

    <div class="detail-section" style="color: ${project.color};">
      <div class="detail-section__label">Problem</div>
      <p class="detail-section__body">${escapeHtml(project.problem)}</p>
    </div>

    <div class="detail-section" style="color: ${project.color};">
      <div class="detail-section__label">Solution</div>
      <p class="detail-section__body">${escapeHtml(project.solution)}</p>
    </div>

    <div class="detail-section" style="color: ${project.color};">
      <div class="detail-section__label">Features</div>
      <div class="detail-highlights" style="color: var(--color-text);">
        ${project.features.map((f) => `
          <div class="detail-highlight">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true" style="flex-shrink:0; margin-top:2px; color:${project.color};"><path d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <span>${escapeHtml(f)}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card detail-cta-box">
      <div class="detail-cta-box__title">Want something like this?</div>
      <p class="detail-cta-box__text">Tell me what you're building I'll get back to you with an estimate.</p>
      <a class="btn btn--primary" style="background:${project.color};" href="${whatsappUrl}" target="_blank" rel="noopener">Order via WhatsApp</a>
    </div>
  `;
}
