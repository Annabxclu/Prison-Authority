#!/bin/bash
set -e
cd "$(dirname "$0")"
{
echo '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prison Management Simulator</title>'
echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">'
echo '<style>'; cat src/style.css; echo '</style></head><body>'
echo '<div id="menu" class="hide"></div><div id="app" class="hide"><header id="hdr"></header><nav id="nav"></nav><main id="main"></main></div><div id="modalBg" class="hide"></div><div id="toasts"></div>'
echo '<script>'; cat src/core.js src/sim.js src/ui.js src/app.js; echo '</script></body></html>'
} > index.html
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const s=h.split('<script>')[1].split('</script>')[0];new Function(s);console.log('syntax ok',h.length)"
