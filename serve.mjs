// Serve the app locally: node serve.mjs [port] [--no-open]
// Static files from this folder, localhost only, no caching (so edits to anchors.json show
// on reload). Uses port 4791 (or the given port) and moves up to 20 ports past it if that
// one is busy. No dependencies.
//
// Keep the port stable: the browser keeps saved data (the last selection now, mastery
// progress from M4) per address, and the port is part of the address. On any other port
// the app starts with nothing saved, so a fallback prints a warning.

import { createServer } from 'node:http';
import { connect } from 'node:net';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = fileURLToPath(new URL('.', import.meta.url)).replace(/[\\/]$/, '');
const HOSTS = ['127.0.0.1', '::1']; // "localhost" can mean either; claim the port on both
const DEFAULT_PORT = 4791; // uncommon on purpose, so it's almost never busy
const TRIES = 21;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.md': 'text/plain; charset=utf-8',
};

const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');
const portArg = args.find(a => !a.startsWith('--'));
const firstPort = portArg === undefined ? DEFAULT_PORT : Number(portArg);
if (!Number.isInteger(firstPort) || firstPort < 1 || firstPort > 65535) {
  console.error(`Not a port number: ${portArg}. Usage: node serve.mjs [port] [--no-open]`);
  process.exit(1);
}

function send(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(`${text}\n`);
}

async function handle(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch {
    return send(res, 400, 'Bad request');
  }
  if (path.includes('\0')) return send(res, 400, 'Bad request');
  if (path.split('/').some(part => part.startsWith('.'))) return send(res, 404, 'Not found'); // .git etc.
  let file = normalize(join(ROOT, path));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return send(res, 403, 'Forbidden');
  try {
    let info = await stat(file);
    if (info.isDirectory()) {
      file = join(file, 'index.html');
      info = await stat(file);
    }
    if (!info.isFile()) return send(res, 404, 'Not found');
    res.writeHead(200, {
      'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch {
    send(res, 404, 'Not found');
  }
}

// True if something already answers on this port (e.g. another project's server bound to
// all addresses, which wouldn't stop us binding 127.0.0.1 but would confuse the browser).
function answers(host, port) {
  return new Promise(resolve => {
    const socket = connect({ host, port });
    const done = result => { socket.destroy(); resolve(result); };
    socket.setTimeout(300, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

function listen(host, port) {
  return new Promise((resolve, reject) => {
    const server = createServer(handle);
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}

// Claim `port` on every localhost address. Resolves to the servers, or null if busy.
async function claim(port) {
  for (const host of HOSTS) {
    if (await answers(host, port)) return null;
  }
  const servers = [];
  for (const host of HOSTS) {
    try {
      servers.push(await listen(host, port));
    } catch (err) {
      if (err.code === 'EADDRNOTAVAIL' || err.code === 'EAFNOSUPPORT') continue; // no IPv6
      for (const s of servers) s.close();
      if (err.code === 'EADDRINUSE' || err.code === 'EACCES') return null;
      throw err;
    }
  }
  return servers.length ? servers : null;
}

let started = false;
for (let port = firstPort; port < firstPort + TRIES && port <= 65535; port++) {
  const servers = await claim(port);
  if (!servers) continue;
  started = true;
  const url = `http://localhost:${port}`;
  console.log(`Âncoras: ${url}  (Ctrl+C to stop)`);
  if (port !== firstPort) console.log(`(Port ${firstPort} was busy, so this uses ${port}.)`);
  if (port !== DEFAULT_PORT) {
    console.log(`Warning: your saved settings and progress live on port ${DEFAULT_PORT}, so ` +
      `they won't show here and anything saved now stays on ${port}. To get them back, stop ` +
      `whatever is using ${DEFAULT_PORT} and run "node serve.mjs" again.`);
  }
  if (!noOpen && process.platform === 'darwin') {
    try {
      spawn('open', [url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref();
    } catch {
      // Opening the browser is a convenience; the address is printed above.
    }
  }
  process.on('SIGINT', () => process.exit(0));
  break;
}

if (!started) {
  console.error(`Ports ${firstPort}–${firstPort + TRIES - 1} are all busy. ` +
    `Close another local server and try again (saved progress lives on ${DEFAULT_PORT}).`);
  process.exit(1);
}
