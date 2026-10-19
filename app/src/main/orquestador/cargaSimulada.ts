import type { EstadoCarga, JugadorCarga } from '../../shared/tiposApp';
import { registrar } from '../log';
import type { DatosCarga, OrquestadorCarga } from './carga';

/** Con COACH_FORZAR_PARTIDA=1, la pantalla de carga de muestra se ve estos milisegundos antes de la partida. */
export const DURACION_CARGA_SIMULADA_MS = 5000;

type Etiqueta = JugadorCarga['etiquetas'][number];
// Igual que las del servidor: texto en español y la clave de i18n para enseñarlas en el idioma de la app.
const especialista = (campeon: string): Etiqueta => ({
  tipo: 'positivo',
  texto: `Especialista en ${campeon}`,
  clave: 'carga.etiqueta.especialista',
  params: { campeon },
});
const racha: Etiqueta = { tipo: 'positivo', texto: 'Racha positiva esta temporada', clave: 'carga.etiqueta.racha' };
const CLAVES_RASGO: Record<string, string> = {
  'Fuerte al principio': 'carga.rasgo.Assassin',
  'Fuerte en peleas largas': 'carga.rasgo.Fighter',
  'Daño mágico en área': 'carga.rasgo.Mage',
  'Escala a final de partida': 'carga.rasgo.Marksman',
  'Protege a su equipo': 'carga.rasgo.Support',
  'Inicia las peleas': 'carga.rasgo.Tank',
  'Mecánicas exigentes': 'carga.rasgo.dificil',
};
const rasgo = (texto: string): Etiqueta => ({ tipo: 'neutro', texto, clave: CLAVES_RASGO[texto] });

/**
 * Jugadores de muestra (ficticios) para depurar, hacer capturas y grabar el vídeo sin cliente de LoL.
 * El del centro de tu equipo es el de la grabación de ejemplo (Ahri). Las etiquetas siguen las mismas
 * reglas que las del servidor: solo positivas o neutras.
 */
export const JUGADORES_DE_MUESTRA: readonly JugadorCarga[] = [
  {
    equipo: 'aliado', riotId: 'Roca Firme#LAS1', campeonId: 86, campeon: 'Garen', nombre: 'Garen', rol: 'TOP',
    rango: { tier: 'PLATINUM', division: 'I', lp: 64, victorias: 58, derrotas: 51 },
    maestria: { nivel: 23, puntos: 214_000 }, campeonWinrate: 0.524,
    etiquetas: [especialista('Garen'), rasgo('Fuerte en peleas largas')],
  },
  {
    equipo: 'aliado', riotId: 'Bosque Sereno#LAS1', campeonId: 64, campeon: 'LeeSin', nombre: 'Lee Sin', rol: 'JUNGLE',
    rango: { tier: 'EMERALD', division: 'III', lp: 12, victorias: 41, derrotas: 30 },
    maestria: { nivel: 9, puntos: 61_500 }, campeonWinrate: 0.491,
    etiquetas: [racha, rasgo('Fuerte en peleas largas'), rasgo('Mecánicas exigentes')],
  },
  {
    equipo: 'aliado', propio: true, riotId: 'Señor Ñandú#LAS1', campeonId: 103, campeon: 'Ahri', nombre: 'Ahri', rol: 'MIDDLE',
    rango: { tier: 'EMERALD', division: 'II', lp: 42, victorias: 30, derrotas: 24 },
    maestria: { nivel: 31, puntos: 412_000 }, campeonWinrate: 0.517,
    etiquetas: [especialista('Ahri'), rasgo('Daño mágico en área')],
  },
  {
    equipo: 'aliado', riotId: 'Flecha Lenta#LAS1', campeonId: 222, campeon: 'Jinx', nombre: 'Jinx', rol: 'BOTTOM',
    rango: null,
    maestria: { nivel: 2, puntos: 3_100 }, campeonWinrate: 0.508,
    etiquetas: [rasgo('Escala a final de partida')],
  },
  {
    equipo: 'aliado', riotId: 'Faro del Sur#LAS1', campeonId: 412, campeon: 'Thresh', nombre: 'Thresh', rol: 'UTILITY',
    rango: { tier: 'GOLD', division: 'I', lp: 88, victorias: 77, derrotas: 70 },
    maestria: { nivel: 14, puntos: 98_000 }, campeonWinrate: 0.502,
    etiquetas: [rasgo('Protege a su equipo')],
  },
  {
    equipo: 'enemigo', riotId: 'Lince Rojo#LAS2', campeonId: 122, campeon: 'Darius', nombre: 'Darius', rol: 'TOP',
    rango: { tier: 'EMERALD', division: 'IV', lp: 5, victorias: 22, derrotas: 19 },
    maestria: { nivel: 18, puntos: 156_000 }, campeonWinrate: 0.513,
    etiquetas: [especialista('Darius'), rasgo('Fuerte en peleas largas')],
  },
  {
    equipo: 'enemigo', riotId: 'Marea Alta#LAS2', campeonId: 104, campeon: 'Graves', nombre: 'Graves', rol: 'JUNGLE',
    rango: { tier: 'PLATINUM', division: 'II', lp: 31, victorias: 35, derrotas: 33 },
    maestria: { nivel: 7, puntos: 40_200 }, campeonWinrate: 0.497,
    etiquetas: [rasgo('Escala a final de partida')],
  },
  {
    equipo: 'enemigo', riotId: 'Sombra Quieta#LAS2', campeonId: 238, campeon: 'Zed', nombre: 'Zed', rol: 'MIDDLE',
    rango: { tier: 'DIAMOND', division: 'IV', lp: 17, victorias: 64, derrotas: 49 },
    maestria: { nivel: 12, puntos: 88_000 }, campeonWinrate: 0.489,
    etiquetas: [racha, rasgo('Fuerte al principio')],
  },
  {
    equipo: 'enemigo', riotId: 'Pluma Azul#LAS2', campeonId: 145, campeon: 'Kaisa', nombre: "Kai'Sa", rol: 'BOTTOM',
    rango: { tier: 'EMERALD', division: 'I', lp: 70, victorias: 48, derrotas: 45 },
    maestria: { nivel: 10, puntos: 72_400 }, campeonWinrate: 0.505,
    etiquetas: [rasgo('Escala a final de partida')],
  },
  {
    equipo: 'enemigo', riotId: 'Hada Curiosa#LAS2', campeonId: 117, campeon: 'Lulu', nombre: 'Lulu', rol: 'UTILITY',
    rango: { tier: 'GOLD', division: 'III', lp: 50, victorias: 19, derrotas: 21 },
    maestria: { nivel: 6, puntos: 25_000 }, campeonWinrate: 0.511,
    etiquetas: [rasgo('Protege a su equipo')],
  },
];

/** La pantalla de carga de muestra, con la versión y los nombres de Data Dragon cuando los hay. */
export function cargaDeMuestra(datos: DatosCarga | null): EstadoCarga {
  return {
    version: datos?.version ?? '',
    // Clasificatoria Solo/Dúo (la cabecera de la pantalla completa la nombra).
    cola: 420,
    jugadores: JUGADORES_DE_MUESTRA.map((j) => {
      const dd = datos?.campeones.get(j.campeonId);
      return { ...j, campeon: dd?.id || j.campeon, nombre: dd?.nombre || j.nombre, etiquetas: [...j.etiquetas] };
    }),
  };
}

/**
 * COACH_FORZAR_PARTIDA=1: sin cliente de LoL no hay fase GameStart, así que se enseña la pantalla de
 * carga de muestra unos segundos (para las capturas y el vídeo) y después se arranca la partida.
 */
/** COACH_FORZAR_PARTIDA=1 (carga de muestra y partida simulada) solo en desarrollo: la app instalada lo ignora. */
export function forzarPartidaDe(env: Record<string, string | undefined>, empaquetada: boolean): boolean {
  return !empaquetada && env.COACH_FORZAR_PARTIDA === '1';
}

export async function arrancarForzado(dep: {
  carga: Pick<OrquestadorCarga, 'simular'>;
  datos: () => Promise<DatosCarga | null>;
  arrancar: () => void;
  esperaMs?: number;
}): Promise<void> {
  const datos = await dep.datos().catch(() => null);
  registrar('aviso', 'COACH_FORZAR_PARTIDA=1: pantalla de carga de muestra antes de la partida');
  dep.carga.simular(cargaDeMuestra(datos));
  setTimeout(dep.arrancar, dep.esperaMs ?? DURACION_CARGA_SIMULADA_MS);
}
