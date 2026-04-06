/**
 * app.js — Mode toggle and download link wiring.
 *
 * Loaded after ui.js, split.js, and combine.js.
 */
(function () {
  'use strict';

  // Mode toggle
  const modeSplit      = document.getElementById('mode-split');
  const modeCombine    = document.getElementById('mode-combine');
  const sectionSplit   = document.getElementById('section-split');
  const sectionCombine = document.getElementById('section-combine');

  modeSplit.addEventListener('click', function (e) {
    e.preventDefault();
    modeSplit.classList.add('active');
    modeSplit.setAttribute('aria-selected', 'true');
    modeCombine.classList.remove('active');
    modeCombine.setAttribute('aria-selected', 'false');
    sectionSplit.removeAttribute('hidden');
    sectionCombine.setAttribute('hidden', '');
  });

  modeCombine.addEventListener('click', function (e) {
    e.preventDefault();
    modeCombine.classList.add('active');
    modeCombine.setAttribute('aria-selected', 'true');
    modeSplit.classList.remove('active');
    modeSplit.setAttribute('aria-selected', 'false');
    sectionCombine.removeAttribute('hidden');
    sectionSplit.setAttribute('hidden', '');
  });

  // Download link
  const downloadLink = document.getElementById('download-link');
  if (downloadLink) {
    downloadLink.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.SSS && SSS.Bundler && typeof SSS.Bundler.download === 'function') {
        SSS.Bundler.download();
      }
    });
  }

})();
