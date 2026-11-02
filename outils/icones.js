// Dessine les icônes de l'application (formes simples, aucune image extérieure) : node outils/icones.js
// Produit docs/icones/icone.svg, icon-192.png, icon-512.png et icon-maskable-512.png.
// Les PNG sont calculés ici, sans bibliothèque : anneau bleu + coche dorée sur fond nuit bleue.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SORTIE = path.join(__dirname, '..', 'docs', 'icones');
const FOND_CENTRE = [0x1B, 0x2D, 0x5E], FOND_BORD = [0x0B, 0x12, 0x26];
const ANNEAU = [0x8F, 0xB2, 0xFF], COCHE = [0xE8, 0xC4, 0x68];
// Formes en coordonnées 0..1. Tout tient dans un cercle de rayon 0,30 : zone sûre « maskable » (0,40) respectée.
const R_ANNEAU = 0.27, E_ANNEAU = 0.045, E_COCHE = 0.06, RAYON_COINS = 0.22;
const COCHE_PTS = [[0.38, 0.51], [0.47, 0.60], [0.64, 0.41]];

function distSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function dansCarreArrondi(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r), cy = Math.min(Math.max(y, r), 1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}
// Couleur d'un point : null = transparent.
function couleur(x, y, plein) {
  if (!plein && !dansCarreArrondi(x, y, RAYON_COINS)) return null;
  const t = Math.min(1, Math.hypot(x - 0.5, y - 0.5) / 0.7071);
  let c = FOND_CENTRE.map(function (v, i) { return v + (FOND_BORD[i] - v) * t; });
  if (Math.abs(Math.hypot(x - 0.5, y - 0.5) - R_ANNEAU) <= E_ANNEAU / 2) c = ANNEAU;
  for (let i = 0; i < COCHE_PTS.length - 1; i++) {
    const a = COCHE_PTS[i], b = COCHE_PTS[i + 1];
    if (distSegment(x, y, a[0], a[1], b[0], b[1]) <= E_COCHE / 2) c = COCHE;
  }
  return c;
}

// ---------- PNG minimal (RGBA 8 bits) ----------
const CRC = new Int32Array(256).map(function (_, n) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
function crc32(buf) { let c = -1; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function bloc(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]), crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(taille, plein) {
  const SS = 4, lignes = Buffer.alloc(taille * (taille * 4 + 1));
  for (let py = 0; py < taille; py++) {
    lignes[py * (taille * 4 + 1)] = 0;
    for (let px = 0; px < taille; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
        const c = couleur((px + (sx + 0.5) / SS) / taille, (py + (sy + 0.5) / SS) / taille, plein);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const o = py * (taille * 4 + 1) + 1 + px * 4;
      lignes[o] = a ? Math.round(r / a) : 0; lignes[o + 1] = a ? Math.round(g / a) : 0; lignes[o + 2] = a ? Math.round(b / a) : 0;
      lignes[o + 3] = Math.round(255 * a / (SS * SS));
    }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(taille, 0); ihdr.writeUInt32BE(taille, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(lignes, { level: 9 })), bloc('IEND', Buffer.alloc(0))]);
}

// ---------- SVG équivalent (même dessin) ----------
function hex(c) { return '#' + c.map(function (v) { return v.toString(16).padStart(2, '0'); }).join(''); }
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<defs><radialGradient id="f" cx="50%" cy="50%" r="70.71%"><stop offset="0" stop-color="' + hex(FOND_CENTRE) + '"/><stop offset="1" stop-color="' + hex(FOND_BORD) + '"/></radialGradient></defs>' +
  '<rect width="100" height="100" rx="' + RAYON_COINS * 100 + '" fill="url(#f)"/>' +
  '<circle cx="50" cy="50" r="' + R_ANNEAU * 100 + '" fill="none" stroke="' + hex(ANNEAU) + '" stroke-width="' + E_ANNEAU * 100 + '"/>' +
  '<polyline points="' + COCHE_PTS.map(function (p) { return p[0] * 100 + ',' + p[1] * 100; }).join(' ') + '" fill="none" stroke="' + hex(COCHE) + '" stroke-width="' + E_COCHE * 100 + '" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>\n';

fs.mkdirSync(SORTIE, { recursive: true });
fs.writeFileSync(path.join(SORTIE, 'icone.svg'), svg);
fs.writeFileSync(path.join(SORTIE, 'icon-192.png'), png(192, false));
fs.writeFileSync(path.join(SORTIE, 'icon-512.png'), png(512, false));
fs.writeFileSync(path.join(SORTIE, 'icon-maskable-512.png'), png(512, true));
console.log('Icônes écrites dans docs/icones/ : icone.svg, icon-192.png, icon-512.png, icon-maskable-512.png');
