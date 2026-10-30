#!/usr/bin/env node
/*
 * Local static server for testing the previews (Node 18+, no packages needed).
 *
 *   node serve.js [port]      then open http://localhost:8000/preview/our-world.html
 *
 * Serves this folder only, for local testing; not for production.
 */
"use strict";
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.argv[2]) || 8000;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".pdf": "application/pdf",
};

http.createServer((req, res) => {
  let file;
  try {
    file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://localhost").pathname));
  } catch (error) {
    res.writeHead(400).end("Bad request");
    return;
  }
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream" }).end(data);
  });
}).listen(PORT, () => {
  console.log(`Serving ${ROOT} at http://localhost:${PORT}/preview/our-world.html`);
});
