import { app, BrowserWindow, globalShortcut, ipcMain, Menu, Notification, shell, utilityProcess } from 'electron';
import { join } from 'node:path';
import { PREMIUM_HABILITADO, ROLES, type Rol } from '@coach/shared';
import { alCambiarIdioma, establecerIdioma, idiomaActual, idiomaDeSistema, LOCALE_DDRAGON, t } from '../shared/i18n';
import { crearActualizacionAutomatica, crearMarcaArchivo, type Actualizador } from './actualizaciones';
import { alternarJungla, aplicarPosiciones, cargarAjustes, conservarPosicion, guardarAjustes, guardarMinimapa, migrarAjustes, normalizarAjustes, WIDGETS } from './ajustes';
import { registrarIpcAsistente } from './asistente';
import { crearAtajo, crearGestorAtajos } from './atajo';
import { crearAtajoCarga } from './atajoCarga';
import { opcionesImportarManual } from './lcu/importar';
import { crearAtajosJungla } from './consejos/atajosJungla';
import { idDispositivo } from './dispositivo';
import { crearClienteBuilds } from './builds/clienteBuilds';
import { registrarIpcCampeones } from './campeones';
import { crearCargadorAumentos } from './datos/aumentos';
import { cargarDatosEstaticos, dirCacheDDragon, type DatosEstaticos } from './datos/estaticos';
import { asegurarInstanciaUnica } from './instancia';
import { crearEstadoOcupado } from './ocupado';
import { registrarIpcOpcion, registrarIpcRunas } from './ipcOpcion';
import { crearGestorLicencia, forzarPremiumDe, INTERVALO_COMPROBACION_MS, registrarIpcLicencia } from './licencia';
import { VigilanteLcu } from './lcu/vigilante';
import { configurarDirectorioLog, registrar } from './log';
import { crearOrquestadorCarga } from './orquestador/carga';
import { arrancarForzado, forzarPartidaDe } from './orquestador/cargaSimulada';
import { crearOrquestadorPartida } from './orquestador/partida';
import { panelAumentos } from './consejos/aumentosCaos';
import { chocaConLol, mismoAcelerador } from '../shared/teclas';
import { crearOrquestadorSeleccion } from './orquestador/seleccion';
import { crearPlan } from './plan';
import { crearConectorPartida, crearSondaPartida } from './partida/conector';
import { marcarEmpaquetada, urlServidor } from './servidor';
import { crearVentanaOverlay } from './ventanas/overlay';
import { registrarControlVentana } from './ventanas/controlVentana';
import { crearControlOverlay } from './ventanas/overlayControl';
import { DIR_LOL_POR_DEFECTO, leerEscalaHud } from './partida/escalaHud';
import type { EscalaHud } from '../shared/tiposApp';
import { crearVentanaPrincipal } from './ventanas/principal';
import { registrarIpcWeb } from './web';
import { programarDescargaAutomatica } from './voz/descargaAuto';
import { iniciarVozNatural } from './voz/inicioVoz';
import { marcarDinamica } from './voz/dinamicas';
import { crearCoachIa } from './ia/coachIa';
import { crearHistorial } from './ia/historial';
import { crearServicioPerfil } from './perfil/servicio';
import { aplicarArranqueWindows, arrancoOculta, crearBandeja } from './bandeja';
import { charlaPrevia, conversacion, esIdiomaIa, resumenPersonal } from './ia/coachPersonal';
import { pedirPersonal } from './ia/clienteIa';
import { esIdReto } from './perfil/retos';
import type { ClienteLcu } from './lcu/cliente';

/** Tamaño de pantalla que manda el overlay al arrastrar la flecha (o undefined si no vale). */
function tamanoPantalla(v: unknown): { ancho: number; alto: number } | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const { ancho, alto } = v as { ancho?: unknown; alto?: unknown };
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 100 && n <= 20000;
  return ok(ancho) && ok(alto) ? { ancho: Math.round(ancho), alto: Math.round(alto) } : undefined;
}

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
  establecerIdioma(migrarAjustes(rutaAjustes, idiomaSistema).idioma);
  registrar('info', `Idioma de la app: ${idiomaActual()} (sistema: ${app.getLocale()})`);
  // Las ventanas leen el idioma al cargar (síncrono, desde su preload) y lo siguen por 'coach:idioma'.
  ipcMain.on('coach:idioma-actual', (e) => {
    e.returnValue = idiomaActual();
  });
  // La ventana principal lee su tema igual, al cargar, para pintar ya con él (sin parpadeo del clásico).
  ipcMain.on('coach:tema-actual', (e) => {
    e.returnValue = leerAjustes().tema;
  });

  // En la app instalada se ignoran COACH_SERVIDOR y COACH_PREMIUM (solo sirven en desarrollo).
  marcarEmpaquetada(app.isPackaged);
  const esPrincipal = (sender: unknown) => !!ventana && !ventana.isDestroyed() && sender === ventana.webContents;
  // Voz natural (3.1): síntesis neuronal sin conexión en un proceso aparte; sin ella, la voz de Windows.
  const vozNatural = iniciarVozNatural(
    { app, ipcMain, utilityProcess },
    {
      ajustes: () => leerAjustes(),
      idioma: () => idiomaActual(),
      esPrincipal,
      esOverlay: (sender) => !!ventanaOverlay && !ventanaOverlay.isDestroyed() && sender === ventanaOverlay.webContents,
      alEstado: (estado) => {
        if (ventana && !ventana.isDestroyed()) ventana.webContents.send('voz:estado', estado);
      },
    },
  );
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
  // 3.2: coach con IA (análisis al terminar la partida y consejos de momentos muertos).
  let lcuActual: ClienteLcu | null = null;
  const coachIa = crearCoachIa({
    ajustes: () => leerAjustes(),
    idioma: () => idiomaActual(),
    urlServidor: () => urlServidor(),
    lcu: () => lcuActual,
    contexto: async () => {
      const c = await orquestador.contexto().catch(() => null);
      return c ? { build: c.build, rol: c.build ? c.rol : null, objetos: c.objetos, version: c.version, modo: c.modo } : null;
    },
    nombreCampeon: (id) => nombresCampeones.get(id.toLowerCase()),
    historial: crearHistorial(join(app.getPath('userData'), 'analisis.json')),
    enviarVoz: (f) => overlay.enviarVoz?.(f),
    enviarAviso: (a) => overlay.enviarAviso(a),
    marcarDinamica,
    alAnalisis: ({ estado, entrada }) => {
      const a = leerAjustes();
      const hablar = !!entrada && a.ia.vozAnalisis && a.overlay.voz.activa;
      if (ventana && !ventana.isDestroyed()) ventana.webContents.send('coach:analisis', { estado, ...(entrada ? { entrada, hablar } : {}) });
      if (entrada) notificarAnalisis(entrada.analisis.veredicto);
    },
  });
  /** Nombres de los campeones en el idioma de la app (Data Dragon), para el análisis. */
  const nombresCampeones = new Map<string, string>();
  let cargandoNombres = false;
  const cargarNombres = () => {
    if (cargandoNombres) return;
    cargandoNombres = true;
    void cargarDatos()
      .then((d) => {
        nombresCampeones.clear();
        for (const c of d.campeones.values()) nombresCampeones.set(c.id.toLowerCase(), c.nombre);
      })
      .catch(() => undefined)
      .finally(() => (cargandoNombres = false));
  };
  /** Notificación nativa del análisis; al pulsarla se abre la vista «Análisis». */
  function notificarAnalisis(veredicto: string): void {
    try {
      if (!Notification.isSupported()) return;
      const n = new Notification({ title: t('analisis.notificacion.titulo'), body: veredicto.slice(0, 180), silent: true });
      n.on('click', () => {
        if (!ventana || ventana.isDestroyed()) return;
        if (ventana.isMinimized()) ventana.restore();
        ventana.show();
        ventana.focus();
        ventana.webContents.send('coach:navegar', 'analisis');
      });
      n.show();
    } catch (e) {
      registrar('aviso', `No se pudo mostrar la notificación del análisis: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  ipcMain.handle('coach:analisis-historial', (e) => {
    if (!esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    return coachIa.historial();
  });
  // 3.5: perfil, historial y retos (de la LCU, guardados solo en este PC).
  const perfil = crearServicioPerfil({
    dir: join(app.getPath('userData'), 'perfil'),
    lcu: () => lcuActual,
    campeones: async () => {
      const d = await cargarDatos();
      return { version: d.version, porId: Object.fromEntries([...d.campeones.entries()].map(([k, c]) => [k, { id: c.id, nombre: c.nombre }])) };
    },
    alCambiar: (p) => {
      if (ventana && !ventana.isDestroyed()) ventana.webContents.send('coach:perfil', p);
    },
    alCompletarReto: (reto) => {
      try {
        if (!Notification.isSupported()) return;
        const n = new Notification({ title: t('coach.retoConseguido.titulo'), body: t('coach.retoConseguido.texto', { reto: t(`perfil.reto.${reto.id}.nombre`) }), silent: true });
        n.on('click', () => {
          if (!ventana || ventana.isDestroyed()) return;
          if (ventana.isMinimized()) ventana.restore();
          ventana.show();
          ventana.webContents.send('coach:navegar', 'perfil');
        });
        n.show();
      } catch {
        // sin notificaciones del sistema
      }
    },
  });
  // 3.5: coach personal (conversación con el resumen del perfil, sin nombres ni Riot ID).
  ipcMain.handle('coach:personal', async (e, mensajes: unknown) => {
    if (!esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    const conv = conversacion(mensajes);
    if (!conv) return { ok: false, error: 'no_valido' };
    const idioma = idiomaActual();
    return pedirPersonal({ idioma: esIdiomaIa(idioma) ? idioma : 'es', perfil: resumenPersonal(await perfil.perfil()), mensajes: conv }, { urlServidor: urlServidor() });
  });
  /** 3.5: charla de voz del coach personal al empezar la partida (reto y cómo te va con ese campeón). */
  async function charlaAlEmpezar(): Promise<void> {
    const a = leerAjustes();
    if (!a.ia.charlaPrevia || !a.overlay.voz.activa || !a.overlay.voz.tipos.animo) return;
    const texto = charlaPrevia(await perfil.perfil(), orquestador.estado().seleccion?.campeon.key ?? null);
    if (texto && partida.enPartida()) overlay.enviarVoz?.({ tipo: 'animo', clave: 'coach:charla', texto, prioridad: 4, caducaMs: 30_000 });
  }
  ipcMain.handle('coach:perfil', async (e, actualizar: unknown) => {
    if (!esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    if (actualizar === true) await perfil.actualizar();
    return perfil.perfil();
  });
  ipcMain.handle('coach:perfil-linea', (e, id: unknown) => {
    if (!esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    if (typeof id !== 'number' || !Number.isSafeInteger(id)) throw new Error('Partida no válida');
    return perfil.lineaTiempo(id);
  });
  ipcMain.handle('coach:perfil-reto', (e, id: unknown) => {
    if (!esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    if (id !== null && !esIdReto(id)) throw new Error('Reto no válido');
    return perfil.elegirReto(id);
  });
  ipcMain.handle('coach:analisis-estado', (e) => {
    if (!esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    return coachIa.estado();
  });

  const partida = crearOrquestadorPartida({
    crearConector: crearConectorPartida,
    overlay,
    obtenerAjustes: () => leerAjustes(),
    contexto: () => orquestador.contexto(),
    avisar: (aviso) => orquestador.avisar(aviso),
    alCambiarPartida: (activa) => {
      atajos.enPartida(activa);
      if (activa) carga.partidaIniciada();
      sincronizarEspacio();
      // Las frases fijas se preparan al empezar (si no se hizo ya en la pantalla de carga); al acabar, se suelta lo pendiente.
      if (activa) vozNatural.precalentar();
      if (activa) setTimeout(() => void charlaAlEmpezar().catch(() => undefined), 6000);
      else vozNatural.vaciarFondo();
      sincronizarJungla();
    },
    esPremium,
    cargaActual: () => carga.actual(),
    cargaActiva: () => carga.activa(),
    alEstadoIa: (estado, resumen, ctx) => {
      if (nombresCampeones.size === 0) cargarNombres();
      coachIa.alEstado(estado, resumen, {
        build: ctx.build,
        rol: ctx.tieneSeleccion ? ctx.rol : null,
        objetos: ctx.objetos,
        ...(ctx.version ? { version: ctx.version } : {}),
        ...(estado.modo ? { modo: estado.modo } : {}),
      });
    },
    // 3.4: tier list de aumentos de ARAM: Caos (encaje con el campeón; nunca % de victorias).
    panelAumentos: async (campeon) => {
      const [d, nombres] = await Promise.all([cargarDatos(), cargarAumentosMemo()]);
      const c = [...d.campeones.values()].find((x) => x.id.toLowerCase() === campeon.toLowerCase());
      return c ? panelAumentos(c, nombres) : null;
    },
  });
  // Teclas opcionales de la jungla (solo en partida y con el widget activo) y Alt+Shift+L para mostrar u
  // ocultar los temporizadores (durante toda la partida).
  const atajosJungla = crearAtajosJungla(
    globalShortcut,
    (id) => partida.marcarJungla(id),
    () => cambiarAjustesOverlay(alternarJungla(leerAjustes()), true),
  );
  // 3.4: Alt+Shift+A enseña u oculta el panel de aumentos (registrada durante la partida; solo actúa en ARAM: Caos).
  const atajoAumentos = crearAtajo(globalShortcut, () => partida.alternarAumentos());
  function sincronizarJungla(): void {
    const a = leerAjustes();
    const teclaAumentos = a.teclaAumentos.trim();
    const ocupada = [a.teclaOverlay, a.teclaJungla].some((t) => t && mismoAcelerador(t, teclaAumentos));
    if (partida.enPartida() && teclaAumentos && !ocupada && !chocaConLol(teclaAumentos)) atajoAumentos.registrar(teclaAumentos);
    else atajoAumentos.liberar();
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
    enviarModo: (modo) => {
      overlay.enviarModo(modo);
      if (modo === 'carga') vozNatural.precalentar();
    },
    enviarCarga: (estado) => overlay.enviarCarga(estado),
    mostrar: () => overlay.mostrar(),
    ocultar: () => overlay.ocultar(),
    enPartida: () => partida.enPartida(),
    rutaJunglaActiva: () => leerAjustes().junglaEnemiga.ruta,
    // En cuanto la Live Client responde, la partida se juega: la carga se retira (nunca sale en la partida).
    partidaEnVivo: crearSondaPartida(),
    // 3.1: pantalla completa, solo tarjetas o desactivada; Espacio la oculta (y solo entonces se reserva).
    ajustesCarga: () => leerAjustes().overlay.carga,
    alCambiarVisible: () => sincronizarEspacio(),
    enviarOcultar: () => overlay.enviarOcultarCarga(),
  });
  // 3.1: Espacio (ocultar la pantalla de carga) solo está reservado mientras la carga se ve; nunca en la partida.
  const atajoCarga = crearAtajoCarga(globalShortcut, () => {
    if (!partida.enPartida()) carga.ocultarPorUsuario();
  });
  function sincronizarEspacio(): void {
    atajoCarga.sincronizar({
      cargaVisible: carga.visible(),
      activado: leerAjustes().overlay.carga.ocultarConEspacio,
      enPartida: partida.enPartida(),
    });
  }
  // Si pasa a Premium con una partida en curso, el coach empieza sin esperar a la siguiente.
  licencia?.alCambiar(() => partida.planCambiado());
  /** Escala del HUD de LoL (Config/game.cfg) de la carpeta del cliente conectado o, sin él, la de por defecto. */
  let dirLolConocido: string | null = null;
  let hudActual: EscalaHud | null = null;
  async function actualizarHud(): Promise<void> {
    const hud = await leerEscalaHud(dirLolConocido ?? DIR_LOL_POR_DEFECTO);
    if (JSON.stringify(hud) === JSON.stringify(hudActual)) return;
    hudActual = hud;
    registrar('info', `Escala del HUD de LoL: ${hud ? JSON.stringify(hud) : 'desconocida'}`);
    overlay.enviarHud(hud);
  }
  void actualizarHud();
  /** Sale del modo mover; fuera de partida el overlay vuelve a ocultarse. */
  function salirDeMover(): void {
    overlay.mover(false);
    if (!partida.enPartida()) overlay.ocultar();
  }
  app.on('will-quit', () => {
    atajoCarga.liberar();
    atajos.liberar();
    atajosJungla.liberar();
    atajoAumentos.liberar();
    overlay.mover(false);
  });

  ipcMain.handle('coach:estado-actual', () => orquestador.estado());
  // «Importar» (manual). 3.1: sin páginas de runas libres, solo se sustituye una si el jugador lo confirmó (id de la
  // página) o marcó «No volver a preguntar»; la importación automática no pasa por aquí y nunca borra nada.
  ipcMain.handle('coach:importar', (e, o: unknown) => {
    if (!esPrincipal(e.sender)) throw new Error('Remitente no permitido');
    return orquestador.importar(opcionesImportarManual(o, leerAjustes().sustituirPaginaSinPreguntar === true));
  });
  ipcMain.handle('coach:cambiar-rol', (_e, rol: unknown) => {
    if (!ROLES.includes(rol as Rol)) throw new Error('Rol no válido');
    return orquestador.cambiarRol(rol as Rol);
  });
  registrarIpcOpcion(ipcMain, {
    cambiar: (i) => orquestador.cambiarOpcion(i),
    esPrincipal: (sender) => !!ventana && !ventana.isDestroyed() && sender === ventana.webContents,
  });
  registrarIpcRunas(ipcMain, {
    cambiar: (i) => orquestador.cambiarRunas(i),
    esPrincipal: (sender) => !!ventana && !ventana.isDestroyed() && sender === ventana.webContents,
  });
  ipcMain.handle('coach:obtener-ajustes', () => leerAjustes());
  ipcMain.handle('coach:guardar-ajustes', (_e, a: unknown) => {
    if (typeof a !== 'object' || a === null || Array.isArray(a)) throw new Error('Ajustes no válidos');
    const nuevos = conservarPosicion(normalizarAjustes(a, idiomaSistema), leerAjustes());
    guardarAjustes(rutaAjustes, nuevos);
    aplicarArranqueWindows(nuevos.arranqueWindows);
    atajos.cambiarTecla();
    sincronizarEspacio();
    overlay.enviarConfig(nuevos.overlay);
    sincronizarJungla();
    establecerIdioma(nuevos.idioma);
  });
  // Cambio de idioma en vivo: Data Dragon en el nuevo idioma, la selección repintada y las dos ventanas avisadas.
  alCambiarIdioma((idioma) => {
    registrar('info', `Idioma de la app cambiado a ${idioma}`);
    datosEstaticos = null;
    nombresCampeones.clear();
    void orquestador.idiomaCambiado();
    for (const v of [ventana, ventanaOverlay]) if (v && !v.isDestroyed()) v.webContents.send('coach:idioma', idioma);
  });

  // Modo mover: el estado vive en el control del overlay; al salir se guardan las posiciones de los widgets.
  const esOverlay = (sender: unknown) => !!ventanaOverlay && !ventanaOverlay.isDestroyed() && sender === ventanaOverlay.webContents;
  ipcMain.handle('overlay:obtener-config', (e) => (esOverlay(e.sender) ? leerAjustes().overlay : null));
  ipcMain.on('overlay:guardar-widget', (e, id: unknown, x: unknown, y: unknown, pantalla: unknown) => {
    if (!esOverlay(e.sender) || !WIDGETS.includes(id as never)) return;
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y)) {
      overlay.guardarWidget(id as (typeof WIDGETS)[number], Math.round(x), Math.round(y), tamanoPantalla(pantalla));
    }
  });
  // Escala del HUD de LoL (game.cfg, solo lectura): la última leída, para el overlay al cargar.
  ipcMain.handle('overlay:obtener-hud', (e) => (esOverlay(e.sender) ? hudActual : null));
  // Marco del minimapa calibrado en el modo mover (fracciones de la pantalla) o restablecido (null).
  ipcMain.on('overlay:guardar-minimapa', (e, marco: unknown) => {
    if (esOverlay(e.sender)) cambiarAjustesOverlay(guardarMinimapa(leerAjustes(), marco));
  });
  // Solo desde la ventana principal (el botón de los ajustes del overlay), nunca desde el propio overlay.
  ipcMain.handle('coach:restablecer-minimapa', (e) => {
    if (!esPrincipal(e.sender)) return null;
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
    if (activar) {
      overlay.mover(true);
      void actualizarHud();
    } else salirDeMover();
    return overlay.estaMoviendo();
  });

  // Barra de título propia: solo la ventana principal puede minimizarse, maximizarse o cerrarse así.
  registrarControlVentana(ipcMain, () => ventana);

  // Para la actualización automática: fase de la LCU + pantalla de carga + partida (nunca se reinicia en ellas).
  const estadoOcupado = crearEstadoOcupado({ carga, partida });
  const vigilante = new VigilanteLcu();
  vigilante.on('conectado', (cliente, dirLol: string) => {
    lcuActual = cliente;
    dirLolConocido = dirLol;
    void actualizarHud();
    orquestador.conectado(cliente);
    partida.conectado(dirLol);
    carga.conectado(cliente);
    // 3.5: el perfil se pone al día al abrir el cliente (con un margen: el cliente tarda en tener el historial).
    setTimeout(() => void perfil.actualizar(), 8000);
  });
  vigilante.on('desconectado', () => {
    lcuActual = null;
    orquestador.desconectado();
    partida.desconectado();
    carga.desconectado();
    estadoOcupado.desconectado();
  });
  vigilante.on('fase', (fase: string) => {
    // Al empezar la partida se vuelve a leer la escala del HUD (el jugador pudo cambiarla).
    if (fase === 'GameStart' || fase === 'InProgress') void actualizarHud();
    estadoOcupado.fase(fase);
    orquestador.fase(fase);
    // 3.6: al empezar la selección de campeón, la ventana aparece (sin quitar el foco al cliente de LoL).
    if (fase === 'ChampSelect' && leerAjustes().alFrenteEnSeleccion && ventana && !ventana.isDestroyed()) {
      if (ventana.isMinimized()) ventana.restore();
      if (!ventana.isVisible()) ventana.showInactive();
    }
    void partida.fase(fase);
    void carga.fase(fase);
    void coachIa.fase(fase);
    // 3.5: al terminar la partida, el historial y el rango nuevos (el cliente tarda unos segundos en tenerlos).
    if (fase === 'EndOfGame') for (const ms of [15_000, 60_000]) setTimeout(() => void perfil.actualizar(), ms);
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
  ventana = crearVentanaPrincipal({ oculta: arrancoOculta() });
  // 3.6: bandeja del sistema. Con «Seguir en la bandeja», cerrar la ventana solo la esconde: el overlay, la voz, el
  // análisis y el perfil siguen funcionando. «Salir» (menú de la bandeja) cierra la app de verdad.
  let saliendo = false;
  let avisoBandejaDado = false;
  const mostrarVentana = () => {
    if (!ventana || ventana.isDestroyed()) return;
    if (ventana.isMinimized()) ventana.restore();
    ventana.show();
    ventana.focus();
  };
  const bandeja = crearBandeja({ mostrar: mostrarVentana, salir: () => app.quit() });
  app.on('before-quit', () => (saliendo = true));
  ventana.on('close', (e) => {
    if (saliendo || !bandeja || !leerAjustes().bandeja) return;
    e.preventDefault();
    ventana?.hide();
    if (!avisoBandejaDado && Notification.isSupported()) {
      avisoBandejaDado = true;
      new Notification({ title: t('bandeja.sigueTitulo'), body: t('bandeja.sigueTexto'), silent: true }).show();
    }
  });
  alCambiarIdioma(() => bandeja?.actualizarIdioma());
  aplicarArranqueWindows(leerAjustes().arranqueWindows);
  // COACH_FORZAR_PARTIDA=1 (solo en desarrollo): unos segundos de pantalla de carga de muestra y luego la
  // partida simulada. Se espera a que el overlay haya cargado (y montado sus oyentes): lo enviado antes se perdería.
  if (forzarPartidaDe(process.env, app.isPackaged)) {
    const overlayListo = new Promise<void>((listo) => ventanaOverlay?.webContents.once('did-finish-load', () => setTimeout(listo, 500)));
    void arrancarForzado({ carga, datos: () => overlayListo.then(cargarDatos), arrancar: () => partida.arrancar() });
  } else partida.arrancar();
  // Sin la ventana principal no queda nada que hacer: el overlay oculto no debe mantener viva la app.
  ventana.on('closed', () => ventanaOverlay?.destroy());
  // Al arrancar la app empaquetada: busca, descarga e instala la última versión (nunca en la selección de
  // campeón, la pantalla de carga ni la partida).
  if (app.isPackaged) void actualizar({ avisar: (texto) => orquestador.avisar(texto), ocupado: () => estadoOcupado.ocupado() });
  // 3.1: la voz natural (y la pregrabada si hay paquete) se descarga sola en segundo plano, nunca en partida.
  const detenerDescargaVoz = programarDescargaAutomatica({
    motor: () => leerAjustes().overlay.voz.motor,
    pendiente: () => {
      const e = vozNatural.estado();
      return !e.naturalInstalada || (e.packDisponible && !e.packInstalado);
    },
    ocupado: () => estadoOcupado.ocupado(),
    descargar: () => vozNatural.descargar(),
    // Si empieza la selección, la carga o la partida mientras descarga, se corta (lo bajado se reanuda luego).
    cancelar: () => vozNatural.cancelarDescarga(),
  });
  app.on('will-quit', () => detenerDescargaVoz());
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
      // Marca del último intento en userData: si la instalación silenciosa falla, no hay bucle de reinicios.
      versionActual: app.getVersion(),
      marca: crearMarcaArchivo(join(app.getPath('userData'), 'actualizacion.json')),
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
