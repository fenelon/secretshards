// sssa-web/js/scanner.js
// QR code scanning: BarcodeDetector (native) with paulmillr-qr fallback
// Camera + file upload + manual text input

(function() {
  'use strict';

  if (!window.SSS) window.SSS = {};

  const Scanner = {};

  // Feature detection — camera requires getUserMedia + HTTPS (not file://)
  Scanner.hasCamera =
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia &&
    location.protocol !== 'file:';

  // Native BarcodeDetector (Chrome/Edge 83+) — much better with dense/noisy QR
  const nativeDetector = (typeof BarcodeDetector !== 'undefined')
    ? new BarcodeDetector({ formats: ['qr_code'] })
    : null;

  // Decode QR from an image source using native API, fall back to paulmillr-qr.
  // Accepts: ImageData, ImageBitmap, HTMLImageElement, HTMLCanvasElement, Blob
  // Returns: Promise<string|null>
  function decodeQR(source) {
    if (nativeDetector) {
      return nativeDetector.detect(source).then(function(barcodes) {
        if (barcodes.length > 0) return barcodes[0].rawValue;
        // Native found nothing — try JS fallback if source is ImageData
        if (source.data && source.width && source.height) {
          return SSS.QR.decode(source);
        }
        return null;
      }).catch(function() {
        // Native threw — try JS fallback
        if (source.data && source.width && source.height) {
          return SSS.QR.decode(source);
        }
        return null;
      });
    }
    // No native detector — synchronous JS decode wrapped in promise
    return Promise.resolve(SSS.QR.decode(source));
  }

  // Scan a QR code from an image file (File or Blob)
  // Returns: Promise<string> -- decoded text, or rejects
  Scanner.scanImage = function(file) {
    // Try native detector directly on the Blob first (best quality, no canvas)
    if (nativeDetector) {
      return nativeDetector.detect(file).then(function(barcodes) {
        if (barcodes.length > 0) return barcodes[0].rawValue;
        // Native failed on blob — try via ImageBitmap + canvas fallback
        return scanImageViaCanvas(file);
      }).catch(function() {
        return scanImageViaCanvas(file);
      });
    }
    return scanImageViaCanvas(file);
  };

  function scanImageViaCanvas(file) {
    return createImageBitmap(file).then(function(bitmap) {
      // Try native on the ImageBitmap
      if (nativeDetector) {
        return nativeDetector.detect(bitmap).then(function(barcodes) {
          if (barcodes.length > 0) return barcodes[0].rawValue;
          return jsFallbackDecode(bitmap);
        }).catch(function() {
          return jsFallbackDecode(bitmap);
        });
      }
      return jsFallbackDecode(bitmap);
    });
  }

  function jsFallbackDecode(bitmap) {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = SSS.QR.decode(imageData);
    if (!result) throw new Error('No QR code found in image');
    return result;
  }

  // Start camera scanning
  // videoElement: HTMLVideoElement to show the feed
  // onDetect: function(text) called when a QR code is detected
  // onError: function(err) called when camera access fails
  // Returns: { stop: function() } to stop scanning
  Scanner.startCamera = function(videoElement, onDetect, onError) {
    if (!Scanner.hasCamera) {
      throw new Error('Camera scanning not available');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let stream = null;
    let animationId = null;
    let stopped = false;
    let detecting = false;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    }).then(function(mediaStream) {
      if (stopped) {
        mediaStream.getTracks().forEach(function(t) { t.stop(); });
        return;
      }
      stream = mediaStream;
      videoElement.srcObject = stream;
      videoElement.play();

      function scan() {
        if (stopped || detecting) return;
        if (videoElement.readyState < videoElement.HAVE_CURRENT_DATA) {
          animationId = requestAnimationFrame(scan);
          return;
        }
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        ctx.drawImage(videoElement, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        detecting = true;
        decodeQR(imageData).then(function(result) {
          detecting = false;
          if (stopped) return;
          if (result) {
            onDetect(result);
          } else {
            animationId = requestAnimationFrame(scan);
          }
        }).catch(function() {
          detecting = false;
          if (!stopped) animationId = requestAnimationFrame(scan);
        });
      }
      videoElement.onloadedmetadata = function() {
        scan();
      };
    }).catch(function(err) {
      if (!stopped) {
        if (onError) {
          onError(err);
        } else {
          console.error('Camera error:', err);
        }
      }
    });

    return {
      stop: function() {
        stopped = true;
        if (animationId) cancelAnimationFrame(animationId);
        if (stream) stream.getTracks().forEach(function(t) { t.stop(); });
        videoElement.srcObject = null;
      }
    };
  };

  window.SSS.Scanner = Scanner;
})();
