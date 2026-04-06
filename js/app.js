/**
 * app.js — UI logic for the Shamir Secret Sharing web app.
 *
 * Wires up all interactions: mode toggle, split, combine cards,
 * validation, copy, and print.
 *
 * SECURITY: Never uses innerHTML. All DOM construction uses createElement,
 * textContent, and appendChild.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. DOM references
  // ---------------------------------------------------------------------------
  const modeSplit      = document.getElementById('mode-split');
  const modeCombine    = document.getElementById('mode-combine');
  const sectionSplit   = document.getElementById('section-split');
  const sectionCombine = document.getElementById('section-combine');
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
  const shareInputs    = document.getElementById('share-inputs');
  const btnCombine     = document.getElementById('btn-combine');
  const combineOutput  = document.getElementById('combine-output');
  const combineError   = document.getElementById('combine-error');
  const recoveredText  = document.getElementById('recovered-text');
  const btnCopySecret  = document.getElementById('btn-copy-secret');
  const ariaStatus     = document.getElementById('aria-status');
  const cameraModal    = document.getElementById('camera-modal');
  const cameraVideo    = document.getElementById('camera-video');
  const cameraErrorEl  = document.getElementById('camera-error');
  const btnCloseCamera = document.getElementById('btn-close-camera');
  const downloadLink   = document.getElementById('download-link');
  const thresholdError = document.getElementById('threshold-error');

  // ---------------------------------------------------------------------------
  // 2. Inline error helpers (replaces alert())
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 3. Mode toggle
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // 4. Byte counter & validation
  // ---------------------------------------------------------------------------
  function updateByteCounter() {
    const secret = inputSecret.value;
    const bytes = new TextEncoder().encode(secret).length;
    byteCount.textContent = bytes;

    const qrWarning = document.getElementById('qr-warning');
    const overLimitMsg = document.getElementById('over-limit-msg');

    if (bytes > 512) {
      byteCounter.classList.add('over-limit');
      overLimitMsg.removeAttribute('hidden');
      qrWarning.setAttribute('hidden', '');
    } else {
      byteCounter.classList.remove('over-limit');
      overLimitMsg.setAttribute('hidden', '');
      // Show QR warning only when under limit but shares would be large
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

    validateSplit();
  }

  function validateSplit() {
    const min     = parseInt(inputMinimum.value, 10);
    const total   = parseInt(inputTotal.value, 10);
    const secret  = inputSecret.value;
    const bytes   = new TextEncoder().encode(secret).length;

    // Threshold validation
    var thresholdMsg = '';
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
      showInlineError(thresholdError, thresholdMsg);
    } else {
      clearInlineError(thresholdError);
    }

    const ok = (
      min >= 2 &&
      total >= min &&
      total <= 255 &&
      secret.length > 0 &&
      bytes <= 512
    );
    btnSplit.disabled = !ok;
    if (ok) clearInlineError(splitError);
  }

  inputMinimum.addEventListener('input', updateByteCounter);
  inputTotal.addEventListener('input', updateByteCounter);
  inputSecret.addEventListener('input', updateByteCounter);

  // Run once on load so the button state matches default values
  updateByteCounter();

  // ---------------------------------------------------------------------------
  // 5. Split handler
  // ---------------------------------------------------------------------------
  btnSplit.addEventListener('click', function () {
    const min    = parseInt(inputMinimum.value, 10);
    const total  = parseInt(inputTotal.value, 10);
    const secret = inputSecret.value;

    let shares;
    try {
      shares = SSS.create(min, total, secret);
    } catch (err) {
      showInlineError(splitError, 'Error creating shares: ' + err.message);
      return;
    }
    clearInlineError(splitError);

    // Clear existing shares with safe DOM removal
    while (sharesList.firstChild) {
      sharesList.removeChild(sharesList.firstChild);
    }

    shares.forEach(function (share, idx) {
      const card = document.createElement('div');
      card.className = 'share-card';

      // Label
      const label = document.createElement('div');
      label.className = 'share-label';
      label.textContent = 'Share ' + (idx + 1) + ' of ' + total;
      card.appendChild(label);

      // QR code canvas
      const qrDiv = document.createElement('div');
      qrDiv.className = 'share-qr';
      const canvas = document.createElement('canvas');
      try {
        SSS.QR.generate(share, canvas, { size: 200 });
      } catch (e) {
        // QR generation failed (share too large) — canvas remains blank
      }
      qrDiv.appendChild(canvas);
      card.appendChild(qrDiv);

      // Share text — click to copy
      const shareText = document.createElement('div');
      shareText.className = 'share-text';
      shareText.textContent = share;
      shareText.title = 'Click to copy';
      shareText.setAttribute('role', 'button');
      shareText.setAttribute('tabindex', '0');
      shareText.addEventListener('click', function () {
        navigator.clipboard.writeText(share).then(function () {
          showTooltip(shareText, 'Copied');
          announce('Share copied to clipboard');
        }).catch(function () {
          // Clipboard unavailable — silently ignore
        });
      });
      card.appendChild(shareText);

      // Print single share button
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
  // 5a. Clear all
  // ---------------------------------------------------------------------------
  btnClear.addEventListener('click', function () {
    location.reload();
  });

  /**
   * Shows a temporary tooltip message above an element, then removes it.
   */
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

  // ---------------------------------------------------------------------------
  // 6a. Print single share (reuses the same CSS print template as Print All)
  // ---------------------------------------------------------------------------
  function printSingleShare(index) {
    const cards = sharesList.querySelectorAll('.share-card');
    cards.forEach(function (c, i) {
      if (i !== index) c.classList.add('print-hidden');
      else c.classList.add('print-single');
    });

    const originalTitle = document.title;
    document.title = SSS.timestampedName('sss-share-' + (index + 1) + 'of' + cards.length + '-');
    window.print();
    document.title = originalTitle;

    cards.forEach(function (c) {
      c.classList.remove('print-hidden');
      c.classList.remove('print-single');
    });
  }

  // ---------------------------------------------------------------------------
  // 6b. Print all shares
  // ---------------------------------------------------------------------------
  btnPrint.addEventListener('click', function () {
    const originalTitle = document.title;
    document.title = SSS.timestampedName('sss-');
    window.print();
    document.title = originalTitle;
  });

  // ---------------------------------------------------------------------------
  // 7. Combine cards
  // ---------------------------------------------------------------------------
  let cameraController = null;
  let activeCameraSlot = null;

  /**
   * Creates a filled (read-only) share card and inserts it before the Add Share card.
   */
  function createFilledCard(shareData) {
    const card = document.createElement('div');
    card.className = 'combine-card combine-card-filled';
    card.dataset.share = shareData;

    const label = document.createElement('div');
    label.className = 'combine-card-label';
    label.textContent = 'Share';
    card.appendChild(label);

    const preview = document.createElement('div');
    preview.className = 'combine-card-preview';
    preview.textContent = shareData.substring(0, 20) + '...';
    card.appendChild(preview);

    const btnRemove = document.createElement('button');
    btnRemove.className = 'combine-card-remove';
    btnRemove.textContent = '\u00d7';
    btnRemove.setAttribute('aria-label', 'Remove share');
    btnRemove.addEventListener('click', function () {
      shareInputs.removeChild(card);
      renumberCards();
      validateCombine();
    });
    card.appendChild(btnRemove);

    // Insert before the Add Share card (always last child)
    const addCard = shareInputs.querySelector('.combine-card-add');
    shareInputs.insertBefore(card, addCard);
    renumberCards();
    validateCombine();
  }

  /**
   * Resets the Add Share card back to its 3-button state.
   */
  function resetAddCard() {
    const addCard = shareInputs.querySelector('.combine-card-add');
    if (!addCard) return;

    // Clear everything after the label
    while (addCard.children.length > 1) {
      addCard.removeChild(addCard.lastChild);
    }

    const actions = document.createElement('div');
    actions.className = 'combine-card-actions';

    // Scan QR button
    if (SSS.Scanner.hasCamera) {
      const btnScan = document.createElement('button');
      btnScan.className = 'btn-secondary';
      btnScan.textContent = 'Scan QR';
      btnScan.addEventListener('click', function () {
        activeCameraSlot = { callback: createFilledCard };
        openCamera();
      });
      actions.appendChild(btnScan);
    }

    // Upload QR Code Image button
    {
      const btnUpload = document.createElement('button');
      btnUpload.className = 'btn-secondary';
      btnUpload.textContent = 'Upload QR Image';

      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';

      fileInput.addEventListener('change', function () {
        const file = fileInput.files[0];
        if (!file) return;
        SSS.Scanner.scanImage(file).then(function (text) {
          if (!SSS.isValidShare(text)) {
            showPasteMode(text);
          } else {
            const dupCard = findDuplicateCard(text);
            if (dupCard) {
              highlightDuplicate(dupCard);
            } else {
              createFilledCard(text);
            }
          }
        }).catch(function (err) {
          showPasteMode('');
          // Show error on the paste mode that was just opened
          const currentAddCard = shareInputs.querySelector('.combine-card-add');
          const errorEl = currentAddCard && currentAddCard.querySelector('.combine-card-error');
          if (errorEl) {
            errorEl.textContent = 'Could not read QR code from image: ' + err.message;
            errorEl.removeAttribute('hidden');
          }
        });
        fileInput.value = '';
      });

      btnUpload.addEventListener('click', function () {
        fileInput.click();
      });

      actions.appendChild(btnUpload);
      actions.appendChild(fileInput);
    }

    // Paste Text button
    const btnPaste = document.createElement('button');
    btnPaste.className = 'btn-secondary';
    btnPaste.textContent = 'Paste Text';
    btnPaste.addEventListener('click', function () {
      showPasteMode('');
    });
    actions.appendChild(btnPaste);

    addCard.appendChild(actions);
  }

  /**
   * Switches the Add Share card into paste-text input mode.
   * @param {string} prefill — optional text to pre-fill the input with
   */
  function showPasteMode(prefill) {
    const addCard = shareInputs.querySelector('.combine-card-add');
    if (!addCard) return;

    // Clear everything after the label
    while (addCard.children.length > 1) {
      addCard.removeChild(addCard.lastChild);
    }

    const textInput = document.createElement('input');
    textInput.type = 'text';
    textInput.className = 'combine-card-input';
    textInput.placeholder = 'Paste share here\u2026';
    textInput.setAttribute('autocomplete', 'off');
    textInput.setAttribute('spellcheck', 'false');
    if (prefill) textInput.value = prefill;

    const errorMsg = document.createElement('div');
    errorMsg.className = 'combine-card-error';
    errorMsg.setAttribute('hidden', '');

    function trySubmit() {
      const val = textInput.value.trim();
      if (val === '') {
        errorMsg.setAttribute('hidden', '');
      } else if (!SSS.isValidShare(val)) {
        errorMsg.textContent = 'Invalid share format';
        errorMsg.removeAttribute('hidden');
      } else {
        const dupCard = findDuplicateCard(val);
        if (dupCard) {
          errorMsg.textContent = 'Duplicate share';
          errorMsg.removeAttribute('hidden');
          highlightDuplicate(dupCard);
          return;
        }
        createFilledCard(val);
        resetAddCard();
      }
    }

    textInput.addEventListener('input', trySubmit);

    addCard.appendChild(textInput);
    addCard.appendChild(errorMsg);

    // Back button to return to 3-button mode
    const btnBack = document.createElement('button');
    btnBack.className = 'btn-small combine-card-paste-back';
    btnBack.textContent = 'Back';
    btnBack.addEventListener('click', function () {
      resetAddCard();
    });
    addCard.appendChild(btnBack);

    textInput.focus();

    // Trigger validation if prefilled
    if (prefill) {
      trySubmit();
    }
  }

  /**
   * Creates the Add Share card and appends it to shareInputs.
   */
  function createAddShareCard() {
    const card = document.createElement('div');
    card.className = 'combine-card combine-card-add';

    const label = document.createElement('div');
    label.className = 'combine-card-label';
    label.textContent = 'Add Share';
    card.appendChild(label);

    shareInputs.appendChild(card);
    resetAddCard();
  }

  /**
   * Updates filled card labels to reflect current order.
   */
  function renumberCards() {
    const cards = shareInputs.querySelectorAll('.combine-card-filled');
    cards.forEach(function (c, i) {
      const lbl = c.querySelector('.combine-card-label');
      if (lbl) {
        lbl.textContent = 'Share ' + (i + 1);
      }
    });
  }

  /**
   * Returns the filled card element if a share with the same data exists, or null.
   */
  function findDuplicateCard(shareData) {
    const cards = shareInputs.querySelectorAll('.combine-card-filled');
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].dataset.share === shareData) return cards[i];
    }
    return null;
  }

  /**
   * Highlights the duplicate card with a blink animation and error message.
   */
  function highlightDuplicate(card) {
    // Remove any existing duplicate error on this card
    const existing = card.querySelector('.combine-card-error');
    if (existing) existing.parentNode.removeChild(existing);

    const errorMsg = document.createElement('div');
    errorMsg.className = 'combine-card-error';
    errorMsg.textContent = 'Duplicate share';
    card.appendChild(errorMsg);

    // Blink the card
    card.classList.add('combine-card-blink');
    setTimeout(function () {
      card.classList.remove('combine-card-blink');
    }, 1500);

    // Remove error after 3 seconds
    setTimeout(function () {
      if (errorMsg.parentNode) {
        errorMsg.parentNode.removeChild(errorMsg);
      }
    }, 3000);
  }

  /**
   * Returns an array of share strings from filled cards.
   */
  function getValidShares() {
    const result = [];
    const cards = shareInputs.querySelectorAll('.combine-card-filled');
    cards.forEach(function (c) {
      result.push(c.dataset.share);
    });
    return result;
  }

  /**
   * Enables btn-combine when there are >= 2 filled cards.
   */
  function validateCombine() {
    btnCombine.disabled = getValidShares().length < 2;
  }

  // Initialise with the Add Share card
  createAddShareCard();

  // ---------------------------------------------------------------------------
  // 8. Camera
  // ---------------------------------------------------------------------------
  function openCamera() {
    cameraModal.removeAttribute('hidden');
    cameraErrorEl.setAttribute('hidden', '');
    btnCloseCamera.focus();
    try {
      cameraController = SSS.Scanner.startCamera(cameraVideo, function (text) {
        const callback = activeCameraSlot && activeCameraSlot.callback;
        closeCamera();
        if (callback && SSS.isValidShare(text)) {
          const dupCard = findDuplicateCard(text);
          if (dupCard) {
            highlightDuplicate(dupCard);
          } else {
            callback(text);
          }
        }
      }, function (err) {
        // Camera permission denied or other error
        cameraVideo.setAttribute('hidden', '');
        cameraErrorEl.textContent = 'Camera unavailable: ' + err.message;
        cameraErrorEl.removeAttribute('hidden');
      });
    } catch (err) {
      closeCamera();
      showInlineError(combineError, 'Could not start camera: ' + err.message);
    }
  }

  function closeCamera() {
    if (cameraController) {
      cameraController.stop();
      cameraController = null;
    }
    cameraModal.setAttribute('hidden', '');
    cameraVideo.removeAttribute('hidden');
    cameraErrorEl.setAttribute('hidden', '');
    activeCameraSlot = null;
  }

  btnCloseCamera.addEventListener('click', function () {
    closeCamera();
  });

  // Close camera on backdrop click
  cameraModal.addEventListener('click', function (e) {
    if (e.target === cameraModal) {
      closeCamera();
    }
  });

  // ---------------------------------------------------------------------------
  // 9. Keyboard shortcuts
  // ---------------------------------------------------------------------------
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !cameraModal.hasAttribute('hidden')) {
      closeCamera();
    }
  });

  // ---------------------------------------------------------------------------
  // 10. Combine
  // ---------------------------------------------------------------------------
  btnCombine.addEventListener('click', function () {
    const shares = getValidShares();
    let secret;
    try {
      secret = SSS.combine(shares);
    } catch (err) {
      showInlineError(combineError, 'Error combining shares: ' + err.message);
      return;
    }
    clearInlineError(combineError);
    recoveredText.value = secret;
    combineOutput.removeAttribute('hidden');
  });

  // ---------------------------------------------------------------------------
  // 11. Copy
  // ---------------------------------------------------------------------------
  btnCopySecret.addEventListener('click', function () {
    navigator.clipboard.writeText(recoveredText.value).then(function () {
      showTooltip(btnCopySecret, 'Copied');
      announce('Secret copied to clipboard');
    }).catch(function () {
      // Clipboard unavailable — silently ignore
    });
  });

  // ---------------------------------------------------------------------------
  // 12. Download link
  // ---------------------------------------------------------------------------
  if (downloadLink) {
    downloadLink.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.SSS && SSS.Bundler && typeof SSS.Bundler.download === 'function') {
        SSS.Bundler.download();
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 13. Warn before closing if shares are visible
  // ---------------------------------------------------------------------------
  window.addEventListener('beforeunload', function (e) {
    if (!splitOutput.hasAttribute('hidden')) {
      e.preventDefault();
      e.returnValue = '';
      return '';
    }
  });

})();
