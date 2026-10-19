/**
 * Interruptor de Premium (licencias, pruebas, Stripe y coach en partida de pago).
 *
 * Las políticas de Riot prohíben cobrar por una app o dar acceso exclusivo a parte de los usuarios,
 * así que Coach LoL IA es gratis para todos y este interruptor está apagado. El código de Premium se
 * conserva solo para reactivarlo si Riot aprueba oficialmente la monetización:
 * - servidor: variable de entorno `PREMIUM_HABILITADO=1`;
 * - app y web: constante de compilación (este valor), apagada por defecto.
 */
export const PREMIUM_HABILITADO: boolean = false;
