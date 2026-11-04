/**
 * Plan de la app según el interruptor PREMIUM_HABILITADO (constante de compilación, apagada).
 *
 * Apagado (Coach LoL IA gratis, como exigen las políticas de Riot): no se crea el gestor de
 * licencias, no se consulta el servidor y el coach en partida funciona para todo el mundo.
 * Encendido (solo si Riot aprueba la monetización): se crea el gestor de licencias, pero el coach en
 * partida sigue siendo gratis; la licencia solo fija la cuota mensual de coach con IA del servidor.
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
  // Con los planes de cuotas (nov. 2026), el coach en partida es gratis para todos también con Premium:
  // la licencia solo decide la cuota mensual de coach con IA (análisis y preguntas), que limita el servidor.
  return { licencia: o.crearLicencia(), esPremium: () => true };
}
