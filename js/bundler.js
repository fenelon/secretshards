(function() {
  'use strict';
  if (!window.SSS) window.SSS = {};
  const Bundler = {};

  const CSS_FILES = ['css/style.css'];
  const JS_FILES = ['js/sss.js', 'js/qr-bundle.js', 'js/qr.js', 'js/scanner.js', 'js/app.js'];

  Bundler.download = function() {
    const allPaths = ['index.html'].concat(CSS_FILES, JS_FILES);
    const fetches = allPaths.map(function(path) {
      return fetch(path).then(function(r) { return r.text(); }).then(function(text) {
        return { path: path, content: text };
      });
    });

    Promise.all(fetches).then(function(results) {
      let cssContent = '';
      let jsContent = '';
      let htmlSource = '';
      results.forEach(function(file) {
        if (file.path === 'index.html') {
          htmlSource = file.content;
        } else if (file.path.endsWith('.css')) {
          cssContent += file.content + '\n';
        } else {
          jsContent += file.content + '\n';
        }
      });

      // Parse the original HTML to extract pristine body content
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlSource, 'text/html');
      const mainHTML = doc.querySelector('main').outerHTML;
      const modalHTML = doc.getElementById('camera-modal').outerHTML;

      const parts = [];
      parts.push('<!DOCTYPE html>');
      parts.push('<html lang="en">');
      parts.push('<head>');
      parts.push('  <meta charset="utf-8">');
      parts.push('  <meta name="viewport" content="width=device-width, initial-scale=1">');
      parts.push("  <title>Shamir's Secret Sharing (Offline)</title>");
      parts.push('  <style>');
      parts.push(cssContent);
      parts.push('  </style>');
      parts.push('  <style>.download-banner { display: none !important; }</style>');
      parts.push('</head>');
      parts.push('<body>');
      parts.push(mainHTML);
      parts.push(modalHTML);
      parts.push('  <script>');
      parts.push(jsContent);
      parts.push('  <\/script>');
      parts.push('</body>');
      parts.push('</html>');

      const html = parts.join('\n');
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = SSS.timestampedName('sss-') + '.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }).catch(function(err) {
      console.error('Bundling failed:', err);
    });
  };

  window.SSS.Bundler = Bundler;
})();
