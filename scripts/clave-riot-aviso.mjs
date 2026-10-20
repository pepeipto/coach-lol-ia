// Aviso de clave de Riot caducada (lo ejecuta .github/workflows/clave-riot.yml cada 30 min).
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

export function cuerpoIssue(riotDesde) {
  const desde = riotDesde ? `\n\nRiot rechaza la clave desde: **${riotDesde}** (UTC).` : '';
  return `La clave de desarrollo de Riot del servidor (\`coachlolia-api\`) ha caducado: caduca cada 24 h hasta que Riot conceda la clave de producción. Mientras tanto el recolector y la pantalla de carga no pueden hablar con Riot.${desde}

## Cómo renovarla (1 minuto)

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

/** Devuelve 'abierta', 'cerrada' o 'nada'. */
export async function avisar({ fetch: hacerFetch = fetch, gh, repo, log = console.log }) {
  const salud = await leerSalud(hacerFetch, log);
  if (!salud) return 'nada';
  log(`Clave de Riot: ${salud.riot} (desde ${salud.riotDesde ?? '?'})`);
  if (salud.riot !== 'caducada' && salud.riot !== 'ok') return 'nada';

  const abiertas = JSON.parse(
    (await gh(['issue', 'list', '--repo', repo, '--label', ETIQUETA, '--state', 'open', '--json', 'number', '--limit', '50'])) || '[]',
  );
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
