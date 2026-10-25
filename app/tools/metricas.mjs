// Cifras de difusión: descargas de cada versión en GitHub Releases y tarjetas compartidas (contador anónimo del servidor).
// Uso: node app/tools/metricas.mjs
const REPO = 'pepeipto/coach-lol-ia';
const SERVIDOR = process.env.COACH_SERVIDOR ?? 'https://api.coachlolia.com';

const versiones = await (await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, { headers: { Accept: 'application/vnd.github+json' } })).json();
let total = 0;
console.log('Descargas del instalador por versión:');
for (const v of versiones) {
  const n = v.assets.filter((a) => a.name.endsWith('.exe')).reduce((s, a) => s + a.download_count, 0);
  total += n;
  console.log(`  ${v.tag_name.padEnd(10)} ${String(n).padStart(6)}   (${v.published_at?.slice(0, 10) ?? ''})`);
}
console.log(`  Total      ${String(total).padStart(6)}`);
try {
  const m = await (await fetch(`${SERVIDOR}/api/metricas`)).json();
  console.log(`Tarjetas compartidas: ${m.tarjetas.total} en total, ${m.tarjetas.ultimos7Dias} en los últimos 7 días`);
} catch {
  console.log('Tarjetas compartidas: el servidor todavía no tiene el contador (despliega la 3.7).');
}
