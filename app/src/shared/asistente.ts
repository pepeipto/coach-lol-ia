import type { MensajeAsistente } from './tiposApp';

export const MAX_MENSAJES_ASISTENTE = 12;
/** Las respuestas del asistente que se reenvían como contexto se recortan a esto. */
export const MAX_CARACTERES_RESPUESTA = 8000;

/**
 * Deja el historial listo para continuar: roles alternos empezando por el usuario (se quitan las
 * entradas que sobran), respuestas recortadas a 8000 caracteres, sin una pregunta final que se quedó
 * sin respuesta y como mucho 11 mensajes (más la pregunta nueva, 12).
 */
export function normalizarHistorial(historial: readonly MensajeAsistente[]): MensajeAsistente[] {
  const r: MensajeAsistente[] = [];
  for (const m of historial) {
    if (!m || (m.rol !== 'usuario' && m.rol !== 'asistente') || typeof m.texto !== 'string' || !m.texto.trim()) continue;
    const esperado = r.length === 0 || r[r.length - 1]!.rol === 'asistente' ? 'usuario' : 'asistente';
    if (m.rol !== esperado) continue;
    r.push({ rol: m.rol, texto: m.rol === 'asistente' ? m.texto.slice(0, MAX_CARACTERES_RESPUESTA) : m.texto });
  }
  if (r.length > 0 && r[r.length - 1]!.rol === 'usuario') r.pop();
  let ultimos = r.slice(-(MAX_MENSAJES_ASISTENTE - 1));
  while (ultimos.length > 0 && ultimos[0]!.rol !== 'usuario') ultimos = ultimos.slice(1);
  return ultimos;
}

/** Lo que se envía: el historial normalizado más la pregunta nueva. */
export function paraEnviar(historial: readonly MensajeAsistente[], pregunta: string): MensajeAsistente[] {
  return [...normalizarHistorial(historial), { rol: 'usuario', texto: pregunta }];
}
