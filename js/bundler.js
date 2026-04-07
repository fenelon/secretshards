(function() {
  'use strict';
  if (!window.SSS) window.SSS = {};
  const Bundler = {};

  const CSS_FILES = ['css/style.css', 'css/print.css'];
  const JS_FILES = ['js/sss.js', 'js/qr-bundle.js', 'js/qr.js', 'js/scanner.js', 'js/ui.js', 'js/download.js', 'js/split.js', 'js/combine.js', 'js/app.js'];

  Bundler.download = function() {
    const allPaths = ['index.html'].concat(CSS_FILES, JS_FILES);
    const fetches = allPaths.map(function(path) {
      return fetch(path).then(function(r) { return r.text(); }).then(function(text) {
        return { path: path, content: text };
      });
    });

    Promise.all(fetches).then(function(results) {
      let cssContent = '';
      let printCssContent = '';
      let jsContent = '';
      let htmlSource = '';
      results.forEach(function(file) {
        if (file.path === 'index.html') {
          htmlSource = file.content;
        } else if (file.path === 'css/print.css') {
          printCssContent = file.content;
        } else if (file.path.endsWith('.css')) {
          cssContent += file.content + '\n';
        } else {
          jsContent += file.content + '\n';
        }
      });

      // Start from original HTML, inline CSS/JS, remove external refs
      let html = htmlSource;

      // Remove CSP (incompatible with inline scripts/styles) and favicon links (no files offline)
      html = html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/g, '');
      html = html.replace(/<link rel="apple-touch-icon"[^>]*>\n?/g, '');
      html = html.replace(/<link rel="icon"[^>]*>\n?/g, '');

      // Replace external CSS links with inlined styles
      html = html.replace(/<link rel="stylesheet" href="css\/[^"]*"[^>]*>\n?/g, '');
      var date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      var bannerHTML = 'You\u2019re using an offline copy saved on ' + date + '.<br> The live version at <a href="https://secretshards.com">SecretShards.com</a> may have new features \u2014 <a href="https://secretshards.com">redownload anytime</a>.';
      html = html.replace(/<div class="download-banner-inner">[\s\S]*?<\/div>/, '<div class="download-banner-inner">' + bannerHTML + '</div>');
      var offlineBannerCSS = '.download-banner { background-color: #1a1400; border-bottom: 1px solid #332800; }\n' +
        '.download-banner-inner { color: #997a00; }\n' +
        '.download-banner-inner a { color: #cca300; }\n' +
        '.download-banner-inner a:hover { color: #e6b800; }\n';
      html = html.replace('</head>', '  <style>\n' + cssContent + '  </style>\n  <style media="print">\n' + printCssContent + '  </style>\n  <style>\n' + offlineBannerCSS + '  </style>\n</head>');

      // Replace external script tags with single inlined script
      html = html.replace(/<script defer src="js\/[^"]*"><\/script>\n?/g, '');
      html = html.replace('</body>', '  <script>\n' + jsContent + '  <\/script>\n</body>');

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
      var banner = document.getElementById('download-banner');
      if (banner) {
        var inner = banner.querySelector('.download-banner-inner');
        if (inner) inner.textContent = 'Download failed: ' + err.message;
      }
    });
  };

  window.SSS.Bundler = Bundler;
})();
