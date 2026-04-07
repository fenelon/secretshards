# Canvas PNG Download Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-click PNG download buttons for individual and bulk share card export, bypassing the browser print dialog.

**Architecture:** New `js/download.js` module exposes `SSS.Download` with canvas rendering, blob download, and minimal ZIP writer. `split.js` wires download buttons alongside existing print buttons. No external dependencies.

**Tech Stack:** Canvas 2D API, Blob API, vanilla JS (IIFE pattern matching existing modules)

---

### Task 1: Create `js/download.js` with canvas rendering

**Files:**
- Create: `js/download.js`

This task builds the core rendering function that draws a share card onto an offscreen canvas, matching the print.css layout.

- [ ] **Step 1: Create `js/download.js` with module skeleton and `renderCard`**

```js
/**
 * download.js — Canvas-based PNG download for share cards.
 *
 * Renders share cards to an offscreen canvas and triggers PNG downloads.
 * For bulk downloads, packs PNGs into a ZIP (STORE method, no compression).
 */
(function () {
  'use strict';

  var Download = SSS.Download = {};

  // Canvas dimensions — US Letter proportions at 2x for crisp output
  var W = 1632;
  var H = 2112;

  /**
   * Render a share card DOM element onto an offscreen canvas.
   * Calls callback(canvas) when done.
   */
  Download.renderCard = function (card, callback) {
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, W, H);

    var y = Math.round(H * 0.03); // 3% top padding, matching print.css

    // Share name (optional)
    var nameEl = card.querySelector('.share-name');
    if (nameEl && !nameEl.hasAttribute('hidden')) {
      ctx.fillStyle = '#000';
      ctx.font = 'bold ' + Math.round(W * 0.03) + 'px Helvetica Neue, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(nameEl.textContent, W / 2, y + Math.round(W * 0.03));
      y += Math.round(W * 0.04);
    }

    // Share label
    var labelEl = card.querySelector('.share-label');
    if (labelEl) {
      ctx.fillStyle = '#555';
      ctx.font = 'bold ' + Math.round(W * 0.035) + 'px Helvetica Neue, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      var labelText = labelEl.textContent.toUpperCase();
      ctx.letterSpacing = '0.12em';
      ctx.fillText(labelText, W / 2, y + Math.round(W * 0.035));
      ctx.letterSpacing = '0em';
      y += Math.round(W * 0.05);
    }

    // Print info text
    var infoEl = card.querySelector('.share-print-info');
    if (infoEl) {
      ctx.fillStyle = '#888';
      var infoSize = Math.round(W * 0.023);
      ctx.font = infoSize + 'px Helvetica Neue, Helvetica, sans-serif';
      ctx.textAlign = 'center';
      var infoLines = infoEl.textContent.split('\n');
      for (var i = 0; i < infoLines.length; i++) {
        ctx.fillText(infoLines[i], W / 2, y + infoSize);
        y += Math.round(infoSize * 1.4);
      }
      y += Math.round(W * 0.01);
    }

    // QR code
    var qrImg = card.querySelector('.share-qr img');
    if (qrImg) {
      var qrSize = Math.round(W * 0.8);
      var qrX = Math.round((W - qrSize) / 2);
      // Disable image smoothing for crisp pixelated QR
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(qrImg, qrX, y, qrSize, qrSize);
      ctx.imageSmoothingEnabled = true;
      y += qrSize + Math.round(W * 0.01);
    } else {
      // Fallback: try canvas element
      var qrCanvas = card.querySelector('.share-qr canvas');
      if (qrCanvas) {
        var qrSize2 = Math.round(W * 0.8);
        var qrX2 = Math.round((W - qrSize2) / 2);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(qrCanvas, qrX2, y, qrSize2, qrSize2);
        ctx.imageSmoothingEnabled = true;
        y += qrSize2 + Math.round(W * 0.01);
      }
    }

    // Base64 share text — monospace, word-wrapped at 88% width
    var shareTextEl = card.querySelector('.share-text');
    if (shareTextEl) {
      ctx.fillStyle = '#333';
      var textSize = Math.round(W * 0.017);
      ctx.font = textSize + 'px Courier New, Courier, monospace';
      ctx.textAlign = 'center';
      var maxWidth = Math.round(W * 0.88);
      var words = shareTextEl.textContent;
      var wrappedLines = wrapText(ctx, words, maxWidth);
      for (var j = 0; j < wrappedLines.length; j++) {
        ctx.fillText(wrappedLines[j], W / 2, y + textSize);
        y += Math.round(textSize * 1.4);
      }
    }

    callback(canvas);
  };

  /**
   * Word-wrap text to fit within maxWidth pixels.
   * For base64 strings (no spaces), breaks at maxWidth boundaries.
   */
  function wrapText(ctx, text, maxWidth) {
    var lines = [];
    // Base64 shares have no spaces — break by character width
    if (text.indexOf(' ') === -1) {
      var line = '';
      for (var i = 0; i < text.length; i++) {
        var test = line + text[i];
        if (ctx.measureText(test).width > maxWidth && line.length > 0) {
          lines.push(line);
          line = text[i];
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
    } else {
      // Space-separated text — wrap at word boundaries
      var parts = text.split(' ');
      var current = parts[0];
      for (var k = 1; k < parts.length; k++) {
        var testLine = current + ' ' + parts[k];
        if (ctx.measureText(testLine).width > maxWidth) {
          lines.push(current);
          current = parts[k];
        } else {
          current = testLine;
        }
      }
      if (current) lines.push(current);
    }
    return lines;
  }

})();
```

- [ ] **Step 2: Verify the file loads without errors**

Open the app in a browser, check the console for errors, and confirm `SSS.Download.renderCard` is defined by running in the console:

```
typeof SSS.Download.renderCard === 'function'
```

- [ ] **Step 3: Commit**

```bash
git add js/download.js
git commit -m "feat: add download.js with canvas card rendering"
```

---

### Task 2: Add blob download helper and single-card download

**Files:**
- Modify: `js/download.js`

- [ ] **Step 1: Add `downloadBlob` and `downloadCard` to `js/download.js`**

Add before the closing `})();`:

```js
  /**
   * Trigger a browser download of a Blob with the given filename.
   */
  Download.downloadBlob = function (blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /**
   * Render a single share card and download it as a PNG.
   */
  Download.downloadCard = function (card, filename) {
    Download.renderCard(card, function (canvas) {
      canvas.toBlob(function (blob) {
        Download.downloadBlob(blob, filename);
      }, 'image/png');
    });
  };
```

- [ ] **Step 2: Verify in console**

```
typeof SSS.Download.downloadCard === 'function'
```

- [ ] **Step 3: Commit**

```bash
git add js/download.js
git commit -m "feat: add downloadBlob and downloadCard helpers"
```

---

### Task 3: Add minimal ZIP writer

**Files:**
- Modify: `js/download.js`

- [ ] **Step 1: Add `createZip` function to `js/download.js`**

Add before the closing `})();`:

```js
  /**
   * Create a ZIP file (STORE method, no compression) from an array of
   * {name: string, data: Uint8Array} entries. Returns a Blob.
   *
   * PNGs are already deflate-compressed, so STORE avoids redundant work
   * and keeps the implementation minimal (~60 lines).
   */
  Download.createZip = function (files) {
    var localHeaders = [];
    var centralHeaders = [];
    var offset = 0;

    for (var i = 0; i < files.length; i++) {
      var name = new TextEncoder().encode(files[i].name);
      var data = files[i].data;

      // DOS date/time: use current time
      var now = new Date();
      var dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
      var dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

      var crc = crc32(data);

      // Local file header (30 + name.length bytes)
      var local = new Uint8Array(30 + name.length);
      var lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);  // signature
      lv.setUint16(4, 20, true);           // version needed
      lv.setUint16(6, 0, true);            // flags
      lv.setUint16(8, 0, true);            // compression: STORE
      lv.setUint16(10, dosTime, true);     // mod time
      lv.setUint16(12, dosDate, true);     // mod date
      lv.setUint32(14, crc, true);         // crc-32
      lv.setUint32(18, data.length, true); // compressed size
      lv.setUint32(22, data.length, true); // uncompressed size
      lv.setUint16(26, name.length, true); // filename length
      lv.setUint16(28, 0, true);           // extra field length
      local.set(name, 30);

      localHeaders.push(local);

      // Central directory header (46 + name.length bytes)
      var central = new Uint8Array(46 + name.length);
      var cv = new DataView(central.buffer);
      cv.setUint32(0, 0x02014b50, true);   // signature
      cv.setUint16(4, 20, true);            // version made by
      cv.setUint16(6, 20, true);            // version needed
      cv.setUint16(8, 0, true);             // flags
      cv.setUint16(10, 0, true);            // compression: STORE
      cv.setUint16(12, dosTime, true);      // mod time
      cv.setUint16(14, dosDate, true);      // mod date
      cv.setUint32(16, crc, true);          // crc-32
      cv.setUint32(20, data.length, true);  // compressed size
      cv.setUint32(24, data.length, true);  // uncompressed size
      cv.setUint16(28, name.length, true);  // filename length
      cv.setUint16(30, 0, true);            // extra field length
      cv.setUint16(32, 0, true);            // comment length
      cv.setUint16(34, 0, true);            // disk number
      cv.setUint16(36, 0, true);            // internal attrs
      cv.setUint32(38, 0, true);            // external attrs
      cv.setUint32(42, offset, true);       // local header offset
      central.set(name, 46);

      centralHeaders.push(central);

      offset += local.length + data.length;
    }

    // End of central directory (22 bytes)
    var centralSize = 0;
    for (var c = 0; c < centralHeaders.length; c++) centralSize += centralHeaders[c].length;

    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);             // signature
    ev.setUint16(4, 0, true);                       // disk number
    ev.setUint16(6, 0, true);                       // central dir disk
    ev.setUint16(8, files.length, true);             // entries on disk
    ev.setUint16(10, files.length, true);            // total entries
    ev.setUint32(12, centralSize, true);             // central dir size
    ev.setUint32(16, offset, true);                  // central dir offset
    ev.setUint16(20, 0, true);                       // comment length

    // Assemble all parts
    var parts = [];
    for (var j = 0; j < localHeaders.length; j++) {
      parts.push(localHeaders[j]);
      parts.push(files[j].data);
    }
    for (var k = 0; k < centralHeaders.length; k++) {
      parts.push(centralHeaders[k]);
    }
    parts.push(eocd);

    return new Blob(parts, { type: 'application/zip' });
  };

  /**
   * CRC-32 (ISO 3309). Table-driven for speed.
   */
  var crcTable = null;
  function crc32(data) {
    if (!crcTable) {
      crcTable = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) {
          c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        }
        crcTable[n] = c;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < data.length; i++) {
      crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
```

- [ ] **Step 2: Verify in console**

```
typeof SSS.Download.createZip === 'function'
```

- [ ] **Step 3: Commit**

```bash
git add js/download.js
git commit -m "feat: add minimal ZIP writer (STORE, no compression)"
```

---

### Task 4: Add `downloadAll` for bulk ZIP download

**Files:**
- Modify: `js/download.js`

- [ ] **Step 1: Add `downloadAll` function to `js/download.js`**

Add before the closing `})();`:

```js
  /**
   * Render all share cards to PNGs, pack into a ZIP, and download.
   * cards: NodeList or array of .share-card elements.
   * filenamePrefix: string prefix for the ZIP filename.
   */
  Download.downloadAll = function (cards, filenamePrefix) {
    var remaining = cards.length;
    var zipFiles = new Array(cards.length);

    for (var i = 0; i < cards.length; i++) {
      (function (idx) {
        Download.renderCard(cards[idx], function (canvas) {
          canvas.toBlob(function (blob) {
            var reader = new FileReader();
            reader.onload = function () {
              zipFiles[idx] = {
                name: 'share-' + (idx + 1) + '.png',
                data: new Uint8Array(reader.result)
              };
              remaining--;
              if (remaining === 0) {
                var zipBlob = Download.createZip(zipFiles);
                Download.downloadBlob(zipBlob, filenamePrefix + '.zip');
              }
            };
            reader.readAsArrayBuffer(blob);
          }, 'image/png');
        });
      })(i);
    }
  };
```

- [ ] **Step 2: Verify in console**

```
typeof SSS.Download.downloadAll === 'function'
```

- [ ] **Step 3: Commit**

```bash
git add js/download.js
git commit -m "feat: add downloadAll for bulk ZIP download"
```

---

### Task 5: Wire up download buttons in split.js and index.html

**Files:**
- Modify: `index.html:29` (add script tag)
- Modify: `index.html:102` (add Download All button)
- Modify: `index.html:175` (add download button to template)
- Modify: `js/split.js:169-175` (wire per-card download button)
- Modify: `js/split.js:221-224` (wire Download All button)

- [ ] **Step 1: Add `<script>` tag to `index.html`**

Add `js/download.js` after `js/ui.js` and before `js/split.js`:

```html
  <script defer src="js/download.js"></script>
```

Insert at line 29, between the `ui.js` and `split.js` script tags.

- [ ] **Step 2: Add "Download All" button to output header in `index.html`**

Change line 102 from:

```html
          <button id="btn-print" class="btn-secondary">Print All</button>
```

to:

```html
          <button id="btn-print" class="btn-secondary">Print All</button>
          <button id="btn-download-all" class="btn-secondary">Download All</button>
```

- [ ] **Step 3: Add download button to share card template in `index.html`**

Change line 175 from:

```html
      <button class="btn-small share-card-print"></button>
```

to:

```html
      <button class="btn-small share-card-print"></button>
      <button class="btn-small share-card-download"></button>
```

- [ ] **Step 4: Add DOM reference and wiring in `js/split.js`**

Add after the `btnPrint` DOM reference (line 23):

```js
  const btnDownloadAll = document.getElementById('btn-download-all');
```

- [ ] **Step 5: Wire per-card download button in `js/split.js`**

In the `shares.forEach` loop, after the `btnPrint` wiring block (after line 173), add:

```js
      var btnDownload = card.querySelector('.share-card-download');
      btnDownload.textContent = 'Download ' + (idx + 1);
      btnDownload.addEventListener('click', (function (shareIdx) {
        return function () {
          var c = sharesList.querySelectorAll('.share-card')[shareIdx];
          var filename = SSS.timestampedName(printPrefix() + 'share' + (shareIdx + 1) + '-') + '.png';
          SSS.Download.downloadCard(c, filename);
        };
      })(idx));
```

- [ ] **Step 6: Wire Download All button in `js/split.js`**

Add after the existing `btnPrint` click listener (after line 224):

```js
  btnDownloadAll.addEventListener('click', function () {
    var cards = sharesList.querySelectorAll('.share-card');
    var prefix = SSS.timestampedName(printPrefix());
    SSS.Download.downloadAll(Array.prototype.slice.call(cards), prefix);
  });
```

- [ ] **Step 7: Commit**

```bash
git add index.html js/split.js
git commit -m "feat: wire download buttons for individual and bulk share export"
```

---

### Task 6: Manual end-to-end test

**Files:** None (testing only)

- [ ] **Step 1: Test single share download**

1. Open the app in Chrome
2. Split a secret (e.g., "test secret", 3 of 5, name "TestWallet")
3. Click "Download 1" on the first share card
4. Verify a PNG file downloads with name like `SecretShards.com-TestWallet-share1-20260407-*.png`
5. Open the PNG — verify it shows: name, label, info text, QR code, base64 text
6. Scan the QR code from the PNG — verify it matches the share text

- [ ] **Step 2: Test bulk ZIP download**

1. Click "Download All"
2. Verify a ZIP file downloads with name like `SecretShards.com-TestWallet-20260407-*.zip`
3. Extract the ZIP — verify it contains `share-1.png` through `share-5.png`
4. Open each PNG — verify layout matches the single-share output

- [ ] **Step 3: Test without name**

1. Split a secret with no name
2. Download a single share — verify filename is `SecretShards.com-share1-*.png`
3. Download all — verify ZIP filename is `SecretShards.com-*.zip`

- [ ] **Step 4: Test on iOS Safari**

1. Open the app on an iPhone/iPad
2. Split and download a single share — verify it downloads/opens correctly
3. Download all — verify ZIP downloads

- [ ] **Step 5: Test print still works**

1. Click "Print All" — verify the existing print flow works unchanged
2. Click "Print Share 1" — verify it works unchanged

- [ ] **Step 6: Commit any fixes if needed**

---

### Task 7: Hide download buttons in print output

**Files:**
- Modify: `css/print.css:80-84`

The download buttons should be hidden in print output, just like the print buttons already are.

- [ ] **Step 1: Add `.share-card-download` to the hidden-in-print rule in `css/print.css`**

Change line 80-84 from:

```css
.share-card-print,
.copied-tooltip,
.qr-size-warning {
  display: none !important;
}
```

to:

```css
.share-card-print,
.share-card-download,
.copied-tooltip,
.qr-size-warning {
  display: none !important;
}
```

- [ ] **Step 2: Commit**

```bash
git add css/print.css
git commit -m "fix: hide download buttons in print output"
```
