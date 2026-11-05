/**
 * Interruptor de los planes de pago (licencias, pruebas, Stripe y cuotas del coach con IA).
 *
 * Encendido desde noviembre de 2026: lo de la app sigue siendo gratis para todos, también el coach en
 * partida; los planes solo amplían la cuota mensual de coach con IA en la nube (ver planes.ts), que es
 * lo que cuesta dinero. Se avisa a Riot con una App Note (docs/app-note-riot-planes.md).
 * - servidor: variable de entorno `PREMIUM_HABILITADO=1`;
 * - app y web: constante de compilación (este valor y web/src/lib/producto.ts).
 */
export const PREMIUM_HABILITADO: boolean = true;
