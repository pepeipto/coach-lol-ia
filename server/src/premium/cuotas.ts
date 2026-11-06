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
  /** Licencia pagada (suscripción o vitalicia): su cuota mensual ya limita el gasto, sin los topes de los gratuitos. */
  pago: boolean;
}

/**
 * Tope mensual del plan Gratis por IP (IPv4 o /64 de IPv6), además del del dispositivo: el id del dispositivo lo
 * genera la app, así que inventar ids no debe dar cuota gratis sin fin. Es el doble del plan Gratis para que
 * dos jugadores de la misma casa (o de una IP compartida) no se queden sin nada.
 */
export const CUOTA_GRATIS_POR_IP: Record<TipoCuota, number> = {
  partida: PLANES.gratis.cuota.partida * 2,
  pregunta: PLANES.gratis.cuota.pregunta * 2,
};

/** Inicio (ISO) del mes natural en UTC: el periodo del tope por IP. */
const mesDe = (ahora: number): { inicio: string; fin: string } => {
  const d = new Date(ahora);
  return {
    inicio: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString(),
    fin: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)).toISOString(),
  };
};

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
  | { ok: true; origen: 'cuota' | 'extra'; periodo: string; ip?: { sujeto: string; periodo: string } }
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
    return { id: `l:${l.clave}`, plan: l.plan, alta: l.alta, clave: l.clave, pago: l.tipo !== 'prueba' };
  }
  if (!o.dispositivo || !FORMATO_DISPOSITIVO.test(o.dispositivo)) return null;
  db.sql.prepare('INSERT OR IGNORE INTO cuotas_altas (dispositivo, alta) VALUES (?, ?)').run(o.dispositivo, new Date(o.ahora).toISOString());
  const { alta } = db.sql.prepare('SELECT alta FROM cuotas_altas WHERE dispositivo = ?').get(o.dispositivo) as { alta: string };
  return { id: `d:${o.dispositivo}`, plan: 'gratis', alta, clave: null, pago: false };
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

const sumarUso = (db: Db, sujeto: string, periodo: string, tipo: TipoCuota) =>
  db.sql
    .prepare('INSERT INTO cuotas_uso (sujeto, periodo, tipo, n) VALUES (?, ?, ?, 1) ON CONFLICT(sujeto, periodo, tipo) DO UPDATE SET n = n + 1')
    .run(sujeto, periodo, tipo);

/**
 * Gasta una unidad de cuota (o una partida extra). Comprueba y suma en una transacción. Con `ip`, un dispositivo
 * sin licencia (plan Gratis) gasta además el tope mensual de su IP (CUOTA_GRATIS_POR_IP).
 */
export function consumirCuota(db: Db, s: Sujeto, tipo: TipoCuota, ahora: number, ip?: string): ResultadoConsumo {
  const { inicio, fin } = periodoActual(s.alta, ahora);
  return db.sql.transaction((): ResultadoConsumo => {
    if (leerUso(db, s, inicio, tipo) < PLANES[s.plan].cuota[tipo]) {
      let porIp: { sujeto: string; periodo: string } | undefined;
      if (s.clave === null && ip) {
        const mes = mesDe(ahora);
        porIp = { sujeto: `i:${ip}`, periodo: mes.inicio };
        const usadasIp =
          (db.sql.prepare('SELECT n FROM cuotas_uso WHERE sujeto = ? AND periodo = ? AND tipo = ?').get(porIp.sujeto, porIp.periodo, tipo) as { n: number } | undefined)?.n ?? 0;
        if (usadasIp >= CUOTA_GRATIS_POR_IP[tipo]) return { ok: false, renueva: mes.fin < fin ? mes.fin : fin };
        sumarUso(db, porIp.sujeto, porIp.periodo, tipo);
      }
      sumarUso(db, s.id, inicio, tipo);
      // Los periodos de hace más de 2 meses ya no sirven.
      db.sql.prepare('DELETE FROM cuotas_uso WHERE periodo < ?').run(new Date(ahora - 62 * 86_400_000).toISOString());
      return porIp ? { ok: true, origen: 'cuota', periodo: inicio, ip: porIp } : { ok: true, origen: 'cuota', periodo: inicio };
    }
    if (tipo === 'partida' && PLANES[s.plan].paquetes && s.clave) {
      const r = db.sql.prepare('UPDATE saldo_partidas SET partidas = partidas - 1 WHERE clave = ? AND partidas > 0').run(s.clave);
      if (r.changes === 1) return { ok: true, origen: 'extra', periodo: inicio };
    }
    return { ok: false, renueva: fin };
  })();
}

/** Devuelve lo gastado cuando la IA falla (el jugador no recibió nada). */
export function devolverCuota(
  db: Db,
  s: Sujeto,
  tipo: TipoCuota,
  gasto: { origen: 'cuota' | 'extra'; periodo: string; ip?: { sujeto: string; periodo: string } },
): void {
  if (gasto.origen === 'extra' && s.clave) {
    db.sql.prepare('UPDATE saldo_partidas SET partidas = partidas + 1 WHERE clave = ?').run(s.clave);
    return;
  }
  const restar = db.sql.prepare('UPDATE cuotas_uso SET n = n - 1 WHERE sujeto = ? AND periodo = ? AND tipo = ? AND n > 0');
  restar.run(s.id, gasto.periodo, tipo);
  if (gasto.ip) restar.run(gasto.ip.sujeto, gasto.ip.periodo, tipo);
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
