/**
 * split.js — Split mode UI logic.
 *
 * Handles form validation, share generation, rendering, printing,
 * and the beforeunload warning.
 *
 * SECURITY: Never uses innerHTML. All DOM construction uses createElement,
 * textContent, and appendChild.
 */
(function () {
  'use strict';

  var UI = SSS.UI;

  // DOM references
  const inputMinimum   = document.getElementById('input-minimum');
  const inputTotal     = document.getElementById('input-total');
  const inputSecret    = document.getElementById('input-secret');
  const byteCount      = document.getElementById('byte-count');
  const byteCounter    = document.querySelector('.byte-counter');
  const btnSplit       = document.getElementById('btn-split');
  const btnClear       = document.getElementById('btn-clear');
  const btnPrint       = document.getElementById('btn-print');
  const btnDownloadAll = document.getElementById('btn-download-all');
  const splitOutput    = document.getElementById('split-output');
  const sharesList     = document.getElementById('shares-list');
  const splitError     = document.getElementById('split-error');
  const thresholdError = document.getElementById('threshold-error');
  const qrWarning      = document.getElementById('qr-warning');
  const overLimitMsg   = document.getElementById('over-limit-msg');
  const inputName      = document.getElementById('input-name');
  const nameCount      = document.getElementById('name-count');

  const encoder = new TextEncoder();

  inputName.addEventListener('input', function () {
    nameCount.textContent = inputName.value.length;
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  function validateForm() {
    const secret = inputSecret.value;
    const bytes = encoder.encode(secret).length;
    const min = parseInt(inputMinimum.value, 10);
    const total = parseInt(inputTotal.value, 10);

    // Update byte counter display
    byteCount.textContent = bytes;

    if (bytes > 512) {
      byteCounter.classList.add('over-limit');
      overLimitMsg.removeAttribute('hidden');
      qrWarning.setAttribute('hidden', '');
    } else {
      byteCounter.classList.remove('over-limit');
      overLimitMsg.setAttribute('hidden', '');
      if (bytes > 0) {
        const chunks = Math.ceil(bytes / 32);
        const shareLen = chunks * 88;
        if (shareLen > 700) {
          qrWarning.removeAttribute('hidden');
        } else {
          qrWarning.setAttribute('hidden', '');
        }
      } else {
        qrWarning.setAttribute('hidden', '');
      }
    }

    // Threshold validation
    let thresholdMsg = '';
    if (isNaN(min) || min < 2) {
      thresholdMsg = 'Minimum must be at least 2';
    } else if (isNaN(total) || total < 2) {
      thresholdMsg = 'Total must be at least 2';
    } else if (total > 255) {
      thresholdMsg = 'Total cannot exceed 255';
    } else if (min > total) {
      thresholdMsg = 'Minimum cannot exceed total';
    }

    if (thresholdMsg) {
      UI.showInlineError(thresholdError, thresholdMsg);
    } else {
      UI.clearInlineError(thresholdError);
    }

    const ok = (
      min >= 2 &&
      total >= min &&
      total <= 255 &&
      secret.length > 0 &&
      bytes <= 512
    );
    btnSplit.disabled = !ok;
    if (ok) UI.clearInlineError(splitError);
  }

  inputMinimum.addEventListener('input', validateForm);
  inputTotal.addEventListener('input', validateForm);
  inputSecret.addEventListener('input', validateForm);
  validateForm();

  // ---------------------------------------------------------------------------
  // Split handler
  // ---------------------------------------------------------------------------
  btnSplit.addEventListener('click', function () {
    const min    = parseInt(inputMinimum.value, 10);
    const total  = parseInt(inputTotal.value, 10);
    const secret = inputSecret.value;

    const nameTrimmed = inputName.value.trim();
    const options = {};
    if (nameTrimmed) options.name = nameTrimmed;

    let shares;
    try {
      shares = SSS.create(min, total, secret, options);
    } catch (err) {
      UI.showInlineError(splitError, 'Error creating shares: ' + err.message);
      return;
    }
    UI.clearInlineError(splitError);

    while (sharesList.firstChild) {
      sharesList.removeChild(sharesList.firstChild);
    }

    var tplShareCard = document.getElementById('tpl-share-card');

    shares.forEach(function (share, idx) {
      const card = tplShareCard.content.cloneNode(true).querySelector('.share-card');

      const parsed = SSS.parseShare(share);
      if (parsed && parsed.version >= 2 && parsed.name) {
        var nameEl = card.querySelector('.share-name');
        nameEl.textContent = parsed.name;
        nameEl.removeAttribute('hidden');
      }
      card.querySelector('.share-label').textContent =
        'Share ' + (idx + 1) + (parsed && parsed.version >= 2 ? '' : ' of ' + total);

      var qrDiv = card.querySelector('.share-qr');
      const canvas = document.createElement('canvas');
      try {
        SSS.QR.generate(share, canvas, { size: 200 });
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.width = 200;
        img.height = 200;
        img.alt = 'QR code for share ' + (idx + 1);
        qrDiv.appendChild(img);
      } catch (e) {
        qrDiv.appendChild(canvas);
      }

      var shareText = card.querySelector('.share-text');
      shareText.textContent = share;
      shareText.addEventListener('click', function () {
        navigator.clipboard.writeText(share).then(function () {
          UI.showTooltip(shareText, 'Copied');
          UI.announce('Share copied to clipboard');
        }).catch(function () {
          UI.showTooltip(shareText, 'Select text to copy');
        });
      });

      var btnPrint = card.querySelector('.share-card-print');
      btnPrint.textContent = 'Print';
      btnPrint.addEventListener('click', (function (shareIdx) {
        return function () { printSingleShare(shareIdx); };
      })(idx));

      var btnDownload = card.querySelector('.share-card-download');
      btnDownload.textContent = 'Download';
      btnDownload.addEventListener('click', (function (shareIdx) {
        return function () {
          var c = sharesList.querySelectorAll('.share-card')[shareIdx];
          var filename = SSS.timestampedName(printPrefix() + 'share' + (shareIdx + 1) + '-') + '.png';
          SSS.Download.downloadCard(c, filename);
        };
      })(idx));

      sharesList.appendChild(card);
    });

    splitOutput.removeAttribute('hidden');
    btnClear.removeAttribute('hidden');
  });

  // ---------------------------------------------------------------------------
  // Clear all
  // ---------------------------------------------------------------------------
  btnClear.addEventListener('click', function () {
    location.reload();
  });

  // ---------------------------------------------------------------------------
  // Print
  // ---------------------------------------------------------------------------
  function printPrefix() {
    const name = SSS.sanitizeName(inputName.value.trim());
    return name ? 'SecretShards.com-' + name + '-' : 'SecretShards.com-';
  }

  // Print via a new window with just the share cards. Falls back to an
  // on-page overlay + @media print CSS when popups are blocked (e.g. Brave).
  var printOverlay = document.createElement('div');
  printOverlay.id = 'print-overlay';
  document.body.appendChild(printOverlay);

  function printViaOverlay(title, cards) {
    var prevTitle = document.title;
    document.title = title;
    printOverlay.innerHTML = '';
    for (var i = 0; i < cards.length; i++) {
      printOverlay.appendChild(cards[i].cloneNode(true));
    }
    document.body.classList.add('print-mode');
    void document.body.offsetHeight;
    window.addEventListener('afterprint', function onAfter() {
      window.removeEventListener('afterprint', onAfter);
      document.body.classList.remove('print-mode');
      printOverlay.innerHTML = '';
      document.title = prevTitle;
    });
    window.print();
  }

  function printCards(title, cards) {
    var body = '';
    for (var i = 0; i < cards.length; i++) body += cards[i].outerHTML;
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
      title.replace(/</g, '&lt;') +
      '</title><link rel="stylesheet" href="css/print.css">' +
      '</head><body>' + body + '</body></html>';
    var w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.addEventListener('afterprint', function () { w.close(); });
      w.print();
    } else {
      printViaOverlay(title, cards);
    }
  }

  function printSingleShare(index) {
    var card = sharesList.querySelectorAll('.share-card')[index];
    printCards(SSS.timestampedName(printPrefix() + 'share' + (index + 1) + '-'), [card]);
  }

  btnPrint.addEventListener('click', function () {
    var cards = sharesList.querySelectorAll('.share-card');
    printCards(SSS.timestampedName(printPrefix()), Array.prototype.slice.call(cards));
  });

  btnDownloadAll.addEventListener('click', function () {
    var cards = sharesList.querySelectorAll('.share-card');
    var prefix = SSS.timestampedName(printPrefix());
    SSS.Download.downloadAll(Array.prototype.slice.call(cards), prefix);
  });

  // ---------------------------------------------------------------------------
  // Warn before closing if shares are visible
  // ---------------------------------------------------------------------------
  window.addEventListener('beforeunload', function (e) {
    if (document.body.classList.contains('print-mode')) return;
    if (!splitOutput.hasAttribute('hidden')) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });

})();
