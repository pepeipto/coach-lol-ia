// Interruptor de Premium de la web (constante de compilación, igual que PREMIUM_HABILITADO en shared/).
// Las políticas de Riot no permiten cobrar ni dar acceso exclusivo, así que Coach LoL IA es gratis y
// las páginas /premium, /premium/gracias y /premium/gestionar no se construyen ni se enlazan. Su código
// se conserva en src/premium/ y solo se volvería a encender si Riot aprueba oficialmente la monetización.
// Sin dependencias de Astro: lo importa también astro.config.mjs.
export const PREMIUM_HABILITADO: boolean = false;
