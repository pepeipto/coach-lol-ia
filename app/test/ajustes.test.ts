import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AJUSTES_POR_DEFECTO, cargarAjustes, conservarPosicion, guardarAjustes, migrarAjustes, migrarIdioma, normalizarAjustes } from '../src/main/ajustes';
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
    it('por defecto: todos los widgets activos salvo la jungla y los avisos emergentes (3.0.1), sin posición, escala 1; voz apagada con todos los tipos', () => {
      const o = AJUSTES_POR_DEFECTO.overlay;
      expect(Object.keys(o.widgets).sort()).toEqual(['avisos', 'compra', 'cs', 'habilidad', 'jungla', 'objetivos']);
      for (const [id, w] of Object.entries(o.widgets)) {
        expect(w).toEqual({ activo: !['jungla', 'avisos', 'compra'].includes(id), x: null, y: null, escala: 1 });
      }
      expect(o.opacidad).toBeGreaterThanOrEqual(0.5);
      expect(o.opacidad).toBeLessThanOrEqual(1);
      expect(o.voz.activa).toBe(false);
      expect(o.voz.vozId).toBeNull();
      expect(Object.values(o.voz.tipos).every(Boolean)).toBe(true);
      expect(Object.keys(o.voz.tipos).sort()).toEqual(['compra', 'cs', 'fase', 'habilidad', 'jungla', 'junglaEnemiga', 'objetivo', 'vision']);
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

describe('jungla en el minimapa', () => {
  it('por defecto: presentación «minimapa», marco sin calibrar (null) y Alt+Shift+L para mostrar u ocultar', () => {
    expect(AJUSTES_POR_DEFECTO.overlay.jungla).toEqual({ presentacion: 'minimapa', minimapa: null });
    expect(AJUSTES_POR_DEFECTO.teclaJungla).toBe('Alt+Shift+L');
    expect(AJUSTES_POR_DEFECTO.overlay.widgets.jungla.activo).toBe(false);
  });

  it('migración: un ajustes.json sin la sección (2.1.0 o 3.0 sin minimapa) recibe los valores por defecto', () => {
    const a = normalizarAjustes({ overlay: { widgets: { jungla: { activo: true, x: 10, y: 20, escala: 1 } } }, teclasJungla: { azul: 'F5' } });
    expect(a.overlay.jungla).toEqual({ presentacion: 'minimapa', minimapa: null });
    expect(a.teclaJungla).toBe('Alt+Shift+L');
    expect(a.overlay.widgets.jungla).toMatchObject({ activo: true, x: 10, y: 20 });
  });

  it('el marco del minimapa se guarda en fracciones de la pantalla; los valores fuera de rango o raros se descartan', () => {
    const bien = normalizarAjustes({ overlay: { jungla: { presentacion: 'panel', minimapa: { x: 0.8, y: 0.75, lado: 0.24 } } }, teclaJungla: 'Ctrl+Alt+J' });
    expect(bien.overlay.jungla).toEqual({ presentacion: 'panel', minimapa: { x: 0.8, y: 0.75, lado: 0.24 } });
    expect(bien.teclaJungla).toBe('Ctrl+Alt+J');
    for (const minimapa of [{ x: 1.5, y: 0.5, lado: 0.2 }, { x: 0.5, y: 0.5, lado: 0 }, { x: 'a', y: 0.5, lado: 0.2 }, 3]) {
      expect(normalizarAjustes({ overlay: { jungla: { presentacion: 'otra', minimapa } } }).overlay.jungla).toEqual({ presentacion: 'minimapa', minimapa: null });
    }
    // Sin tecla (vacía) se queda sin atajo.
    expect(normalizarAjustes({ teclaJungla: '' }).teclaJungla).toBe('');
  });

  it('alternarJungla enciende o apaga el widget; guardarMinimapa y restablecer cambian solo el marco', async () => {
    const { alternarJungla, guardarMinimapa } = await import('../src/main/ajustes');
    const a = structuredClone(AJUSTES_POR_DEFECTO);
    const encendido = alternarJungla(a);
    expect(encendido.overlay.widgets.jungla.activo).toBe(true);
    expect(alternarJungla(encendido).overlay.widgets.jungla.activo).toBe(false);
    const conMarco = guardarMinimapa(a, { x: 0.81, y: 0.74, lado: 0.25 });
    expect(conMarco.overlay.jungla.minimapa).toEqual({ x: 0.81, y: 0.74, lado: 0.25 });
    expect(guardarMinimapa(conMarco, { x: 3, y: 0, lado: 0.2 }).overlay.jungla.minimapa).toEqual({ x: 0.81, y: 0.74, lado: 0.25 }); // inválido: no cambia
    expect(guardarMinimapa(conMarco, null).overlay.jungla.minimapa).toBeNull();
  });

  it('conservarPosicion conserva el marco del minimapa (lo guarda el modo mover)', () => {
    const guardados = normalizarAjustes({ overlay: { jungla: { presentacion: 'minimapa', minimapa: { x: 0.8, y: 0.7, lado: 0.25 } } } });
    const nuevos = normalizarAjustes({ overlay: { jungla: { presentacion: 'panel', minimapa: null } } });
    expect(conservarPosicion(nuevos, guardados).overlay.jungla).toEqual({ presentacion: 'panel', minimapa: { x: 0.8, y: 0.7, lado: 0.25 } });
  });
});

describe('jungla enemigo (Track F)', () => {
  it('por defecto: avisos por el registro de muertes encendidos y la ruta estimada apagada', () => {
    expect(AJUSTES_POR_DEFECTO.junglaEnemiga).toEqual({ avisos: true, ruta: false });
    expect(AJUSTES_POR_DEFECTO.overlay.voz.tipos.junglaEnemiga).toBe(true);
  });

  it('un ajustes.json sin la sección recibe los valores por defecto; los tipos incorrectos se ignoran', () => {
    expect(normalizarAjustes({}).junglaEnemiga).toEqual({ avisos: true, ruta: false });
    expect(normalizarAjustes({ junglaEnemiga: { avisos: false, ruta: true } }).junglaEnemiga).toEqual({ avisos: false, ruta: true });
    expect(normalizarAjustes({ junglaEnemiga: { avisos: 'no', ruta: 1 } }).junglaEnemiga).toEqual({ avisos: true, ruta: false });
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
    // 3.0.1: la posición se conserva, pero los avisos emergentes quedan apagados (la voz sigue).
    expect(a.overlay.widgets.avisos).toMatchObject({ activo: false, x: 1500, y: 120 });
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

describe('idioma (Fase 3)', () => {
  const dir = () => mkdtempSync(join(tmpdir(), 'coach-idioma-'));

  it('por defecto, español; con idioma del sistema, ese', () => {
    expect(AJUSTES_POR_DEFECTO.idioma).toBe('es');
    expect(normalizarAjustes(null).idioma).toBe('es');
    expect(normalizarAjustes(null, 'de').idioma).toBe('de');
  });

  it('respeta el idioma guardado y descarta uno que no existe', () => {
    expect(normalizarAjustes({ idioma: 'fr' }, 'en').idioma).toBe('fr');
    expect(normalizarAjustes({ idioma: 'it' }, 'en').idioma).toBe('en');
    expect(normalizarAjustes({ idioma: 'it' }).idioma).toBe('es');
  });

  it('migración: unos ajustes de la 2.x siguen en español si el sistema está en otro idioma (p. ej. italiano)', () => {
    const ruta = join(dir(), 'ajustes.json');
    writeFileSync(ruta, JSON.stringify({ importacionAutomatica: true }), 'utf8');
    expect(migrarIdioma(ruta, 'es').idioma).toBe('es');
    const guardado = JSON.parse(readFileSync(ruta, 'utf8')) as { idioma: string; importacionAutomatica: boolean };
    expect(guardado.idioma).toBe('es');
    expect(guardado.importacionAutomatica).toBe(true);
  });

  it('migración: con el sistema en inglés, se guarda inglés y luego ya no cambia aunque cambie el sistema', () => {
    const ruta = join(dir(), 'ajustes.json');
    writeFileSync(ruta, JSON.stringify({ voz: true }), 'utf8');
    expect(migrarIdioma(ruta, 'en').idioma).toBe('en');
    expect(migrarIdioma(ruta, 'de').idioma).toBe('en');
    expect(cargarAjustes(ruta, 'de').idioma).toBe('en');
  });

  it('migración: sin archivo (instalación nueva) no escribe nada y usa el idioma del sistema', () => {
    const ruta = join(dir(), 'ajustes.json');
    expect(migrarIdioma(ruta, 'pt-BR').idioma).toBe('pt-BR');
    expect(() => readFileSync(ruta, 'utf8')).toThrow();
  });
});

describe('3.0.1: avisos emergentes apagados por defecto', () => {
  const ajustes301 = (widgets: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    idioma: 'es',
    bienvenidaVista: true,
    overlay: { widgets, voz: { activa: true, volumen: 0.5, vozId: null, tipos: {} } },
    ...extra,
  });

  it('instalación nueva: los avisos de texto y la compra salen apagados; la flecha, encendida', () => {
    const w = AJUSTES_POR_DEFECTO.overlay.widgets;
    expect(w.avisos.activo).toBe(false);
    expect(w.compra.activo).toBe(false);
    expect(w.habilidad.activo).toBe(true);
    expect(AJUSTES_POR_DEFECTO.avisosEmergentesMigrados).toBe(true);
  });

  it('unos ajustes de la 3.0 con los avisos encendidos se apagan una vez al actualizar (la voz no cambia)', () => {
    const ruta = join(dir(), 'ajustes.json');
    writeFileSync(ruta, JSON.stringify(ajustes301({ avisos: { activo: true, x: 10, y: 20, escala: 1.2 }, compra: { activo: true } })), 'utf8');
    const a = migrarAjustes(ruta, 'es');
    expect(a.overlay.widgets.avisos).toEqual({ activo: false, x: 10, y: 20, escala: 1.2 });
    expect(a.overlay.widgets.compra.activo).toBe(false);
    expect(a.overlay.voz.activa).toBe(true);
    const guardado = JSON.parse(readFileSync(ruta, 'utf8')) as typeof a;
    expect(guardado.avisosEmergentesMigrados).toBe(true);
    expect(guardado.overlay.widgets.avisos.activo).toBe(false);
  });

  it('quien los vuelve a encender tras la migración los conserva encendidos', () => {
    const ruta = join(dir(), 'ajustes.json');
    writeFileSync(ruta, JSON.stringify(ajustes301({ avisos: { activo: true }, compra: { activo: true } })), 'utf8');
    const a = migrarAjustes(ruta, 'es');
    const encendidos = normalizarAjustes({
      ...a,
      overlay: { ...a.overlay, widgets: { ...a.overlay.widgets, avisos: { ...a.overlay.widgets.avisos, activo: true }, compra: { ...a.overlay.widgets.compra, activo: true } } },
    });
    guardarAjustes(ruta, encendidos);
    const otraVez = migrarAjustes(ruta, 'es');
    expect(otraVez.overlay.widgets.avisos.activo).toBe(true);
    expect(otraVez.overlay.widgets.compra.activo).toBe(true);
    expect(cargarAjustes(ruta).overlay.widgets.compra.activo).toBe(true);
  });

  it('unos ajustes de la 2.x (sin sección overlay) también quedan sin avisos emergentes', () => {
    const a = normalizarAjustes({ voz: true, posicionOverlay: { x: 5, y: 6 } });
    expect(a.overlay.widgets.avisos.activo).toBe(false);
    expect(a.overlay.widgets.compra.activo).toBe(false);
    expect(a.overlay.voz.activa).toBe(true);
    expect(a.avisosEmergentesMigrados).toBe(true);
  });

  it('migrarIdioma sigue existiendo (mismo comportamiento que migrarAjustes)', () => {
    expect(migrarIdioma).toBe(migrarAjustes);
  });
});
