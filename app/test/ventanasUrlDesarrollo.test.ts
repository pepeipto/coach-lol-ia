import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Seguridad (hallazgo 12): ELECTRON_RENDERER_URL solo se lee con la app sin empaquetar.
const estado = vi.hoisted(() => ({ isPackaged: false, cargas: [] as string[] }));

vi.mock('electron', () => {
  class BrowserWindow {
    webContents = { on: vi.fn(), setWindowOpenHandler: vi.fn(), getURL: () => '' };
    once = vi.fn();
    setAlwaysOnTop = vi.fn();
    setIgnoreMouseEvents = vi.fn();
    loadURL = vi.fn(async (url: string) => void estado.cargas.push(`url:${url}`));
    loadFile = vi.fn(async (ruta: string) => void estado.cargas.push(`archivo:${ruta.replace(/\\/g, '/')}`));
  }
  return {
    BrowserWindow,
    app: {
      get isPackaged() {
        return estado.isPackaged;
      },
      getPath: () => '.',
    },
    screen: { getPrimaryDisplay: () => ({ bounds: { x: 0, y: 0, width: 1920, height: 1080 } }) },
    Menu: {},
    nativeImage: {},
    Tray: class {},
  };
});
vi.mock('../src/main/log', () => ({ registrar: vi.fn() }));
vi.mock('../src/main/bandeja', () => ({ rutaRecurso: (n: string) => n }));

const { crearVentanaPrincipal } = await import('../src/main/ventanas/principal');
const { crearVentanaOverlay } = await import('../src/main/ventanas/overlay');

describe('ventanas: ELECTRON_RENDERER_URL', () => {
  beforeEach(() => {
    estado.cargas = [];
    process.env.ELECTRON_RENDERER_URL = 'http://localhost:5173';
  });
  afterEach(() => {
    delete process.env.ELECTRON_RENDERER_URL;
  });

  it('sin empaquetar (desarrollo) carga el servidor de electron-vite', () => {
    estado.isPackaged = false;
    crearVentanaPrincipal();
    crearVentanaOverlay({} as never);
    expect(estado.cargas).toEqual(['url:http://localhost:5173/principal/index.html', 'url:http://localhost:5173/overlay/index.html']);
  });

  it('en la app instalada se ignora y se cargan los archivos del paquete', () => {
    estado.isPackaged = true;
    crearVentanaPrincipal();
    crearVentanaOverlay({} as never);
    expect(estado.cargas).toHaveLength(2);
    expect(estado.cargas[0]).toMatch(/^archivo:.*renderer\/principal\/index\.html$/);
    expect(estado.cargas[1]).toMatch(/^archivo:.*renderer\/overlay\/index\.html$/);
  });
});
