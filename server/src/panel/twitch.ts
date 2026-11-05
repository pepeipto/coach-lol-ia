/*
 * Canal de Twitch en el panel: si está en directo, título, juego, espectadores, los clips más vistos de los últimos
 * 30 días y los últimos directos guardados. Usa la API Helix con un token de aplicación (TWITCH_CLIENT_ID y
 * TWITCH_CLIENT_SECRET, de una aplicación creada en dev.twitch.tv): no necesita iniciar sesión con la cuenta del
 * canal ni puede cambiar nada en él. Los seguidores piden un token del propio canal, así que no salen aquí.
 */

const DIA_MS = 86_400_000;
/** Lo que se pide a Twitch se guarda 2 minutos: recargar el panel no gasta peticiones. */
export const CACHE_TWITCH_MS = 2 * 60_000;
const TIEMPO_MS = 5000;

export interface ClipTwitch {
  id: string;
  url: string;
  titulo: string;
  vistas: number;
  /** ISO. */
  creado: string;
  segundos: number;
  miniatura: string;
}

export interface VideoTwitch {
  url: string;
  titulo: string;
  vistas: number;
  creado: string;
  /** «3h2m10s», tal como lo da Twitch. */
  duracion: string;
}

export interface EstadoTwitch {
  canal: string;
  nombre: string;
  enDirecto: boolean;
  titulo: string;
  juego: string;
  espectadores: number;
  /** ISO de cuando empezó el directo; null si no está en directo. */
  desde: string | null;
  clips: ClipTwitch[];
  videos: VideoTwitch[];
  /** ISO de la consulta. */
  consultado: string;
}

export type PanelTwitch =
  | { estado: 'sin_configurar'; canal: string }
  | { estado: 'error'; canal: string; mensaje: string }
  | ({ estado: 'ok' } & EstadoTwitch);

export interface OpcionesTwitch {
  clientId: string;
  secreto: string;
  /** Nombre de usuario del canal (el de la dirección twitch.tv/<canal>). */
  canal: string;
  fetch?: typeof fetch;
  ahora?: () => number;
}

export function crearTwitch(o: OpcionesTwitch | null, canal: string): { consultar(): Promise<PanelTwitch> } {
  if (!o) return { consultar: async () => ({ estado: 'sin_configurar', canal }) };
  const f = o.fetch ?? fetch;
  const ahora = o.ahora ?? Date.now;
  let token: { valor: string; caduca: number } | null = null;
  let idCanal: { id: string; nombre: string } | null = null;
  let cache: { t: number; r: PanelTwitch } | null = null;

  const pedirToken = async () => {
    if (token && token.caduca > ahora() + 60_000) return token.valor;
    const cuerpo = new URLSearchParams({ client_id: o.clientId, client_secret: o.secreto, grant_type: 'client_credentials' });
    const r = await f('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: cuerpo.toString(),
      signal: AbortSignal.timeout(TIEMPO_MS),
    });
    if (!r.ok) throw new Error(r.status === 400 || r.status === 403 ? 'Twitch no acepta TWITCH_CLIENT_ID o TWITCH_CLIENT_SECRET.' : `Twitch respondió ${r.status} al pedir el token.`);
    const j = (await r.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) throw new Error('Twitch no devolvió un token.');
    token = { valor: j.access_token, caduca: ahora() + (j.expires_in ?? 3600) * 1000 };
    return token.valor;
  };

  const helix = async <T>(ruta: string, reintento = true): Promise<T[]> => {
    const r = await f(`https://api.twitch.tv/helix/${ruta}`, {
      headers: { 'client-id': o.clientId, authorization: `Bearer ${await pedirToken()}` },
      signal: AbortSignal.timeout(TIEMPO_MS),
    });
    if (r.status === 401 && reintento) {
      token = null;
      return helix<T>(ruta, false);
    }
    if (!r.ok) throw new Error(`Twitch respondió ${r.status} a /${ruta.split('?')[0]}.`);
    return ((await r.json()) as { data?: T[] }).data ?? [];
  };

  const consultarAhora = async (): Promise<PanelTwitch> => {
    if (!idCanal) {
      const [u] = await helix<{ id: string; display_name: string }>(`users?login=${encodeURIComponent(o.canal)}`);
      if (!u) return { estado: 'error', canal: o.canal, mensaje: `Twitch no encuentra el canal «${o.canal}».` };
      idCanal = { id: u.id, nombre: u.display_name };
    }
    const id = encodeURIComponent(idCanal.id);
    const desde = new Date(ahora() - 30 * DIA_MS).toISOString();
    const [directos, canales, clips, videos] = await Promise.all([
      helix<{ title: string; game_name: string; viewer_count: number; started_at: string }>(`streams?user_id=${id}`),
      helix<{ title: string; game_name: string }>(`channels?broadcaster_id=${id}`),
      helix<{ id: string; url: string; title: string; view_count: number; created_at: string; duration: number; thumbnail_url: string }>(
        `clips?broadcaster_id=${id}&started_at=${encodeURIComponent(desde)}&first=12`,
      ),
      helix<{ url: string; title: string; view_count: number; created_at: string; duration: string }>(`videos?user_id=${id}&type=archive&first=5`),
    ]);
    const directo = directos[0];
    const canal = canales[0];
    return {
      estado: 'ok',
      canal: o.canal,
      nombre: idCanal.nombre,
      enDirecto: !!directo,
      titulo: directo?.title ?? canal?.title ?? '',
      juego: directo?.game_name ?? canal?.game_name ?? '',
      espectadores: directo?.viewer_count ?? 0,
      desde: directo?.started_at ?? null,
      clips: clips
        .map((c) => ({ id: c.id, url: c.url, titulo: c.title, vistas: c.view_count, creado: c.created_at, segundos: Math.round(c.duration), miniatura: c.thumbnail_url }))
        .sort((a, b) => b.vistas - a.vistas),
      videos: videos.map((v) => ({ url: v.url, titulo: v.title, vistas: v.view_count, creado: v.created_at, duracion: v.duration })),
      consultado: new Date(ahora()).toISOString(),
    };
  };

  return {
    async consultar() {
      const t = ahora();
      if (cache && t - cache.t < CACHE_TWITCH_MS) return cache.r;
      let r: PanelTwitch;
      try {
        r = await consultarAhora();
      } catch (e) {
        r = { estado: 'error', canal: o.canal, mensaje: e instanceof Error && e.name !== 'TimeoutError' ? e.message : 'Twitch no respondió a tiempo.' };
      }
      cache = { t, r };
      return r;
    },
  };
}
