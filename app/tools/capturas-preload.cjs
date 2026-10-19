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
    ventana: nada,
    licencia: () => Promise.resolve(escena.licencia),
    activarLicencia: () => Promise.resolve(escena.licencia),
    quitarLicencia: () => Promise.resolve(escena.licencia),
    abrirWeb: () => Promise.resolve(),
    asistente: () => Promise.resolve({ ok: true, respuesta: '' }),
    alCambiarLicencia: () => nada,
  });
} else {
  contextBridge.exposeInMainWorld('coachOverlay', {
    alEstado: (cb) => luego(() => cb(escena.estado)),
    alAviso: (cb) => luego(() => cb(escena.aviso), 250),
    alMover: nada,
    alModo: (cb) => luego(() => cb('partida')),
    alCarga: nada,
    alConfig: nada,
    alJungla: nada,
    alVoz: nada,
    obtenerConfig: () => Promise.resolve(escena.config),
    guardarWidget: nada,
    marcarJungla: nada,
    capturarRaton: nada,
    capturarRatonJungla: nada,
    fijar: nada,
  });
}
