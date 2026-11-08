/**
 * Planes y cuotas de Coach LoL IA (propuesta de noviembre de 2026, aproximada a scoutr.gg/pricing).
 *
 * Todo esto solo se usa con PREMIUM_HABILITADO encendido, y no se enciende sin el visto bueno de Riot
 * (App Note). Lo que da información durante la partida no se cobra nunca: solo se limita el volumen de
 * coach con IA en la nube, que es lo que cuesta dinero. Hecho con ayuda de IA.
 */

export type IdPlan = 'gratis' | 'aliado' | 'estratega' | 'mariscal' | 'leyenda';
export type IdPaquete = 'partidas25' | 'partidas50' | 'partidas100';
/** 'partida': análisis con IA al terminar la partida (POST /api/coach/analisis). 'pregunta': coach personal (POST /api/coach/personal). */
export type TipoCuota = 'partida' | 'pregunta';

export interface Plan {
  id: IdPlan;
  nombre: string;
  /** Precio mensual en céntimos de euro, IVA incluido. */
  centimosMes: number;
  /** Cuota mensual por tipo. */
  cuota: Record<TipoCuota, number>;
  /** Puede comprar paquetes de partidas extra. */
  paquetes: boolean;
  /**
   * Pago anual en céntimos, IVA incluido (2 meses gratis), si el plan lo tiene. La cuota sigue siendo mensual:
   * se renueva cada mes el día del alta, también en el plan anual.
   */
  centimosAnio?: number;
}

export interface Paquete {
  id: IdPaquete;
  partidas: number;
  /** Pago único en céntimos de euro, IVA incluido. */
  centimos: number;
}

export const PLANES: Record<IdPlan, Plan> = {
  gratis: { id: 'gratis', nombre: 'Gratis', centimosMes: 0, cuota: { partida: 3, pregunta: 5 }, paquetes: false },
  aliado: { id: 'aliado', nombre: 'Aliado', centimosMes: 499, cuota: { partida: 10, pregunta: 50 }, paquetes: false, centimosAnio: 4990 },
  estratega: { id: 'estratega', nombre: 'Estratega', centimosMes: 899, cuota: { partida: 30, pregunta: 150 }, paquetes: true, centimosAnio: 8990 },
  mariscal: { id: 'mariscal', nombre: 'Mariscal', centimosMes: 1499, cuota: { partida: 60, pregunta: 300 }, paquetes: true },
  leyenda: { id: 'leyenda', nombre: 'Leyenda', centimosMes: 2499, cuota: { partida: 120, pregunta: 600 }, paquetes: true },
};

/** Planes de pago, en el orden en que se muestran. */
export const PLANES_DE_PAGO: readonly Exclude<IdPlan, 'gratis'>[] = ['aliado', 'estratega', 'mariscal', 'leyenda'];

/** Planes que también se pueden pagar por años. */
export const PLANES_ANUALES: readonly Exclude<IdPlan, 'gratis'>[] = PLANES_DE_PAGO.filter((id) => PLANES[id].centimosAnio !== undefined);

/** Periodo de pago de una suscripción. */
export type PeriodoPago = 'mes' | 'anio';
export const esPeriodoPago = (v: unknown): v is PeriodoPago => v === 'mes' || v === 'anio';

export const PAQUETES: Record<IdPaquete, Paquete> = {
  partidas25: { id: 'partidas25', partidas: 25, centimos: 899 },
  partidas50: { id: 'partidas50', partidas: 50, centimos: 1499 },
  partidas100: { id: 'partidas100', partidas: 100, centimos: 2399 },
};

export const esIdPlan = (v: unknown): v is IdPlan => typeof v === 'string' && Object.hasOwn(PLANES, v);
export const esIdPaquete = (v: unknown): v is IdPaquete => typeof v === 'string' && Object.hasOwn(PAQUETES, v);

/** «8,99 €» a partir de céntimos. */
export const formatearEuros = (centimos: number): string =>
  `${Math.floor(centimos / 100)}${centimos % 100 ? `,${String(centimos % 100).padStart(2, '0')}` : ''} €`;

/** Fecha del alta trasladada al año y mes dados (o al último día de ese mes si no lo tiene). */
function anclaEnMes(a: Date, anio: number, mes: number): number {
  const ultimo = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return Date.UTC(anio, mes, Math.min(a.getUTCDate(), ultimo), a.getUTCHours(), a.getUTCMinutes(), a.getUTCSeconds());
}

/**
 * Periodo mensual en curso (ISO), contado desde el día del alta: la cuota se renueva cada mes ese mismo
 * día (o el último del mes si no lo tiene, p. ej. un alta el 31) y no se acumula.
 */
export function periodoActual(alta: string | number, ahora: number): { inicio: string; fin: string } {
  const a = new Date(alta);
  const n = new Date(ahora);
  let anio = n.getUTCFullYear();
  let mes = n.getUTCMonth();
  if (ahora < a.getTime()) {
    anio = a.getUTCFullYear();
    mes = a.getUTCMonth();
  } else if (anclaEnMes(a, anio, mes) > ahora) {
    mes -= 1;
  }
  const inicio = Math.max(anclaEnMes(a, anio, mes), a.getTime());
  return { inicio: new Date(inicio).toISOString(), fin: new Date(anclaEnMes(a, anio, mes + 1)).toISOString() };
}
