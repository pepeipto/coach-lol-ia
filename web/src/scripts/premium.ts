// Lógica de cliente de las páginas de Premium (contrato con el servidor, ver plan v2, Task B2):
//   POST {API}/api/premium/checkout            → { url }
//   GET  {API}/api/premium/licencia?session_id → { clave, estado } | 404 { error: 'pendiente' }
//   POST {API}/api/premium/portal { clave }    → { url } | 404 { error: 'licencia_desconocida' }
//                                                 | 400 { error: 'licencia_vitalicia' | 'licencia_prueba' }
//   POST {API}/api/premium/prueba (sin cuerpo)  → { clave, caducaEn } | 429 { error: 'prueba_ya_solicitada' }
//   503 { error: 'premium_no_configurado' }    → «Las suscripciones aún no están disponibles»
//
// Las funciones puras reciben `fetch` inyectado para poder probarlas con node:test.
// Solo se usa sintaxis de TypeScript borrable (Node 24 la ejecuta sin compilar).

export const CORREO_SOPORTE = 'suport@coachlolia.com';

export const MENSAJES = {
  noDisponible: 'Las suscripciones aún no están disponibles',
  sinConexion: 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo en unos minutos.',
  inesperado: `Algo ha fallado. Inténtalo de nuevo y, si se repite, escríbenos a ${CORREO_SOPORTE}.`,
  demasiadas: 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.',
  tiempoAgotado:
    'El pago aún se está confirmando. Recarga esta página en unos minutos: tu licencia aparecerá aquí.',
  sinSesion:
    'Falta el identificador de la compra. Vuelve a esta página desde el enlace al que te lleva Stripe después de pagar.',
  licenciaDesconocida: 'No encontramos esa licencia. Revisa que la hayas copiado completa.',
  claveInvalida: 'La clave debe tener el formato CLIA-XXXX-XXXX-XXXX-XXXX.',
  pruebaYaSolicitada: 'Ya pediste una prueba desde esta conexión en los últimos 30 días.',
  licenciaVitalicia: 'Esa licencia es vitalicia: no tiene suscripción que gestionar.',
  licenciaPrueba: 'Esa clave es de prueba: no tiene suscripción que gestionar. Puedes suscribirte en la página de Premium.',
} as const;

export const ESTADOS: Record<string, string> = {
  activa: 'Activa',
  cancelada: 'Cancelada',
  impagada: 'Pago pendiente',
};

type Respuesta = { ok: boolean; status: number; json(): Promise<unknown> };
export type Fetch = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<Respuesta>;
export type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string; pendiente?: boolean };

const INTERVALO_MS = 2000;
const LIMITE_MS = 30000;
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PATRON_CLAVE = new RegExp(`^CLIA(-[${ALFABETO}]{4}){4}$`);

function base(api: string): string {
  return api.replace(/\/+$/, '');
}

async function leerJson(r: Respuesta): Promise<Record<string, unknown>> {
  try {
    const datos = await r.json();
    return datos && typeof datos === 'object' ? (datos as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Solo se redirige a URLs https (Stripe Checkout y Customer Portal). */
export function urlSegura(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function errorDe(status: number, cuerpo: Record<string, unknown>): string {
  if (status === 503 || cuerpo.error === 'premium_no_configurado') return MENSAJES.noDisponible;
  if (status === 429) return MENSAJES.demasiadas;
  if (cuerpo.error === 'licencia_desconocida') return MENSAJES.licenciaDesconocida;
  if (cuerpo.error === 'licencia_vitalicia') return MENSAJES.licenciaVitalicia;
  if (cuerpo.error === 'licencia_prueba') return MENSAJES.licenciaPrueba;
  return MENSAJES.inesperado;
}

export function normalizarClave(texto: string): string {
  return texto.trim().toUpperCase().replace(/\s+/g, '');
}

export function claveValida(clave: string): boolean {
  return PATRON_CLAVE.test(clave);
}

/** Pide al servidor una sesión de Stripe Checkout. */
export async function crearCheckout(api: string, fetch: Fetch): Promise<Resultado<{ url: string }>> {
  let r: Respuesta;
  try {
    // Sin cuerpo ni cabeceras: es una petición CORS «simple» y no necesita preflight.
    r = await fetch(`${base(api)}/api/premium/checkout`, { method: 'POST' });
  } catch {
    return { ok: false, error: MENSAJES.sinConexion };
  }
  const cuerpo = await leerJson(r);
  if (r.ok && urlSegura(cuerpo.url)) return { ok: true, url: cuerpo.url };
  return { ok: false, error: r.ok ? MENSAJES.inesperado : errorDe(r.status, cuerpo) };
}

/**
 * Consulta la licencia de una sesión de Checkout. Mientras el servidor responda
 * 404 `pendiente` (o falle la red), reintenta cada 2 s durante 30 s como máximo.
 */
export async function esperarLicencia(
  api: string,
  sessionId: string,
  opciones: { fetch: Fetch; esperar?: (ms: number) => Promise<unknown>; ahora?: () => number },
): Promise<Resultado<{ clave: string; estado: string }>> {
  if (!sessionId) return { ok: false, error: MENSAJES.sinSesion };
  const esperar = opciones.esperar ?? ((ms: number) => new Promise((resolver) => setTimeout(resolver, ms)));
  const ahora = opciones.ahora ?? (() => Date.now());
  const url = `${base(api)}/api/premium/licencia?session_id=${encodeURIComponent(sessionId)}`;
  const inicio = ahora();
  let ultimoFueRed = false;

  for (;;) {
    try {
      const r = await opciones.fetch(url);
      const cuerpo = await leerJson(r);
      if (r.ok && typeof cuerpo.clave === 'string') {
        return { ok: true, clave: cuerpo.clave, estado: typeof cuerpo.estado === 'string' ? cuerpo.estado : 'activa' };
      }
      if (!(r.status === 404 && cuerpo.error === 'pendiente')) {
        return { ok: false, error: r.ok ? MENSAJES.inesperado : errorDe(r.status, cuerpo) };
      }
      ultimoFueRed = false;
    } catch {
      ultimoFueRed = true;
    }
    if (ahora() - inicio + INTERVALO_MS > LIMITE_MS) {
      return ultimoFueRed
        ? { ok: false, error: MENSAJES.sinConexion, pendiente: true }
        : { ok: false, error: MENSAJES.tiempoAgotado, pendiente: true };
    }
    await esperar(INTERVALO_MS);
  }
}

/** Pide la URL del Customer Portal de Stripe para una licencia. */
export async function abrirPortal(api: string, clave: string, fetch: Fetch): Promise<Resultado<{ url: string }>> {
  let r: Respuesta;
  try {
    r = await fetch(`${base(api)}/api/premium/portal`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clave }),
    });
  } catch {
    return { ok: false, error: MENSAJES.sinConexion };
  }
  const cuerpo = await leerJson(r);
  if (r.ok && urlSegura(cuerpo.url)) return { ok: true, url: cuerpo.url };
  return { ok: false, error: r.ok ? MENSAJES.inesperado : errorDe(r.status, cuerpo) };
}

/** Pide una prueba gratuita de 24 h (una por conexión cada 30 días). */
export async function pedirPrueba(api: string, fetch: Fetch): Promise<Resultado<{ clave: string; caducaEn: string }>> {
  let r: Respuesta;
  try {
    // Sin cuerpo ni cabeceras: petición CORS «simple», sin preflight.
    r = await fetch(`${base(api)}/api/premium/prueba`, { method: 'POST' });
  } catch {
    return { ok: false, error: MENSAJES.sinConexion };
  }
  const cuerpo = await leerJson(r);
  if (r.ok && typeof cuerpo.clave === 'string' && claveValida(cuerpo.clave) && typeof cuerpo.caducaEn === 'string') {
    return { ok: true, clave: cuerpo.clave, caducaEn: cuerpo.caducaEn };
  }
  if (r.status === 429 && cuerpo.error === 'prueba_ya_solicitada') return { ok: false, error: MENSAJES.pruebaYaSolicitada };
  if (r.status === 429) return { ok: false, error: MENSAJES.demasiadas };
  return { ok: false, error: MENSAJES.inesperado };
}

/** «20 de octubre de 2026, 14:00» en la hora local del navegador. */
export function fechaLocal(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' });
}

// ---------------------------------------------------------------------------
// Conexión con el DOM (solo en el navegador).

function apiDeLaPagina(): string {
  const el = document.querySelector<HTMLElement>('[data-api]');
  return el?.dataset.api || 'http://localhost:8080';
}

const fetchNavegador: Fetch = (url, init) => window.fetch(url, init);

function mostrar(el: HTMLElement | null, texto: string, tipo: 'error' | 'info' = 'error'): void {
  if (!el) return;
  el.textContent = texto;
  el.dataset.tipo = tipo;
  el.hidden = false;
}

/** /premium: botón «Suscribirme». */
export function iniciarSuscribir(): void {
  const boton = document.getElementById('suscribirme') as HTMLButtonElement | null;
  const estado = document.getElementById('estado-checkout');
  if (!boton) return;
  const textoOriginal = boton.textContent ?? '';
  boton.addEventListener('click', async () => {
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
    boton.textContent = 'Conectando con Stripe…';
    if (estado) estado.hidden = true;
    const r = await crearCheckout(apiDeLaPagina(), fetchNavegador);
    if (r.ok) {
      window.location.assign(r.url);
      return;
    }
    mostrar(estado, r.error);
    boton.disabled = false;
    boton.removeAttribute('aria-busy');
    boton.textContent = textoOriginal;
  });
}

async function copiar(texto: string, campo: HTMLElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const seleccion = window.getSelection();
    const rango = document.createRange();
    rango.selectNodeContents(campo);
    seleccion?.removeAllRanges();
    seleccion?.addRange(rango);
    return false;
  }
}

/** /premium: bloque «Probar Premium 24 h gratis». */
export function iniciarPrueba(): void {
  const boton = document.getElementById('pedir-prueba') as HTMLButtonElement | null;
  const estado = document.getElementById('estado-prueba');
  const resultado = document.getElementById('prueba-resultado');
  const campoClave = document.getElementById('prueba-clave');
  const campoCaduca = document.getElementById('prueba-caduca');
  const botonCopiar = document.getElementById('prueba-copiar') as HTMLButtonElement | null;
  const avisoCopia = document.getElementById('prueba-copiada');
  if (!boton) return;
  const textoOriginal = boton.textContent ?? '';
  boton.addEventListener('click', async () => {
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
    boton.textContent = 'Generando tu clave…';
    if (estado) estado.hidden = true;
    const r = await pedirPrueba(apiDeLaPagina(), fetchNavegador);
    boton.removeAttribute('aria-busy');
    if (r.ok) {
      if (campoClave) campoClave.textContent = r.clave;
      if (campoCaduca) campoCaduca.textContent = fechaLocal(r.caducaEn);
      if (resultado) resultado.hidden = false;
      boton.hidden = true;
      return;
    }
    mostrar(estado, r.error);
    boton.disabled = false;
    boton.textContent = textoOriginal;
  });
  botonCopiar?.addEventListener('click', async () => {
    const clave = campoClave?.textContent ?? '';
    if (!clave || !campoClave) return;
    const ok = await copiar(clave, campoClave);
    mostrar(avisoCopia, ok ? '¡Copiada! Pégala en la app: Premium → Clave de licencia.' : 'Clave seleccionada: pulsa Ctrl+C para copiarla.', 'info');
  });
}

/** /premium/gracias: muestra la licencia de la compra. */
export function iniciarGracias(): void {
  const cargando = document.getElementById('licencia-cargando');
  const resultado = document.getElementById('licencia-resultado');
  const error = document.getElementById('licencia-error');
  const errorTexto = document.getElementById('licencia-error-texto');
  const reintentar = document.getElementById('licencia-reintentar');
  const campoClave = document.getElementById('licencia-clave');
  const campoEstado = document.getElementById('licencia-estado');
  const botonCopiar = document.getElementById('licencia-copiar') as HTMLButtonElement | null;
  const avisoCopia = document.getElementById('licencia-copiada');
  const sessionId = new URLSearchParams(window.location.search).get('session_id') ?? '';

  async function consultar(): Promise<void> {
    if (cargando) cargando.hidden = false;
    if (error) error.hidden = true;
    const r = await esperarLicencia(apiDeLaPagina(), sessionId, { fetch: fetchNavegador });
    if (cargando) cargando.hidden = true;
    if (r.ok) {
      if (campoClave) campoClave.textContent = r.clave;
      if (campoEstado) campoEstado.textContent = ESTADOS[r.estado] ?? r.estado;
      if (resultado) resultado.hidden = false;
      return;
    }
    if (errorTexto) errorTexto.textContent = r.error;
    if (reintentar) reintentar.hidden = !r.pendiente;
    if (error) error.hidden = false;
  }

  reintentar?.addEventListener('click', () => void consultar());
  botonCopiar?.addEventListener('click', async () => {
    const clave = campoClave?.textContent ?? '';
    if (!clave || !campoClave) return;
    const ok = await copiar(clave, campoClave);
    mostrar(avisoCopia, ok ? '¡Copiada! Pégala en la app, en Ajustes → Licencia.' : 'Clave seleccionada: pulsa Ctrl+C para copiarla.', 'info');
    if (ok) {
      botonCopiar.textContent = 'Copiada';
      setTimeout(() => (botonCopiar.textContent = 'Copiar licencia'), 2500);
    }
  });
  void consultar();
}

/** /premium/gestionar: formulario de clave → Customer Portal. */
export function iniciarGestionar(): void {
  const form = document.getElementById('form-portal') as HTMLFormElement | null;
  const campo = document.getElementById('clave') as HTMLInputElement | null;
  const boton = form?.querySelector<HTMLButtonElement>('button[type="submit"]') ?? null;
  const estado = document.getElementById('estado-portal');
  if (!form || !campo || !boton) return;
  const textoOriginal = boton.textContent ?? '';

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const clave = normalizarClave(campo.value);
    campo.value = clave;
    if (!claveValida(clave)) {
      campo.setAttribute('aria-invalid', 'true');
      mostrar(estado, MENSAJES.claveInvalida);
      campo.focus();
      return;
    }
    campo.removeAttribute('aria-invalid');
    if (estado) estado.hidden = true;
    boton.disabled = true;
    boton.textContent = 'Abriendo el portal…';
    const r = await abrirPortal(apiDeLaPagina(), clave, fetchNavegador);
    if (r.ok) {
      window.location.assign(r.url);
      return;
    }
    mostrar(estado, r.error);
    boton.disabled = false;
    boton.textContent = textoOriginal;
  });
}
