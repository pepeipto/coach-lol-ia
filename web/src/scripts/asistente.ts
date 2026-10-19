// Asistente IA de la web: chat flotante que llama a POST {API}/api/asistente.
//   cuerpo { mensajes: [{ rol: 'usuario' | 'asistente', texto }] } → { respuesta }
//   503 asistente_no_configurado · 429 limite_asistente · 502 asistente_no_disponible · 400 mensajes_no_validos
// Todo el texto se inserta con textContent (nunca HTML). El historial vive en sessionStorage.
// Solo sintaxis de TypeScript borrable (Node 24 la ejecuta sin compilar en las pruebas).

export const NOTA_ASISTENTE =
  'Respuestas generadas por IA; pueden contener errores. Para problemas de cobro escribe a suport@coachlolia.com.';

export const MENSAJES_ASISTENTE = {
  noDisponible: 'El asistente aún no está disponible. Mientras tanto, escríbenos a suport@coachlolia.com.',
  limite: 'Has hecho muchas preguntas seguidas. Espera un rato y vuelve a intentarlo.',
  fallo: 'El asistente no ha podido responder ahora. Inténtalo de nuevo en unos minutos.',
  noValido: 'No he podido enviar tu mensaje. Escribe una pregunta de hasta 1000 caracteres.',
  sinConexion: 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
} as const;

export const MAX_MENSAJES = 12;
export const MAX_CARACTERES = 1000;
const CLAVE_SESION = 'coach-asistente';

export interface MensajeChat {
  rol: 'usuario' | 'asistente';
  texto: string;
}

type Respuesta = { ok: boolean; status: number; json(): Promise<unknown> };
export type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<Respuesta>;

/** Los últimos mensajes que caben (12), empezando siempre por uno del usuario. */
export function recortarHistorial(historial: MensajeChat[]): MensajeChat[] {
  let r = historial.slice(-MAX_MENSAJES);
  while (r.length > 0 && r[0]!.rol !== 'usuario') r = r.slice(1);
  return r;
}

/** Envía el historial (el último mensaje es la pregunta) y devuelve la respuesta o un error en español. */
export async function preguntar(
  api: string,
  historial: MensajeChat[],
  fetch: Fetch,
): Promise<{ ok: true; respuesta: string } | { ok: false; error: string }> {
  let r: Respuesta;
  try {
    r = await fetch(`${api.replace(/\/+$/, '')}/api/asistente`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mensajes: recortarHistorial(historial) }),
    });
  } catch {
    return { ok: false, error: MENSAJES_ASISTENTE.sinConexion };
  }
  let cuerpo: Record<string, unknown> = {};
  try {
    const datos = await r.json();
    if (datos && typeof datos === 'object') cuerpo = datos as Record<string, unknown>;
  } catch {
    cuerpo = {};
  }
  if (r.ok && typeof cuerpo.respuesta === 'string' && cuerpo.respuesta.trim()) return { ok: true, respuesta: cuerpo.respuesta };
  if (r.status === 503) return { ok: false, error: MENSAJES_ASISTENTE.noDisponible };
  if (r.status === 429) return { ok: false, error: MENSAJES_ASISTENTE.limite };
  if (r.status === 400) return { ok: false, error: MENSAJES_ASISTENTE.noValido };
  return { ok: false, error: MENSAJES_ASISTENTE.fallo };
}

// ---------------------------------------------------------------------------
// Conexión con el DOM (solo en el navegador).

function leerHistorial(): MensajeChat[] {
  try {
    const datos = JSON.parse(sessionStorage.getItem(CLAVE_SESION) ?? '[]') as unknown;
    if (!Array.isArray(datos)) return [];
    return datos.filter(
      (m): m is MensajeChat =>
        !!m && (m.rol === 'usuario' || m.rol === 'asistente') && typeof m.texto === 'string',
    );
  } catch {
    return [];
  }
}

function guardarHistorial(h: MensajeChat[]): void {
  try {
    sessionStorage.setItem(CLAVE_SESION, JSON.stringify(h.slice(-40)));
  } catch {
    // sin sessionStorage (modo privado): el chat funciona igual durante la visita
  }
}

const ENFOCABLES = 'button:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Botón flotante «Asistente IA» y su panel de chat (diálogo modal accesible). */
export function iniciarAsistente(): void {
  const abrir = document.getElementById('asistente-abrir') as HTMLButtonElement | null;
  const panel = document.getElementById('asistente-panel') as HTMLDialogElement | null;
  const cerrar = document.getElementById('asistente-cerrar') as HTMLButtonElement | null;
  const lista = document.getElementById('asistente-mensajes');
  const form = document.getElementById('asistente-form') as HTMLFormElement | null;
  const campo = document.getElementById('asistente-texto') as HTMLTextAreaElement | null;
  const enviar = form?.querySelector<HTMLButtonElement>('button[type="submit"]') ?? null;
  const estado = document.getElementById('asistente-estado');
  if (!abrir || !panel || !cerrar || !lista || !form || !campo || !enviar || !estado) return;
  const api = panel.dataset.api || 'http://localhost:8080';
  let historial = leerHistorial();
  let esperando = false;

  function burbuja(m: MensajeChat): void {
    const li = document.createElement('li');
    li.className = `asistente-burbuja ${m.rol}`;
    const quien = document.createElement('span');
    quien.className = 'solo-lectores';
    quien.textContent = m.rol === 'usuario' ? 'Tú: ' : 'Asistente: ';
    const texto = document.createElement('p');
    texto.textContent = m.texto;
    li.append(quien, texto);
    lista!.append(li);
  }

  function pintar(): void {
    lista!.replaceChildren();
    for (const m of historial) burbuja(m);
    lista!.scrollTop = lista!.scrollHeight;
  }

  function mostrarEstado(texto: string, tipo: 'error' | 'info'): void {
    estado!.textContent = texto;
    estado!.dataset.tipo = tipo;
    estado!.hidden = !texto;
  }

  function abrirPanel(): void {
    pintar();
    if (typeof panel!.showModal === 'function') panel!.showModal();
    else panel!.setAttribute('open', '');
    abrir!.setAttribute('aria-expanded', 'true');
    campo!.focus();
  }

  function cerrarPanel(): void {
    if (typeof panel!.close === 'function') panel!.close();
    else panel!.removeAttribute('open');
  }

  panel.addEventListener('close', () => {
    abrir.setAttribute('aria-expanded', 'false');
    abrir.focus();
  });
  abrir.addEventListener('click', abrirPanel);
  cerrar.addEventListener('click', cerrarPanel);
  // Esc cierra (el <dialog> modal ya lo hace; esto cubre los navegadores sin showModal) y Tab no sale del panel.
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cerrarPanel();
      return;
    }
    if (e.key !== 'Tab') return;
    const enfocables = [...panel.querySelectorAll<HTMLElement>(ENFOCABLES)];
    if (enfocables.length === 0) return;
    const primero = enfocables[0]!;
    const ultimo = enfocables[enfocables.length - 1]!;
    if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  });
  campo.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = campo.value.trim();
    if (!texto || esperando) return;
    if (texto.length > MAX_CARACTERES) {
      mostrarEstado(MENSAJES_ASISTENTE.noValido, 'error');
      return;
    }
    esperando = true;
    enviar.disabled = true;
    campo.value = '';
    historial = [...historial, { rol: 'usuario', texto }];
    guardarHistorial(historial);
    burbuja({ rol: 'usuario', texto });
    lista.scrollTop = lista.scrollHeight;
    mostrarEstado('Escribiendo…', 'info');
    const r = await preguntar(api, historial, (url, init) => window.fetch(url, init));
    esperando = false;
    enviar.disabled = false;
    if (r.ok) {
      historial = [...historial, { rol: 'asistente', texto: r.respuesta }];
      guardarHistorial(historial);
      burbuja({ rol: 'asistente', texto: r.respuesta });
      mostrarEstado('', 'info');
    } else {
      // La pregunta sin respuesta se quita del historial para que el siguiente envío siga alternando.
      historial = historial.slice(0, -1);
      guardarHistorial(historial);
      campo.value = texto;
      pintar();
      mostrarEstado(r.error, 'error');
    }
    lista.scrollTop = lista.scrollHeight;
    campo.focus();
  });
}
