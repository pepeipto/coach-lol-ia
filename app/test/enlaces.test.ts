// Enlaces de extremo a extremo entre la app, la web y el servidor (C2-3).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PREMIUM_HABILITADO } from '@coach/shared';
import { describe, expect, it } from 'vitest';
import { AJUSTES_POR_DEFECTO } from '../src/main/ajustes';
import { RUTAS_WEB, URL_WEB } from '../src/main/web';
import { t } from '../src/shared/i18n';

const RAIZ = join(__dirname, '..', '..');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');

describe('app ↔ web ↔ servidor', () => {
  // El servidor está en el repo privado coach-lol-ia-servidor: allí se comprueba que existen sus rutas.
  it('el dominio de la web es el mismo en la app y Astro (site, sin base)', () => {
    expect(URL_WEB).toBe('https://www.coachlolia.com');
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
      // Las de Premium se inyectan desde web/src/premium/ (astro.config.mjs) cuando el interruptor está encendido.
      const premium = ruta.startsWith('/premium')
        ? leer('web/astro.config.mjs').includes(`pattern: '${ruta}'`) && PREMIUM_HABILITADO
        : false;
      expect(existsSync(`${base}.astro`) || existsSync(join(base, 'index.astro')) || premium, ruta).toBe(true);
    }
  });

  it('las rutas /api/… que llaman la web y la app son las que ofrece el servidor', () => {
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
      '/api/premium/paquete',
      '/api/premium/portal',
      '/api/premium/prueba',
    ]);
  });

  it('las teclas del overlay que cuentan el README y la web son las que registra la app', () => {
    expect(AJUSTES_POR_DEFECTO.teclaOverlay).toBe('CommandOrControl+Shift+O');
    const readme = leer('README.md');
    expect(readme).toContain('`CommandOrControl+Shift+O`');
    expect(readme).toMatch(/vista Overlay.*«Mover y calibrar».*«Fijar aquí».*Esc/s);
    expect(readme).not.toMatch(/Alt\+C/);
    // 3.1: la portada multilingüe tiene sus textos en web/src/i18n/textos/ (es.ts, el español).
    const web = leer('web/src/i18n/textos/es.ts');
    expect(web).toContain('Ctrl+Mayús+O');
    expect(web).toMatch(/«Mover y calibrar».*«Fijar aquí».*Esc/s);
    expect(t('overlay.config.mover')).toBe('Mover y calibrar');
    expect(web).not.toMatch(/Alt\+C/);
    // La tecla rápida sale del modo mover, pero no lo activa (eso se hace desde la vista Overlay).
    expect(t('vistaOverlay.posicionDesc', { tecla: 'X' })).not.toMatch(/activa/);
    expect(t('vistaOverlay.posicionDesc', { tecla: 'X' })).toMatch(/sale del modo mover/);
  });

  it('el correo de soporte se escribe igual en la app y la web', () => {
    expect(t('soporte.correo')).toBe('support@coachlolia.com');
    expect(leer('web/src/lib/sitio.ts')).toContain("CORREO_SOPORTE = 'support@coachlolia.com'");
    for (const f of ['README.md', 'web/src/lib/sitio.ts', 'app/src/shared/i18n/es.json']) expect(leer(f)).not.toMatch(/suport@coachlolia/);
  });
});
