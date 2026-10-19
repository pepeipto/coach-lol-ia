import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AJUSTES_POR_DEFECTO, cargarAjustes, conservarPosicion, guardarAjustes, normalizarAjustes } from '../src/main/ajustes';
import { queMostrar, VERSION_ACTUAL } from '../src/shared/novedades';

const dir = () => mkdtempSync(join(tmpdir(), 'coach-ajustes-'));

describe('ajustes', () => {
  it('valores por defecto', () => {
    expect(AJUSTES_POR_DEFECTO.avisos).toEqual({ compra: true, habilidad: true, objetivo: true, vision: true, fase: true });
    expect(AJUSTES_POR_DEFECTO.voz).toBe(false);
    expect(AJUSTES_POR_DEFECTO.importacionAutomatica).toBe(false);
    expect(AJUSTES_POR_DEFECTO.teclaOverlay).toBe('CommandOrControl+Shift+O');
    expect(AJUSTES_POR_DEFECTO.posicionOverlay).toBeNull();
  });
  it('archivo ausente → por defecto', () => {
    expect(cargarAjustes(join(dir(), 'no.json'))).toEqual(AJUSTES_POR_DEFECTO);
  });
  it('JSON roto → por defecto', () => {
    const r = join(dir(), 'a.json');
    writeFileSync(r, '{ roto');
    expect(cargarAjustes(r)).toEqual(AJUSTES_POR_DEFECTO);
  });
  it('JSON parcial → mezcla con los defectos', () => {
    const r = join(dir(), 'a.json');
    writeFileSync(r, JSON.stringify({ voz: true, avisos: { compra: false } }));
    expect(cargarAjustes(r)).toEqual({
      ...AJUSTES_POR_DEFECTO,
      bienvenidaVista: true, // archivo antiguo sin el campo: usuario veterano
      voz: true,
      avisos: { ...AJUSTES_POR_DEFECTO.avisos, compra: false },
      // Migración a la 3.0: la voz antigua pasa a overlay.voz.activa.
      overlay: { ...AJUSTES_POR_DEFECTO.overlay, voz: { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true } },
    });
  });
  it('guardar y cargar', () => {
    const r = join(dir(), 'sub', 'a.json');
    const a = { ...AJUSTES_POR_DEFECTO, importacionAutomatica: true, posicionOverlay: { x: 3, y: 4 } };
    guardarAjustes(r, a);
    expect(JSON.parse(readFileSync(r, 'utf8'))).toEqual(a);
    expect(cargarAjustes(r)).toEqual(a);
  });

  it('la URL del servidor ya no es un ajuste: un ajustes.json antiguo con urlServidor se ignora', () => {
    const r = join(dir(), 'a.json');
    writeFileSync(r, JSON.stringify({ urlServidor: 'http://localhost:8080', voz: true }));
    const a = cargarAjustes(r);
    expect(a).not.toHaveProperty('urlServidor');
    expect(a.voz).toBe(true);
    expect(AJUSTES_POR_DEFECTO).not.toHaveProperty('urlServidor');
  });

  it('conservarPosicion ignora la posición de los ajustes que llegan de la ventana', () => {
    const guardados = { ...AJUSTES_POR_DEFECTO, posicionOverlay: { x: 300, y: 40 } };
    const obsoletos = { ...AJUSTES_POR_DEFECTO, voz: true, posicionOverlay: null };
    expect(conservarPosicion(obsoletos, guardados)).toEqual({ ...obsoletos, posicionOverlay: { x: 300, y: 40 } });
  });

  describe('overlay modular (3.0)', () => {
    it('por defecto: todos los widgets activos salvo la jungla, sin posición, escala 1; voz apagada con todos los tipos', () => {
      const o = AJUSTES_POR_DEFECTO.overlay;
      expect(Object.keys(o.widgets).sort()).toEqual(['avisos', 'compra', 'cs', 'habilidad', 'jungla', 'objetivos']);
      for (const [id, w] of Object.entries(o.widgets)) {
        expect(w).toEqual({ activo: id !== 'jungla', x: null, y: null, escala: 1 });
      }
      expect(o.opacidad).toBeGreaterThanOrEqual(0.5);
      expect(o.opacidad).toBeLessThanOrEqual(1);
      expect(o.voz.activa).toBe(false);
      expect(o.voz.vozId).toBeNull();
      expect(Object.values(o.voz.tipos).every(Boolean)).toBe(true);
      expect(Object.keys(o.voz.tipos).sort()).toEqual(['compra', 'cs', 'fase', 'habilidad', 'jungla', 'objetivo', 'vision']);
      expect(AJUSTES_POR_DEFECTO.teclasJungla).toEqual({});
    });

    it('acota escala (0.75–1.5), opacidad (0.5–1) y volumen (0–1); valores no válidos vuelven al defecto', () => {
      const a = normalizarAjustes({
        overlay: {
          widgets: { cs: { activo: false, x: 10.4, y: 'x', escala: 3 }, habilidad: { escala: 0.1 }, objetivos: 'roto' },
          opacidad: 0.1,
          voz: { activa: true, volumen: 7, vozId: 'Microsoft Sabina', tipos: { cs: false, jungla: 'si' } },
        },
      });
      expect(a.overlay.widgets.cs).toEqual({ activo: false, x: 10, y: null, escala: 1.5 });
      expect(a.overlay.widgets.habilidad.escala).toBe(0.75);
      expect(a.overlay.widgets.objetivos).toEqual(AJUSTES_POR_DEFECTO.overlay.widgets.objetivos);
      expect(a.overlay.opacidad).toBe(0.5);
      expect(a.overlay.voz).toMatchObject({ activa: true, volumen: 1, vozId: 'Microsoft Sabina' });
      expect(a.overlay.voz.tipos.cs).toBe(false);
      expect(a.overlay.voz.tipos.jungla).toBe(true);
      // `voz` refleja siempre overlay.voz.activa.
      expect(a.voz).toBe(true);
    });

    it('migra un ajustes.json de la 2.x: la posición del panel pasa a los avisos y la voz se conserva', () => {
      const a = normalizarAjustes({ voz: true, posicionOverlay: { x: 300, y: 40 } });
      expect(a.overlay.widgets.avisos).toMatchObject({ x: 300, y: 40 });
      expect(a.overlay.voz.activa).toBe(true);
      // Con la sección overlay ya presente, manda overlay.voz.activa.
      const b = normalizarAjustes({ voz: true, overlay: { voz: { activa: false } } });
      expect(b.overlay.voz.activa).toBe(false);
      expect(b.voz).toBe(false);
    });

    it('teclas de la jungla: solo campamentos conocidos con una tecla no vacía', () => {
      const a = normalizarAjustes({ teclasJungla: { azul: 'F5', rojo: '', enemigoAzul: 'F6', gromp: 3 } });
      expect(a.teclasJungla).toEqual({ azul: 'F5' });
    });

    it('conservarPosicion conserva las posiciones de los widgets (las guarda el modo mover) y acepta el resto', () => {
      const guardados = normalizarAjustes({ overlay: { widgets: { cs: { activo: true, x: 50, y: 60, escala: 1 } } } });
      const nuevos = normalizarAjustes({ overlay: { widgets: { cs: { activo: false, x: null, y: null, escala: 1.2 } } } });
      const r = conservarPosicion(nuevos, guardados);
      expect(r.overlay.widgets.cs).toEqual({ activo: false, x: 50, y: 60, escala: 1.2 });
    });
  });
});

describe('ajustes.json de la 2.1.0 (integración 3.0)', () => {
  // Así guardaba la 2.1.0 sus ajustes: sin `overlay`, `teclasJungla`, `bienvenidaVista` ni `ultimaVersionVista`.
  const AJUSTES_210 = {
    avisos: { compra: true, habilidad: false, objetivo: true, vision: true, fase: true },
    voz: true,
    importacionAutomatica: true,
    teclaOverlay: 'Alt+C',
    posicionOverlay: { x: 1500, y: 120 },
  };

  it('recibe las dos migraciones: la del overlay (Track A) y la de la bienvenida (Track C)', () => {
    const r = join(dir(), 'ajustes.json');
    writeFileSync(r, JSON.stringify(AJUSTES_210, null, 2));
    const a = cargarAjustes(r);
    // Track C: usuario veterano, sin bienvenida; verá las novedades de la 3.0 una vez.
    expect(a.bienvenidaVista).toBe(true);
    expect(a.ultimaVersionVista).toBeNull();
    expect(queMostrar(a)).toBe('novedades');
    // Track A: la voz antigua pasa a overlay.voz.activa y la posición del panel al widget de avisos.
    expect(a.overlay.voz.activa).toBe(true);
    expect(a.voz).toBe(true);
    expect(a.overlay.widgets.avisos).toMatchObject({ activo: true, x: 1500, y: 120 });
    expect(a.overlay.widgets.jungla.activo).toBe(false);
    expect(a.teclasJungla).toEqual({});
    // Lo demás se conserva.
    expect(a.avisos.habilidad).toBe(false);
    expect(a.teclaOverlay).toBe('Alt+C');
    expect(a.importacionAutomatica).toBe(true);
  });

  it('tras guardar y volver a cargar, las dos migraciones se mantienen', () => {
    const r = join(dir(), 'ajustes.json');
    writeFileSync(r, JSON.stringify(AJUSTES_210));
    guardarAjustes(r, { ...cargarAjustes(r), ultimaVersionVista: VERSION_ACTUAL });
    const a = cargarAjustes(r);
    expect(a.bienvenidaVista).toBe(true);
    expect(a.ultimaVersionVista).toBe(VERSION_ACTUAL);
    expect(queMostrar(a)).toBe('nada');
    expect(a.overlay.voz.activa).toBe(true);
    expect(a.overlay.widgets.avisos).toMatchObject({ x: 1500, y: 120 });
  });
});
