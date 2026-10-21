import datos from '../datos/aumentosCaos.json';
import type { AumentoCaos, Etiqueta, Rareza } from '../datos/etiquetasAumentos';
import type { AumentoPanel, PanelAumentos, PerfilCampeon, TierAumento } from '../../shared/tiposApp';

/**
 * Tier list de aumentos de ARAM: Caos para el campeón que llevas (3.4).
 *
 * Política de Riot (Game Policy): «Products cannot display win rates for Augments». Por eso el tier NO sale de
 * partidas ni de victorias: sale de cuánto encaja lo que hace cada aumento (sus etiquetas, ver etiquetasAumentos.ts)
 * con el perfil del campeón en Data Dragon (clase, tipo de daño, alcance y recurso). Es una recomendación de encaje.
 */
export const AUMENTOS_CAOS = (datos as { aumentos: AumentoCaos[] }).aumentos;

export type Pesos = Record<Etiqueta, number>;

/** Peso de cada etiqueta por clase de Data Dragon (Marksman, Mage…); el daño (ap/ad) se reparte aparte. */
const PESOS_CLASE: Record<string, Partial<Pesos> & { dano: number }> = {
  Marksman: { dano: 3, critico: 3, ataque: 3, alcance: 2.5, movilidad: 1.5, habilidades: 0.5 },
  Mage: { dano: 3, habilidades: 3, definitiva: 1.5, control: 1, mana: 1, movilidad: 0.5 },
  Assassin: { dano: 3, movilidad: 2.5, habilidades: 2, definitiva: 1.5, critico: 0.5, bolaNieve: 1.5 },
  Fighter: { dano: 2, tanque: 2, curacion: 2, ataque: 1.5, habilidades: 1.5, movilidad: 1, control: 0.5, bolaNieve: 1.5 },
  Tank: { dano: 0.5, tanque: 3, control: 2.5, curacion: 1.5, habilidades: 1.5, aliados: 1, definitiva: 1, bolaNieve: 1.5 },
  Support: { dano: 1, aliados: 3, curacion: 2.5, control: 2, habilidades: 1.5, tanque: 0.5 },
};
/** La segunda clase del campeón cuenta menos que la primera. */
const PESO_SEGUNDA_CLASE = 0.6;
/** Lo que vale un aumento que sirve a cualquiera (oro, yunques, fuerza adaptable…). */
const PESO_GENERAL = 1.5;
/** Sin descripción pública no se sabe qué hace: se queda en medio de la tabla, nunca arriba. */
const PUNTOS_SIN_DESCRIPCION = 1.2;
/** Penalización de lo que no sirve al campeón (PH en un campeón de AD, alcance en uno cuerpo a cuerpo…). */
const NO_SIRVE = -2.5;
/** Alcance de ataque a partir del que un campeón es «a distancia». */
const ALCANCE_DISTANCIA = 300;

export type TipoDano = 'ap' | 'ad' | 'mixto';

export function tipoDano(perfil: PerfilCampeon): TipoDano {
  const { ataque, magia } = perfil;
  if (magia >= ataque + 2) return 'ap';
  if (ataque >= magia + 2) return 'ad';
  return 'mixto';
}

/** `partype` llega traducido (Mana, Maná…): se compara sin tildes ni mayúsculas. */
export const usaMana = (perfil: PerfilCampeon) =>
  perfil.recurso
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase() === 'mana';

/** Peso de cada etiqueta para un campeón. Sin perfil (Data Dragon antiguo en caché), todo neutro. */
export function pesosCampeon(perfil: PerfilCampeon | null): Pesos {
  const pesos = Object.fromEntries(
    ['ap', 'ad', 'critico', 'ataque', 'alcance', 'cuerpo', 'habilidades', 'definitiva', 'tanque', 'curacion', 'aliados', 'control', 'movilidad', 'mana', 'bolaNieve', 'general'].map(
      (e) => [e, 1],
    ),
  ) as Pesos;
  pesos.general = PESO_GENERAL;
  if (!perfil || !perfil.clases.length) return pesos;
  for (const k of Object.keys(pesos) as Etiqueta[]) if (k !== 'general') pesos[k] = 0;
  let dano = 0;
  perfil.clases.slice(0, 2).forEach((clase, i) => {
    const tabla = PESOS_CLASE[clase];
    if (!tabla) return;
    const f = i === 0 ? 1 : PESO_SEGUNDA_CLASE;
    dano = Math.max(dano, tabla.dano * f);
    for (const [e, w] of Object.entries(tabla)) {
      if (e !== 'dano') pesos[e as Etiqueta] = Math.max(pesos[e as Etiqueta], (w as number) * f);
    }
  });
  const tipo = tipoDano(perfil);
  const tirador = perfil.clases.includes('Marksman');
  pesos.ap = tipo === 'ap' ? dano : tipo === 'mixto' ? dano * 0.7 : NO_SIRVE;
  pesos.ad = tipo === 'ad' ? dano : tipo === 'mixto' ? dano * 0.7 : NO_SIRVE;
  if (tipo === 'ap' && !tirador) {
    pesos.critico = NO_SIRVE;
    pesos.ataque = Math.min(pesos.ataque, 0.3);
  }
  const distancia = perfil.alcance >= ALCANCE_DISTANCIA;
  if (!distancia) pesos.alcance = NO_SIRVE;
  // Volverse cuerpo a cuerpo solo tiene sentido para quien ataca a distancia.
  pesos.cuerpo = distancia && tirador ? 0.8 : NO_SIRVE;
  if (!usaMana(perfil)) pesos.mana = NO_SIRVE;
  return pesos;
}

/**
 * Puntos de un aumento: sobre todo lo que más le aporta y, en parte, la media de todo lo que hace (un aumento de
 * curar aliados vale menos para un luchador que uno de curarse a sí mismo). Lo que no le sirve resta entero.
 */
export function puntuarAumento(a: AumentoCaos, pesos: Pesos): number {
  if (a.sinDescripcion) return PUNTOS_SIN_DESCRIPCION;
  const ws = a.etiquetas.map((e) => pesos[e] ?? 0);
  const positivos = ws.map((w) => Math.max(0, w));
  const mejor = Math.max(0, ...positivos);
  const media = positivos.reduce((s, w) => s + w, 0) / positivos.length;
  const resta = ws.filter((w) => w < 0).reduce((s, w) => s + w, 0);
  return Math.round((0.6 * mejor + 0.4 * media + resta) * 100) / 100;
}

/** Corte de cada tier dentro de una rareza: el 12 % mejor es S, el 23 % siguiente A, el 35 % siguiente B. */
const CORTES: [TierAumento, number][] = [
  ['S', 0.12],
  ['A', 0.35],
  ['B', 0.7],
];

export interface AumentoValorado {
  aumento: AumentoCaos;
  puntos: number;
  tier: TierAumento;
}

/** Tier de cada aumento para el campeón, por rareza (se compara con los de su misma rareza). */
export function tierList(perfil: PerfilCampeon | null, aumentos: AumentoCaos[] = AUMENTOS_CAOS): Map<number, AumentoValorado> {
  const pesos = pesosCampeon(perfil);
  const resultado = new Map<number, AumentoValorado>();
  for (const rareza of ['prismatico', 'oro', 'plata'] as Rareza[]) {
    const lista = aumentos
      .filter((a) => a.rareza === rareza)
      .map((a) => ({ aumento: a, puntos: puntuarAumento(a, pesos) }))
      // Mismo orden siempre: por puntos y, a igualdad, por id.
      .sort((x, y) => y.puntos - x.puntos || x.aumento.id - y.aumento.id);
    lista.forEach((v, i) => {
      const posicion = (i + 1) / lista.length;
      let tier: TierAumento = CORTES.find(([, hasta]) => posicion <= hasta)?.[0] ?? 'C';
      // Lo que no le sirve nunca pasa de C; lo que no se sabe qué hace, nunca de B.
      if (v.puntos <= 0) tier = 'C';
      else if (v.aumento.sinDescripcion && (tier === 'S' || tier === 'A')) tier = 'B';
      resultado.set(v.aumento.id, { ...v, tier });
    });
  }
  return resultado;
}

/** Familias que de verdad se combinan entre sí (las mejoras de objetos y las misiones no). */
export const FAMILIAS_COMBO = ['pan', 'alcance', 'yunques', 'bolaNieve', 'almas', 'pentakill'] as const;
/** Grupos por tema: aumentos con la misma etiqueta se refuerzan unos a otros. */
export const TEMAS_COMBO: Etiqueta[] = ['critico', 'ataque', 'ap', 'ad', 'habilidades', 'definitiva', 'tanque', 'curacion', 'aliados', 'control', 'movilidad'];

export interface Combo {
  /** `familia:pan`, `tema:critico`… (la clave del texto en el overlay). */
  id: string;
  aumentos: AumentoValorado[];
}

/**
 * Los grupos de aumentos que mejor combinan para el campeón: los temas con más peso para él y las familias cuyos
 * aumentos le encajan. Cada combo trae sus aumentos que no son C, de mejor a peor.
 */
export function combos(perfil: PerfilCampeon | null, valorados: Map<number, AumentoValorado>, maximo = 3, porCombo = 5): Combo[] {
  const pesos = pesosCampeon(perfil);
  const todos = [...valorados.values()];
  const miembros = (filtro: (a: AumentoCaos) => boolean) =>
    todos
      .filter((v) => filtro(v.aumento) && v.tier !== 'C')
      .sort((x, y) => y.puntos - x.puntos || x.aumento.id - y.aumento.id);
  const candidatos: { combo: Combo; nota: number }[] = [];
  for (const tema of TEMAS_COMBO) {
    const lista = miembros((a) => a.etiquetas.includes(tema));
    if (lista.length >= 3 && pesos[tema] >= 1.5) candidatos.push({ combo: { id: `tema:${tema}`, aumentos: lista.slice(0, porCombo) }, nota: pesos[tema] });
  }
  for (const familia of FAMILIAS_COMBO) {
    const lista = miembros((a) => a.familia === familia);
    if (lista.length < 2) continue;
    const media = lista.reduce((s, v) => s + v.puntos, 0) / lista.length;
    if (media >= 1.2) candidatos.push({ combo: { id: `familia:${familia}`, aumentos: lista.slice(0, porCombo) }, nota: media });
  }
  return candidatos
    .sort((x, y) => y.nota - x.nota || x.combo.id.localeCompare(y.combo.id))
    .slice(0, maximo)
    .map((c) => c.combo);
}

/** Cuántos aumentos salen por rareza en el panel del overlay, y cuántos por combo. */
export const POR_COLUMNA = 6;
export const POR_COMBO = 5;

/**
 * Panel de aumentos del overlay para un campeón: los mejores de cada rareza y los combos. `nombres` trae el nombre y
 * el icono de cada aumento en el idioma de la app (cherry-augments.json); sin nombre, el aumento no sale.
 */
export function panelAumentos(
  campeon: { nombre: string; perfil?: PerfilCampeon | null },
  nombres: ReadonlyMap<number, { nombre: string; icono: string | null }>,
  aumentos: AumentoCaos[] = AUMENTOS_CAOS,
): PanelAumentos {
  const perfil = campeon.perfil ?? null;
  const conNombre = aumentos.filter((a) => nombres.has(a.id));
  const valorados = tierList(perfil, conNombre);
  const aPanel = (v: AumentoValorado): AumentoPanel => ({ id: v.aumento.id, ...nombres.get(v.aumento.id)!, tier: v.tier });
  const columnas = (['prismatico', 'oro', 'plata'] as const).map((rareza) => ({
    rareza,
    aumentos: [...valorados.values()]
      .filter((v) => v.aumento.rareza === rareza && v.tier !== 'C')
      .sort((x, y) => y.puntos - x.puntos || x.aumento.id - y.aumento.id)
      .slice(0, POR_COLUMNA)
      .map(aPanel),
  }));
  return {
    campeon: campeon.nombre,
    columnas,
    combos: combos(perfil, valorados, 3, POR_COMBO).map((c) => ({ id: c.id, aumentos: c.aumentos.map(aPanel) })),
  };
}
