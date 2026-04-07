/**
 * download.js — Canvas-based PNG download for share cards.
 *
 * Renders share cards to an offscreen canvas and triggers PNG downloads.
 * For bulk downloads, packs PNGs into a ZIP (STORE method, no compression).
 */
(function () {
  'use strict';

  var Download = SSS.Download = {};

  // Canvas dimensions — A4 proportions at 2x for crisp output (210x297mm)
  var W = 1588;
  var H = 2245;

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

})();
