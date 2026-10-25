import { clasificarObjeto, esColaGrietaNormal, MAPA_DE_MODO, modoDeMapa, tieneRoles, type Build, type ListaCampeones, type ModoJuego, type Rol } from '@coach/shared';
import { t } from '../../shared/i18n';
import { esColaRotativa, nombreRotativo } from '../../shared/colas';
import type { Ajustes, CampeonDDragon, EstadoEnfrentamientos, EstadoPrincipal, ResultadoImportar, RivalesSeleccion, RotativoSeleccion } from '../../shared/tiposApp';
import { ideasBaneo } from '../builds/baneos';
import { buenasEleccionesContra, countersVista, indiceCampeones, rivalDeLinea } from '../builds/counters';
import { crearClienteBuilds, type ResultadoBuild } from '../builds/clienteBuilds';
import { recursosDe } from '../builds/recursos';
import type { Aumentos } from '../datos/aumentos';
import { panelAumentos } from '../consejos/aumentosCaos';
import type { DatosEstaticos } from '../datos/estaticos';
import type { ClienteLcu } from '../lcu/cliente';
import { importarTodo, type OpcionesRunas } from '../lcu/importar';
import type { SeleccionCampeon } from '../lcu/seleccion';
import { registrar } from '../log';
import { urlServidor } from '../servidor';
import { buildElegida, opcionValida, runasValida } from '../../shared/opciones';

interface Dependencias {
  dirCache: string;
  cargarDatos: () => Promise<DatosEstaticos>;
  obtenerAjustes: () => Ajustes;
  enviar: (estado: EstadoPrincipal) => void;
  /** Nombres e iconos de los aumentos (ARAM: Caos y Arena); sin ella, se enseñan sus ids. */
  cargarAumentos?: () => Promise<Aumentos>;
  /** Sustituibles en las pruebas. */
  crearBuilds?: typeof crearClienteBuilds;
  importarTodo?: typeof importarTodo;
  urlServidor?: () => string;
}

const FALLO_TOTAL: ResultadoImportar = {
  runas: { ok: false, motivo: 'error' },
  hechizos: { ok: false, motivo: 'error' },
  objetos: { ok: false, motivo: 'error' },
};

/** Une el vigilante del cliente, los datos y las builds, y empuja el estado a la ventana principal. */
export function crearOrquestadorSeleccion(dep: Dependencias) {
  let datos: DatosEstaticos | null = null;
  let lcu: ClienteLcu | null = null;
  let seleccion: SeleccionCampeon | null = null;
  let estado: EstadoPrincipal = {
    cliente: 'esperando',
    seleccion: null,
    version: '',
    recursos: { objetos: {}, runas: {}, hechizos: {} },
    error: null,
    importacion: null,
    aviso: null,
  };
  let generacion = 0;
  let cola: Promise<unknown> = Promise.resolve();
  let ultimaAuto: string | null = null;
  /** Arena no tiene runas ni un conjunto de objetos que importar: no se ofrece «Importar». */
  const importable = (modo: ModoJuego | undefined) => modo !== 'arena';
  async function aumentos(): Promise<Aumentos | undefined> {
    try {
      return await dep.cargarAumentos?.();
    } catch {
      return undefined;
    }
  }

  /**
   * 3.8: datos del modo rotativo de una cola: la lista del servidor (`GET /rotativos`, con caché) dice su nombre, su
   * mapa y si tiene datos o es PvE; si el servidor no la conoce, el gameMode y el mapa de la sesión de gameflow.
   */
  async function resolverRotativo(
    builds: ReturnType<typeof crearClienteBuilds>,
    cola: number,
    sel: SeleccionCampeon,
  ): Promise<Omit<RotativoSeleccion, 'estado'> & { estado: 'pve' | 'otro'; conDatos: boolean }> {
    const lista = await builds.obtenerRotativos?.().catch(() => null);
    const info = lista?.lista.modos.find((m) => m.cola === cola);
    // El servidor puede mandar gameMode '' y mapa 0 si aún no los conoce: entonces valen los de la partida en curso.
    const mapa = info?.mapa && info.mapa > 0 ? info.mapa : sel.mapa;
    const base = modoDeMapa(mapa) ?? 'clasificatoria';
    const gameMode = info?.gameMode || sel.gameMode || null;
    return {
      cola,
      nombre: info?.nombre || gameMode || '',
      gameMode,
      base,
      estado: info?.pve ? 'pve' : 'otro',
      conDatos: !!info && info.conDatos && !info.pve,
    };
  }

  /** Opción elegida por campeón y rol, solo durante la sesión. */
  const opcionesElegidas = new Map<string, number>();
  /** Página de runas elegida por campeón, modo y rol (3.0.1), también solo durante la sesión. */
  const runasElegidas = new Map<string, number>();
  /** Campeón, modo y rol ya importados en esta selección de campeones: cambiar de runas los vuelve a importar. */
  let importadaEn: string | null = null;
  const claveDe = (sel: NonNullable<EstadoPrincipal['seleccion']>) =>
    `${sel.campeon.key}-${sel.rotativo ? `rotativo${sel.rotativo.cola}` : (sel.modo ?? 'clasificatoria')}-${sel.rol}`;
  const crearBuilds = dep.crearBuilds ?? crearClienteBuilds;
  const importarLcu = dep.importarTodo ?? importarTodo;

  const publicar = (parcial: Partial<EstadoPrincipal>) => {
    estado = { ...estado, ...parcial };
    dep.enviar(estado);
  };

  async function asegurarDatos(): Promise<DatosEstaticos | null> {
    if (datos) return datos;
    try {
      datos = await dep.cargarDatos();
      return datos;
    } catch (e) {
      registrar('error', `No se pudieron cargar los datos de Data Dragon: ${String(e)}`);
      return null;
    }
  }

  async function mostrar(sel: SeleccionCampeon, rolElegido?: Rol): Promise<void> {
    const gen = ++generacion;
    try {
      const d = await asegurarDatos();
      if (gen !== generacion) return;
      if (!d) return publicar({ seleccion: null, error: 'datos', importacion: null });
      const campeon = d.campeones.get(sel.campeonId);
      if (!campeon) return publicar({ seleccion: null, error: null, importacion: null });
      const builds = crearBuilds({ urlServidor: (dep.urlServidor ?? urlServidor)(), dirCache: dep.dirCache });
      // 3.8: un modo rotativo (URF, Uno para todos…) usa su build si el servidor tiene datos; si no, la de su mapa.
      const rotativo = !sel.modo && esColaRotativa(sel.cola) ? await resolverRotativo(builds, sel.cola, sel) : null;
      if (gen !== generacion) return;
      // ARAM, ARAM: Caos y Arena: build por campeón, sin roles. Una cola sin datos propios usa clasificatoria.
      const modo: ModoJuego = rotativo ? rotativo.base : (sel.modo ?? 'clasificatoria');
      let delModo: ResultadoBuild | null = null;
      if (rotativo?.conDatos) {
        const r = await builds.obtenerBuildRotativa(rotativo.cola, campeon.id).catch((): ResultadoBuild => ({ estado: 'no_disponible' }));
        if (r.estado !== 'no_disponible') delModo = r;
      }
      const pve = rotativo?.estado === 'pve';
      const conRoles = !delModo && !pve && tieneRoles(modo);
      const roles = conRoles ? await builds.obtenerRoles(campeon.id) : [];
      const rol: Rol | null = conRoles ? (rolElegido ?? sel.rol ?? roles[0] ?? 'MIDDLE') : null;
      // En un modo PvE (Enjambre…) no hay builds: ni se piden.
      const resultado: ResultadoBuild = pve ? { estado: 'no_disponible' } : (delModo ?? (await builds.obtenerBuild(campeon.id, rol, modo)));
      const infoRotativo: RotativoSeleccion | undefined = rotativo
        ? { cola: rotativo.cola, nombre: rotativo.nombre, gameMode: rotativo.gameMode, base: rotativo.base, estado: pve ? 'pve' : delModo ? 'datos' : 'respaldo' }
        : undefined;
      const claveModo = rotativo ? `rotativo${rotativo.cola}` : modo;
      const necesitaAumentos = modo === 'caos' || (resultado.estado !== 'no_disponible' && !!resultado.build.aumentosPopulares?.length);
      const listaAumentos = necesitaAumentos ? await aumentos() : undefined;
      // 3.4: en ARAM: Caos, la tier list de aumentos por encaje con el campeón (sin % de victorias: política de Riot).
      const aumentosCaos = modo === 'caos' && listaAumentos?.size ? panelAumentos(campeon, listaAumentos) : undefined;
      if (gen !== generacion) return;
      const recordada = opcionesElegidas.get(`${sel.campeonId}-${claveModo}-${rol}`) ?? 0;
      const opcion = resultado.estado !== 'no_disponible' && opcionValida(resultado.build, recordada) ? recordada : 0;
      const runasRecordada = runasElegidas.get(`${sel.campeonId}-${claveModo}-${rol}`) ?? 0;
      const opcionRunas = resultado.estado !== 'no_disponible' && runasValida(resultado.build, runasRecordada) ? runasRecordada : 0;
      publicar({
        seleccion: {
          campeon: { ...campeon, key: sel.campeonId },
          rol,
          ...(conRoles || (rotativo && modo === 'clasificatoria') ? {} : { modo }),
          rolesDisponibles: roles,
          resultado,
          opcion,
          opcionRunas,
          ...(aumentosCaos ? { aumentosCaos } : {}),
          ...(esColaGrietaNormal(sel.cola) ? { cola: sel.cola } : {}),
          ...(infoRotativo ? { rotativo: infoRotativo } : {}),
        },
        version: d.version,
        recursos: resultado.estado === 'no_disponible' ? estado.recursos : recursosDe(resultado.build, d, listaAumentos),
        error: null,
        importacion: null,
      });
      await importarAutomatico();
      await actualizarEnfrentamientos();
    } catch (e) {
      registrar('error', `Error al mostrar la build: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  /** Con la importación automática, importa la selección actual (con su opción) si aún no se hizo. */
  async function importarAutomatico(): Promise<void> {
    const sel = estado.seleccion;
    if (!sel || sel.resultado.estado === 'no_disponible' || !importable(sel.modo) || !dep.obtenerAjustes().importacionAutomatica) return;
    // Hasta saber la cola no se importa solo: podría ser ARAM o Arena y la build cambiaría al llegar.
    if (seleccion?.modoPendiente) return;
    const clave = `${claveDe(sel)}-${sel.opcion}-${sel.opcionRunas ?? 0}`;
    if (clave === ultimaAuto) return;
    ultimaAuto = clave;
    await importar();
  }

  /**
   * Las importaciones se encadenan: nunca hay dos a la vez borrando y creando páginas. `opcionesRunas` solo llega
   * desde «Importar» (manual): la importación automática nunca sustituye una página del jugador.
   */
  function importar(opcionesRunas: OpcionesRunas = {}, deEnfrentamiento = false): Promise<ResultadoImportar> {
    const turno = cola.then(async () => {
      const sel = estado.seleccion;
      if (!lcu || !sel || sel.resultado.estado === 'no_disponible' || !importable(sel.modo)) return FALLO_TOTAL;
      // 3.9: la build del cruce contra el rival de tu línea (si la hay) en lugar de la de la opción elegida.
      const enf = estado.enfrentamientos;
      if (deEnfrentamiento && (!enf?.contra?.build || !enf.rival)) return FALLO_TOTAL;
      const titulo = deEnfrentamiento
        ? `Coach: ${sel.campeon.nombre} vs ${enf!.rival!.nombre}`
        : `Coach: ${sel.campeon.nombre} ${
            sel.rotativo ? nombreRotativo(sel.rotativo) : sel.rol ? t('rol.' + sel.rol) : t('modo.' + (sel.modo ?? 'clasificatoria'))
          }`;
      const mapa = sel.modo === 'aram' || sel.modo === 'caos' ? 12 : 11;
      const aImportar = deEnfrentamiento ? enf!.contra!.build! : buildElegida(sel.resultado.build, sel.opcion, sel.opcionRunas);
      let resultado: ResultadoImportar;
      try {
        // Runas de la página elegida; hechizos y objetos, de la opción de build.
        resultado = await importarLcu(lcu, aImportar, sel.campeon.key, titulo, mapa, opcionesRunas);
      } catch (e) {
        registrar('error', `Importación fallida: ${e instanceof Error ? e.message : String(e)}`);
        resultado = FALLO_TOTAL;
      }
      if (deEnfrentamiento) return resultado; // su resultado lo enseña la tarjeta del cruce
      if (resultado.runas.ok || resultado.hechizos.ok || resultado.objetos.ok) importadaEn = claveDe(sel);
      // Solo se publica si la selección sigue siendo la misma.
      if (estado.seleccion === sel) publicar({ importacion: resultado });
      return resultado;
    });
    cola = turno.catch(() => undefined);
    return turno;
  }

  /** 3.9: rivales de la sesión de champ select y lista de campeones (para deducir sus roles) de esta selección. */
  let rivales: RivalesSeleccion | null = null;
  let listaRoles: Promise<ListaCampeones | null> | null = null;
  let generacionEnf = 0;

  /**
   * 3.9: enfrentamientos de la selección: tus counters, tu cruce contra el rival de tu línea (si ya eligió) o, sin
   * campeón elegido, las mejores elecciones contra él. Solo en la Grieta con roles (clasificatoria y normales).
   */
  async function actualizarEnfrentamientos(): Promise<void> {
    const gen = ++generacionEnf;
    const sel = estado.seleccion;
    const enGrieta = sel ? !sel.modo && !sel.rotativo : !!rivales;
    const rol: Rol | null = sel ? sel.rol : (rivales?.rol ?? null);
    if (!enGrieta || !rol) {
      if (estado.enfrentamientos) publicar({ enfrentamientos: null });
      return;
    }
    const d = await asegurarDatos();
    if (!d || gen !== generacionEnf) return;
    const builds = crearBuilds({ urlServidor: (dep.urlServidor ?? urlServidor)(), dirCache: dep.dirCache });
    if (!builds.obtenerCounters) return;
    const porId = indiceCampeones(d);
    const porKey = new Map<number, CampeonDDragon>([...porId.values()].map((c) => [c.key, c]));
    let rival: EstadoEnfrentamientos['rival'] = null;
    // La lista de campeones de clasificatoria (con caché): para deducir el rol de los rivales y para las ideas de bloqueo.
    const pedirLista = () =>
      (listaRoles ??= builds
        .obtenerCampeones('clasificatoria')
        .then((r) => (r.estado === 'no_disponible' ? null : r.lista))
        .catch(() => null));
    if (rivales?.rivales.length) {
      const necesitaLista = rivales.rivales.some((r) => r.rol === null);
      rival = rivalDeLinea(rivales, rol, porKey, necesitaLista ? await pedirLista() : null);
    }
    const siguiente: EstadoEnfrentamientos = { rol, rival, counters: null, contra: null, buenasElecciones: [] };
    const nada = { estado: 'no_disponible' as const };
    if (sel) {
      const [counters, cruce] = await Promise.all([
        builds.obtenerCounters(sel.campeon.id, rol).catch(() => nada),
        rival ? builds.obtenerEnfrentamiento(sel.campeon.id, rival.id, rol).catch(() => nada) : null,
      ]);
      if (counters.estado !== 'no_disponible') siguiente.counters = countersVista(counters.counters, porId, counters.estado === 'sin_conexion');
      if (cruce && cruce.estado !== 'no_disponible') {
        const { partidas, tasaVictoria, datosLimitados, tasaFaseLineas, partidasFaseLineas, puntuacion, build } = cruce.enfrentamiento;
        // 3.9.2: con la fase de líneas y la puntuación del cruce si el servidor las da.
        const fase = tasaFaseLineas !== undefined ? { tasaFaseLineas, partidasFaseLineas, ...(puntuacion !== undefined ? { puntuacion } : {}) } : {};
        siguiente.contra = { partidas, tasaVictoria, datosLimitados, ...fase, ...(build ? { build, recursos: recursosDe(build, d) } : {}) };
      }
    } else if (rival) {
      const delRival = await builds.obtenerCounters(rival.id, rol).catch(() => nada);
      if (delRival.estado !== 'no_disponible') siguiente.buenasElecciones = buenasEleccionesContra(delRival.counters, porId);
    }
    // 3.9.2: en la fase de bloqueos, varias ideas para banear (nunca una sola: normas de Riot, ver `baneos.ts`).
    if (rivales?.faseBloqueos) {
      const excluir = new Set<number>([...(rivales.bloqueados ?? []), ...(rivales.aliados ?? []), ...rivales.rivales.map((r) => r.campeonId)]);
      const ideas = ideasBaneo({
        rol,
        campeon: sel ? { id: sel.campeon.id, nombre: sel.campeon.nombre, key: sel.campeon.key } : null,
        counters: siguiente.counters,
        lista: await pedirLista(),
        indice: porId,
        excluir,
      });
      if (ideas) siguiente.ideasBaneo = ideas;
    }
    if (gen !== generacionEnf) return;
    publicar({ enfrentamientos: siguiente });
  }

  return {
    estado: () => estado,
    importar,
    /** 3.9: importa la build del cruce contra el rival de tu línea (botón de la tarjeta «Contra …»). */
    importarEnfrentamiento: (opcionesRunas: OpcionesRunas = {}) => importar(opcionesRunas, true),
    /** 3.9: rivales de la sesión de champ select (lo que el cliente enseña); recalcula los enfrentamientos. */
    async alRivales(r: RivalesSeleccion | null): Promise<void> {
      rivales = r;
      await actualizarEnfrentamientos();
    },
    /**
     * Build y rol efectivos de la selección, y los objetos, para los consejos en partida. Null si no hay datos.
     * En Arena, la próxima compra sale de los objetos legendarios más elegidos (la build no tiene núcleo).
     */
    async contexto(): Promise<{
      build: Build | null;
      rol: Rol;
      objetos: DatosEstaticos['objetos'];
      version: string;
      modo: ModoJuego;
      /** 3.8: cola de una normal de la Grieta o de un modo rotativo. */
      cola?: number;
    } | null> {
      const d = await asegurarDatos();
      if (!d) return null;
      const sel = estado.seleccion;
      let build = sel && sel.resultado.estado !== 'no_disponible' ? buildElegida(sel.resultado.build, sel.opcion, sel.opcionRunas) : null;
      if (build?.modo === 'arena' && build.objetosArenaPopulares?.length) {
        const legendarios = build.objetosArenaPopulares
          .map((o) => o.id)
          .filter((id) => d.objetos[id] && clasificarObjeto(id, d.objetos[id], MAPA_DE_MODO.arena) === 'legendario')
          .slice(0, 3);
        build = { ...build, nucleo: legendarios };
      }
      const cola = sel?.rotativo?.cola ?? sel?.cola;
      return {
        build,
        rol: sel?.rol ?? seleccion?.rol ?? 'MIDDLE',
        objetos: d.objetos,
        version: d.version,
        modo: sel?.modo ?? 'clasificatoria',
        ...(cola ? { cola } : {}),
      };
    },
    avisar(aviso: string | null): void {
      publicar({ aviso });
    },
    /** Al salir de la selección de campeones se olvida la última importación automática. */
    fase(fase: string): void {
      if (fase !== 'ChampSelect') {
        ultimaAuto = null;
        importadaEn = null;
        // 3.9: los enfrentamientos son de antes de la partida: fuera de la selección se quitan.
        rivales = null;
        listaRoles = null;
        generacionEnf++;
        if (estado.enfrentamientos) publicar({ enfrentamientos: null });
      }
    },
    /** Elige otra opción de build; un índice no válido (o sin build) se ignora. */
    async cambiarOpcion(i: number): Promise<void> {
      const sel = estado.seleccion;
      if (!sel || sel.resultado.estado === 'no_disponible' || !opcionValida(sel.resultado.build, i) || i === sel.opcion) return;
      opcionesElegidas.set(claveDe(sel), i);
      publicar({ seleccion: { ...sel, opcion: i }, importacion: null });
      await importarAutomatico();
    },
    /**
     * Elige otra página de runas (3.0.1); un índice no válido (o una build sin páginas elegibles) se ignora. Con la
     * importación automática se importa como al cambiar de opción; sin ella, se vuelve a importar solo si ya se
     * importó en esta selección de campeones (para que la página «Coach: …» sea la elegida).
     */
    async cambiarRunas(i: number): Promise<void> {
      const sel = estado.seleccion;
      if (!sel || sel.resultado.estado === 'no_disponible' || !runasValida(sel.resultado.build, i) || i === (sel.opcionRunas ?? 0)) return;
      runasElegidas.set(claveDe(sel), i);
      publicar({ seleccion: { ...sel, opcionRunas: i }, importacion: null });
      if (importable(sel.modo) && dep.obtenerAjustes().importacionAutomatica) await importarAutomatico();
      else if (importadaEn === claveDe(sel)) await importar();
    },
    async cambiarRol(rol: Rol): Promise<void> {
      // Fuera de clasificatoria no hay roles: el cambio se ignora.
      if (seleccion && tieneRoles(seleccion.modo ?? 'clasificatoria')) await mostrar(seleccion, rol);
    },
    conectado(cliente: ClienteLcu): void {
      lcu = cliente;
      publicar({ cliente: 'conectado' });
    },
    desconectado(): void {
      lcu = null;
      seleccion = null;
      ultimaAuto = null;
      importadaEn = null;
      rivales = null;
      listaRoles = null;
      generacion++;
      generacionEnf++;
      publicar({ cliente: 'esperando', seleccion: null, error: null, importacion: null, enfrentamientos: null });
    },
    async alSeleccionar(sel: SeleccionCampeon): Promise<void> {
      seleccion = sel;
      await mostrar(sel);
    },
    /** El idioma de la app cambió: los nombres de Data Dragon se vuelven a cargar y la selección se repinta en el nuevo. */
    async idiomaCambiado(): Promise<void> {
      datos = null;
      if (seleccion) await mostrar(seleccion, estado.seleccion?.rol ?? undefined);
    },
  };
}
