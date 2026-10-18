import { randomBytes } from 'node:crypto';
import type { Db } from '../db';

export type EstadoLicencia = 'activa' | 'cancelada' | 'impagada';

export interface Licencia {
  clave: string;
  stripeCustomer: string;
  stripeSubscription: string | null;
  checkoutSession: string;
  estado: EstadoLicencia;
  renuevaEn: string | null;
  actualizada: string;
}

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Clave `CLIA-XXXX-XXXX-XXXX-XXXX` con caracteres aleatorios criptográficos (sin sesgo de módulo: 32 símbolos). */
export function generarClave(aleatorio: (n: number) => Buffer = randomBytes): string {
  const bytes = aleatorio(16);
  const grupos: string[] = [];
  for (let g = 0; g < 4; g++) {
    let grupo = '';
    for (let i = 0; i < 4; i++) grupo += ALFABETO[bytes[g * 4 + i]! % ALFABETO.length];
    grupos.push(grupo);
  }
  return `CLIA-${grupos.join('-')}`;
}

export interface RepoLicencias {
  porSesion(sesion: string): Licencia | null;
  porClave(clave: string): Licencia | null;
  porSuscripcion(sub: string): Licencia | null;
  /** Idempotente por `checkoutSession`. */
  crearSiNoExiste(datos: {
    checkoutSession: string;
    stripeCustomer: string;
    stripeSubscription: string | null;
    renuevaEn: string | null;
    /** Por defecto 'activa'. */
    estado?: EstadoLicencia;
  }): Licencia;
  actualizarPorSuscripcion(sub: string, cambios: { estado?: EstadoLicencia; renuevaEn?: string | null }): Licencia | null;
}

interface Fila {
  clave: string;
  stripe_customer: string;
  stripe_subscription: string | null;
  checkout_session: string;
  estado: EstadoLicencia;
  renueva_en: string | null;
  actualizada: string;
}

const aLicencia = (f: Fila): Licencia => ({
  clave: f.clave,
  stripeCustomer: f.stripe_customer,
  stripeSubscription: f.stripe_subscription,
  checkoutSession: f.checkout_session,
  estado: f.estado,
  renuevaEn: f.renueva_en,
  actualizada: f.actualizada,
});

export function crearRepoLicencias(db: Db): RepoLicencias {
  const sql = db.sql;
  const selSesion = sql.prepare('SELECT * FROM licencias WHERE checkout_session = ?');
  const selClave = sql.prepare('SELECT * FROM licencias WHERE clave = ?');
  const selSub = sql.prepare('SELECT * FROM licencias WHERE stripe_subscription = ?');
  const ins = sql.prepare(
    `INSERT OR IGNORE INTO licencias
       (clave, stripe_customer, stripe_subscription, checkout_session, estado, renueva_en, actualizada)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const obtener = (st: typeof selSesion, v: string): Licencia | null => {
    const f = st.get(v) as Fila | undefined;
    return f ? aLicencia(f) : null;
  };

  return {
    porSesion: (s) => obtener(selSesion, s),
    porClave: (c) => obtener(selClave, c),
    porSuscripcion: (s) => obtener(selSub, s),
    crearSiNoExiste(d) {
      const ahora = new Date().toISOString();
      // Una colisión de clave (casi imposible) se reintenta con otra; una sesión repetida se ignora.
      for (let intento = 0; intento < 5; intento++) {
        ins.run(generarClave(), d.stripeCustomer, d.stripeSubscription, d.checkoutSession, d.estado ?? 'activa', d.renuevaEn, ahora);
        const existente = obtener(selSesion, d.checkoutSession);
        if (existente) return existente;
      }
      throw new Error('No se pudo generar una clave de licencia única.');
    },
    actualizarPorSuscripcion(sub, cambios) {
      const actual = obtener(selSub, sub);
      if (!actual) return null;
      const estado = cambios.estado ?? actual.estado;
      const renuevaEn = cambios.renuevaEn !== undefined ? cambios.renuevaEn : actual.renuevaEn;
      sql
        .prepare('UPDATE licencias SET estado = ?, renueva_en = ?, actualizada = ? WHERE stripe_subscription = ?')
        .run(estado, renuevaEn, new Date().toISOString(), sub);
      return obtener(selSub, sub);
    },
  };
}
