import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import { AJUSTES_POR_DEFECTO, normalizarAjustes } from '../src/main/ajustes';
import type { FetchMinimo } from '../src/main/voz/descarga';
import { registrarIpcVoz, textoValido } from '../src/main/voz/ipcVoz';
import { ARCHIVOS_REQUERIDOS, crearMotorVoz, MAX_FALLOS, type ProcesoVoz } from '../src/main/voz/motorVoz';
import type { MensajeAlProceso, MensajeDelProceso } from '../src/main/voz/protocolo';
import { escribirTar } from '../src/main/voz/tar';
import type { Ajustes, MotorVoz } from '../src/shared/tiposApp';

const tmp = () => mkdtempSync(join(tmpdir(), 'coach-motor-'));
const esperar = () => new Promise((r) => setTimeout(r, 0));

function instalar(dir: string, id: string, sha: string, archivos: Record<string, string | Buffer>) {
  const d = join(dir, id);
  for (const [n, v] of Object.entries(archivos)) {
    mkdirSync(join(d, ...n.split('/').slice(0, -1)), { recursive: true });
    writeFileSync(join(d, ...n.split('/')), v);
  }
  writeFileSync(join(d, 'instalado.json'), JSON.stringify({ id, sha256: sha }));
}

const PAQUETE = { id: 'modelo', url: 'https://x/modelo.tar.gz', bytes: 10, sha256: 's' };
const PACK = { id: 'pack-es-1', url: 'https://x/pack.tar.gz', bytes: 10, sha256: 'p' };

/** Proceso de síntesis falso: responde (o no) a mano. */
function procesoFalso() {
  const enviados: MensajeAlProceso[] = [];
  let oyente: (m: MensajeDelProceso) => void = () => {};
  let salir: (c: number | null) => void = () => {};
  const creados = { n: 0 };
  const crear = (): ProcesoVoz => {
    creados.n++;
    return {
      enviar: (m) => enviados.push(m),
      alMensaje: (cb) => (oyente = cb),
      alSalir: (cb) => (salir = cb),
      matar: vi.fn(),
    };
  };
  return {
    crear,
    enviados,
    creados,
    responder: (m: MensajeDelProceso) => oyente(m),
    caer: () => salir(1),
    audio: (id: number) => oyente({ tipo: 'audio', id, sampleRate: 44100, pcm: new Uint8Array(8), ms: 300, cpuMs: 200 }),
  };
}

function montar(o: { motor?: MotorVoz; modelo?: boolean; pack?: Record<string, string> | null; activa?: boolean } = {}) {
  const dir = tmp();
  if (o.modelo !== false) instalar(dir, PAQUETE.id, PAQUETE.sha256, Object.fromEntries(ARCHIVOS_REQUERIDOS.map((a) => [a, '{}'])));
  if (o.pack) {
    const segmentos = Object.fromEntries(Object.entries(o.pack).map(([k, t], i) => [k, { archivo: `c${String(i).padStart(9, '0')}.mp3`, texto: t }]));
    const archivos: Record<string, string> = { 'manifest.json': JSON.stringify({ version: 1, idioma: 'es', vozId: 'v', modelo: 'm', fecha: 'f', segmentos }) };
    for (const s of Object.values(segmentos)) archivos[s.archivo] = s.texto;
    instalar(dir, PACK.id, PACK.sha256, archivos);
  }
  const ajustes: Ajustes = structuredClone(AJUSTES_POR_DEFECTO);
  ajustes.overlay.voz.motor = o.motor ?? 'pack';
  ajustes.overlay.voz.activa = o.activa ?? true;
  const p = procesoFalso();
  const estados: unknown[] = [];
  const motor = crearMotorVoz({
    dir,
    ajustes: () => ajustes,
    idioma: () => 'es',
    crearProceso: p.crear,
    paquete: PAQUETE,
    paquetePack: () => (o.pack === null ? null : PACK),
    alEstado: (e) => estados.push(e),
  });
  return { motor, p, ajustes, dir, estados };
}

describe('motor de la voz: elección y reserva', () => {
  it('con el motor «Windows» no sintetiza nada', async () => {
    const { motor, p } = montar({ motor: 'sistema' });
    expect(await motor.sintetizar('Hola')).toBeNull();
    expect(p.creados.n).toBe(0);
  });

  it('sin el modelo descargado, null (suena la de Windows)', async () => {
    const { motor } = montar({ modelo: false, pack: null });
    expect(await motor.sintetizar('Hola')).toBeNull();
    expect(motor.estado()).toMatchObject({ estado: 'no_instalada', naturalInstalada: false, packDisponible: false });
  });

  it('voz natural: carga el modelo, sintetiza y guarda en caché', async () => {
    const { motor, p } = montar({ motor: 'natural' });
    const promesa = motor.sintetizar('Nivel seis: sube la R.');
    await esperar();
    expect(p.enviados[0]).toMatchObject({ tipo: 'cargar', hilos: 2 });
    p.responder({ tipo: 'cargado', sampleRate: 44100 });
    await esperar();
    expect(p.enviados[1]).toMatchObject({ tipo: 'sintetizar', texto: 'Nivel seis: sube la erre.', idioma: 'es', estilo: 'M2', pasos: 5 });
    p.audio(1);
    expect(await promesa).toMatchObject({ sampleRate: 44100 });
    // Segunda vez: de la caché, sin pedir nada al proceso.
    expect(await motor.sintetizar('Nivel seis: sube la R.')).toMatchObject({ sampleRate: 44100 });
    expect(p.enviados).toHaveLength(2);
    expect(motor.medidas()).toHaveLength(1);
  });

  it('con la voz apagada no prepara nada (ni abre el proceso de síntesis)', async () => {
    const { motor, p } = montar({ motor: 'natural', pack: null, activa: false });
    expect(motor.precalentar()).toBe(0);
    await esperar();
    expect(p.creados.n).toBe(0);
  });

  it('las frases de la partida pasan delante de las de preparación', async () => {
    const { motor, p } = montar({ motor: 'natural', pack: null });
    expect(motor.precalentar()).toBeGreaterThan(2);
    await esperar();
    p.responder({ tipo: 'cargado', sampleRate: 44100 });
    await esperar();
    const vivo = motor.sintetizar('Frase urgente de la partida');
    p.audio(1); // termina la primera de fondo
    await esperar();
    const ultima = p.enviados.at(-1) as Extract<MensajeAlProceso, { tipo: 'sintetizar' }>;
    expect(ultima.texto).toBe('Frase urgente de la partida');
    p.audio(ultima.id);
    expect(await vivo).not.toBeNull();
    motor.vaciarFondo();
    expect(motor.enCola).toBe(0);
  });

  it('si el proceso cae, la frase da null; tras varios fallos la voz natural se aparta', async () => {
    const { motor, p } = montar({ motor: 'natural' });
    for (let i = 0; i < MAX_FALLOS; i++) {
      const fr = motor.sintetizar(`frase ${i}`);
      await esperar();
      p.caer();
      expect(await fr).toBeNull();
    }
    expect(motor.estado().error).toBe('motor');
    expect(await motor.sintetizar('otra')).toBeNull();
  });
});

describe('voz pregrabada: paquete completo o parcial', () => {
  const pack = { 'puedes comprar': 'Puedes comprar', 'filo infinito': 'Filo infinito', 'barón disponible en un minuto': 'Barón disponible en un minuto.' };

  it('frase entera en el paquete: clips pregrabados, sin tocar la voz natural', async () => {
    const { motor, p } = montar({ pack });
    const a = await motor.sintetizar('Puedes comprar Filo infinito');
    expect(a && 'clips' in a && a.clips.length).toBe(2);
    expect(p.creados.n).toBe(0);
  });

  it('paquete parcial: la frase con un segmento que falta sale ENTERA con la voz natural', async () => {
    const { motor, p } = montar({ pack });
    const promesa = motor.sintetizar('Puedes comprar Filo de la noche');
    await esperar();
    p.responder({ tipo: 'cargado', sampleRate: 44100 });
    await esperar();
    expect(p.enviados[1]).toMatchObject({ tipo: 'sintetizar', texto: 'Puedes comprar Filo de la noche' });
    p.audio(1);
    const a = await promesa;
    expect(a && 'pcm' in a).toBe(true);
  });

  it('con el motor natural no se usa el paquete aunque esté', async () => {
    const { motor, p } = montar({ motor: 'natural', pack });
    void motor.sintetizar('Puedes comprar Filo infinito');
    await esperar();
    expect(p.creados.n).toBe(1);
  });

  it('al preparar la partida se saltan las frases que ya están en el paquete', async () => {
    const { motor } = montar({ pack: { ...pack, 'barón disponible en un minuto': 'x' } });
    const sin = montar({ pack: null }).motor.precalentar();
    expect(motor.precalentar()).toBeLessThanOrEqual(sin);
  });
});

describe('descarga del modelo y del paquete del idioma', () => {
  it('descarga los dos, con la suma comprobada, y queda todo instalado', async () => {
    const tgzModelo = gzipSync(escribirTar(ARCHIVOS_REQUERIDOS.map((a) => ({ nombre: a, datos: Buffer.from('{}') }))));
    const tgzPack = gzipSync(escribirTar([{ nombre: 'manifest.json', datos: Buffer.from('{}') }]));
    const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
    const dir = tmp();
    const f: FetchMinimo = async (url) => {
      const b = url.includes('modelo') ? tgzModelo : tgzPack;
      return { status: 200, headers: { get: () => String(b.length) }, body: new Blob([new Uint8Array(b)]).stream() as ReadableStream<Uint8Array> };
    };
    const ajustes = structuredClone(AJUSTES_POR_DEFECTO);
    const estados: string[] = [];
    const motor = crearMotorVoz({
      dir,
      ajustes: () => ajustes,
      idioma: () => 'es',
      crearProceso: procesoFalso().crear,
      fetch: f,
      paquete: { ...PAQUETE, bytes: tgzModelo.length, sha256: sha(tgzModelo) },
      paquetePack: () => ({ ...PACK, bytes: tgzPack.length, sha256: sha(tgzPack) }),
      alEstado: (e) => estados.push(e.estado),
    });
    expect(motor.estado().megasPendientes).toBe(0);
    await motor.descargar();
    expect(motor.estado()).toMatchObject({ estado: 'instalada', naturalInstalada: true, packInstalado: true, error: null });
    expect(estados).toContain('descargando');
    expect(estados).toContain('instalando');
  });

  it('un paquete aún sin publicar da error «paquete» y la app sigue con la de Windows', async () => {
    const dir = tmp();
    const motor = crearMotorVoz({
      dir,
      ajustes: () => structuredClone(AJUSTES_POR_DEFECTO),
      idioma: () => 'es',
      crearProceso: procesoFalso().crear,
      paquete: { ...PAQUETE, bytes: 0, sha256: '' },
      paquetePack: () => null,
    });
    await motor.descargar();
    expect(motor.estado()).toMatchObject({ estado: 'error', error: 'paquete' });
    expect(await motor.sintetizar('hola')).toBeNull();
  });
});

describe('IPC de la voz', () => {
  function ipc() {
    const handles = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>();
    const ons = new Map<string, (e: { sender: unknown }, ...a: unknown[]) => void>();
    return { handles, ons, ipc: { handle: (c: string, f: never) => handles.set(c, f), on: (c: string, f: never) => ons.set(c, f) } };
  }
  const motor = () => ({ sintetizar: vi.fn(async () => null), estado: vi.fn(() => ({}) as never), descargar: vi.fn(async () => {}), cancelarDescarga: vi.fn() });

  it('solo el overlay y la ventana principal; texto validado', async () => {
    const { handles, ons, ipc: i } = ipc();
    const m = motor();
    registrarIpcVoz(i, { motor: m, esPrincipal: (s) => s === 'principal', esOverlay: (s) => s === 'overlay' });
    await expect(handles.get('voz:sintetizar')!({ sender: 'otro' }, 'hola')).rejects.toThrow('Remitente');
    expect(await handles.get('voz:sintetizar')!({ sender: 'overlay' }, 42)).toBeNull();
    expect(await handles.get('voz:sintetizar')!({ sender: 'overlay' }, 'x'.repeat(301))).toBeNull();
    await handles.get('voz:sintetizar')!({ sender: 'principal' }, '  Hola\u0000 ');
    expect(m.sintetizar).toHaveBeenCalledWith('Hola');
    ons.get('voz:preparar')!({ sender: 'principal' }, 'no');
    ons.get('voz:preparar')!({ sender: 'overlay' }, 'sí');
    expect(m.sintetizar).toHaveBeenLastCalledWith('sí');
    expect(() => handles.get('voz:descargar')!({ sender: 'overlay' })).toThrow('Remitente');
    handles.get('voz:descargar')!({ sender: 'principal' });
    handles.get('voz:cancelar')!({ sender: 'principal' });
    expect(m.descargar).toHaveBeenCalled();
    expect(m.cancelarDescarga).toHaveBeenCalled();
  });

  it('textoValido', () => {
    expect(textoValido('  ')).toBeNull();
    expect(textoValido('ok')).toBe('ok');
  });
});

describe('ajustes de la voz (3.1)', () => {
  it('motor y voces por idioma, con valores por defecto y saneados', () => {
    const a = normalizarAjustes({ overlay: { voz: { motor: 'raro', vocesNaturales: { es: 'supertonic3:F1', xx: 'supertonic3:M1', en: 'otra' } } } });
    expect(a.overlay.voz.motor).toBe('pack');
    expect(a.overlay.voz.vocesNaturales).toEqual({ es: 'supertonic3:F1' });
    expect(normalizarAjustes({ overlay: { voz: { motor: 'sistema' } } }).overlay.voz.motor).toBe('sistema');
    expect(normalizarAjustes({}).overlay.voz).toMatchObject({ motor: 'pack', vocesNaturales: {} });
  });
});
