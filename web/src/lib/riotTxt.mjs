// Verificación del sitio en el Riot Developer Portal: https://www.coachlolia.com/riot.txt
// (https://developer.riotgames.com/how-to-verify-site.html). El archivo NO está en el repositorio: su contenido
// es la cadena que da el portal después de enviar la solicitud de producción. Cuando exista, se guarda en
// web/public/riot.txt y Astro lo copia tal cual a la raíz del sitio (GitHub Pages lo sirve como text/plain).

/**
 * Problemas de un riot.txt (bytes del archivo): debe ser solo la cadena del portal, en UTF-8 sin BOM y sin
 * espacios ni saltos de línea antes o después. Devuelve la lista de problemas (vacía si es válido).
 * @param {Uint8Array} bytes
 * @returns {string[]}
 */
export function problemasRiotTxt(bytes) {
  const problemas = [];
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) problemas.push('lleva BOM (guárdalo como UTF-8 sin BOM)');
  const texto = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
  if (texto.length === 0) problemas.push('está vacío');
  else {
    if (texto !== texto.trim()) problemas.push('tiene espacios o saltos de línea al principio o al final');
    if (/[\r\n]/.test(texto.trim())) problemas.push('tiene más de una línea');
  }
  return problemas;
}
