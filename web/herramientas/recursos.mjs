// Genera los recursos estáticos de SEO a partir del logo y las capturas:
//   public/og/og-<idioma>.jpg      imagen Open Graph 1200×630 por idioma
//   public/favicon.ico             32×32 (PNG dentro de un ICO)
//   public/iconos/*.png            apple-touch-icon (180), 192, 512 y maskable 512
// Uso (desde web/): node herramientas/recursos.mjs   · Requiere sharp (viene con Astro).
import sharp from 'sharp';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (...p) => join(raiz, 'public', ...p);
const FONDO = '#0a0e1a';
const logo = readFileSync(pub('favicon.svg'));

const OG = {
  es: { lema: ['Builds Esmeralda+, tier list y coach', 'en partida para League of Legends'], chips: ['Gratis', 'Windows 10/11', 'Solo API oficiales de Riot'] },
  en: { lema: ['Emerald+ builds, tier list and an', 'in-game coach for League of Legends'], chips: ['Free', 'Windows 10/11', 'Official Riot APIs only'] },
  'pt-br': { lema: ['Builds Esmeralda+, tier list e coach', 'na partida para League of Legends'], chips: ['Grátis', 'Windows 10/11', 'Só APIs oficiais da Riot'] },
  fr: { lema: ['Builds Émeraude+, tier list et coach', 'en jeu pour League of Legends'], chips: ['Gratuit', 'Windows 10/11', 'API officielles de Riot'] },
  de: { lema: ['Smaragd+-Builds, Tier-List und', 'Ingame-Coach für League of Legends'], chips: ['Kostenlos', 'Windows 10/11', 'Nur offizielle Riot-APIs'] },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

async function og(lang, { lema, chips }) {
  const ancho = 1200;
  const alto = 630;
  const fondo = await sharp(pub('img', 'splash-ahri.webp')).resize(ancho, alto, { fit: 'cover', position: 'top' }).toBuffer();
  const captura = await sharp(pub('capturas', 'campeon-800.webp'))
    .resize(500, 312)
    .composite([
      {
        input: Buffer.from(`<svg width="500" height="312"><rect x="1" y="1" width="498" height="310" rx="16" fill="none" stroke="#c8aa6e" stroke-width="2"/></svg>`),
      },
    ])
    .png()
    .toBuffer();
  const mascaraCaptura = Buffer.from(`<svg width="500" height="312"><rect width="500" height="312" rx="16" fill="#fff"/></svg>`);
  const capturaRedonda = await sharp(captura).composite([{ input: mascaraCaptura, blend: 'dest-in' }]).png().toBuffer();
  let x = 72;
  let y = 400;
  const chipsSvg = chips
    .map((c) => {
      const w = Math.round(c.length * 9.6 + 34);
      if (x + w > 640) {
        x = 72;
        y += 54;
      }
      const svg = `<rect x="${x}" y="${y}" width="${w}" height="44" rx="22" fill="#121829" stroke="#c8aa6e" stroke-opacity="0.6"/><text x="${x + w / 2}" y="${y + 28}" text-anchor="middle" font-family="Segoe UI" font-weight="600" font-size="18" fill="#e2c98f">${esc(c)}</text>`;
      x += w + 12;
      return svg;
    })
    .join('');
  const capa = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stop-color="${FONDO}" stop-opacity="0.97"/>
        <stop offset="0.55" stop-color="${FONDO}" stop-opacity="0.82"/>
        <stop offset="1" stop-color="${FONDO}" stop-opacity="0.45"/>
      </linearGradient>
      <linearGradient id="t" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0.3" stop-color="#ffffff"/>
        <stop offset="1" stop-color="#e2c98f"/>
      </linearGradient>
    </defs>
    <rect width="${ancho}" height="${alto}" fill="url(#g)"/>
    <rect x="0" y="${alto - 6}" width="${ancho}" height="6" fill="#c8aa6e"/>
    <text x="168" y="168" font-family="Segoe UI" font-weight="700" font-size="66" fill="url(#t)">Coach LoL IA</text>
    <text x="72" y="270" font-family="Segoe UI" font-weight="600" font-size="30" fill="#e8ecf5">${esc(lema[0])}</text>
    <text x="72" y="318" font-family="Segoe UI" font-weight="600" font-size="30" fill="#e8ecf5">${esc(lema[1])}</text>
    ${chipsSvg}
    <text x="72" y="572" font-family="Segoe UI" font-size="22" fill="#8b97b8">www.coachlolia.com</text>
  </svg>`);
  const icono = await sharp(logo).resize(80, 80).png().toBuffer();
  mkdirSync(pub('og'), { recursive: true });
  await sharp(fondo)
    .composite([
      { input: capa },
      { input: icono, left: 72, top: 104 },
      { input: capturaRedonda, left: 668, top: 168 },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(pub('og', `og-${lang}.jpg`));
}

async function icono(tam, { relleno = 0, fondo = null } = {}) {
  const interior = Math.round(tam * (1 - relleno * 2));
  const img = await sharp(logo).resize(interior, interior).png().toBuffer();
  if (!fondo && relleno === 0) return img;
  return sharp({ create: { width: tam, height: tam, channels: 4, background: fondo ?? { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: img, gravity: 'center' }])
    .png()
    .toBuffer();
}

/** ICO con una sola imagen PNG (formato admitido por todos los navegadores actuales). */
function ico(png, tam) {
  const cab = Buffer.alloc(22);
  cab.writeUInt16LE(0, 0);
  cab.writeUInt16LE(1, 2);
  cab.writeUInt16LE(1, 4);
  cab.writeUInt8(tam, 6);
  cab.writeUInt8(tam, 7);
  cab.writeUInt8(0, 8);
  cab.writeUInt8(0, 9);
  cab.writeUInt16LE(1, 10);
  cab.writeUInt16LE(32, 12);
  cab.writeUInt32LE(png.length, 14);
  cab.writeUInt32LE(22, 18);
  return Buffer.concat([cab, png]);
}

for (const [lang, datos] of Object.entries(OG)) await og(lang, datos);
mkdirSync(pub('iconos'), { recursive: true });
writeFileSync(pub('favicon.ico'), ico(await icono(32), 32));
writeFileSync(pub('iconos', 'apple-touch-icon.png'), await icono(180, { relleno: 0.1, fondo: FONDO }));
writeFileSync(pub('iconos', 'icono-192.png'), await icono(192));
writeFileSync(pub('iconos', 'icono-512.png'), await icono(512));
writeFileSync(pub('iconos', 'icono-maskable-512.png'), await icono(512, { relleno: 0.16, fondo: FONDO }));
console.log('Recursos generados en public/');
