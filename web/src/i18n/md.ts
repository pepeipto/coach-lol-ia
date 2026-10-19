// Marcado mínimo para los textos traducidos: **negrita**, *cursiva*, `código` y [texto](destino).
// El destino puede ser una URL externa (https://…, mailto:…) o una página interna con «@clave» o «@clave#ancla»,
// que se resuelve a la ruta de ese idioma. Todo el texto se escapa antes de convertir el marcado.
import { ruta, SLUGS, type Idioma, type Pagina } from './idiomas.ts';

const escapar = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function destino(href: string, lang: Idioma): string {
  if (!href.startsWith('@')) return href;
  const [clave, ancla = ''] = href.slice(1).split('#');
  if (!(clave in SLUGS)) throw new Error(`Enlace interno desconocido: ${href}`);
  return ruta(lang, clave as Pagina, ancla ? `#${ancla}` : '');
}

export function md(texto: string, lang: Idioma): string {
  // Los `códigos` se apartan primero para que su contenido no se interprete como marcado.
  const codigos: string[] = [];
  let s = escapar(texto).replace(/`([^`]+)`/g, (_, c: string) => {
    codigos.push(c);
    return `\u0000${codigos.length - 1}\u0000`;
  });
  s = s
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t: string, h: string) => {
      const url = destino(h.replace(/&amp;/g, '&'), lang);
      const externo = /^https?:\/\//.test(url);
      return `<a href="${escapar(url)}"${externo ? ' rel="noopener"' : ''}>${t}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<code>${codigos[Number(i)]}</code>`);
}
