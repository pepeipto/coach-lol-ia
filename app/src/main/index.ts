import { app, BrowserWindow, globalShortcut, ipcMain, Menu, shell } from 'electron';
import { join } from 'node:path';
import { PREMIUM_HABILITADO, ROLES, type Rol } from '@coach/shared';
import { alCambiarIdioma, establecerIdioma, idiomaActual, idiomaDeSistema, LOCALE_DDRAGON, t } from '../shared/i18n';
import { crearActualizacionAutomatica, type Actualizador } from './actualizaciones';
import { alternarJungla, aplicarPosiciones, cargarAjustes, conservarPosicion, guardarAjustes, guardarMinimapa, migrarIdioma, normalizarAjustes, WIDGETS } from './ajustes';
import { registrarIpcAsistente } from './asistente';
import { crearGestorAtajos } from './atajo';
import { crearAtajosJungla } from './consejos/atajosJungla';
import { idDispositivo } from './dispositivo';
import { crearClienteBuilds } from './builds/clienteBuilds';
import { registrarIpcCampeones } from './campeones';
import { crearCargadorAumentos } from './datos/aumentos';
import { cargarDatosEstaticos, dirCacheDDragon, type DatosEstaticos } from './datos/estaticos';
import { asegurarInstanciaUnica } from './instancia';
import { crearEstadoOcupado } from './ocupado';
import { registrarIpcOpcion } from './ipcOpcion';
import { crearGestorLicencia, forzarPremiumDe, INTERVALO_COMPROBACION_MS, registrarIpcLicencia } from './licencia';
import { VigilanteLcu } from './lcu/vigilante';
import { configurarDirectorioLog, registrar } from './log';
import { crearOrquestadorCarga } from './orquestador/carga';
import { arrancarForzado } from './orquestador/cargaSimulada';
import { crearOrquestadorPartida } from './orquestador/partida';
import { crearOrquestadorSeleccion } from './orquestador/seleccion';
import { crearPlan } from './plan';
import { crearConectorPartida, crearSondaPartida } from './partida/conector';
import { marcarEmpaquetada, urlServidor } from './servidor';
import { crearVentanaOverlay } from './ventanas/overlay';
import { registrarControlVentana } from './ventanas/controlVentana';
import { crearControlOverlay } from './ventanas/overlayControl';
import { crearVentanaPrincipal } from './ventanas/principal';
import { registrarIpcWeb } from './web';

let ventana: BrowserWindow | null = null;
let ventanaOverlay: BrowserWindow | null = null;

function iniciar(): void {
  configurarDirectorioLog(() => join(app.getPath('userData'), 'logs'));
  registrar('info', 'Aplicación iniciada');
  const rutaAjustes = join(app.getPath('userData'), 'ajustes.json');
  const dirCache = join(app.getPath('userData'), 'cache');
  // Idioma (Fase 3): el guardado en Ajustes; sin él, el del sistema si es uno de los nuestros, y si no, español.
  const idiomaSistema = idiomaDeSistema(app.getLocale());
  const leerAjustes = () => cargarAjustes(rutaAjustes, idiomaSistema);
  establecerIdioma(migrarIdioma(rutaAjustes, idiomaSistema).idioma);
  registrar('info', `Idioma de la app: ${idiomaActual()} (sistema: ${app.getLocale()})`);
  // Las ventanas leen el idioma al cargar (síncrono, desde su preload) y lo siguen por 'coach:idioma'.
  ipcMain.on('coach:idioma-actual', (e) => {
    e.returnValue = idiomaActual();
  });

  // En la app instalada se ignoran COACH_SERVIDOR y COACH_PREMIUM (solo sirven en desarrollo).
  marcarEmpaquetada(app.isPackaged);
  const esPrincipal = (sender: unknown) => !!ventana && !ventana.isDestroyed() && sender === ventana.webContents;
  // Coach LoL IA es gratis: con PREMIUM_HABILITADO apagado (constante de compilación) no se crea el
  // gestor de licencias, no se consulta el servidor y el coach en partida funciona para todos.
  const { licencia, esPremium } = crearPlan({
    premiumHabilitado: PREMIUM_HABILITADO,
    crearLicencia: () => {
      const forzarPremium = forzarPremiumDe(process.env, app.isPackaged);
      if (forzarPremium) registrar('aviso', 'COACH_PREMIUM=1: el plan Premium está forzado');
      // Licencia Premium: se comprueba al arrancar y cada 6 h; COACH_PREMIUM=1 la fuerza (desarrollo).
      return crearGestorLicencia({
        ruta: join(app.getPath('userData'), 'licencia.json'),
        urlServidor: urlServidor(),
        forzarPremium,
        // Id anónimo del equipo (hash del MachineGuid y el nombre): vincula las licencias de prueba.
        dispositivo: (() => {
          let id: Promise<string> | null = null;
          return () => (id ??= idDispositivo({ rutaRespaldo: join(app.getPath('userData'), 'dispositivo.json') }));
        })(),
      });
    },
  });
  if (licencia) {
    licencia.alCambiar((estado) => {
      if (ventana && !ventana.isDestroyed()) ventana.webContents.send('coach:licencia', estado);
    });
    registrarIpcLicencia(ipcMain, licencia, { esPrincipal });
    void licencia.comprobar();
    const temporizadorLicencia = setInterval(() => void licencia.comprobar(), INTERVALO_COMPROBACION_MS);
    app.on('will-quit', () => clearInterval(temporizadorLicencia));
  }
  // Páginas de la web (lista blanca validada en main): /apoyar con Premium desactivado.
  registrarIpcWeb(ipcMain, { abrir: (url) => shell.openExternal(url), esPrincipal });
  // Asistente de soporte: la ventana pregunta a través de main, que valida y llama al servidor.
  registrarIpcAsistente(ipcMain, {
    urlServidor: () => urlServidor(),
    esPrincipal,
  });

  // Datos de Data Dragon compartidos por la selección y el apartado «Campeones»; si fallan, se reintenta.
  let datosEstaticos: Promise<DatosEstaticos> | null = null;
  // En el idioma de la app (es_MX, en_US, pt_BR, fr_FR, de_DE), con una caché por idioma.
  const cargarDatos = () => {
    const locale = LOCALE_DDRAGON[idiomaActual()];
    return (datosEstaticos ??= cargarDatosEstaticos(dirCacheDDragon(join(dirCache, 'ddragon'), locale), fetch, locale).catch((e: unknown) => {
      datosEstaticos = null;
      throw e;
    }));
  };
  // Nombres e iconos de los aumentos (ARAM: Caos y Arena), memorizados; desde la copia en disco se reintenta la red a los 30 min.
  const cargarAumentosMemo = crearCargadorAumentos(join(dirCache, 'cdragon'), { locale: () => LOCALE_DDRAGON[idiomaActual()] });
  // Apartado «Campeones»: la lista con tiers y la build de cualquier campeón, pedidas a través de main.
  registrarIpcCampeones(ipcMain, {
    esPrincipal,
    cargarDatos,
    builds: () => crearClienteBuilds({ urlServidor: urlServidor(), dirCache }),
    cargarAumentos: cargarAumentosMemo,
  });

  const orquestador = crearOrquestadorSeleccion({
    dirCache,
    cargarDatos,
    cargarAumentos: cargarAumentosMemo,
    obtenerAjustes: () => leerAjustes(),
    enviar: (estado) => {
      if (ventana && !ventana.isDestroyed()) ventana.webContents.send('coach:estado', estado);
    },
  });

  // Tecla rápida solo en partida o en modo mover; Esc solo en modo mover (ambas salen de él).
  const atajos = crearGestorAtajos(globalShortcut, {
    tecla: () => leerAjustes().teclaOverlay,
    alPulsar: () => (overlay.estaMoviendo() ? salirDeMover() : partida.alternar()),
    alEsc: () => salirDeMover(),
  });
  const overlay = crearControlOverlay(
    () => ventanaOverlay,
    (posiciones) => guardarAjustes(rutaAjustes, aplicarPosiciones(leerAjustes(), posiciones)),
    (activo) => {
      atajos.moviendo(activo);
      if (ventana && !ventana.isDestroyed()) ventana.webContents.send('coach:overlay-moviendo', activo);
    },
  );
  const partida = crearOrquestadorPartida({
    crearConector: crearConectorPartida,
    overlay,
    obtenerAjustes: () => leerAjustes(),
    contexto: () => orquestador.contexto(),
    avisar: (aviso) => orquestador.avisar(aviso),
    alCambiarPartida: (activa) => {
      atajos.enPartida(activa);
      if (activa) carga.partidaIniciada();
      sincronizarJungla();
    },
    esPremium,
    cargaActual: () => carga.actual(),
  });
  // Teclas opcionales de la jungla (solo en partida y con el widget activo) y Alt+Shift+L para mostrar u
  // ocultar los temporizadores (durante toda la partida).
  const atajosJungla = crearAtajosJungla(
    globalShortcut,
    (id) => partida.marcarJungla(id),
    () => cambiarAjustesOverlay(alternarJungla(leerAjustes()), true),
  );
  function sincronizarJungla(): void {
    const a = leerAjustes();
    atajosJungla.sincronizar({
      activo: partida.enPartida() && a.overlay.widgets.jungla.activo,
      enPartida: partida.enPartida(),
      teclas: a.teclasJungla,
      teclaOverlay: a.teclaOverlay,
      teclaAlternar: a.teclaJungla,
    });
  }
  /** Guarda unos ajustes del overlay que no vienen de la ventana principal y los reparte a las dos ventanas. */
  function cambiarAjustesOverlay(nuevos: ReturnType<typeof cargarAjustes>, avisarJungla = false): void {
    guardarAjustes(rutaAjustes, nuevos);
    overlay.enviarConfig(nuevos.overlay);
    sincronizarJungla();
    if (ventana && !ventana.isDestroyed()) ventana.webContents.send('coach:ajustes-cambiados', nuevos);
    if (avisarJungla) {
      const activos = nuevos.overlay.widgets.jungla.activo;
      overlay.enviarAviso({ texto: t(activos ? 'jungla.alternar.activados' : 'jungla.alternar.desactivados'), voz: false });
    }
  }
  // Pantalla de carga (modo 'carga' del overlay): de GameStart/InProgress al primer estado de la partida.
  // Va por el control del overlay, que suelta el ratón al salir de la partida.
  const carga = crearOrquestadorCarga({
    urlServidor: () => urlServidor(),
    datos: cargarDatos,
    enviarModo: (modo) => overlay.enviarModo(modo),
    enviarCarga: (estado) => overlay.enviarCarga(estado),
    mostrar: () => overlay.mostrar(),
    ocultar: () => overlay.ocultar(),
    enPartida: () => partida.enPartida(),
    rutaJunglaActiva: () => leerAjustes().junglaEnemiga.ruta,
    // En cuanto la Live Client responde, la partida se juega: la carga se retira (nunca sale en la partida).
    partidaEnVivo: crearSondaPartida(),
  });
  // Si pasa a Premium con una partida en curso, el coach empieza sin esperar a la siguiente.
  licencia?.alCambiar(() => partida.planCambiado());
  /** Sale del modo mover; fuera de partida el overlay vuelve a ocultarse. */
  function salirDeMover(): void {
    overlay.mover(false);
    if (!partida.enPartida()) overlay.ocultar();
  }
  app.on('will-quit', () => {
    atajos.liberar();
    atajosJungla.liberar();
    overlay.mover(false);
  });

  ipcMain.handle('coach:estado-actual', () => orquestador.estado());
  ipcMain.handle('coach:importar', () => orquestador.importar());
  ipcMain.handle('coach:cambiar-rol', (_e, rol: unknown) => {
    if (!ROLES.includes(rol as Rol)) throw new Error('Rol no válido');
    return orquestador.cambiarRol(rol as Rol);
  });
  registrarIpcOpcion(ipcMain, {
    cambiar: (i) => orquestador.cambiarOpcion(i),
    esPrincipal: (sender) => !!ventana && !ventana.isDestroyed() && sender === ventana.webContents,
  });
  ipcMain.handle('coach:obtener-ajustes', () => leerAjustes());
  ipcMain.handle('coach:guardar-ajustes', (_e, a: unknown) => {
    if (typeof a !== 'object' || a === null || Array.isArray(a)) throw new Error('Ajustes no válidos');
    const nuevos = conservarPosicion(normalizarAjustes(a, idiomaSistema), leerAjustes());
    guardarAjustes(rutaAjustes, nuevos);
    atajos.cambiarTecla();
    overlay.enviarConfig(nuevos.overlay);
    sincronizarJungla();
    establecerIdioma(nuevos.idioma);
  });
  // Cambio de idioma en vivo: Data Dragon en el nuevo idioma, la selección repintada y las dos ventanas avisadas.
  alCambiarIdioma((idioma) => {
    registrar('info', `Idioma de la app cambiado a ${idioma}`);
    datosEstaticos = null;
    void orquestador.idiomaCambiado();
    for (const v of [ventana, ventanaOverlay]) if (v && !v.isDestroyed()) v.webContents.send('coach:idioma', idioma);
  });

  // Modo mover: el estado vive en el control del overlay; al salir se guardan las posiciones de los widgets.
  const esOverlay = (sender: unknown) => !!ventanaOverlay && !ventanaOverlay.isDestroyed() && sender === ventanaOverlay.webContents;
  ipcMain.handle('overlay:obtener-config', (e) => (esOverlay(e.sender) ? leerAjustes().overlay : null));
  ipcMain.on('overlay:guardar-widget', (e, id: unknown, x: unknown, y: unknown) => {
    if (!esOverlay(e.sender) || !WIDGETS.includes(id as never)) return;
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
      overlay.guardarWidget(id as (typeof WIDGETS)[number], Math.round(x), Math.round(y));
    }
  });
  // Marco del minimapa calibrado en el modo mover (fracciones de la pantalla) o restablecido (null).
  ipcMain.on('overlay:guardar-minimapa', (e, marco: unknown) => {
    if (esOverlay(e.sender)) cambiarAjustesOverlay(guardarMinimapa(leerAjustes(), marco));
  });
  ipcMain.handle('coach:restablecer-minimapa', () => {
    cambiarAjustesOverlay(guardarMinimapa(leerAjustes(), null));
    return leerAjustes();
  });
  // Un widget pide el ratón solo mientras el cursor está encima; el control decide si se lo da.
  ipcMain.on('overlay:capturar-raton', (e, capturar: unknown, origen: unknown) => {
    if (!esOverlay(e.sender) || typeof capturar !== 'boolean') return;
    overlay.capturarRaton(capturar, origen === 'jungla' ? 'jungla' : 'mover');
  });
  // Clic en un campamento del widget de la jungla (la validación del id la hace el orquestador).
  ipcMain.on('overlay:jungla-marcar', (e, id: unknown) => {
    if (esOverlay(e.sender) && typeof id === 'string') partida.marcarJungla(id as never);
  });
  ipcMain.on('overlay:fijar', (e) => {
    if (e.sender === ventanaOverlay?.webContents) salirDeMover();
  });
  ipcMain.handle('coach:overlay-moviendo', () => overlay.estaMoviendo());
  ipcMain.handle('coach:mover-overlay', (_e, activar: unknown) => {
    if (typeof activar !== 'boolean') throw new Error('Valor no válido');
    if (activar) overlay.mover(true);
    else salirDeMover();
    return overlay.estaMoviendo();
  });

  // Barra de título propia: solo la ventana principal puede minimizarse, maximizarse o cerrarse así.
  registrarControlVentana(ipcMain, () => ventana);

  // Para la actualización automática: fase de la LCU + pantalla de carga + partida (nunca se reinicia en ellas).
  const estadoOcupado = crearEstadoOcupado({ carga, partida });
  const vigilante = new VigilanteLcu();
  vigilante.on('conectado', (cliente, dirLol: string) => {
    orquestador.conectado(cliente);
    partida.conectado(dirLol);
    carga.conectado(cliente);
  });
  vigilante.on('desconectado', () => {
    orquestador.desconectado();
    partida.desconectado();
    carga.desconectado();
    estadoOcupado.desconectado();
  });
  vigilante.on('fase', (fase: string) => {
    estadoOcupado.fase(fase);
    orquestador.fase(fase);
    void partida.fase(fase);
    void carga.fase(fase);
  });
  vigilante.on('seleccion', (sel) => void orquestador.alSeleccionar(sel));
  vigilante.iniciar();
  app.on('before-quit', () => vigilante.detener());

  ventanaOverlay = crearVentanaOverlay(leerAjustes());
  // La configuración llega también al control (para saber si la jungla puede pedir el ratón).
  // Tras recargar o caer, el renderizador ya no sabe que tenía el ratón: se suelta siempre.
  ventanaOverlay.webContents.on('did-finish-load', () => {
    overlay.soltarRaton();
    overlay.enviarConfig(leerAjustes().overlay);
  });
  ventanaOverlay.webContents.on('render-process-gone', () => overlay.soltarRaton());
  ventana = crearVentanaPrincipal();
  // COACH_FORZAR_PARTIDA=1: unos segundos de pantalla de carga de muestra y luego la partida simulada.
  // Se espera a que el overlay haya cargado (y montado sus oyentes): lo enviado antes se perdería.
  if (process.env.COACH_FORZAR_PARTIDA === '1') {
    const overlayListo = new Promise<void>((listo) => ventanaOverlay?.webContents.once('did-finish-load', () => setTimeout(listo, 500)));
    void arrancarForzado({ carga, datos: () => overlayListo.then(cargarDatos), arrancar: () => partida.arrancar() });
  } else partida.arrancar();
  // Sin la ventana principal no queda nada que hacer: el overlay oculto no debe mantener viva la app.
  ventana.on('closed', () => ventanaOverlay?.destroy());
  // Al arrancar la app empaquetada: busca, descarga e instala la última versión (nunca en la selección de
  // campeón, la pantalla de carga ni la partida).
  if (app.isPackaged) void actualizar({ avisar: (texto) => orquestador.avisar(texto), ocupado: () => estadoOcupado.ocupado() });
}

/** Carga electron-updater (solo en la app empaquetada) y se actualiza sola a la última versión de GitHub Releases. */
async function actualizar(o: { avisar: (texto: string | null) => void; ocupado: () => boolean }): Promise<void> {
  try {
    // electron-updater es CommonJS: según el empaquetado, el export viene con o sin `default`.
    const modulo = (await import('electron-updater')) as typeof import('electron-updater') & { default?: typeof import('electron-updater') };
    const autoUpdater = modulo.autoUpdater ?? modulo.default?.autoUpdater;
    if (!autoUpdater) throw new Error('electron-updater no expone autoUpdater');
    const actualizacion = crearActualizacionAutomatica(autoUpdater as unknown as Actualizador, {
      ocupado: o.ocupado,
      avisar: (texto) => {
        o.avisar(texto);
        if (texto) registrar('info', texto);
      },
    });
    app.on('will-quit', () => actualizacion.detener());
    await actualizacion.iniciar();
  } catch (e) {
    registrar('error', `No se pudo buscar actualizaciones: ${e instanceof Error ? e.message : String(e)}`);
  }
}

if (asegurarInstanciaUnica(app, () => ventana)) {
  // Sin menú de la aplicación: el menú por defecto de Electron está en inglés.
  Menu.setApplicationMenu(null);
  // Mismo identificador que el instalador (appId): lo necesitan las notificaciones de Windows.
  app.setAppUserModelId('com.coachlolia.app');
  void app.whenReady().then(() => {
    iniciar();
  });
  app.on('window-all-closed', () => app.quit());
}
