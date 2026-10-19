import { randomBytes } from 'node:crypto';
import type { Db } from '../db';

export type EstadoLicencia = 'activa' | 'cancelada' | 'impagada';
/**
 * 'suscripcion' la crea Stripe; 'vitalicia' (nunca caduca) y 'prueba' (caduca en `caducaEn`) se crean
 * sin Stripe: con herramientas/crear-licencia o, la prueba de 24 h, desde la web.
 */
export type TipoLicencia = 'suscripcion' | 'vitalicia' | 'prueba';
/** Estado que ve el cliente: el guardado, o 'caducada' si la prueba ya pasó su fecha. */
export type EstadoEfectivo = EstadoLicencia | 'caducada';

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
  /** ISO; solo en las pruebas. */
  caducaEn: string | null;
  /** Dispositivo (id anónimo de 64 hex) al que quedó vinculada una prueba. */
  dispositivo: string | null;
  /** Duración de una prueba en horas (las de tester empiezan a contar en su primera activación). */
  horas: number | null;
}

/** Una vitalicia siempre está activa; una prueba pasa a 'caducada' en cuanto llega su fecha. */
export function estadoEfectivo(l: Licencia, ahora: number = Date.now()): EstadoEfectivo {
  if (l.tipo === 'vitalicia') return 'activa';
  if (l.caducaEn !== null && ahora >= Date.parse(l.caducaEn)) return 'caducada';
  return l.estado;
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
  /**
   * Licencia de prueba de `horas`. Con `desde: 'creacion'` (las de la web) caduca `horas` después de
   * `ahora`; por defecto (las de tester, desde la herramienta) empieza a contar en su primera activación.
   */
  crearPrueba(datos: { horas: number; nota: string; ahora?: number; desde?: 'creacion' | 'activacion' }): Licencia;
  /**
   * Vincula una prueba a un dispositivo (solo si aún no tenía) y, si aún no tenía fecha de caducidad,
   * la fija en `ahora + horas`.
   */
  vincularDispositivo(clave: string, dispositivo: string, ahora?: number): void;
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
  caduca_en: string | null;
  dispositivo: string | null;
  horas: number | null;
}

const TIPOS: TipoLicencia[] = ['suscripcion', 'vitalicia', 'prueba'];

const aLicencia = (f: Fila): Licencia => ({
  clave: f.clave,
  tipo: TIPOS.includes(f.tipo) ? f.tipo : 'suscripcion',
  stripeCustomer: f.stripe_customer,
  stripeSubscription: f.stripe_subscription,
  checkoutSession: f.checkout_session,
  estado: f.estado,
  renuevaEn: f.renueva_en,
  actualizada: f.actualizada,
  nota: f.nota,
  caducaEn: f.caduca_en,
  dispositivo: f.dispositivo,
  horas: f.horas,
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
  const insSinStripe = sql.prepare(
    `INSERT OR IGNORE INTO licencias (clave, tipo, estado, renueva_en, actualizada, nota, caduca_en, horas)
     VALUES (?, ?, 'activa', NULL, ?, ?, ?, ?)`,
  );
  const crearSinStripe = (
    tipo: 'vitalicia' | 'prueba',
    nota: string,
    ahora: number,
    caducaEn: string | null,
    horas: number | null = null,
  ): Licencia => {
    for (let intento = 0; intento < 5; intento++) {
      const clave = generarClave();
      if (insSinStripe.run(clave, tipo, new Date(ahora).toISOString(), nota, caducaEn, horas).changes === 1) return obtener(selClave, clave)!;
    }
    throw new Error('No se pudo generar una clave de licencia única.');
  };
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
    crearVitalicia: ({ nota }) => crearSinStripe('vitalicia', nota, Date.now(), null),
    crearPrueba({ horas, nota, ahora = Date.now(), desde = 'activacion' }) {
      if (!Number.isInteger(horas) || horas <= 0) throw new Error('Las horas de la prueba deben ser un entero positivo.');
      const caducaEn = desde === 'creacion' ? new Date(ahora + horas * 3600 * 1000).toISOString() : null;
      return crearSinStripe('prueba', nota, ahora, caducaEn, horas);
    },
    vincularDispositivo(clave, dispositivo, ahora = Date.now()) {
      const actual = obtener(selClave, clave);
      if (!actual || actual.tipo !== 'prueba' || actual.dispositivo) return;
      // Las claves de tester empiezan a contar ahora; las de la web ya traen su fecha.
      const caducaEn = actual.caducaEn ?? (actual.horas ? new Date(ahora + actual.horas * 3600 * 1000).toISOString() : null);
      sql
        .prepare("UPDATE licencias SET dispositivo = ?, caduca_en = ? WHERE clave = ? AND tipo = 'prueba' AND dispositivo IS NULL")
        .run(dispositivo, caducaEn, clave);
    },
  };
}
