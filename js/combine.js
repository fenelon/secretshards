/**
 * combine.js — Combine mode UI logic.
 *
 * Handles share card lifecycle, camera scanning, QR image upload,
 * text paste, share combination, and secret copy.
 *
 * SECURITY: Never uses innerHTML. All DOM construction uses createElement,
 * textContent, and appendChild.
 */
(function () {
  'use strict';

  var UI = SSS.UI;

  // DOM references
  const shareInputs    = document.getElementById('share-inputs');
  const btnCombine     = document.getElementById('btn-combine');
  const combineOutput  = document.getElementById('combine-output');
  const combineError   = document.getElementById('combine-error');
  const recoveredText  = document.getElementById('recovered-text');
  const btnCopySecret  = document.getElementById('btn-copy-secret');
  const cameraModal    = document.getElementById('camera-modal');
  const cameraVideo    = document.getElementById('camera-video');
  const cameraErrorEl  = document.getElementById('camera-error');
  const btnCloseCamera = document.getElementById('btn-close-camera');

  let cameraController = null;
  let activeCameraSlot = null;

  // ---------------------------------------------------------------------------
  // Filled share cards
  // ---------------------------------------------------------------------------
  function createFilledCard(shareData) {
    const card = document.createElement('div');
    card.className = 'combine-card combine-card-filled';
    card.dataset.share = shareData;

    const label = document.createElement('div');
    label.className = 'combine-card-label';
    const parsed = SSS.parseShare(shareData);
    if (parsed && parsed.version >= 2 && parsed.name) {
      label.textContent = parsed.name;
    } else {
      label.textContent = 'Share';
    }
    card.appendChild(label);

    const preview = document.createElement('div');
    preview.className = 'combine-card-preview';
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

    const addCard = shareInputs.querySelector('.combine-card-add');
    shareInputs.insertBefore(card, addCard);
    renumberCards();
    validateCombine();
  }

  // ---------------------------------------------------------------------------
  // Add Share card (3-button state)
  // ---------------------------------------------------------------------------
  function resetAddCard() {
    const addCard = shareInputs.querySelector('.combine-card-add');
    if (!addCard) return;

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

  // ---------------------------------------------------------------------------
  // Paste mode
  // ---------------------------------------------------------------------------
  function showPasteMode(prefill) {
    const addCard = shareInputs.querySelector('.combine-card-add');
    if (!addCard) return;

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

    const btnBack = document.createElement('button');
    btnBack.className = 'btn-small combine-card-paste-back';
    btnBack.textContent = 'Back';
    btnBack.addEventListener('click', function () {
      resetAddCard();
    });
    addCard.appendChild(btnBack);

    textInput.focus();

    if (prefill) {
      trySubmit();
    }
  }

  // ---------------------------------------------------------------------------
  // Card helpers
  // ---------------------------------------------------------------------------
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

  function renumberCards() {
    const cards = shareInputs.querySelectorAll('.combine-card-filled');
    cards.forEach(function (c, i) {
      const lbl = c.querySelector('.combine-card-label');
      if (!lbl) return;
      const parsed = SSS.parseShare(c.dataset.share);
      if (parsed && parsed.version >= 2 && parsed.name) {
        lbl.textContent = parsed.name;
      } else {
        lbl.textContent = 'Share ' + (i + 1);
      }
      var preview = c.querySelector('.combine-card-preview');
      if (preview) {
        var pl = parsed && parsed.payload ? parsed.payload : c.dataset.share;
        preview.textContent = pl.substring(0, 20) + '\u2026';
      }
    });
  }

  function findDuplicateCard(shareData) {
    const cards = shareInputs.querySelectorAll('.combine-card-filled');
    for (let i = 0; i < cards.length; i++) {
      if (cards[i].dataset.share === shareData) return cards[i];
    }
    return null;
  }

  function highlightDuplicate(card) {
    const existing = card.querySelector('.combine-card-error');
    if (existing) existing.parentNode.removeChild(existing);

    const errorMsg = document.createElement('div');
    errorMsg.className = 'combine-card-error';
    errorMsg.textContent = 'Duplicate share';
    card.appendChild(errorMsg);

    card.classList.add('combine-card-blink');
    setTimeout(function () {
      card.classList.remove('combine-card-blink');
    }, 1500);

    setTimeout(function () {
      if (errorMsg.parentNode) {
        errorMsg.parentNode.removeChild(errorMsg);
      }
    }, 3000);
  }

  function getValidShares() {
    const result = [];
    const cards = shareInputs.querySelectorAll('.combine-card-filled');
    cards.forEach(function (c) {
      result.push(c.dataset.share);
    });
    return result;
  }

  function validateCombine() {
    var shares = getValidShares();
    var count = shares.length;
    var threshold = 0;
    for (var i = 0; i < shares.length; i++) {
      var parsed = SSS.parseShare(shares[i]);
      if (parsed && parsed.threshold) {
        threshold = parsed.threshold;
        break;
      }
    }
    if (threshold > 0 && count < threshold) {
      var remaining = threshold - count;
      btnCombine.textContent = 'Combine \u2014 need ' + remaining + ' more';
      btnCombine.disabled = true;
    } else if (count >= 2) {
      btnCombine.textContent = 'Combine';
      btnCombine.disabled = false;
    } else {
      btnCombine.textContent = 'Combine';
      btnCombine.disabled = true;
    }
  }

  createAddShareCard();

  // ---------------------------------------------------------------------------
  // Camera
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
        cameraVideo.setAttribute('hidden', '');
        cameraErrorEl.textContent = 'Camera unavailable: ' + err.message;
        cameraErrorEl.removeAttribute('hidden');
      });
    } catch (err) {
      closeCamera();
      UI.showInlineError(combineError, 'Could not start camera: ' + err.message);
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

  cameraModal.addEventListener('click', function (e) {
    if (e.target === cameraModal) {
      closeCamera();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !cameraModal.hasAttribute('hidden')) {
      closeCamera();
    }
  });

  // ---------------------------------------------------------------------------
  // Combine handler
  // ---------------------------------------------------------------------------
  btnCombine.addEventListener('click', function () {
    const shares = getValidShares();
    let secret;
    try {
      secret = SSS.combine(shares);
    } catch (err) {
      UI.showInlineError(combineError, 'Error combining shares: ' + err.message);
      return;
    }
    UI.clearInlineError(combineError);
    recoveredText.value = secret;
    combineOutput.removeAttribute('hidden');
  });

  // ---------------------------------------------------------------------------
  // Copy secret
  // ---------------------------------------------------------------------------
  btnCopySecret.addEventListener('click', function () {
    navigator.clipboard.writeText(recoveredText.value).then(function () {
      UI.showTooltip(btnCopySecret, 'Copied');
      UI.announce('Secret copied to clipboard');
    }).catch(function () {
      recoveredText.select();
      UI.showTooltip(btnCopySecret, 'Select text to copy');
    });
  });

})();
