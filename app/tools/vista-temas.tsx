// Herramienta de desarrollo: la ventana principal con una build de Ahri de muestra y el tema de ?tema= (para revisar
// los temas en un navegador sin cliente ni servidor; ver vista-temas.html). Las imágenes de Data Dragon las sirve quien la abra
// (ver la ruta de Playwright de la revisión); sin ellas quedan huecos.
import type { Build } from '@coach/shared';
import { createRoot } from 'react-dom/client';
import type { Ajustes, EstadoPrincipal, EstadoLicencia } from '../src/shared/tiposApp';
import { VERSION_ACTUAL } from '../src/shared/novedades';
// Los mismos estilos y en el mismo orden que principal/main.tsx.
import '../src/renderer/comun/tokens.css';
import '../src/renderer/principal/estilos.css';
import '../src/renderer/principal/vistas/campeon.css';
import '../src/renderer/principal/vistas/vistas.css';
import '../src/renderer/principal/vistas/campeones.css';
import '../src/renderer/principal/vistas/bienvenida.css';
import '../src/renderer/principal/vistas/analisis.css';
import '../src/renderer/principal/vistas/parche.css';
import '../src/renderer/principal/vistas/tft.css';
import '../src/renderer/overlay/panel.css';
import '../src/renderer/principal/tema.css';
import '../src/renderer/principal/temas.css';

const params = new URLSearchParams(location.search);
const tema = params.get('tema') ?? 'clasico';
const vista = params.get('vista') ?? 'campeon';

const build: Build = {
  campeon: 'Ahri',
  rol: 'MIDDLE',
  parche: '25.22',
  partidas: 48213,
  tasaVictoria: 0.5241,
  mezclaParches: false,
  runas: { estiloPrincipal: 8100, estiloSecundario: 8200, runas: [8112, 8139, 8140, 8106, 8226, 8210, 5008, 5008, 5001] },
  hechizos: [4, 14],
  objetosIniciales: [1056, 2003],
  nucleo: [6655, 4645, 3089],
  botas: 3020,
  situacionales: [3135, 3157, 3108],
  ordenHabilidades: ['Q', 'W', 'E', 'Q', 'Q', 'R', 'Q', 'E', 'Q', 'E', 'R', 'E', 'E', 'W', 'W', 'R', 'W', 'W'],
  calculadoEn: new Date().toISOString(),
};
const runa = (nombre: string, icono: string) => ({ nombre, icono });
const estado: EstadoPrincipal = {
  cliente: 'conectado',
  version: '15.22.1',
  error: null,
  importacion: null,
  aviso: null,
  recursos: {
    objetos: { 1056: 'Anillo de Doran', 2003: 'Poción de vida', 6655: 'Tormento de Luden', 4645: 'Llama sombría', 3089: 'Sombrero mortal de Rabadon', 3020: 'Botas del hechicero', 3135: 'Bastón del vacío', 3157: 'Reloj de arena de Zhonya', 3108: 'Códice demoníaco' },
    runas: {
      8100: runa('Dominación', 'perk-images/Styles/7200_Domination.png'),
      8200: runa('Brujería', 'perk-images/Styles/7202_Sorcery.png'),
      8112: runa('Electrocutar', 'perk-images/Styles/Domination/Electrocute/Electrocute.png'),
      8139: runa('Sabor a sangre', 'perk-images/Styles/Domination/TasteOfBlood/GreenTerror_TasteOfBlood.png'),
      8140: runa('Recuerdos macabros', 'perk-images/Styles/Domination/GrislyMementos/GrislyMementos.png'),
      8106: runa('Cazador definitivo', 'perk-images/Styles/Domination/UltimateHunter/UltimateHunter.png'),
      8226: runa('Flujo de maná', 'perk-images/Styles/Sorcery/ManaflowBand/ManaflowBand.png'),
      8210: runa('Trascendencia', 'perk-images/Styles/Sorcery/Transcendence/Transcendence.png'),
    },
    hechizos: { 4: { nombre: 'Destello', imagen: 'SummonerFlash.png' }, 14: { nombre: 'Ignición', imagen: 'SummonerDot.png' } },
  },
  seleccion: {
    campeon: { id: 'Ahri', nombre: 'Ahri', key: 103 },
    rol: 'MIDDLE',
    rolesDisponibles: ['MIDDLE'],
    resultado: { estado: 'ok', build },
    opcion: 0,
  },
};
// ?mains=1: selección aún sin fijar contra Zed, con «Tus mains para esta partida» (3.18) e «Ideas para elegir».
if (params.get('mains')) {
  const cc = (id: string, key: number) => ({ id, nombre: id, key });
  estado.enfrentamientos = {
    rol: 'MIDDLE',
    rival: { ...cc('Zed', 238), inferido: false },
    counters: null,
    contra: null,
    buenasElecciones: [],
    mainsEleccion: {
      motivo: 'contra',
      mains: [
        { campeon: cc('Ahri', 103), ventaja: 0.086, partidasServidor: 412, tuyas: { partidas: 14, victorias: 9 } },
        { campeon: cc('Syndra', 134), ventaja: 0.031, partidasServidor: 268, tuyas: { partidas: 8, victorias: 4 } },
        { campeon: cc('Orianna', 61), ventaja: -0.012, partidasServidor: 305, tuyas: { partidas: 5, victorias: 3 } },
        { campeon: cc('Viktor', 112), ventaja: -0.024, partidasServidor: 190, tuyas: { partidas: 3, victorias: 1 } },
      ],
    },
  };
}
const licencia: EstadoLicencia = { plan: 'premium', estado: 'activa', renuevaEn: new Date(Date.now() + 20 * 864e5).toISOString(), claveVisible: 'CLIA-••••-7K2P' } as EstadoLicencia;
const ajustesBase = { idioma: 'es', tema, bienvenidaVista: true, ultimaVersionVista: VERSION_ACTUAL } as Partial<Ajustes>;

// Las mismas llamadas que simula tools/capturas-preload.cjs.
const nada = () => {};
// main/ajustes.ts no carga en un navegador: los ajustes por defecto llegan en JSON con ?ajustes=/ruta/absoluta.json
// (npx tsx -e "import('./src/main/ajustes.ts').then(m => console.log(JSON.stringify(m.AJUSTES_POR_DEFECTO)))").
const porDefecto = (await fetch(`/@fs${params.get('ajustes')}`).then((r) => r.json())) as Ajustes;
const ajustes = { ...porDefecto, ...ajustesBase } as Ajustes;
(window as unknown as { coach: unknown }).coach = {
  idioma: 'es',
  tema,
  alCambiarEstado: (cb: (e: EstadoPrincipal) => void) => (setTimeout(() => cb(estado)), nada),
  importar: () => new Promise(nada),
  cambiarRol: () => Promise.resolve(),
  cambiarOpcion: () => Promise.resolve(),
  obtenerAjustes: () => Promise.resolve(ajustes),
  guardarAjustes: () => Promise.resolve(),
  moverOverlay: () => Promise.resolve(false),
  overlayMoviendo: () => Promise.resolve(false),
  alCambiarMover: () => nada,
  alCambiarAjustes: () => nada,
  restablecerMinimapa: () => Promise.resolve(ajustes),
  ventana: nada,
  licencia: () => Promise.resolve(licencia),
  activarLicencia: () => Promise.resolve(licencia),
  quitarLicencia: () => Promise.resolve(licencia),
  abrirWeb: () => Promise.resolve(),
  asistente: () => Promise.resolve({ ok: true, respuesta: '' }),
  alCambiarLicencia: () => nada,
  campeones: () => Promise.resolve({ ok: false, error: 'datos' }),
  buildDe: () => Promise.resolve({ ok: false, error: 'datos' }),
  historialAnalisis: () => Promise.resolve([]),
  estadoAnalisis: () => Promise.resolve({ estado: 'inactivo' }),
  alAnalisis: () => nada,
  perfil: () => Promise.resolve(null),
  lineaTiempo: () => Promise.resolve(null),
  elegirReto: () => Promise.resolve(null),
  alPerfil: () => nada,
  coachPersonal: () => Promise.resolve({ ok: true, datos: '' }),
  alNavegar: () => nada,
};

const [{ App }, { iniciarIdioma }, { iniciarTema }] = await Promise.all([
  import('../src/renderer/principal/App'),
  import('../src/renderer/comun/idioma'),
  import('../src/renderer/comun/tema'),
]);
const w = window as unknown as { coach: Parameters<typeof iniciarTema>[0] & Parameters<typeof iniciarIdioma>[0] };
iniciarIdioma(w.coach);
iniciarTema(w.coach);
document.documentElement.dataset.vistaInicial = vista;
createRoot(document.getElementById('root')!).render(<App />);
