/**
 * Topes de gasto de la IA por defecto (seguridad, hallazgos 1, 3 y 4). Son los mismos que fija fly.toml, para que un
 * despliegue sin esas variables no quede con topes altos. Coach LoL IA es gratis: los topes están pensados para que un
 * abuso (rotando IPv6, que se salta los límites por IP) no cueste más de unos pocos dólares al día por ruta. Si se
 * quedan cortos con usuarios reales, se suben en fly.toml sin tocar el código.
 *
 * Precios usados (API de Anthropic, por millón de tokens de entrada / salida): Sonnet 5.5, 2 / 10 USD; Haiku 5.5,
 * 0,10 / 0,50 USD. «Peor caso» es con la salida llena hasta max_tokens; lo normal es bastante menos.
 *
 * Además de esto, conviene poner un límite de gasto mensual en la consola de Anthropic (no se puede hacer desde aquí).
 */

/** Asistente de soporte: Sonnet basta para dudas de la app (ASISTENTE_MODELO lo cambia). */
export const MODELO_ASISTENTE = 'claude-sonnet-5-5';
/**
 * Peor caso por respuesta: ~2000 tokens de historial (recortado a 6000 caracteres), la base de conocimiento en caché y
 * 700 de salida ≈ 0,012 USD. 300 al día ≈ 3,6 USD como mucho; 60 por hora aguanta un pico sin gastar el día entero
 * en unos minutos.
 */
export const ASISTENTE_MAX_HORA = 60;
export const ASISTENTE_MAX_DIA = 300;

/**
 * Ficha del campeón (Sonnet, hasta 8000 tokens de salida): peor caso ≈ 0,09 USD. Las fichas se guardan por versión
 * de Data Dragon y solo se generan las que alguien pide, así que 100 al día cubren de sobra los campeones que se
 * juegan en las primeras horas de un parche (≈ 9 USD como mucho). 15 por IP y día: un usuario normal mira unas pocas.
 */
export const FICHA_MAX_DIA = 100;
export const FICHA_IP_DIA = 15;

/**
 * Claves del cruce (Sonnet, hasta 6000 tokens de salida): peor caso ≈ 0,07 USD. Hay cientos de miles de cruces
 * posibles y es fácil pedirlos al azar: 120 al día (≈ 8 USD como mucho) y 20 por IP, que es más de lo que se ve en
 * una tarde de partidas.
 */
export const CRUCE_CONSEJOS_MAX_DIA = 120;
export const CRUCE_CONSEJOS_IP_DIA = 20;

/** Novedades del parche (Sonnet, hasta 16 000 tokens): 5 idiomas por parche; 10 al día permiten repetir una vez (≈ 1,6 USD). */
export const PARCHE_MAX_DIA = 10;

/**
 * Coach con IA: los mismos valores que ya estaban en fly.toml (peor caso ~10 USD al día entre las tres rutas, según
 * su comentario). El consejo usa Haiku (120 tokens de salida, céntimos por miles); el análisis y el coach personal,
 * Sonnet. Antes el código tenía por defecto entre 7 y 15 veces más.
 */
export const LIMITES_COACH_IA = {
  analisisIpDia: 10,
  consejoIpDia: 60,
  analisisMaxHora: 40,
  analisisMaxDia: 200,
  consejoMaxHora: 400,
  consejoMaxDia: 3000,
  personalIpDia: 40,
  personalMaxHora: 60,
  personalMaxDia: 400,
} as const;
