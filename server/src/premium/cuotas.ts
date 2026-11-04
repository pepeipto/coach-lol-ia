import { PAQUETES, periodoActual, PLANES, type IdPaquete, type IdPlan, type TipoCuota } from '@coach/shared';
import type { Db } from '../db';
import { estadoEfectivo, type RepoLicencias } from './licencias';
import { FORMATO_DISPOSITIVO } from './pruebas';

/*
 * Cuotas mensuales del coach con IA (solo con PREMIUM_HABILITADO; apagado hasta que Riot lo apruebe).
 * Una licencia activa usa la cuota de su plan; sin licencia, el dispositivo anónimo usa la del plan Gratis.
 * Cuando se acaba la cuota de partidas, se gastan las partidas extra de los paquetes (si el plan los admite).
 */

export interface Sujeto {
  /** 'l:<clave>' o 'd:<dispositivo>'. */
  id: string;
  plan: IdPlan;
  /** ISO del alta (renovación mensual). */
  alta: string;
  /** Clave de la licencia, si la hay (para el saldo de paquetes). */
  clave: string | null;
}

export interface EstadoCuota {
  plan: IdPlan;
  /** ISO de la próxima renovación. */
  renueva: string;
  usadas: Record<TipoCuota, number>;
  cuota: Record<TipoCuota, number>;
  /** Partidas extra de paquetes que quedan. */
  extra: number;
}

export type ResultadoConsumo =
  | { ok: true; origen: 'cuota' | 'extra'; periodo: string }
  | { ok: false; renueva: string };

/**
 * Quién gasta la cuota: la licencia si está activa (y, si es una prueba ya vinculada, desde su dispositivo);
 * si no, el dispositivo. null sin licencia válida ni dispositivo con formato correcto.
 */
export function resolverSujeto(
  db: Db,
  repo: RepoLicencias,
  o: { clave?: string | undefined; dispositivo?: string | undefined; ahora: number },
): Sujeto | null {
  const l = o.clave ? repo.porClave(o.clave) : null;
  if (l && estadoEfectivo(l, o.ahora) === 'activa' && !(l.tipo === 'prueba' && l.dispositivo && l.dispositivo !== o.dispositivo)) {
    return { id: `l:${l.clave}`, plan: l.plan, alta: l.alta, clave: l.clave };
  }
  if (!o.dispositivo || !FORMATO_DISPOSITIVO.test(o.dispositivo)) return null;
  db.sql.prepare('INSERT OR IGNORE INTO cuotas_altas (dispositivo, alta) VALUES (?, ?)').run(o.dispositivo, new Date(o.ahora).toISOString());
  const { alta } = db.sql.prepare('SELECT alta FROM cuotas_altas WHERE dispositivo = ?').get(o.dispositivo) as { alta: string };
  return { id: `d:${o.dispositivo}`, plan: 'gratis', alta, clave: null };
}

const leerUso = (db: Db, s: Sujeto, periodo: string, tipo: TipoCuota): number =>
  (db.sql.prepare('SELECT n FROM cuotas_uso WHERE sujeto = ? AND periodo = ? AND tipo = ?').get(s.id, periodo, tipo) as { n: number } | undefined)?.n ?? 0;

const leerExtra = (db: Db, clave: string | null): number =>
  clave ? ((db.sql.prepare('SELECT partidas FROM saldo_partidas WHERE clave = ?').get(clave) as { partidas: number } | undefined)?.partidas ?? 0) : 0;

export function estadoCuota(db: Db, s: Sujeto, ahora: number): EstadoCuota {
  const { inicio, fin } = periodoActual(s.alta, ahora);
  return {
    plan: s.plan,
    renueva: fin,
    usadas: { partida: leerUso(db, s, inicio, 'partida'), pregunta: leerUso(db, s, inicio, 'pregunta') },
    cuota: { ...PLANES[s.plan].cuota },
    extra: leerExtra(db, s.clave),
  };
}

/** Gasta una unidad de cuota (o una partida extra). Comprueba y suma en una transacción. */
export function consumirCuota(db: Db, s: Sujeto, tipo: TipoCuota, ahora: number): ResultadoConsumo {
  const { inicio, fin } = periodoActual(s.alta, ahora);
  return db.sql.transaction((): ResultadoConsumo => {
    if (leerUso(db, s, inicio, tipo) < PLANES[s.plan].cuota[tipo]) {
      db.sql
        .prepare('INSERT INTO cuotas_uso (sujeto, periodo, tipo, n) VALUES (?, ?, ?, 1) ON CONFLICT(sujeto, periodo, tipo) DO UPDATE SET n = n + 1')
        .run(s.id, inicio, tipo);
      // Los periodos de hace más de 2 meses ya no sirven.
      db.sql.prepare('DELETE FROM cuotas_uso WHERE periodo < ?').run(new Date(ahora - 62 * 86_400_000).toISOString());
      return { ok: true, origen: 'cuota', periodo: inicio };
    }
    if (tipo === 'partida' && PLANES[s.plan].paquetes && s.clave) {
      const r = db.sql.prepare('UPDATE saldo_partidas SET partidas = partidas - 1 WHERE clave = ? AND partidas > 0').run(s.clave);
      if (r.changes === 1) return { ok: true, origen: 'extra', periodo: inicio };
    }
    return { ok: false, renueva: fin };
  })();
}

/** Devuelve lo gastado cuando la IA falla (el jugador no recibió nada). */
export function devolverCuota(db: Db, s: Sujeto, tipo: TipoCuota, gasto: { origen: 'cuota' | 'extra'; periodo: string }): void {
  if (gasto.origen === 'extra' && s.clave) {
    db.sql.prepare('UPDATE saldo_partidas SET partidas = partidas + 1 WHERE clave = ?').run(s.clave);
    return;
  }
  db.sql.prepare('UPDATE cuotas_uso SET n = n - 1 WHERE sujeto = ? AND periodo = ? AND tipo = ? AND n > 0').run(s.id, gasto.periodo, tipo);
}

/** Suma un paquete comprado a la licencia. Idempotente por sesión de Checkout; false si ya se había sumado. */
export function sumarPaquete(db: Db, o: { sesion: string; clave: string; paquete: IdPaquete; ahora: number }): boolean {
  return db.sql.transaction(() => {
    const r = db.sql
      .prepare('INSERT OR IGNORE INTO paquetes_comprados (checkout_session, clave, paquete, comprado) VALUES (?, ?, ?, ?)')
      .run(o.sesion, o.clave, o.paquete, new Date(o.ahora).toISOString());
    if (r.changes === 0) return false;
    db.sql
      .prepare('INSERT INTO saldo_partidas (clave, partidas) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET partidas = partidas + excluded.partidas')
      .run(o.clave, PAQUETES[o.paquete].partidas);
    return true;
  })();
}
