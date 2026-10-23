// Partes sin conexión del creador del servidor: leer los mensajes de docs/discord/mensajes/, resolver menciones y
// comprobar que el diseño de servidor.mjs es coherente. Las usan crear-servidor.mjs (también con --simular) y los tests.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTOMOD, CATEGORIAS, PREGUNTAS, ROLES } from './servidor.mjs';

export const CARPETA_MENSAJES = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs', 'discord', 'mensajes');

/** Límite de caracteres de un mensaje de Discord. */
export const MAX_MENSAJE = 2000;
/** Un ID de Discord tiene hasta 20 cifras: con él se calcula la longitud final de las menciones. */
const ID_LARGO = '1'.repeat(20);

/** Todos los canales del diseño, con su categoría. */
export function canales() {
  return CATEGORIAS.flatMap((categoria) => categoria.canales.map((canal) => ({ ...canal, categoria })));
}

/**
 * Lee un archivo de mensajes: un bloque por mensaje, separados por una línea con solo «---». Se quita el comentario
 * HTML inicial. En un foro (`foro`), el primer bloque es el título de la publicación.
 */
export function leerMensajes(nombre, foro = false) {
  const texto = readFileSync(join(CARPETA_MENSAJES, `${nombre}.md`), 'utf8')
    .replace(/\r\n/g, '\n')
    .replace(/^<!--[\s\S]*?-->\n/, '');
  const partes = texto
    .split(/\n---\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (!foro) return { titulo: null, partes };
  const [titulo, ...resto] = partes;
  return { titulo, partes: resto };
}

/** Cambia `<#canal>` y `<@&Rol>` por los IDs reales. Lanza si alguno no existe. */
export function resolverMenciones(texto, idCanal, idRol) {
  return texto
    .replace(/<#([^>\d][^>]*)>/g, (_, nombre) => {
      const id = idCanal(nombre);
      if (!id) throw new Error(`Mención a un canal que no existe: #${nombre}`);
      return `<#${id}>`;
    })
    .replace(/<@&([^>\d][^>]*)>/g, (_, nombre) => {
      const id = idRol(nombre);
      if (!id) throw new Error(`Mención a un rol que no existe: @${nombre}`);
      return `<@&${id}>`;
    });
}

/** Separa «🐞 Bug» en emoji y nombre (etiquetas de foro). */
export function etiqueta(texto) {
  const [emoji, ...resto] = texto.split(' ');
  return { emoji, nombre: resto.join(' ') };
}

/** Comprueba el diseño entero sin conectarse. Devuelve la lista de errores (vacía si todo está bien). */
export function comprobarDiseno() {
  const errores = [];
  const nombresRoles = new Set(ROLES.map((r) => r.nombre));
  const lista = canales();
  const nombresCanales = new Set(lista.map((c) => c.nombre));
  const idCanal = (n) => (nombresCanales.has(n) ? ID_LARGO : null);
  const idRol = (n) => (nombresRoles.has(n) ? ID_LARGO : null);

  if (nombresRoles.size !== ROLES.length) errores.push('Hay roles repetidos');
  if (nombresCanales.size !== lista.length) errores.push('Hay canales repetidos');

  for (const c of lista) {
    if (!['texto', 'anuncios', 'foro', 'voz', 'escenario'].includes(c.tipo)) errores.push(`#${c.nombre}: tipo desconocido ${c.tipo}`);
    if (['texto', 'anuncios', 'foro'].includes(c.tipo) && c.nombre !== c.nombre.toLowerCase()) errores.push(`#${c.nombre}: los canales de texto van en minúsculas`);
    if (c.tema && c.tema.length > (c.tipo === 'foro' ? 4096 : 1024)) errores.push(`#${c.nombre}: tema demasiado largo`);
    for (const rol of Object.keys(c.permisos ?? c.categoria.permisos ?? {})) {
      if (rol !== '@everyone' && !nombresRoles.has(rol)) errores.push(`#${c.nombre}: permisos para un rol que no existe (${rol})`);
    }
    for (const t of c.etiquetas ?? []) {
      const { emoji, nombre } = etiqueta(t);
      if (!emoji || !nombre || nombre.length > 20) errores.push(`#${c.nombre}: etiqueta no válida «${t}»`);
    }
    if ((c.etiquetas ?? []).length > 20) errores.push(`#${c.nombre}: más de 20 etiquetas`);
    if (!c.mensajes) continue;
    try {
      const { titulo, partes } = leerMensajes(c.mensajes, c.tipo === 'foro');
      if (c.tipo === 'foro' && (!titulo || titulo.length > 100)) errores.push(`${c.mensajes}.md: falta el título o pasa de 100 caracteres`);
      if (!partes.length) errores.push(`${c.mensajes}.md: no tiene mensajes`);
      partes.forEach((p, i) => {
        const final = resolverMenciones(p, idCanal, idRol);
        if (final.length > MAX_MENSAJE) errores.push(`${c.mensajes}.md, mensaje ${i + 1}: ${final.length} caracteres (máximo ${MAX_MENSAJE})`);
      });
    } catch (e) {
      errores.push(`${c.mensajes}.md: ${e.message}`);
    }
  }

  const predeterminados = lista.filter((c) => c.predeterminado);
  const conEscritura = predeterminados.filter((c) => !c.permisos && !c.categoria.permisos);
  if (predeterminados.length < 7 || conEscritura.length < 5) errores.push('«Canales y roles» pide 7 canales predeterminados, 5 de ellos con escritura');

  for (const regla of AUTOMOD) {
    if (regla.aviso.length > 150) errores.push(`AutoMod «${regla.nombre}»: el aviso pasa de 150 caracteres`);
    for (const p of regla.palabras) if (p.length > 60) errores.push(`AutoMod: palabra demasiado larga (${p})`);
    for (const r of regla.exentos ?? []) if (!nombresRoles.has(r)) errores.push(`AutoMod «${regla.nombre}»: rol exento que no existe (${r})`);
  }

  for (const p of PREGUNTAS) {
    const roles = ROLES.filter((r) => r.grupo === p.grupo);
    if (!roles.length) errores.push(`Pregunta «${p.titulo}»: grupo sin roles`);
    if (p.emojis.length !== roles.length) errores.push(`Pregunta «${p.titulo}»: hay ${roles.length} roles y ${p.emojis.length} emojis`);
  }
  return errores;
}
