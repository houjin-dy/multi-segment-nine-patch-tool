// Build a self-contained offline HTML file from the maintained source files.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..'), dir = path.join(root, 'resource-packager');
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="style.css\?v=1">/, () => '<style>' + fs.readFileSync(path.join(dir, 'style.css'), 'utf8') + '</style>');
const scripts = [];
html = html.replace(/^[ \t]*<script defer src="([^"]+)\?v=1"><\/script>[ \t]*\r?$/gm, (_, name) => { scripts.push(name); return ''; });
html = html.replaceAll('../index.html', 'index.html').replace('</body>', () => scripts.map(name => '<script>' + fs.readFileSync(path.join(dir, name), 'utf8').replace(/<\/script/gi, '<\\/script') + '</script>').join('\n') + '\n</body>');
fs.writeFileSync(path.join(root, 'resource-packager.html'), html);
console.log('Built resource-packager.html (' + Buffer.byteLength(html) + ' bytes)');
