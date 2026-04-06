// sssa-web/js/qr.js
// SSS.QR wrapper around @paulmillr/qr (0.5.5)
// Provides QR encoding (generate to canvas, toDataURL) and decoding (from ImageData)

(function() {
  'use strict';
  if (!window.SSS) window.SSS = {};

  var lib = window.__paulmillr_qr;
  var encodeQR = lib.encodeQR;
  var decodeQR = lib.decodeQR;

  var QR = {};

  // Render QR code to a canvas element
  QR.generate = function(data, canvas, options) {
    options = options || {};
    var displaySize = options.size || 256;
    var border = options.border !== undefined ? options.border : 4;
    // encodeQR with 'raw' returns a 2D boolean array (includes border)
    // Use low ECC for large data — fewer modules = more scannable from print
    var ecc = data.length > 500 ? 'low' : 'medium';
    var raw = encodeQR(data, 'raw', { ecc: ecc, border: border });
    var moduleCount = raw.length;
    // Use integer cell size for crisp pixels
    // Minimum 12px per module for print quality on dense QR codes
    var cellSize = Math.max(12, Math.ceil(displaySize / moduleCount));
    var actualSize = moduleCount * cellSize;
    canvas.width = actualSize;
    canvas.height = actualSize;
    // CSS scales it down for display; rendering stays pixel-perfect
    canvas.style.width = displaySize + 'px';
    canvas.style.height = displaySize + 'px';
    canvas.style.imageRendering = 'pixelated';
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, actualSize, actualSize);
    ctx.fillStyle = '#000000';
    for (var row = 0; row < moduleCount; row++) {
      for (var col = 0; col < moduleCount; col++) {
        if (raw[row][col]) {
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }
  };

  // Generate QR code and return as PNG data URL
  QR.toDataURL = function(data, options) {
    var canvas = document.createElement('canvas');
    QR.generate(data, canvas, options);
    return canvas.toDataURL('image/png');
  };

  // Decode QR code from ImageData (canvas getImageData result)
  // Returns decoded string or null if not found
  QR.decode = function(imageData) {
    try {
      return decodeQR({ data: imageData.data, width: imageData.width, height: imageData.height });
    } catch (e) {
      return null;
    }
  };

  window.SSS.QR = QR;
})();
