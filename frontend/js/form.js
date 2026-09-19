/**
 * form.js
 * Ports contact_section.dart's _ContactSectionState:
 *  - `need` chip is required, `budget` chip is optional
 *  - selecting a need clears the error state
 *  - submit builds a WhatsApp deep link via buildWhatsAppUrl (same shape
 *    as launch_helper.dart's openWhatsAppOrder)
 * Also posts to /api/contact for server-side record-keeping the
 * Flutter version had no backend, so this is additive, not a behavior
 * change; WhatsApp still opens even if the request fails.
 */

import { buildWhatsAppUrl } from './data.js';

export function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const needGroup = document.getElementById('needGroup');
  const needLabel = document.getElementById('needLabel');
  const needRequiredTag = document.getElementById('needRequiredTag');
  const budgetGroup = document.getElementById('budgetGroup');
  const description = document.getElementById('descriptionInput');
  const submitBtn = document.getElementById('contactSubmit');
  const feedback = document.getElementById('formFeedback');

  let selectedNeed = null;
  let selectedBudget = null;

  function selectChip(group, value, onSelect) {
    group.querySelectorAll('[data-value]').forEach((chip) => {
      const isSelected = chip.dataset.value === value;
      chip.setAttribute('aria-pressed', String(isSelected));
    });
    onSelect(value);
  }

  needGroup.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-value]');
    if (!chip) return;
    selectedNeed = chip.dataset.value;
    selectChip(needGroup, selectedNeed, () => {});
    clearNeedError();
  });

  budgetGroup.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-value]');
    if (!chip) return;
    selectedBudget = chip.dataset.value;
    selectChip(budgetGroup, selectedBudget, () => {});
  });

  function showNeedError() {
    needLabel.classList.add('form-label--error');
    needRequiredTag.hidden = false;
    needGroup.classList.add('form-error-box');
    showFeedback('error', 'Please select what you need first.');
  }

  function clearNeedError() {
    needLabel.classList.remove('form-label--error');
    needRequiredTag.hidden = true;
    needGroup.classList.remove('form-error-box');
  }

  function showFeedback(type, message) {
    feedback.textContent = message;
    feedback.className = `form-feedback form-feedback--${type}`;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!selectedNeed) {
      showNeedError();
      return;
    }

    submitBtn.classList.add('btn--loading');
    submitBtn.setAttribute('aria-disabled', 'true');

    const payload = {
      need: selectedNeed,
      budget: selectedBudget || '',
      description: description.value,
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Request failed');
      showFeedback('success', "Got it opening WhatsApp with your details prefilled.");
    } catch (err) {
      // Backend not reachable (e.g. running via Live Server without Flask)
      // don't block the user, WhatsApp is the actual point of contact.
      console.warn('[Dukion] /api/contact request failed, continuing to WhatsApp anyway.', err);
    } finally {
      submitBtn.classList.remove('btn--loading');
      submitBtn.removeAttribute('aria-disabled');
    }

    window.open(buildWhatsAppUrl(payload), '_blank', 'noopener');
  });
}
