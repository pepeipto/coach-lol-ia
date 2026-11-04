// Aviso de clave de Riot caducada (lo ejecuta .github/workflows/clave-riot.yml cada 30 min).
//
// Antes de que caduque: si /salud trae `riotCaduca` (la hora estimada en que caduca la clave de desarrollo) y faltan
// menos de VENTANA_PRONTO_MS, abre UNA issue «⏳ La clave de Riot caduca pronto» (etiqueta clave-riot-pronto); se
// cierra sola al renovarla (la hora se aleja) o cuando ya ha caducado (entonces avisa la otra).
//
// Lee GET https://api.coachlolia.com/salud y:
//   - riot = 'caducada' y ninguna issue abierta con la etiqueta clave-riot → abre UNA, asignada a pepeipto
//     (GitHub avisa por correo y en la app móvil);
//   - riot = 'ok' con issues abiertas → las comenta y las cierra;
//   - en cualquier otro caso (servidor caído, 'desconocida'…) no toca nada.
// Usa la CLI `gh` con el GITHUB_TOKEN del workflow. Sin dependencias: node scripts/clave-riot-aviso.mjs
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const URL_SALUD = 'https://api.coachlolia.com/salud';
export const ETIQUETA = 'clave-riot';
export const TITULO = '🔑 Renueva la clave de Riot (caducada)';
export const ASIGNADO = 'pepeipto';
export const ETIQUETA_PRONTO = 'clave-riot-pronto';
export const TITULO_PRONTO = '⏳ La clave de Riot caduca pronto';
/**
 * Con cuánta antelación se avisa. GitHub no lanza el cron cada 30 min con puntualidad (a veces pasan ~6 h entre
 * ejecuciones), así que la ventana es amplia para que al menos una ejecución caiga dentro.
 */
export const VENTANA_PRONTO_MS = 8 * 60 * 60_000;

/** «29/10 a las 21:15 (hora de Madrid)». */
export function textoHora(iso) {
  const f = new Date(iso);
  const fmt = (o) => new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', ...o }).format(f);
  return `${fmt({ day: '2-digit', month: '2-digit' })} a las ${fmt({ hour: '2-digit', minute: '2-digit', hour12: false })} (hora de Madrid)`;
}

export function cuerpoIssuePronto(riotCaduca) {
  return `La clave de desarrollo de Riot del servidor caduca, según la estimación del servidor, el **${textoHora(riotCaduca)}** (${riotCaduca} UTC). Renuévala antes para que la pantalla de carga y el recolector no se queden sin datos.

1. Abre https://developer.riotgames.com, pulsa **Regenerate API Key** y copia la clave nueva.
2. Abre https://api.coachlolia.com/admin/clave, pégala con tu contraseña de administrador y pulsa «Guardar clave» (o usa «Renovar clave Riot» en el PC).

Esta issue se cierra sola cuando el servidor use una clave nueva. No pegues la clave aquí.`;
}

/**
 * Aviso previo según `riotCaduca` y las issues abiertas con ETIQUETA_PRONTO:
 *   - ok y caduca dentro de la ventana (y aún no ha pasado) → abrir (si no hay ninguna);
 *   - ok y caduca más tarde (renovada) o ya caducada → cerrar las abiertas;
 *   - sin `riotCaduca` (clave de producción o servidor antiguo) o estado desconocido → nada.
 */
export function decidirPronto(salud, abiertas, ahora) {
  if (salud.riot === 'caducada') return abiertas.length > 0 ? { accion: 'cerrar', numeros: abiertas.map((i) => i.number) } : { accion: 'nada' };
  const caduca = Date.parse(salud.riotCaduca ?? '');
  if (salud.riot !== 'ok' || !Number.isFinite(caduca)) return { accion: 'nada' };
  const pronto = caduca - ahora <= VENTANA_PRONTO_MS;
  if (pronto) return abiertas.length === 0 ? { accion: 'abrir' } : { accion: 'nada' };
  return abiertas.length > 0 ? { accion: 'cerrar', numeros: abiertas.map((i) => i.number) } : { accion: 'nada' };
}

export function cuerpoIssue(riotDesde) {
  const desde = riotDesde ? `\n\nRiot rechaza la clave desde: **${riotDesde}** (UTC).` : '';
  return `La clave de desarrollo de Riot del servidor (\`coachlolia-api\`) ha caducado: caduca cada 24 h hasta que Riot conceda la clave de producción. Mientras tanto el recolector y la pantalla de carga no pueden hablar con Riot.${desde}

## Desde el móvil (30 segundos)

1. Abre https://developer.riotgames.com, pulsa **Regenerate API Key** y copia la clave nueva.
2. Abre https://api.coachlolia.com/admin/clave, pégala con tu contraseña de administrador y pulsa «Guardar clave».

## Desde el PC

1. Haz doble clic en **«Renovar clave Riot»** en el escritorio. Se abre https://developer.riotgames.com en el navegador.
2. Inicia sesión si te lo pide y, en el panel, pulsa **Regenerate API Key** (resuelve el CAPTCHA).
3. Copia la clave nueva (empieza por \`RGAPI-\`).
4. Vuelve a la ventana de «Renovar clave Riot», pégala y pulsa Enter (no se ve al escribir). El script la comprueba con Riot y la guarda en Fly.io.

Si no tienes el acceso directo: ejecuta \`Renovar clave Riot.bat\` de la raíz del repositorio (o \`clave-riot-servidor.ps1\`).

Esta issue se cierra sola en cuanto el servidor vuelva a usar una clave válida (se comprueba cada 30 min). No pegues la clave aquí.`;
}

/** Qué hacer según el estado de la clave y las issues abiertas con la etiqueta. */
export function decidir(riot, abiertas) {
  if (riot === 'caducada') return abiertas.length === 0 ? { accion: 'abrir' } : { accion: 'nada' };
  if (riot === 'ok' && abiertas.length > 0) return { accion: 'cerrar', numeros: abiertas.map((i) => i.number) };
  return { accion: 'nada' };
}

async function leerSalud(hacerFetch, log) {
  try {
    const resp = await hacerFetch(URL_SALUD, { signal: AbortSignal.timeout(20_000) });
    if (!resp.ok) {
      log(`::warning::/salud respondió ${resp.status}; no se cambia nada.`);
      return null;
    }
    const salud = await resp.json();
    if (!salud || typeof salud.riot !== 'string') {
      log('::warning::/salud no trae el estado de la clave (¿servidor sin desplegar?); no se cambia nada.');
      return null;
    }
    return salud;
  } catch (e) {
    log(`::warning::No se pudo leer /salud (${e instanceof Error ? e.message : String(e)}); no se cambia nada.`);
    return null;
  }
}

const listar = async (gh, repo, etiqueta) =>
  JSON.parse((await gh(['issue', 'list', '--repo', repo, '--label', etiqueta, '--state', 'open', '--json', 'number', '--limit', '50'])) || '[]');

/** El aviso previo; devuelve 'pronto-abierta', 'pronto-cerrada' o 'nada'. */
async function avisarPronto(salud, { gh, repo, log, ahora }) {
  const decision = decidirPronto(salud, await listar(gh, repo, ETIQUETA_PRONTO), ahora);
  if (decision.accion === 'abrir') {
    await gh(['label', 'create', ETIQUETA_PRONTO, '--repo', repo, '--color', 'FBCA04', '--description', 'La clave de Riot del servidor caduca pronto', '--force']);
    await gh(['issue', 'create', '--repo', repo, '--title', TITULO_PRONTO, '--body', cuerpoIssuePronto(salud.riotCaduca), '--label', ETIQUETA_PRONTO, '--assignee', ASIGNADO]);
    log('Aviso previo abierto.');
    return 'pronto-abierta';
  }
  if (decision.accion === 'cerrar') {
    const comentario =
      salud.riot === 'caducada' ? 'La clave ya ha caducado: sigue el aviso «🔑 Renueva la clave de Riot (caducada)». Cierro este.' : '✅ Clave renovada. Cierro el aviso previo.';
    for (const n of decision.numeros) await gh(['issue', 'close', String(n), '--repo', repo, '--comment', comentario, '--reason', 'completed']);
    log(`Avisos previos cerrados: ${decision.numeros.join(', ')}`);
    return 'pronto-cerrada';
  }
  return 'nada';
}

/** Devuelve 'abierta', 'cerrada', 'pronto-abierta', 'pronto-cerrada' o 'nada'. */
export async function avisar({ fetch: hacerFetch = fetch, gh, repo, log = console.log, ahora = Date.now() }) {
  const salud = await leerSalud(hacerFetch, log);
  if (!salud) return 'nada';
  log(`Clave de Riot: ${salud.riot} (desde ${salud.riotDesde ?? '?'}${salud.riotCaduca ? `; caduca hacia ${salud.riotCaduca}` : ''})`);
  if (salud.riot !== 'caducada' && salud.riot !== 'ok') return 'nada';
  const principal = await avisarCaducada(salud, { gh, repo, log });
  const previo = await avisarPronto(salud, { gh, repo, log, ahora });
  return principal !== 'nada' ? principal : previo;
}

/** El aviso de clave caducada; devuelve 'abierta', 'cerrada' o 'nada'. */
async function avisarCaducada(salud, { gh, repo, log }) {
  const abiertas = await listar(gh, repo, ETIQUETA);
  const decision = decidir(salud.riot, abiertas);
  if (decision.accion === 'abrir') {
    await gh(['label', 'create', ETIQUETA, '--repo', repo, '--color', 'D93F0B', '--description', 'La clave de Riot del servidor ha caducado', '--force']);
    await gh(['issue', 'create', '--repo', repo, '--title', TITULO, '--body', cuerpoIssue(salud.riotDesde), '--label', ETIQUETA, '--assignee', ASIGNADO]);
    log('Issue abierta.');
    return 'abierta';
  }
  if (decision.accion === 'cerrar') {
    const comentario = `✅ La clave de Riot vuelve a funcionar (estado ok desde ${salud.riotDesde ?? 'ahora'}). Cierro el aviso.`;
    for (const n of decision.numeros) {
      await gh(['issue', 'close', String(n), '--repo', repo, '--comment', comentario, '--reason', 'completed']);
    }
    log(`Cerradas: ${decision.numeros.join(', ')}`);
    return 'cerrada';
  }
  log('Nada que hacer.');
  return 'nada';
}

function ghReal(args) {
  return new Promise((resolve, reject) => {
    execFile('gh', args, { env: process.env }, (error, stdout, stderr) => {
      if (error) reject(new Error(`gh ${args.slice(0, 2).join(' ')} falló: ${stderr || error.message}`));
      else resolve(stdout);
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repo = process.env.GITHUB_REPOSITORY ?? 'pepeipto/coach-lol-ia';
  avisar({ gh: ghReal, repo }).catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
