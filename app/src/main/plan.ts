/**
 * Plan de la app según el interruptor PREMIUM_HABILITADO (constante de compilación, apagada).
 *
 * Apagado (Coach LoL IA gratis, como exigen las políticas de Riot): no se crea el gestor de
 * licencias, no se consulta el servidor y el coach en partida funciona para todo el mundo.
 * Encendido (solo si Riot aprueba la monetización): el plan sale de la licencia, como en 2.0.
 */
export interface Plan<G> {
  /** Gestor de licencias; null con Premium desactivado. */
  licencia: G | null;
  /** Si el coach en partida está disponible. */
  esPremium: () => boolean;
}

export function crearPlan<G extends { estado(): { plan: string } }>(o: {
  premiumHabilitado: boolean;
  crearLicencia: () => G;
}): Plan<G> {
  if (!o.premiumHabilitado) return { licencia: null, esPremium: () => true };
  const licencia = o.crearLicencia();
  return { licencia, esPremium: () => licencia.estado().plan === 'premium' };
}
