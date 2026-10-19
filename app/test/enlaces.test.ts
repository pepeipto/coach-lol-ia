// Enlaces de extremo a extremo entre la app, la web y el servidor (C2-3).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PREMIUM_HABILITADO } from '@coach/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { URL_WEB_POR_DEFECTO } from '../../server/src/config';
import { abrirDb, type Db } from '../../server/src/db';
import { crearServidor } from '../../server/src/http';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { RUTAS_WEB, URL_WEB } from '../src/main/web';
import { t } from '../src/shared/i18n';

const RAIZ = join(__dirname, '..', '..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');

describe('app ↔ web ↔ servidor', () => {
  let db: Db;
  let servidor: ReturnType<typeof crearServidor>;
  beforeAll(() => {
    db = abrirDb(':memory:');
    // El código de Premium se conserva (solo para cuando Riot apruebe la monetización): aquí se
    // enciende para comprobar que sus rutas siguen casando con las que llaman la web y la app.
    servidor = crearServidor(db, { premiumHabilitado: true });
  });
  afterAll(async () => {
    await servidor.close();
    db.cerrar();
  });

  it('el dominio de la web es el mismo en la app, el servidor (URL_WEB) y Astro (site, sin base)', () => {
    expect(URL_WEB).toBe('https://www.coachlolia.com');
    expect(URL_WEB_POR_DEFECTO).toBe(URL_WEB);
    const astro = leer('web/astro.config.mjs');
    expect(astro).toContain(`site: '${URL_WEB}'`);
    expect(astro).toMatch(/base: '\/'/);
    expect(leer('web/public/CNAME').trim()).toBe('www.coachlolia.com');
  });

  it('el interruptor de Premium vale lo mismo en shared (app y servidor) y en la web', () => {
    expect(leer('web/src/lib/producto.ts')).toContain(`export const PREMIUM_HABILITADO: boolean = ${PREMIUM_HABILITADO};`);
  });

  it('cada ruta que abre la app (abrirWeb) existe como página de la web', () => {
    const pagina = (ruta: string) => (ruta === '/' ? 'index' : ruta.slice(1));
    for (const ruta of RUTAS_WEB) {
      const base = join(RAIZ, 'web', 'src', 'pages', pagina(ruta));
      expect(existsSync(`${base}.astro`) || existsSync(join(base, 'index.astro')), ruta).toBe(true);
    }
  });

  it('cada ruta /api/… que llaman la web y la app existe en el servidor (no da 404)', async () => {
    const fuentes = [
      ...readdirSync(join(RAIZ, 'web', 'src', 'scripts')).map((f) => `web/src/scripts/${f}`),
      'app/src/main/licencia.ts',
      'app/src/main/asistente.ts',
    ];
    const rutas = new Set<string>();
    for (const f of fuentes) for (const m of leer(f).matchAll(/\/api\/[a-z]+(?:\/[a-z]+)*/g)) rutas.add(m[0]);
    expect([...rutas].sort()).toEqual([
      '/api/asistente',
      '/api/premium/checkout',
      '/api/premium/estado',
      '/api/premium/licencia',
      '/api/premium/portal',
      '/api/premium/prueba',
    ]);
    const metodo: Record<string, 'GET' | 'POST'> = {
      '/api/asistente': 'POST',
      '/api/premium/checkout': 'POST',
      '/api/premium/estado': 'GET',
      '/api/premium/licencia': 'GET',
      '/api/premium/portal': 'POST',
      '/api/premium/prueba': 'POST',
    };
    for (const ruta of rutas) {
      const url = ruta === '/api/premium/estado' ? '/api/premium/estado/CLIA-AAAA-AAAA-AAAA-AAAA' : ruta;
      const r = await servidor.inject({ method: metodo[ruta]!, url });
      // Sin Stripe ni Anthropic responden 503; estado de una clave desconocida, 404 con su error propio.
      if (ruta === '/api/premium/estado') expect(r.json()).toEqual({ error: 'licencia_desconocida' });
      else expect(r.statusCode, ruta).not.toBe(404);
      // CORS para la web en todas.
      expect(r.headers['access-control-allow-origin'], ruta).toBe(URL_WEB);
    }
  });

  it('las teclas del overlay que cuentan el README y la web son las que registra la app', () => {
    expect(AJUSTES_POR_DEFECTO.teclaOverlay).toBe('CommandOrControl+Shift+O');
    const readme = leer('README.md');
    expect(readme).toContain('`CommandOrControl+Shift+O`');
    expect(readme).toMatch(/vista Overlay.*«Mover y calibrar».*«Fijar aquí».*Esc/s);
    expect(readme).not.toMatch(/Alt\+C/);
    const web = leer('web/src/pages/index.astro');
    expect(web).toContain('Ctrl+Mayús+O');
    expect(web).toMatch(/«Mover y calibrar».*«Fijar aquí».*Esc/s);
    expect(t('overlay.config.mover')).toBe('Mover y calibrar');
    expect(web).not.toMatch(/Alt\+C/);
    // La tecla rápida sale del modo mover, pero no lo activa (eso se hace desde la vista Overlay).
    expect(t('vistaOverlay.posicionDesc', { tecla: 'X' })).not.toMatch(/activa/);
    expect(t('vistaOverlay.posicionDesc', { tecla: 'X' })).toMatch(/sale del modo mover/);
  });

  it('el correo de soporte se escribe igual en la app, la web y el servidor', () => {
    expect(t('soporte.correo')).toBe('support@coachlolia.com');
    expect(leer('web/src/lib/sitio.ts')).toContain("CORREO_SOPORTE = 'support@coachlolia.com'");
    expect(leer('server/src/asistente/conocimiento.ts')).toContain('support@coachlolia.com');
    for (const f of ['README.md', 'web/src/lib/sitio.ts', 'app/src/shared/i18n/es.json', 'server/src/asistente/conocimiento.ts']) expect(leer(f)).not.toMatch(/suport@coachlolia/);
  });
});
