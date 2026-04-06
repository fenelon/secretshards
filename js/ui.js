/**
 * ui.js — Shared UI helpers for the Shamir Secret Sharing web app.
 *
 * Provides inline error display, accessibility announcements, and tooltips.
 * Attaches to SSS.UI for use by other modules.
 *
 * SECURITY: Never uses innerHTML. All DOM construction uses createElement,
 * textContent, and appendChild.
 */
(function () {
  'use strict';

  if (!window.SSS) window.SSS = {};

  const ariaStatus = document.getElementById('aria-status');

  function showInlineError(el, message) {
    el.textContent = message;
    el.removeAttribute('hidden');
  }

  function clearInlineError(el) {
    el.textContent = '';
    el.setAttribute('hidden', '');
  }

  function announce(message) {
    if (ariaStatus) ariaStatus.textContent = message;
  }

  function showTooltip(anchor, message) {
    const tip = document.createElement('span');
    tip.className = 'copied-tooltip';
    tip.textContent = message;
    anchor.appendChild(tip);
    setTimeout(function () {
      if (tip.parentNode) {
        tip.parentNode.removeChild(tip);
      }
    }, 1500);
  }

  window.SSS.UI = {
    showInlineError: showInlineError,
    clearInlineError: clearInlineError,
    announce: announce,
    showTooltip: showTooltip,
  };
})();
