#!/bin/sh
# bundle.sh -- produces a single self-contained HTML file
# Usage: ./bundle.sh > sss-offline.html
set -e
cd "$(dirname "$0")"

cat <<'HEADER'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Shamir's Secret Sharing (Offline)</title>
  <style>
HEADER

cat css/style.css

cat <<'MID1'
  </style>
  <style>.download-banner { display: none !important; }</style>
</head>
<body>
MID1

# Extract body content, excluding script/link tags
sed -n '/<body>/,/<\/body>/p' index.html | \
  grep -v '<body>' | \
  grep -v '</body>' | \
  grep -v '<script' | \
  grep -v '</script>' | \
  grep -v '<link '

cat <<'MID2'
  <script>
MID2

cat js/sss.js
cat js/qr-generate.js
cat js/scanner.js
cat js/app.js

cat <<'FOOTER'
  </script>
</body>
</html>
FOOTER
