import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { EscalaHud } from '../../shared/tiposApp';

/** Carpeta de LoL de una instalación normal (cuando aún no se conoce la del cliente conectado). */
export const DIR_LOL_POR_DEFECTO = join('C:', 'Riot Games', 'League of Legends');

type Leer = (ruta: string) => Promise<string>;

/** 0–1 (los deslizadores «Escala del HUD» y «Escala del minimapa» de LoL guardan su valor entre 0 y 1). */
function fraccion(v: string | undefined): number | null {
  if (v === undefined || !/^\s*-?\d+(\.\d+)?\s*$/.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : null;
}

/** Claves de la sección [HUD] de game.cfg (formato INI: «Clave=Valor»). */
function seccionHud(texto: string): Record<string, string> {
  const salida: Record<string, string> = {};
  let enHud = false;
  for (const linea of texto.split(/\r?\n/)) {
    const seccion = /^\s*\[([^\]]+)\]\s*$/.exec(linea);
    if (seccion) {
      enHud = seccion[1]!.trim() === 'HUD';
      continue;
    }
    if (!enHud) continue;
    const par = /^\s*([^=]+?)\s*=\s*(.*?)\s*$/.exec(linea);
    if (par) salida[par[1]!] = par[2]!;
  }
  return salida;
}

/** Las mismas claves en PersistedSettings.json (files[Game.cfg].sections[HUD].settings[{name, value}]). */
function hudPersistido(texto: string): Record<string, string> {
  const salida: Record<string, string> = {};
  const json: unknown = JSON.parse(texto);
  const archivos = (json as { files?: unknown }).files;
  if (!Array.isArray(archivos)) return salida;
  for (const archivo of archivos as { name?: unknown; sections?: unknown }[]) {
    if (String(archivo?.name).toLowerCase() !== 'game.cfg' || !Array.isArray(archivo.sections)) continue;
    for (const seccion of archivo.sections as { name?: unknown; settings?: unknown }[]) {
      if (seccion?.name !== 'HUD' || !Array.isArray(seccion.settings)) continue;
      for (const s of seccion.settings as { name?: unknown; value?: unknown }[]) {
        if (typeof s?.name === 'string' && typeof s.value === 'string') salida[s.name] = s.value;
      }
    }
  }
  return salida;
}

function desde(claves: Record<string, string>): EscalaHud {
  return {
    global: fraccion(claves.GlobalScale),
    minimapa: fraccion(claves.MinimapScale),
    minimapaIzquierda: claves.FlipMiniMap?.trim() === '1',
  };
}

/**
 * Escala del HUD que el jugador eligió en LoL: `GlobalScale` (escala del HUD), `MinimapScale` (escala del
 * minimapa) y `FlipMiniMap` (minimapa a la izquierda), de la sección [HUD] de Config/game.cfg o, si faltan, de
 * Config/PersistedSettings.json. Es el archivo de ajustes del jugador (texto plano): solo se lee, nunca se escribe,
 * y no se toca la memoria del juego. Null si no hay nada legible.
 */
export async function leerEscalaHud(dirLol: string, leer: Leer = (r) => readFile(r, 'utf8')): Promise<EscalaHud | null> {
  let hud: EscalaHud = { global: null, minimapa: null, minimapaIzquierda: false };
  let flipVisto = false;
  try {
    const claves = seccionHud(await leer(join(dirLol, 'Config', 'game.cfg')));
    hud = desde(claves);
    flipVisto = 'FlipMiniMap' in claves;
  } catch {
    // sin game.cfg: se prueba con PersistedSettings.json
  }
  if (hud.global === null || hud.minimapa === null || !flipVisto) {
    try {
      const persistido = desde(hudPersistido(await leer(join(dirLol, 'Config', 'PersistedSettings.json'))));
      hud = {
        global: hud.global ?? persistido.global,
        minimapa: hud.minimapa ?? persistido.minimapa,
        minimapaIzquierda: flipVisto ? hud.minimapaIzquierda : persistido.minimapaIzquierda,
      };
    } catch {
      // sin PersistedSettings.json (o roto): queda lo de game.cfg
    }
  }
  return hud.global === null && hud.minimapa === null ? null : hud;
}
