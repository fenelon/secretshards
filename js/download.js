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

})();
