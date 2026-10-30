#!/usr/bin/env node
/*
 * GP Refresh — prospectus access codes (no server).
 *
 * Generates unique per-prospect access codes and the public data file the access page uses to check them.
 *
 *   access-codes.csv               PRIVATE. The plain codes, one per prospect. Copy each into a GHL contact's
 *                                  prospectus_access_code field. Git-ignored; never publish it.
 *   preview/js/gpr-access-codes.js PUBLIC. No readable codes and no readable PDF link: for each code it holds only
 *                                  a lookup id and the PDF link encrypted with a key derived from that code.
 *
 * Usage (Node 18+, no packages needed):
 *   node make-access-codes.js --pdf-url https://.../prospectus.pdf --count 200   # first batch, or add 200 more
 *   node make-access-codes.js --pdf-url https://.../new-prospectus.pdf           # new PDF link, same codes
 *
 * The CSV is the source of truth: every run re-encrypts the link for every code in it, plus any new ones.
 * Set a code's status to "revoked" in the CSV and re-run to stop it working.
 *
 * Must match preview/js/gpr-prospectus-verify.js (normalisation, KDF, ids and keystream).
 */
"use strict";
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford base32: no I, L, O, U
const PREFIX = "GPR";
const GROUPS = [5, 5]; // GPR-XXXXX-XXXXX: 50 random bits per code
const ITERATIONS = 200000;
const FIELDS = ["code", "status", "assigned_to", "created"];

/* Same as the page: case, spaces and dashes don't matter; O/I/L read as 0/1/1. */
function normalise(code) {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

function newCode(existing) {
  for (;;) {
    const groups = GROUPS.map((n) => Array.from({ length: n }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join(""));
    const code = [PREFIX, ...groups].join("-");
    if (!existing.has(normalise(code))) return code;
  }
}

const sha256 = (...parts) => crypto.createHash("sha256").update(Buffer.concat(parts)).digest();

function masterKey(code, salt) {
  return crypto.pbkdf2Sync(normalise(code), salt, ITERATIONS, 32, "sha256");
}

function lookupId(master) {
  return sha256(Buffer.from("gpr-id"), master).toString("hex");
}

function encrypt(master, text) {
  const data = Buffer.from(text, "utf8");
  const blocks = [];
  for (let i = 0; i <= Math.floor(data.length / 32); i++) {
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(i);
    blocks.push(sha256(Buffer.from("gpr-enc"), master, counter));
  }
  const stream = Buffer.concat(blocks);
  return Buffer.from(data.map((b, i) => b ^ stream[i])).toString("hex");
}

/* Minimal CSV (handles quoted fields, so a spreadsheet re-save still reads back). */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function readRows(file) {
  if (!fs.existsSync(file)) return [];
  const [header, ...lines] = parseCsv(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));
  return lines
    .map((cells) => Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] || "").trim()])))
    .filter((row) => row.code);
}

function writeRows(file, rows) {
  const cell = (v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [FIELDS.join(","), ...rows.map((r) => FIELDS.map((f) => cell(r[f] || "")).join(","))];
  fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
}

function parseArgs(argv) {
  const args = { count: 0, csv: path.join(__dirname, "access-codes.csv"), js: path.join(__dirname, "preview", "js", "gpr-access-codes.js") };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s);
    const value = inline !== undefined ? inline : argv[++i];
    if (flag === "--pdf-url") args.pdfUrl = value;
    else if (flag === "--count") args.count = Number(value);
    else if (flag === "--csv") args.csv = path.resolve(value);
    else if (flag === "--js") args.js = path.resolve(value);
    else fail(`Unknown option ${flag}. Usage: node make-access-codes.js --pdf-url https://... [--count 200]`);
  }
  if (!args.pdfUrl) fail("--pdf-url is required.");
  if (!/^https:\/\//.test(args.pdfUrl)) fail("--pdf-url must start with https://");
  if (!Number.isInteger(args.count) || args.count < 0) fail("--count must be a whole number.");
  return args;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = readRows(args.csv);
  const existing = new Set(rows.map((r) => normalise(r.code)));
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < args.count; i++) {
    const code = newCode(existing);
    existing.add(normalise(code));
    rows.push({ code, status: "unused", assigned_to: "", created: today });
  }
  if (!rows.length) fail("No codes yet: pass --count to create some.");

  // A fresh salt every run, so ids and ciphertexts from earlier versions of the data file can't be compared
  const salt = crypto.randomBytes(16);
  const active = rows.filter((r) => (r.status || "").toLowerCase() !== "revoked");
  const entries = {};
  for (const row of active) {
    const master = masterKey(row.code, salt);
    entries[lookupId(master)] = encrypt(master, args.pdfUrl);
  }
  // Sorted ids, so the file's order doesn't reveal which codes are newest
  const sorted = Object.fromEntries(Object.keys(entries).sort().map((id) => [id, entries[id]]));
  const data = { v: 1, salt: salt.toString("hex"), iterations: ITERATIONS, entries: sorted };

  writeRows(args.csv, rows);
  fs.writeFileSync(
    args.js,
    "/* Generated by make-access-codes.js. Holds no readable codes or links; do not edit by hand. */\n" +
      `window.GPR_ACCESS_CODES = ${JSON.stringify(data)};\n`,
    "utf8"
  );
  console.log(`${active.length} active code(s) (${rows.length - active.length} revoked, ${args.count} new).`);
  console.log(`Private codes: ${args.csv}`);
  console.log(`Public page data: ${args.js}  (publish this file)`);
}

main();
