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

    shares.forEach(function (share, idx) {
      const card = document.createElement('div');
      card.className = 'share-card';

      const label = document.createElement('div');
      label.className = 'share-label';
      card.appendChild(label);

      const parsed = SSS.parseShare(share);
      if (parsed && parsed.version >= 2 && parsed.name) {
        const nameSpan = document.createElement('div');
        nameSpan.className = 'share-name';
        nameSpan.textContent = parsed.name;
        card.insertBefore(nameSpan, label);
      }
      label.textContent = 'Share ' + (idx + 1) + (parsed && parsed.version >= 2 ? '' : ' of ' + total);

      // Print-only description (visible only in @media print)
      const printInfo = document.createElement('div');
      printInfo.className = 'share-print-info';
      printInfo.textContent = 'This is one share of a secret split using SecretShards.com.\nTo reconstruct the secret, collect enough shares and combine them there.';
      card.appendChild(printInfo);

      const qrDiv = document.createElement('div');
      qrDiv.className = 'share-qr';
      const canvas = document.createElement('canvas');
      try {
        SSS.QR.generate(share, canvas, { size: 200 });
        // Use <img> instead of <canvas> so CSS width works in print
        const img = document.createElement('img');
        img.src = canvas.toDataURL('image/png');
        img.width = 200;
        img.height = 200;
        img.alt = 'QR code for share ' + (idx + 1);
        qrDiv.appendChild(img);
      } catch (e) {
        // QR generation failed (share too large) — show canvas as fallback
        qrDiv.appendChild(canvas);
      }
      card.appendChild(qrDiv);

      const shareText = document.createElement('div');
      shareText.className = 'share-text';
      shareText.textContent = share;
      shareText.title = 'Click to copy';
      shareText.setAttribute('role', 'button');
      shareText.setAttribute('tabindex', '0');
      shareText.addEventListener('click', function () {
        navigator.clipboard.writeText(share).then(function () {
          UI.showTooltip(shareText, 'Copied');
          UI.announce('Share copied to clipboard');
        }).catch(function () {
          UI.showTooltip(shareText, 'Select text to copy');
        });
      });
      card.appendChild(shareText);

      const btnPdf = document.createElement('button');
      btnPdf.className = 'btn-small share-card-print';
      btnPdf.textContent = 'Print Share ' + (idx + 1);
      btnPdf.addEventListener('click', (function (shareIdx) {
        return function () {
          printSingleShare(shareIdx);
        };
      })(idx));
      card.appendChild(btnPdf);

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

  // Print via a temporary iframe so each print gets a fresh document
  // context.  Avoids iOS Safari's "suppress alerts" prompt on repeated
  // window.print() calls and the async-cleanup timing issue.
  var PRINT_CSS =
    'body{margin:0;font-family:Helvetica Neue,Helvetica,sans-serif;color:#000}' +
    '.share-card{background:#fff;padding:3% 0 0;margin:0;text-align:center;' +
      'page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid;' +
      'container-type:inline-size}' +
    '.share-card:last-child{page-break-after:avoid;break-after:avoid}' +
    '.share-name{font-size:16pt;font-size:3cqi;font-weight:700;margin-bottom:2pt}' +
    '.share-label{font-size:18pt;font-size:3.5cqi;font-weight:700;text-transform:uppercase;' +
      'letter-spacing:.12em;color:#555;margin-bottom:8pt;margin-bottom:1cqi}' +
    '.share-print-info{display:block;white-space:pre-line;font-size:13pt;font-size:2.3cqi;' +
      'color:#888;text-align:center;line-height:1.4;margin-top:6pt;margin-top:.8cqi}' +
    '.share-qr{margin-bottom:8pt;margin-bottom:1cqi}' +
    '.share-qr img{display:block;width:80%;height:auto;margin:0 auto;image-rendering:pixelated}' +
    '.share-text{font-family:Courier New,Courier,monospace;font-size:12pt;font-size:1.7cqi;' +
      'color:#333;word-break:break-all;text-align:center;line-height:1.4;max-width:88%;margin:0 auto}' +
    '.share-card-print,.copied-tooltip,.qr-size-warning{display:none!important}';

  function printCards(title, cards) {
    var body = '';
    for (var i = 0; i < cards.length; i++) body += cards[i].outerHTML;
    var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' +
      title.replace(/</g, '&lt;') + '</title><style>' + PRINT_CSS +
      '</style></head><body>' + body + '</body></html>';
    var iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;width:0;height:0;border:none';
    document.body.appendChild(iframe);
    var doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(html);
    doc.close();
    iframe.contentWindow.addEventListener('afterprint', function () {
      document.body.removeChild(iframe);
    });
    iframe.contentWindow.print();
  }

  function printSingleShare(index) {
    var card = sharesList.querySelectorAll('.share-card')[index];
    printCards(SSS.timestampedName(printPrefix() + 'share' + (index + 1) + '-'), [card]);
  }

  btnPrint.addEventListener('click', function () {
    var cards = sharesList.querySelectorAll('.share-card');
    printCards(SSS.timestampedName(printPrefix()), Array.prototype.slice.call(cards));
  });

  // ---------------------------------------------------------------------------
  // Warn before closing if shares are visible
  // ---------------------------------------------------------------------------
  window.addEventListener('beforeunload', function (e) {
    if (!splitOutput.hasAttribute('hidden')) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });

})();
