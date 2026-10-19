import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db';
import { estadoEfectivo, type EstadoEfectivo, type Licencia, type RepoLicencias, type TipoLicencia } from './licencias';

/** Horas de la prueba que se pide desde la web. */
export const HORAS_PRUEBA_WEB = 24;
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

/** Solo se guarda esto de la IP: SHA-256(sal + ip). */
export function hashIp(sal: string, ip: string): string {
  return createHash('sha256').update(sal).update(ip).digest('hex');
}

/**
 * Crea una prueba de 24 h si esa IP no pidió otra en los últimos 30 días. Devuelve null si ya la pidió.
 * La comprobación y el registro van en una transacción para que dos peticiones a la vez no saquen dos.
 */
export function pedirPrueba(db: Db, repo: RepoLicencias, o: { ip: string; sal: string; ahora: number }): Licencia | null {
  const hash = hashIp(o.sal, o.ip);
  return db.sql.transaction(() => {
    const previa = db.sql.prepare('SELECT solicitada FROM pruebas_ip WHERE hash = ?').get(hash) as { solicitada: string } | undefined;
    if (previa && o.ahora - Date.parse(previa.solicitada) < VENTANA_PRUEBA_IP_MS) return null;
    db.sql.prepare('INSERT OR REPLACE INTO pruebas_ip (hash, solicitada) VALUES (?, ?)').run(hash, new Date(o.ahora).toISOString());
    return repo.crearPrueba({ horas: HORAS_PRUEBA_WEB, nota: 'web', ahora: o.ahora });
  })();
}

/**
 * Estado de una licencia para la app. Las pruebas se vinculan al primer dispositivo que las consulta:
 * desde otro dispositivo dan 'otro_dispositivo', y un dispositivo que ya usó otra prueba da
 * 'prueba_ya_usada'. Las suscripciones y vitalicias ignoran el dispositivo.
 */
export function estadoParaCliente(db: Db, repo: RepoLicencias, l: Licencia, dispositivo: string | undefined, ahora: number): RespuestaEstado {
  const base = { renuevaEn: l.renuevaEn, caducaEn: l.caducaEn, tipo: l.tipo };
  if (l.tipo === 'vitalicia') return { premium: true, estado: 'activa', renuevaEn: null, caducaEn: null, tipo: 'vitalicia', vitalicia: true };
  if (l.tipo === 'prueba' && dispositivo && FORMATO_DISPOSITIVO.test(dispositivo)) {
    const vinculo = db.sql.transaction((): RespuestaEstado['estado'] | null => {
      const actual = repo.porClave(l.clave);
      if (actual?.dispositivo) return actual.dispositivo === dispositivo ? null : 'otro_dispositivo';
      const usada = db.sql.prepare('SELECT clave FROM pruebas_dispositivos WHERE dispositivo = ?').get(dispositivo) as { clave: string } | undefined;
      if (usada && usada.clave !== l.clave) return 'prueba_ya_usada';
      repo.vincularDispositivo(l.clave, dispositivo);
      db.sql
        .prepare('INSERT OR IGNORE INTO pruebas_dispositivos (dispositivo, clave, vinculada) VALUES (?, ?, ?)')
        .run(dispositivo, l.clave, new Date(ahora).toISOString());
      return null;
    })();
    if (vinculo) return { premium: false, estado: vinculo, ...base };
  }
  const estado = estadoEfectivo(l, ahora);
  return { premium: estado === 'activa', estado, ...base };
}
