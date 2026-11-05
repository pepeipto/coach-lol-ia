// Interruptor de los planes de pago de la web (constante de compilación, igual que PREMIUM_HABILITADO en shared/).
// Encendido desde noviembre de 2026: se construyen /premium, /premium/gracias y /premium/gestionar (src/premium/).
// Todo sigue siendo gratis; los planes solo amplían la cuota de coach con IA.
// Sin dependencias de Astro: lo importa también astro.config.mjs.
export const PREMIUM_HABILITADO: boolean = true;
