// sssa-web/js/scanner.js
// QR code scanning via SSS.QR.decode (paulmillr-qr)
// Camera + file upload + manual text input

(function() {
  'use strict';

  if (!window.SSS) window.SSS = {};

  var Scanner = {};

  // Feature detection — camera requires getUserMedia + HTTPS (not file://)
  Scanner.hasCamera =
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia &&
    location.protocol !== 'file:';

  // Scan a QR code from an image file (File or Blob)
  // Returns: Promise<string> -- decoded text, or rejects
  Scanner.scanImage = function(file) {
    return createImageBitmap(file).then(function(bitmap) {
      var canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var result = SSS.QR.decode(imageData);
      if (!result) throw new Error('No QR code found in image');
      return result;
    });
  };

  // Start camera scanning
  // videoElement: HTMLVideoElement to show the feed
  // onDetect: function(text) called when a QR code is detected
  // onError: function(err) called when camera access fails
  // Returns: { stop: function() } to stop scanning
  Scanner.startCamera = function(videoElement, onDetect, onError) {
    if (!Scanner.hasCamera) {
      throw new Error('Camera scanning not available');
    }

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var stream = null;
    var animationId = null;
    var stopped = false;

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
        if (stopped) return;
        if (videoElement.readyState < videoElement.HAVE_CURRENT_DATA) {
          animationId = requestAnimationFrame(scan);
          return;
        }
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        ctx.drawImage(videoElement, 0, 0);
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        var result = SSS.QR.decode(imageData);
        if (result) {
          onDetect(result);
        } else {
          animationId = requestAnimationFrame(scan);
        }
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
