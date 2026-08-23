/* Dev-only static server. The preview pane renders file:// as an inert
   snapshot, so the app needs a real origin to actually run.
   Port 8420 matches the python desktop version described in CLAUDE.md. */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const TYPES = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(ROOT, path.normalize(p).replace(/^([\/])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end('no'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(buf);
  });
}).listen(8420, '127.0.0.1', () => console.log('nyaarank dev server on http://localhost:8420'));
