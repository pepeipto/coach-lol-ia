import type { IdiomaIa, MensajePersonal, ResumenPersonal } from '@coach/shared';
import { t } from '../../shared/i18n';
import type { Perfil } from '../../shared/perfil';
import { cuenta, metricas, yoEn } from '../perfil/puntuaciones';

/*
 * 3.5: coach personal (estilo Project AVA): el resumen del perfil que se manda al servidor (cifras agregadas, sin
 * nombres ni Riot ID) y la charla de voz antes de cada partida, que se arma en local con el perfil y el reto.
 */

const nombreDe = (p: Perfil, id: number) => p.campeonesDD[id]?.nombre ?? String(id);
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Resumen del perfil para el coach personal: rango, campeones, tendencias, reto y últimas 10 partidas. */
export function resumenPersonal(p: Perfil): ResumenPersonal {
  const solo = p.rangos.find((r) => r.cola === 'solo');
  const rango = solo?.tier ? `${t(`carga.tier.${solo.tier}`)} ${solo.division} ${t('perfil.lp', { n: solo.lp })}`.replace(/\s+/g, ' ').trim() : '';
  const ultimas: ResumenPersonal['ultimas'] = [];
  for (const partida of p.partidas.filter(cuenta).slice(0, 10)) {
    const yo = yoEn(partida);
    const m = metricas(partida);
    if (!yo || !m) continue;
    ultimas.push({
      campeon: nombreDe(p, yo.campeonId).slice(0, 30),
      modo: partida.modo,
      rol: yo.rol,
      victoria: yo.victoria,
      k: yo.asesinatos,
      d: yo.muertes,
      a: yo.asistencias,
      csMin: r1(m.csMin),
      nota: yo.puntuaciones.total,
      minutos: Math.round(partida.duracion / 60),
    });
  }
  return {
    rango: rango.slice(0, 40),
    partidas: Math.min(200, p.partidas.filter(cuenta).length),
    campeones: p.campeones.slice(0, 8).map((c) => ({
      campeon: nombreDe(p, c.campeonId).slice(0, 30),
      partidas: c.partidas,
      victorias: c.victorias,
      kda: Math.min(100, c.kda),
      csMin: c.csMin,
      nota: c.puntuacion,
    })),
    tendencias: p.tendencias.map((x) => ({ id: x.id, valor: x.valor, cambio: x.cambio })),
    reto: p.reto ? { id: p.reto.id, hechas: p.reto.hechas, objetivo: p.reto.objetivo } : null,
    ultimas,
  };
}

/** Conversación válida para el servidor: hasta 12 mensajes, alternos, acabando en el usuario. */
export function conversacion(mensajes: unknown): MensajePersonal[] | null {
  if (!Array.isArray(mensajes)) return null;
  const r: MensajePersonal[] = [];
  for (const m of mensajes.slice(-12)) {
    const x = m as MensajePersonal | null;
    if (!x || (x.rol !== 'usuario' && x.rol !== 'coach') || typeof x.texto !== 'string') return null;
    const texto = x.texto.replace(/\s+/g, ' ').trim().slice(0, x.rol === 'usuario' ? 600 : 2000);
    if (texto) r.push({ rol: x.rol, texto });
  }
  return r.length && r.at(-1)!.rol === 'usuario' ? r : null;
}

export const esIdiomaIa = (v: string): v is IdiomaIa => ['es', 'en', 'pt-BR', 'fr', 'de'].includes(v);

/**
 * Charla de voz antes de la partida: el reto activo (y lo que falta) y, si hay bastantes partidas con ese campeón, cómo
 * le va con él y su punto más flojo. Null si no hay nada que decir (perfil vacío).
 */
export function charlaPrevia(p: Perfil, campeonId: number | null): string | null {
  const frases: string[] = [];
  if (p.reto && !p.reto.completado) {
    const falta = p.reto.objetivo - p.reto.hechas;
    frases.push(t('coach.charla.reto', { reto: t(`perfil.reto.${p.reto.id}.nombre`), falta }));
  } else if (!p.reto && p.partidas.length >= 3) {
    frases.push(t('coach.charla.sinReto'));
  }
  const c = campeonId ? p.campeones.find((x) => x.campeonId === campeonId) : null;
  if (c && c.partidas >= 3) {
    // El punto más flojo con ese campeón en sus partidas: muertes, farmeo o visión.
    const delCampeon = p.partidas.filter((x) => cuenta(x) && yoEn(x)?.campeonId === campeonId);
    const notas = delCampeon.map((x) => yoEn(x)!.puntuaciones);
    const media = (k: 'combate' | 'farmeo' | 'vision') => notas.reduce((s, n) => s + n[k], 0) / Math.max(1, notas.length);
    const flojo = (['combate', 'farmeo', 'vision'] as const)
      .filter((k) => k !== 'vision' || notas.some((n) => n.vision > 0))
      .sort((a, b) => media(a) - media(b))[0]!;
    frases.push(t('coach.charla.campeon', { campeon: nombreDe(p, c.campeonId), partidas: c.partidas, nota: c.puntuacion }));
    if (media(flojo) < 55) frases.push(t(`coach.charla.flojo.${flojo}`));
  }
  return frases.length ? frases.join(' ') : null;
}
