// Minimal Node server (no deps) to persist data in data.json and serve static files
// Run: node server.js (then open http://localhost:3000)

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = __dirname;

function readData(){
  try{ return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch{ return { users:{} }; }
}
function writeData(obj){ fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2)); }

function send(res, status, body, headers={}){
  const h = Object.assign({'Content-Type':'text/plain; charset=utf-8','Access-Control-Allow-Origin':'*'}, headers);
  res.writeHead(status, h); res.end(body);
}

  const MIME = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.ico':'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const method = req.method || 'GET';

  // CORS preflight
  if (method === 'OPTIONS'){
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (url.pathname === '/api/ping'){
    return send(res, 200, 'ok');
  }

  if (url.pathname === '/api/load' && method === 'GET'){
    const user = url.searchParams.get('user') || 'Seb';
    const db = readData();
    const outRaw = db.users[user] || {};
    const out = {
      themes: outRaw.themes || [],
      entries: outRaw.entries || {},
      sizes: outRaw.sizes || [],
      emotions: outRaw.emotions || [],
      emotionColors: outRaw.emotionColors || {},
      pebbleColorTray: outRaw.pebbleColorTray || outRaw.pebbleColor || '#edeae4',
      pebbleColorChip: outRaw.pebbleColorChip || outRaw.pebbleColor || '#edeae4',
      ringThickness: Number.isFinite(outRaw.ringThickness) ? outRaw.ringThickness : 16,
      handleDiameter: Number.isFinite(outRaw.handleDiameter) ? outRaw.handleDiameter : 16,
    };
    return send(res, 200, JSON.stringify(out), {'Content-Type':'application/json; charset=utf-8'});
  }

  if (url.pathname === '/api/save' && method === 'POST'){
    let body='';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try{
        const data = JSON.parse(body||'{}');
        const user = data.user || 'Seb';
        const db = readData();
        db.users[user] = {
          themes: data.themes||[],
          entries: data.entries||{},
          sizes: data.sizes||[],
          emotions: data.emotions||[],
          emotionColors: data.emotionColors||{},
          pebbleColor: data.pebbleColor||undefined,
          pebbleColorTray: data.pebbleColorTray||'#edeae4',
          pebbleColorChip: data.pebbleColorChip||'#edeae4',
          ringThickness: Number.isFinite(data.ringThickness)? data.ringThickness : 16,
          handleDiameter: Number.isFinite(data.handleDiameter)? data.handleDiameter : 16
        };
        writeData(db);
        return send(res, 200, JSON.stringify({ok:true}), {'Content-Type':'application/json; charset=utf-8'});
      }catch(err){ return send(res, 400, 'bad json'); }
    });
    return;
  }

  // Static serving
  let filePath = path.join(PUBLIC_DIR, decodeURIComponent(url.pathname));
  if (url.pathname === '/' || !path.extname(filePath)) filePath = path.join(PUBLIC_DIR, 'index.html');
  fs.readFile(filePath, (err, buf) => {
    if (err){ return send(res, 404, 'Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || 'application/octet-stream';
    send(res, 200, buf, {'Content-Type': mime});
  });
});

server.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
