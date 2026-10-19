// Preload de capturas (solo herramienta de desarrollo): simula el proceso principal con la escena
// que prepara tools/capturas.ts a partir de datos reales. No se empaqueta con la app.
const { contextBridge } = require('electron');
const fs = require('node:fs');

const argumento = (nombre) => {
  const a = process.argv.find((x) => x.startsWith(`--${nombre}=`));
  return a ? a.slice(nombre.length + 3) : '';
};
const escena = JSON.parse(fs.readFileSync(argumento('coach-escena'), 'utf8'));
const pagina = argumento('coach-pagina');
const nada = () => {};
const luego = (fn, ms = 0) => setTimeout(fn, ms);

// Guion de un clip: pasos { ms, canal, dato } que se emiten por los mismos canales que usa main,
// contando desde coachCaptura.iniciar() (lo llama la herramienta al empezar a grabar).
const oyentes = {};
const oir = (canal) => (cb) => void (oyentes[canal] ??= []).push(cb);
const emitir = (canal, dato) => (oyentes[canal] ?? []).forEach((cb) => cb(dato));
contextBridge.exposeInMainWorld('coachCaptura', {
  iniciar: () => {
    for (const p of escena.pasos ?? []) luego(() => emitir(p.canal, p.dato), p.ms);
  },
});

if (pagina === 'principal') {
  contextBridge.exposeInMainWorld('coach', {
    alCambiarEstado: (cb) => luego(() => cb(escena.estado)),
    importar: () => new Promise(nada),
    cambiarRol: () => Promise.resolve(),
    cambiarOpcion: () => Promise.resolve(),
    obtenerAjustes: () => Promise.resolve(escena.ajustes),
    guardarAjustes: () => Promise.resolve(),
    moverOverlay: () => Promise.resolve(false),
    overlayMoviendo: () => Promise.resolve(false),
    alCambiarMover: () => nada,
    alCambiarAjustes: () => nada,
    restablecerMinimapa: () => Promise.resolve(escena.ajustes),
    ventana: nada,
    licencia: () => Promise.resolve(escena.licencia),
    activarLicencia: () => Promise.resolve(escena.licencia),
    quitarLicencia: () => Promise.resolve(escena.licencia),
    abrirWeb: () => Promise.resolve(),
    asistente: () => Promise.resolve({ ok: true, respuesta: '' }),
    alCambiarLicencia: () => nada,
    // Apartado Campeones: la lista de cada modo, preparada con el servidor real.
    campeones: (filtro) => Promise.resolve(escena.campeones?.[filtro?.modo ?? 'clasificatoria'] ?? { ok: false, error: 'datos' }),
    buildDe: () => Promise.resolve({ ok: false, error: 'datos' }),
  });
} else {
  contextBridge.exposeInMainWorld('coachOverlay', {
    // Escena de partida (estado + aviso) o de pantalla de carga (modo 'carga' + carga).
    alEstado: (cb) => {
      oir('estado')(cb);
      if (escena.estado) luego(() => cb(escena.estado));
    },
    alAviso: (cb) => {
      oir('aviso')(cb);
      if (escena.aviso) luego(() => cb(escena.aviso), 250);
    },
    alMover: (cb) => {
      oir('mover')(cb);
      if (escena.mover) luego(() => cb(true), 150);
    },
    alModo: (cb) => {
      oir('modo')(cb);
      luego(() => cb(escena.modo ?? 'partida'), 50);
    },
    alCarga: (cb) => {
      oir('carga')(cb);
      if (escena.carga) luego(() => cb(escena.carga));
    },
    alConfig: oir('config'),
    alJungla: (cb) => {
      oir('jungla')(cb);
      if (escena.jungla) luego(() => cb(escena.jungla), 100);
    },
    alVoz: nada,
    obtenerConfig: () => Promise.resolve(escena.config),
    guardarWidget: nada,
    guardarMinimapa: nada,
    marcarJungla: nada,
    capturarRaton: nada,
    capturarRatonJungla: nada,
    fijar: nada,
  });
}
