import { randomBytes } from 'node:crypto';
import type { Db } from '../db';

export type EstadoLicencia = 'activa' | 'cancelada' | 'impagada';
/** 'suscripcion' la crea Stripe; 'vitalicia' se crea a mano (herramientas/crear-licencia) y nunca caduca. */
export type TipoLicencia = 'suscripcion' | 'vitalicia';

export interface Licencia {
  clave: string;
  tipo: TipoLicencia;
  /** null en las vitalicias. */
  stripeCustomer: string | null;
  stripeSubscription: string | null;
  /** null en las vitalicias. */
  checkoutSession: string | null;
  estado: EstadoLicencia;
  renuevaEn: string | null;
  actualizada: string;
  nota: string | null;
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
  /** Solo afecta a licencias de suscripción: una vitalicia nunca cambia. */
  actualizarPorSuscripcion(sub: string, cambios: { estado?: EstadoLicencia; renuevaEn?: string | null }): Licencia | null;
  /** Licencia vitalicia: siempre activa, sin renovación ni datos de Stripe. */
  crearVitalicia(datos: { nota: string }): Licencia;
}

interface Fila {
  clave: string;
  tipo: TipoLicencia;
  stripe_customer: string | null;
  stripe_subscription: string | null;
  checkout_session: string | null;
  estado: EstadoLicencia;
  renueva_en: string | null;
  actualizada: string;
  nota: string | null;
}

const aLicencia = (f: Fila): Licencia => ({
  clave: f.clave,
  tipo: f.tipo === 'vitalicia' ? 'vitalicia' : 'suscripcion',
  stripeCustomer: f.stripe_customer,
  stripeSubscription: f.stripe_subscription,
  checkoutSession: f.checkout_session,
  estado: f.estado,
  renuevaEn: f.renueva_en,
  actualizada: f.actualizada,
  nota: f.nota,
});

export function crearRepoLicencias(db: Db): RepoLicencias {
  const sql = db.sql;
  const selSesion = sql.prepare('SELECT * FROM licencias WHERE checkout_session = ?');
  const selClave = sql.prepare('SELECT * FROM licencias WHERE clave = ?');
  const selSub = sql.prepare("SELECT * FROM licencias WHERE stripe_subscription = ? AND tipo = 'suscripcion'");
  const ins = sql.prepare(
    `INSERT OR IGNORE INTO licencias
       (clave, tipo, stripe_customer, stripe_subscription, checkout_session, estado, renueva_en, actualizada)
     VALUES (?, 'suscripcion', ?, ?, ?, ?, ?, ?)`,
  );
  const insVitalicia = sql.prepare(
    `INSERT OR IGNORE INTO licencias (clave, tipo, estado, renueva_en, actualizada, nota)
     VALUES (?, 'vitalicia', 'activa', NULL, ?, ?)`,
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
        .prepare("UPDATE licencias SET estado = ?, renueva_en = ?, actualizada = ? WHERE stripe_subscription = ? AND tipo = 'suscripcion'")
        .run(estado, renuevaEn, new Date().toISOString(), sub);
      return obtener(selSub, sub);
    },
    crearVitalicia({ nota }) {
      for (let intento = 0; intento < 5; intento++) {
        const clave = generarClave();
        if (insVitalicia.run(clave, new Date().toISOString(), nota).changes === 1) return obtener(selClave, clave)!;
      }
      throw new Error('No se pudo generar una clave de licencia única.');
    },
  };
}
