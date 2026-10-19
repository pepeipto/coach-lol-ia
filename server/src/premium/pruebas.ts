import { createHmac, randomBytes } from 'node:crypto';
import type { Db } from '../db';
import { estadoEfectivo, type EstadoEfectivo, type Licencia, type RepoLicencias, type TipoLicencia } from './licencias';

/** Horas de la prueba que se pide desde la web. */
export const HORAS_PRUEBA_WEB = 24;
/** Nota con la que se guardan las pruebas pedidas desde la web. */
export const NOTA_PRUEBA_WEB = 'web';
/** Una prueba por IP (con sal y hash) cada 30 días. */
export const VENTANA_PRUEBA_IP_MS = 30 * 24 * 3600 * 1000;
/** Id anónimo de dispositivo que envía la app: SHA-256 en hexadecimal. */
export const FORMATO_DISPOSITIVO = /^[0-9a-f]{64}$/;

/** Respuesta de GET /api/premium/estado/:clave. */
export interface RespuestaEstado {
  premium: boolean;
  estado: EstadoEfectivo | 'otro_dispositivo' | 'prueba_ya_usada';
  renuevaEn: string | null;
  caducaEn: string | null;
  tipo: TipoLicencia;
  vitalicia?: true;
}

/** Sal para el hash de las IP: PRUEBA_SAL si está definida; si no, una aleatoria guardada en la base. */
export function salDePrueba(db: Db, salConfigurada?: string | null): string {
  if (salConfigurada) return salConfigurada;
  const leer = db.sql.prepare("SELECT valor FROM ajustes_servidor WHERE clave = 'sal_prueba'");
  const guardada = leer.get() as { valor: string } | undefined;
  if (guardada) return guardada.valor;
  db.sql.prepare("INSERT OR IGNORE INTO ajustes_servidor (clave, valor) VALUES ('sal_prueba', ?)").run(randomBytes(32).toString('hex'));
  return (leer.get() as { valor: string }).valor;
}

/** Solo se guarda esto de la IP: HMAC-SHA256 con la sal como clave. */
export function hashIp(sal: string, ip: string): string {
  return createHmac('sha256', sal).update(ip).digest('hex');
}

/** Borra los registros de IP de hace más de 30 días (ya no limitan nada). Devuelve cuántos borró. */
export function purgarPruebasIp(db: Db, ahora: number): number {
  return db.sql.prepare('DELETE FROM pruebas_ip WHERE solicitada < ?').run(new Date(ahora - VENTANA_PRUEBA_IP_MS).toISOString()).changes;
}

/**
 * Crea una prueba de 24 h si esa IP no pidió otra en los últimos 30 días. Devuelve null si ya la pidió.
 * La comprobación y el registro van en una transacción para que dos peticiones a la vez no saquen dos.
 */
export function pedirPrueba(db: Db, repo: RepoLicencias, o: { ip: string; sal: string; ahora: number }): Licencia | null {
  const hash = hashIp(o.sal, o.ip);
  return db.sql.transaction(() => {
    purgarPruebasIp(db, o.ahora);
    const previa = db.sql.prepare('SELECT solicitada FROM pruebas_ip WHERE hash = ?').get(hash) as { solicitada: string } | undefined;
    if (previa && o.ahora - Date.parse(previa.solicitada) < VENTANA_PRUEBA_IP_MS) return null;
    db.sql.prepare('INSERT OR REPLACE INTO pruebas_ip (hash, solicitada) VALUES (?, ?)').run(hash, new Date(o.ahora).toISOString());
    return repo.crearPrueba({ horas: HORAS_PRUEBA_WEB, nota: NOTA_PRUEBA_WEB, ahora: o.ahora, desde: 'creacion' });
  })();
}

/**
 * Estado de una licencia para la app. Las pruebas se vinculan al primer dispositivo que las consulta:
 * desde otro dispositivo dan 'otro_dispositivo', y un dispositivo que ya usó otra prueba da
 * 'prueba_ya_usada'. Las suscripciones y vitalicias ignoran el dispositivo.
 */
export function estadoParaCliente(db: Db, repo: RepoLicencias, l: Licencia, dispositivo: string | undefined, ahora: number): RespuestaEstado {
  if (l.tipo === 'vitalicia') return { premium: true, estado: 'activa', renuevaEn: null, caducaEn: null, tipo: 'vitalicia', vitalicia: true };
  if (l.tipo === 'prueba' && dispositivo && FORMATO_DISPOSITIVO.test(dispositivo)) {
    // Solo las pruebas de la web cuentan para «una prueba por equipo»; las claves de tester se pueden
    // usar en cualquier equipo, pero también quedan vinculadas al primero.
    const deLaWeb = l.nota === NOTA_PRUEBA_WEB;
    const vinculo = db.sql.transaction((): RespuestaEstado['estado'] | null => {
      const actual = repo.porClave(l.clave);
      if (actual?.dispositivo) return actual.dispositivo === dispositivo ? null : 'otro_dispositivo';
      if (deLaWeb) {
        const usada = db.sql.prepare('SELECT clave FROM pruebas_dispositivos WHERE dispositivo = ?').get(dispositivo) as { clave: string } | undefined;
        if (usada && usada.clave !== l.clave) return 'prueba_ya_usada';
      }
      repo.vincularDispositivo(l.clave, dispositivo, ahora);
      if (deLaWeb) {
        db.sql
          .prepare('INSERT OR IGNORE INTO pruebas_dispositivos (dispositivo, clave, vinculada) VALUES (?, ?, ?)')
          .run(dispositivo, l.clave, new Date(ahora).toISOString());
      }
      return null;
    })();
    // Tras vincular, una clave de tester ya tiene su fecha de caducidad.
    l = repo.porClave(l.clave) ?? l;
    if (vinculo) return { premium: false, estado: vinculo, renuevaEn: l.renuevaEn, caducaEn: l.caducaEn, tipo: l.tipo };
  }
  const estado = estadoEfectivo(l, ahora);
  return { premium: estado === 'activa', estado, renuevaEn: l.renuevaEn, caducaEn: l.caducaEn, tipo: l.tipo };
}
