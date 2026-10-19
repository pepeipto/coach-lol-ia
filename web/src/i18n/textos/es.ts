// Textos de la web en español (idioma por defecto y referencia de la estructura del resto de idiomas).
// Marcado admitido en los textos largos: ver ../md.ts (**negrita**, *cursiva*, `código`, [enlace](@pagina#ancla)).
import { MIN_PARTIDAS_BUILD, PARTIDAS_DATOS_LIMITADOS } from '../../lib/cifras.ts';

const CORREO = 'support@coachlolia.com';

export const es = {
  meta: {
    lema: 'Tu coach de League of Legends, en español y en tiempo real.',
    paginas: {
      inicio: {
        titulo: 'Coach LoL IA: builds, tier list y overlay de LoL gratis',
        descripcion:
          'App gratis para League of Legends en español: builds Esmeralda+, runas en un clic, tier list y un coach con overlay y voz. Solo API oficiales de Riot.',
      },
      descargar: {
        titulo: 'Descargar Coach LoL IA gratis para Windows 10 y 11',
        descripcion:
          'Descarga gratis Coach LoL IA para Windows 10 y 11: builds de LoL, importación de runas y overlay con voz. Instalador oficial con actualizaciones automáticas.',
      },
      apoyar: {
        titulo: 'Apoya Coach LoL IA, la app de LoL gratis para todos',
        descripcion:
          'Coach LoL IA es gratis y no tiene anuncios dentro de la app. Descubre cómo se financia el proyecto y cómo apoyarlo con una donación voluntaria.',
      },
      novedades: {
        titulo: 'Novedades de Coach LoL IA: versiones y cambios de la app',
        descripcion:
          'Todas las versiones de Coach LoL IA, de la más reciente a la más antigua: overlay por widgets, pantalla de carga, tier list, ARAM, Arena y mucho más.',
      },
      builds: {
        titulo: 'Builds de LoL y tier list con datos Esmeralda+ | Coach LoL IA',
        descripcion:
          'Así calcula Coach LoL IA sus builds de League of Legends y su tier list: partidas Esmeralda+ de EUW, LAN y LAS, recalculadas cada 6 horas.',
      },
      guias: {
        titulo: 'Guías de LoL: overlay seguro, tier list y runas | Coach LoL IA',
        descripcion:
          'Guías de League of Legends en español: cómo usar un overlay respetando las normas de Riot, cómo leer una tier list y cómo importar runas solas.',
      },
      guiaOverlay: {
        titulo: 'Cómo usar un overlay en LoL de forma segura | Coach LoL IA',
        descripcion:
          'Qué permite Riot a un overlay de League of Legends, qué señales indican que una app se pasa de la raya y cómo configurarlo en modo Sin bordes.',
      },
      guiaTierList: {
        titulo: 'Qué es una tier list de LoL y cómo leerla | Coach LoL IA',
        descripcion:
          'Qué significa estar en tier S, A, B o C en League of Legends, cómo se calcula una tier list con victorias y uso, y por qué el tamaño de la muestra importa.',
      },
      guiaRunas: {
        titulo: 'Cómo importar runas automáticamente en LoL | Coach LoL IA',
        descripcion:
          'Paso a paso para importar runas, hechizos y objetos en League of Legends con un clic desde la selección de campeón, sin borrar tus páginas de runas.',
      },
      privacidad: {
        titulo: 'Política de privacidad · Coach LoL IA',
        descripcion: 'Qué datos trata Coach LoL IA, para qué, con qué base jurídica y cuáles son tus derechos sobre ellos.',
      },
      terminos: {
        titulo: 'Términos de uso · Coach LoL IA',
        descripcion: 'Condiciones de uso de Coach LoL IA, una app gratuita para League of Legends que solo usa las API oficiales de Riot.',
      },
      cookies: {
        titulo: 'Política de cookies · Coach LoL IA',
        descripcion: 'Qué cookies usa la web de Coach LoL IA, cuándo se cargan los anuncios y cómo cambiar tu elección en cualquier momento.',
      },
      noEncontrada: {
        titulo: 'Página no encontrada · Coach LoL IA',
        descripcion: 'La página que buscas no existe o ha cambiado de dirección.',
      },
    },
    ogAlt: 'Coach LoL IA: builds, tier list y coach en partida para League of Legends, gratis.',
  },

  comun: {
    saltar: 'Saltar al contenido',
    menuAbrir: 'Abrir el menú',
    menuCerrar: 'Cerrar el menú',
    inicioAria: 'Coach LoL IA, inicio',
    navAria: 'Principal',
    idioma: 'Idioma',
    idiomaAria: 'Cambiar de idioma',
    nav: {
      queHace: 'Qué hace',
      enAccion: 'En acción',
      builds: 'Builds y tier list',
      guias: 'Guías',
      faq: 'FAQ',
      novedades: 'Novedades',
    },
    descargar: 'Descargar',
    apoyar: 'Apoyar',
    descargarWindows: 'Descargar para Windows',
    apoyaProyecto: 'Apoya el proyecto',
    capturaReal: 'Captura real',
    publicidad: 'Publicidad',
    migas: 'Ruta de navegación',
    inicio: 'Inicio',
    ayudaTitulo: '¿Necesitas ayuda?',
    ayudaTexto: 'Escríbenos y te responderemos lo antes posible.',
    soporteAria: 'Soporte',
    leerGuia: 'Leer la guía',
    actualizado: 'Actualizado el',
  },

  pie: {
    descripcion: 'Coach en tiempo real para League of Legends, en 5 idiomas. Versión',
    soporte: 'Soporte',
    producto: 'Producto',
    proyecto: 'Proyecto',
    legal: 'Legal',
    recursos: 'Recursos',
    idiomas: 'Idiomas',
    enlaces: {
      descargar: 'Descargar',
      novedades: 'Novedades',
      apoyar: 'Apoya el proyecto',
      hojaDeRuta: 'Hoja de ruta',
      arquitectura: 'Arquitectura',
      seguridad: 'Seguridad y Vanguard',
      calidad: 'Calidad',
      github: 'Código en GitHub',
      builds: 'Builds y tier list',
      guias: 'Guías',
      privacidad: 'Privacidad',
      terminos: 'Términos',
      cookies: 'Cookies',
    },
    marca:
      'League of Legends es una marca registrada de Riot Games, Inc. Imágenes de League of Legends © Riot Games, Inc.',
  },

  cookies: {
    region: 'Consentimiento de cookies',
    titulo: 'Cookies y publicidad',
    texto:
      'Esta web muestra anuncios de Google AdSense, que usan cookies de terceros. Solo se cargan si los aceptas. Puedes cambiar de opinión en cualquier momento desde la página de',
    enlace: 'cookies',
    rechazar: 'Rechazar',
    aceptar: 'Aceptar',
  },

  asistente: {
    boton: 'Asistente IA',
    titulo: 'Asistente IA de Coach LoL IA',
    cerrar: 'Cerrar el asistente',
    intro: 'Pregúntame cómo instalar la app, importar builds o usar el overlay.',
    conversacion: 'Conversación',
    pregunta: 'Tu pregunta',
    placeholder: 'Escribe tu pregunta…',
    enviar: 'Enviar',
    nota: `Respuestas generadas por IA; pueden contener errores. Si tienes un problema, escribe a ${CORREO}.`,
    escribiendo: 'Escribiendo…',
    tu: 'Tú: ',
    asistente: 'Asistente: ',
    errores: {
      noDisponible: `El asistente aún no está disponible. Mientras tanto, escríbenos a ${CORREO}.`,
      limite: 'Has hecho muchas preguntas seguidas. Espera un rato y vuelve a intentarlo.',
      fallo: 'El asistente no ha podido responder ahora. Inténtalo de nuevo en unos minutos.',
      noValido: 'No he podido enviar tu mensaje. Escribe una pregunta de hasta 1000 caracteres.',
      sinConexion: 'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
    },
  },

  diagrama: {
    aria: 'Diagrama de arquitectura (desplázalo en horizontal en pantallas estrechas)',
    titulo: 'Arquitectura de Coach LoL IA',
    desc: 'En el PC del jugador, la app (Electron) se conecta al cliente de League of Legends por la LCU API y a la partida por la Live Client Data API en 127.0.0.1:2999. En la nube, el servidor de builds (Fastify y SQLite) recoge partidas de la API de Riot, las agrega cada 6 horas y sirve las builds a la app por HTTPS. La app descarga nombres e iconos de Data Dragon. La web (Astro, GitHub Pages) y la vista Ayuda de la app preguntan al asistente IA del servidor, que genera las respuestas con Anthropic. La app solo usa las API oficiales de Riot y no toca el proceso del juego.',
    pc: 'PC DEL JUGADOR · WINDOWS 10/11',
    nube: 'NUBE',
    cliente: 'Cliente de LoL',
    clienteSub: 'lobby y selección',
    partida: 'Partida en curso',
    partidaSub: 'el juego (sin tocarlo)',
    vanguard1: 'no lee memoria ni inyecta;',
    vanguard2: 'sin capturas ni teclas',
    procesoPrincipal: 'PROCESO PRINCIPAL (Node.js)',
    conectorLcu: 'Conector LCU',
    conectorPartida: 'Conector de partida · cada 1 s',
    motor: 'Motor de consejos (reglas)',
    clienteBuilds: 'Cliente de builds + caché',
    asistenteSoporte: 'Asistente de soporte',
    datosEstaticos: 'Datos estáticos',
    ventana: 'Ventana principal (React)',
    ventanaSub: 'build, importar, ajustes',
    overlay: 'Overlay (React)',
    overlaySub: 'transparente, clics pasantes, voz',
    servidor: 'Servidor · Fastify + SQLite',
    recolector: 'Recolector',
    recolectorSub: 'Solo/Dúo, Esmeralda+, EUW · LAN · LAS',
    agregador: 'Agregador · cada 6 h',
    agregadorSub: `≥ 200 partidas por parche · mínimo ${MIN_PARTIDAS_BUILD}`,
    api: 'API pública',
    asistenteIa: 'Asistente IA',
    asistenteIaSub: 'POST /api/asistente · con límites de uso',
    apiRiot: 'API de Riot',
    modeloIa: 'modelo del asistente IA',
    dataDragonSub: 'nombres e iconos',
    estaWeb: 'Esta web',
    claves1: 'RIOT_API_KEY y ANTHROPIC_API_KEY solo existen como',
    claves2: 'variables de entorno del servidor.',
    ayuda: 'ayuda',
    parche: 'parche',
    partidas: 'partidas',
    pie: 'Diagrama de arquitectura. Las flechas azules son los datos de juego y builds; las doradas, las preguntas al asistente IA.',
    respuestas: 'respuestas',
  },

  inicio: {
    etiquetaVersion: 'Nueva versión',
    hero: {
      desc: 'Builds de jugadores Esmeralda+ en la selección de campeón, importadas al cliente en un clic, una pantalla de carga con los dos equipos y un coach que te avisa durante la partida con un overlay por widgets y voz. Solo con las API oficiales de Riot.',
      meta: 'Gratis · Windows 10/11 · Solo API oficiales de Riot · Código en',
      capturaAlt:
        'Captura de Coach LoL IA en la vista Campeón: Ahri en el rol Central con su porcentaje de victorias, 33 partidas y datos del parche 16.20, y el botón Importar; runas de Dominación y Brujería, hechizos Destello e Ignición, objetos de inicio, núcleo y botas, y la tabla del orden de habilidades con prioridad Q, W, E.',
      capturaPie: 'Vista Campeón con datos reales del servidor de builds.',
    },
    cifras: [
      ['Regiones', 'EUW · LAN · LAS'],
      ['Partidas analizadas', 'Esmeralda+'],
      ['Refresco de builds', 'cada 6 h'],
    ],
    cifraPruebas: 'Pruebas automáticas',

    enAccion: {
      antetitulo: 'En acción',
      titulo: 'Míralo en acción',
      intro:
        'Clips reales: una partida de Zed en la jungla con el overlay abierto y un recorrido por la app. Los vídeos no tienen sonido y se cargan solo cuando llegas a ellos.',
      videos: {
        partida: {
          titulo: 'El coach en una partida real',
          texto:
            'Cuenta atrás de los objetivos, tu CS y tu KDA en directo y la flecha que marca qué habilidad subir. Grabación de una partida real de Zed en la jungla.',
          etiqueta:
            'Vídeo de una partida real de League of Legends con Zed en la jungla: el overlay de Coach LoL IA enseña arriba la cuenta atrás de los objetivos, el dragón en 0:38, el widget de CS y KDA en verde y la flecha dorada al subir de nivel.',
        },
        tour: {
          titulo: 'Recorrido por Coach LoL IA 3.0',
          texto:
            'Pantalla de carga (con jugadores de ejemplo), build Esmeralda+, importación en un clic, avisos, temporizadores de jungla, tier list y los modos ARAM y Arena.',
          etiqueta:
            'Vídeo de presentación de Coach LoL IA 3.0: pantalla de carga con datos de ejemplo, build de Ahri en el rol Central, botón Importar, overlay con objetivos, aviso de compra, CS y KDA, temporizadores sobre un minimapa esquemático y tier list por rol y modo.',
        },
      },
      textosVideo: '',
      reproducir: 'Reproducir',
      fotos: [
        {
          nombre: 'partida-objetivos',
          alt: 'Captura de una partida real de League of Legends con Zed en la jungla en el minuto 4:22: arriba, la barra de objetivos de Coach LoL IA con el dragón en 0:38, y a la derecha el widget de CS (20, a 4,6 por minuto) y KDA 0/0/1.',
          pie: 'Barra de objetivos y CS en una partida real (minuto 4).',
        },
        {
          nombre: 'partida-dragon',
          alt: 'Captura de una partida real de League of Legends: Zed tras el aviso «Enemigo asesinado», con la barra de objetivos de Coach LoL IA arriba (dragón en 0:20) y el widget de CS, ya en verde a 6,4 por minuto, en la esquina superior derecha.',
          pie: 'El widget de CS se pone en verde al superar tu objetivo.',
        },
      ],
    },

    queHace: {
      antetitulo: 'Qué hace',
      titulo: 'Todo lo que necesitas, de la selección a la victoria',
      intro:
        'Coach LoL IA te acompaña en los dos momentos que más cuentan: la selección de campeón, donde prepara tu build, y la partida, donde te recuerda lo importante sin que tengas que salir del juego.',
      funciones: [
        {
          icono: 'capas',
          titulo: 'Builds por campeón y rol',
          texto:
            'Runas, hechizos, objetos iniciales, núcleo de 3 objetos, botas, situacionales y orden de habilidades, con su porcentaje de victorias y el número de partidas que lo respaldan. Se publican desde 10 partidas; las que tienen pocas llevan la insignia «Datos limitados».',
        },
        {
          icono: 'grafico',
          titulo: 'Campeones y tier list',
          texto:
            'El apartado Campeones ordena a todos los campeones por rol en los tiers S, A, B y C según sus victorias y su uso, con búsqueda y la build completa de cada uno.',
        },
        {
          icono: 'usuario',
          titulo: 'Pantalla de carga',
          texto:
            'Mientras carga la partida, el overlay enseña a pantalla completa a los diez jugadores, con tu tarjeta resaltada: rango oficial, maestría y victorias del campeón en su rol, con etiquetas solo positivas o neutras. Espacio la oculta.',
        },
        {
          icono: 'descarga',
          titulo: 'Importación en un clic',
          texto:
            'Crea la página de runas «Coach: <Campeón> <Rol>», elige los hechizos y añade un conjunto de objetos a la tienda. Solo toca páginas con el prefijo «Coach:»; si no te queda ninguna libre, sustituye una de las tuyas únicamente si pulsas «Importar» y lo confirmas.',
        },
        {
          icono: 'brujula',
          titulo: 'Rol automático',
          texto:
            'Toma el rol que te asigna el cliente. Si no hay ninguno, usa el más jugado con ese campeón, y puedes cambiarlo con el selector de rol.',
        },
        {
          icono: 'monitor',
          titulo: 'Overlay por widgets',
          texto:
            'Barra de objetivos arriba (con el tipo del próximo dragón), una flecha sobre la habilidad que toca subir, tu CS y tu KDA, el aviso de compra y los avisos. Cada widget se mueve, se escala y se apaga por separado.',
        },
        {
          icono: 'voz',
          titulo: 'Mucha más voz',
          texto:
            'Voz natural neuronal y sin conexión en los 5 idiomas, con 460 frases por idioma y sus variantes: objetivos, compras, farmeo, visión, peleas, fases y jungla, de una en una y la más urgente primero. Eliges el nivel de detalle y qué categorías oír.',
        },
        {
          icono: 'reloj',
          titulo: 'Temporizadores de jungla',
          texto:
            'Opcionales y apagados por defecto: marcas tú cuándo limpias un campamento de tu lado o un Escarabajo y la app cuenta su reaparición, también encima del minimapa.',
        },
        {
          icono: 'diana',
          titulo: 'ARAM, ARAM: Caos y Arena',
          texto:
            'Cada modo con sus builds y su tier list (con aumentos en ARAM: Caos y Arena), y un overlay que en cada modo enseña solo lo que tiene sentido.',
        },
        {
          icono: 'nube',
          titulo: 'Funciona sin conexión',
          texto:
            'Guarda en caché las últimas builds. Si el servidor no responde, la app usa la copia guardada y te lo indica: «Datos sin conexión (parche X)».',
        },
        {
          icono: 'refrescar',
          titulo: 'Se actualiza sola',
          texto:
            'Al abrirla, la app descarga la última versión desde GitHub Releases, la instala y se vuelve a abrir; nunca en medio de una partida, que espera a que termine. Data Dragon y las builds siguen el parche actual.',
        },
        {
          icono: 'idioma',
          titulo: 'En 5 idiomas',
          texto:
            'La app, el overlay, la voz y el asistente en español, inglés, portugués (Brasil), francés y alemán. Elige el idioma en Ajustes; por defecto, el de tu Windows. Esta web, también en los cinco.',
        },
      ],
      vitrina: {
        titulo: 'Tú decides qué te dice el coach',
        texto:
          'Desde la vista Overlay ves una vista previa de los widgets, eliges cuáles quieres, su tamaño y dónde van, y decides qué te dice la voz: el nivel de detalle (Básico, Normal o Completo) y cada categoría por separado.',
        lista: [
          'Vista previa de los widgets tal y como se verán en partida',
          '«Mover y calibrar» para colocar cada widget donde no tape nada',
          'Opacidad general, y tamaño y un interruptor para cada widget',
          'Voz natural o de Windows, volumen, nivel de detalle y categorías, con «Probar voz»',
        ],
        alt: 'Captura de la vista Overlay de Coach LoL IA: vista previa con la barra de objetivos, el CS y el KDA, el aviso «Nivel 6: sube la R», la flecha sobre la R y el aviso de compra; a la derecha, el botón «Mover y calibrar», la opacidad y los interruptores y tamaños de los widgets Objetivos, Flecha de habilidad y Rendimiento (CS y KDA).',
        pie: 'Vista Overlay: widgets, posición, tamaño y voz.',
      },
    },

    novedades3: {
      antetitulo: 'Novedades de la 3.0',
      titulo: 'Antes, durante y entre partidas',
      intro:
        'La 3.0 suma la pantalla de carga, el apartado Campeones con su tier list, los modos ARAM, ARAM: Caos y Arena, y los temporizadores de jungla. La 3.0.1 y la 3.0.2 añaden runas seleccionables, el tema «Sombra» y un overlay que se adapta a pantallas 2K y 4K. Todo con datos que el juego o la API oficial de Riot ya ofrecen. [Ver todas las novedades](@novedades).',
      carga: {
        titulo: 'Pantalla de carga',
        texto:
          'Mientras carga la partida, el overlay coloca a los diez jugadores como el juego: los rivales arriba y tu equipo abajo. De cada uno ves el rango oficial de Solo/Dúo, la maestría con su campeón y las victorias de ese campeón en su rol.',
        lista: [
          'Etiquetas solo positivas o neutras: «Especialista en…», «Escala a final de partida»',
          'Sin MMR inventado ni etiquetas negativas para nadie',
          'Se oculta sola en cuanto empieza la partida',
        ],
        alt: 'Captura de la pantalla de carga en el overlay de Coach LoL IA: diez tarjetas de jugadores con nombres de ejemplo, cinco rivales arriba y cinco aliados abajo, cada una con el campeón, el rol, el rango (de Oro a Diamante, o Sin clasificar), las victorias y derrotas, la maestría, el porcentaje de victorias del campeón y etiquetas como «Especialista en Darius», «Racha positiva esta temporada» o «Protege a su equipo».',
        pie: 'Pantalla de carga con jugadores de ejemplo.',
      },
      campeones: {
        titulo: 'Campeones y tier list',
        texto:
          'Todos los campeones por rol, con su tier (S, A, B o C) según sus victorias y su uso, el número de partidas y la build completa con un clic. Un selector cambia entre Clasificatoria, ARAM, ARAM: Caos y Arena.',
        lista: [
          'Búsqueda, filtro por rol y orden por tier, victorias, uso o partidas',
          'Aviso «Datos limitados» en los que tienen menos de 30 partidas',
          'En Arena, posición media y porcentaje de top 4',
        ],
        alt: 'Captura del apartado Campeones de Coach LoL IA: tier list de Clasificatoria con datos del parche 16.20, el selector de modo (Clasificatoria, ARAM, ARAM: Caos, Arena), la búsqueda, los filtros por rol y una tabla con el campeón, el rol, el tier, las victorias, el uso y las partidas; arriba, Yunara y Viego en tier S, y más abajo campeones en tier B con el aviso de datos limitados.',
        pie: 'Apartado Campeones: tier list por modo y rol.',
        enlace: 'Cómo se calculan las builds y la tier list',
      },
      jungla: {
        titulo: 'Temporizadores de jungla, a tu manera',
        texto:
          'Opcionales y apagados por defecto. Cuando limpias un campamento de tu lado o un Escarabajo, lo marcas con un clic o con tu tecla, y la app cuenta su reaparición encima del minimapa, como los del juego. Con Alt+Mayús+L los muestras u ocultas.',
        lista: [
          'Solo tu jungla y los dos Escarabajos: nunca los campamentos del rival',
          'Dorado en los últimos 30 segundos y una marca cuando el campamento ya está',
          '«El Gromp en 30 segundos» por voz, si lo quieres',
        ],
        alt: 'Detalle de los temporizadores de jungla de Coach LoL IA sobre un minimapa esquemático del lado azul: cuentas atrás de 15 s y 1:40 en dos campamentos, 1:08 y 1:13 en otros dos, y una marca de verificación en los que ya han reaparecido.',
        pie: 'Temporizadores sobre el minimapa (esquema del mapa).',
      },
    },

    comoFunciona: {
      antetitulo: 'Cómo funciona',
      titulo: 'De la selección de campeón a la partida',
      intro: 'Sin configuración: abre la app antes o después del cliente y ella se encarga del resto.',
      pasos: [
        {
          titulo: 'Abre la app y el cliente de LoL',
          texto:
            'Coach LoL IA localiza el cliente leyendo su archivo lockfile (puerto y contraseña locales). Mientras no lo encuentra muestra «Esperando al cliente de League of Legends…» y lo vuelve a intentar cada 3 segundos.',
          detalle: 'LCU API · WebSocket',
        },
        {
          titulo: 'Elige campeón',
          texto:
            'El cliente avisa por WebSocket del campeón y el rol. La app pide la build al servidor y la muestra en menos de 2 segundos. Con «Importar» (o con la importación automática) aplica runas, hechizos y objetos.',
          detalle: 'Selección de campeón',
        },
        {
          titulo: 'Juega con el coach',
          texto:
            'Mientras carga, el overlay enseña la pantalla de carga con los dos equipos. Ya en partida, la app consulta la Live Client Data API en https://127.0.0.1:2999 cada segundo. El motor de consejos compara tu estado con la build y muestra los objetivos, la habilidad que toca subir, tu CS y tu KDA, la próxima compra y los avisos. Ctrl+Mayús+O lo oculta o lo muestra.',
          detalle: 'Live Client Data API',
        },
        {
          titulo: 'Fin de la partida',
          texto:
            'Cuando la partida termina, el overlay se oculta y la app deja de consultar el puerto 2999. La siguiente selección de campeón vuelve a empezar el ciclo.',
          detalle: 'Sin procesos residuales',
        },
      ],
      overlay: {
        alt: 'Captura del overlay de Coach LoL IA sobre el arte de Jinx: arriba, la barra de objetivos (larvas ya disponibles, dragón en 0:38, Heraldo en 5:38 y Barón en 10:38); a la derecha, el CS (61, a 6,5 por minuto frente a un objetivo de 8); a la izquierda, el aviso «Nivel 6: sube la R»; abajo, una flecha sobre la R y el aviso «Ya puedes comprar Huracán de Runaan».',
        pie: 'Overlay en partida, con cada widget en su sitio.',
        titulo: 'Qué te dice el coach en partida',
        avisos: [
          ['Compra', '«Puedes comprar Huracán de Runaan»'],
          ['Habilidades', '«Nivel 6: sube la R»'],
          ['Objetivos', 'A 1 minuto, a 30 segundos y al aparecer, con el tipo de dragón'],
          ['CS', '«Vas por debajo del objetivo de farmeo» (a los 5, 10, 15 y 20 minutos)'],
          ['Visión', '«Compra un guardián de control»'],
          ['Jungla', '«El Gromp en 30 segundos» (solo si usas los temporizadores)'],
          ['Jungla enemiga', '«El jungla enemigo acaba de aparecer en bot (kill)»'],
          ['Fase de partida', '«Fase media: agrupa con tu equipo para los objetivos»'],
        ],
        nota: 'Cada widget va a su sitio: los objetivos arriba, la flecha sobre tu barra de habilidades y el resto donde tú quieras. La voz dice una frase cada vez, la más urgente primero, y el mismo aviso no se repite hasta que su condición cambia. El CS se compara con una referencia de tu rol, sin colores rojos ni mensajes negativos.',
      },
      junglaEnemiga: {
        titulo: 'El jungla enemigo, solo con lo que ya enseña el juego',
        nota1:
          'Cuando el jungla enemigo participa en una muerte, el registro de muertes del juego lo muestra y la app te lo dice: «El jungla enemigo acaba de aparecer en bot (kill)». No es un seguimiento: la app no conoce su posición ni sus enfriamientos, y el aviso siempre habla de esa muerte.',
        nota2:
          'Si quieres, puedes activar una estimación de su ruta habitual (apagada por defecto): por qué lado suele empezar ese campeón y a qué calle suele ir primero, según nuestras partidas. Es lo que suele hacer, no lo que hace en tu partida.',
        alt: 'Captura del overlay de Coach LoL IA con el aviso «El jungla enemigo acaba de aparecer en bot (kill)», junto a la barra de objetivos, el CS, la flecha sobre la R, el aviso de compra y los temporizadores de jungla sobre un minimapa esquemático.',
        pie: 'Aviso por el registro de muertes.',
      },
    },

    arquitectura: {
      antetitulo: 'Arquitectura',
      titulo: 'Tres piezas que trabajan juntas',
      intro:
        'Un monorepo con la app de escritorio, el servidor de builds y esta web. La clave de la API de Riot vive solo en el servidor; la app distribuida no contiene ningún secreto.',
      piezas: [
        {
          titulo: 'App de escritorio',
          texto:
            'Electron con dos ventanas en React. El proceso principal reúne el **conector LCU** (cliente), el **conector de partida** (puerto 2999), el **motor de consejos** (una función pura y determinista: estado de partida + build + rol → avisos), el cliente de builds con caché en disco y los datos de Data Dragon.',
        },
        {
          titulo: 'Servidor de builds',
          texto:
            'Node con Fastify y SQLite, empaquetado en Docker. El recolector descarga partidas de la API de Riot respetando sus límites de peticiones; el agregador calcula las builds cada 6 horas y la API pública las sirve como JSON con el parche y la fecha de cálculo.',
        },
        {
          titulo: 'Web y asistente',
          texto:
            'Esta web estática (Astro) se publica en GitHub Pages. Su asistente IA, igual que la vista Ayuda de la app, pregunta al servidor, que limita el uso y es el único que tiene la clave del modelo.',
        },
      ],
    },

    seguridad: {
      antetitulo: 'Seguridad y Vanguard',
      titulo: 'Solo API oficiales. Nunca tocamos el juego',
      intro:
        'Vanguard es el sistema antitrampas de Riot y vigila el proceso del juego. Coach LoL IA está diseñada para no acercarse a él: todo lo que sabe lo obtiene de las interfaces que Riot publica para herramientas de terceros.',
      si: {
        titulo: 'Lo que sí hace',
        lista: [
          'Lee el **lockfile** del cliente para conectarse a la **LCU API**, una API local con contraseña.',
          'Consulta la **Live Client Data API** en `127.0.0.1:2999`, de solo lectura, durante la partida.',
          'Descarga nombres e iconos de **Data Dragon**, el servicio público de Riot.',
          'Muestra el overlay como una ventana normal de Windows, transparente y con clics pasantes.',
          'Registra la tecla rápida con el atajo global de Electron, sin enviar nada al juego.',
        ],
      },
      nunca: {
        titulo: 'Lo que nunca hace',
        lista: [
          'Leer o escribir la memoria del juego.',
          'Inyectar código o DLL en ningún proceso.',
          'Hacer capturas de pantalla para analizarlas.',
          'Simular teclado o ratón, ni automatizar acciones.',
          'Borrar tus páginas de runas o tus conjuntos de objetos.',
        ],
      },
      noMuestra: {
        titulo: 'Lo que el overlay no muestra',
        lista: [
          'Temporizadores de hechizos de invocador o definitivas enemigas.',
          'Temporizadores de los campamentos de la jungla enemiga: los de jungla son solo de tu lado y los marcas tú.',
          'La posición de los enemigos o cualquier dato que no veas en pantalla. Del jungla enemigo solo repite lo que ya sale en el registro de muertes.',
        ],
        nota: 'Antes de pedir la clave de producción de Riot, cada aviso se revisa frente a la política vigente para desarrolladores.',
      },
      datos:
        '**Tus datos:** la clave de la API de Riot vive solo en el servidor como variable de entorno. La app nunca envía tus credenciales. Pide la build del campeón y el rol y, para la pantalla de carga, solo el PUUID (identificador público de Riot) de los diez jugadores, con su campeón y su rol; el Riot ID no se envía. Con el PUUID el servidor consulta su rango y su maestría en la API oficial y guarda la respuesta solo en memoria, un máximo de 10 minutos.',
      guia: 'Guía: cómo usar un overlay en LoL de forma segura',
    },

    datos: {
      antetitulo: 'Datos',
      titulo: 'Builds de partidas reales, recalculadas cada 6 h',
      intro:
        'Las recomendaciones no son opiniones: salen de partidas clasificatorias recientes de jugadores de nivel alto, procesadas por nuestro propio servidor.',
      tuberia: [
        {
          icono: 'usuario',
          titulo: 'Recolector',
          texto:
            'Usa League-v4 para encontrar jugadores **Esmeralda o superior** en **EUW, LAN y LAS**, y Match-v5 para descargar sus partidas **clasificatorias Solo/Dúo**, de **ARAM**, de **ARAM: Caos** y de **Arena**. Respeta los límites de Riot y procesa miles de partidas nuevas por región en cada ciclo, repartidas entre los modos; lo que un modo no llega a usar pasa a las clasificatorias.',
        },
        {
          icono: 'grafico',
          titulo: 'Agregador',
          texto:
            'Para cada campeón y rol calcula la página de runas, los hechizos, los objetos iniciales, el núcleo de 3 objetos, las botas, los situacionales y el orden de habilidades más frecuentes, con su tasa de victorias y su número de partidas. En ARAM y ARAM: Caos agrupa por campeón, y en Arena añade los aumentos y la posición media. También calcula el tier de cada campeón en su rol.',
        },
        {
          icono: 'reloj',
          titulo: 'Publicación',
          texto:
            'El ciclo se repite **cada 6 h**. La API sirve cada build con su parche y su fecha de cálculo, y la app la guarda en caché para usarla sin conexión.',
        },
      ],
      umbrales: [
        {
          cifra: '200',
          texto:
            '**partidas en el parche actual** para usar solo datos del parche. Con menos de 200 partidas, se combinan con las del parche anterior y la build lo indica (`mezclaParches`).',
        },
        {
          cifra: String(MIN_PARTIDAS_BUILD),
          texto: `**${MIN_PARTIDAS_BUILD} partidas en total** como mínimo para publicar una build. De ${MIN_PARTIDAS_BUILD} a ${PARTIDAS_DATOS_LIMITADOS - 1} partidas lleva la insignia **«Datos limitados»**, y con menos de ${MIN_PARTIDAS_BUILD} la app muestra «Build no disponible» en lugar de inventarse una.`,
        },
        {
          cifra: '6 h',
          texto:
            '**entre actualizaciones.** Cuando sale un parche nuevo, el servidor y Data Dragon se ponen al día solos y la app muestra «Datos del parche X.Y».',
        },
      ],
    },

    tecnologias: {
      antetitulo: 'Tecnologías',
      titulo: 'Un stack moderno, tipado de punta a punta',
      intro:
        'Se descartaron Overwolf (obliga a instalar su plataforma) y Tauri (su overlay transparente con clics pasantes es menos maduro en Windows). Electron da el control necesario sobre el overlay con una sola base de código en TypeScript.',
      lista: [
        ['Electron', 'App de escritorio: ventana principal y overlay transparente con clics pasantes.'],
        ['React 19', 'Interfaz de las dos ventanas, con CSS propio basado en tokens de diseño.'],
        ['TypeScript', 'Todo el código (app, servidor y tipos compartidos) con comprobación estricta.'],
        ['Node.js 24', 'Proceso principal de la app y servidor de builds.'],
        ['SQLite', 'Base de datos del servidor (better-sqlite3): partidas y builds.'],
        ['Fastify', 'API HTTP del servidor: builds, roles y el asistente IA.'],
        ['Vitest', 'Pruebas automáticas de la app, el servidor y el código compartido.'],
        ['Astro', 'Esta web: estática, sin frameworks en el cliente y publicada en GitHub Pages.'],
        ['electron-builder', 'Instalador para Windows y actualizaciones automáticas desde GitHub Releases.'],
        ['Docker', 'Imagen del servidor lista para desplegar en cualquier alojamiento.'],
        ['GitHub Actions', 'Integración continua y despliegue de la web.'],
      ],
    },

    calidad: {
      antetitulo: 'Calidad',
      titulo: 'Probado antes de cada cambio',
      cifra: 'pruebas automáticas con Vitest en la app, el servidor y el código compartido, que se ejecutan en cada cambio.',
      tarjetas: [
        {
          icono: 'prueba',
          titulo: 'Pruebas con datos reales',
          texto:
            'El motor de consejos y el agregador se prueban con partidas grabadas. Un **simulador de partida** reproduce una partida real como Live Client Data API falsa y un **LCU simulado** permite probar la selección de campeón y la importación sin abrir LoL.',
        },
        {
          icono: 'ramas',
          titulo: 'Integración continua',
          texto:
            'GitHub Actions comprueba los tipos de TypeScript de cada paquete y ejecuta todas las pruebas en Windows en cada push. También construye la imagen Docker del servidor y verifica que SQLite carga dentro de ella.',
        },
        {
          icono: 'revisar',
          titulo: 'Revisión por tareas',
          texto:
            'Cada versión parte de una especificación y un plan dividido en tareas pequeñas. Cada tarea sigue TDD (primero una prueba que falla, luego el código) y pasa una revisión de especificación y otra de calidad antes de fusionarse.',
        },
        {
          icono: 'rayo',
          titulo: 'Prueba real en partida',
          texto:
            'Antes de publicar cada versión se prueba en una partida de práctica real. Esta web también tiene sus pruebas: compilan el sitio y comprueban el HTML generado.',
        },
      ],
    },

    planes: {
      antetitulo: 'Gratis',
      titulo: 'Gratis para todos',
      intro:
        'Coach LoL IA es gratis y todo está incluido. No hay planes de pago, pruebas ni claves: todo el mundo tiene la misma app.',
      incluido: {
        titulo: 'Todo incluido',
        lista: [
          'Builds de Esmeralda+ por campeón y rol',
          'Apartado Campeones con tier list',
          'Modos ARAM, ARAM: Caos y Arena, con aumentos',
          'Runas, hechizos, objetos y orden de habilidades',
          'Importación al cliente en un clic',
          'Pantalla de carga con los dos equipos',
          'Coach en partida: overlay por widgets, voz y temporizadores de jungla',
          'Asistente IA de soporte',
        ],
      },
      sinAnuncios: {
        titulo: 'Sin anuncios dentro de la app',
        texto:
          'La app no tiene anuncios ni banners. El proyecto se financia con **anuncios en la web** (solo si aceptas las cookies publicitarias) y con **donaciones voluntarias**.',
      },
      apoya: {
        titulo: 'Apoya el proyecto',
        texto:
          'Las donaciones pagan el servidor, los datos de las builds y el desarrollo. Son voluntarias y no dan ventajas: la app es igual para todos.',
        boton: 'Cómo apoyar',
      },
    },

    hojaDeRuta: {
      antetitulo: 'Hoja de ruta',
      titulo: 'Dónde estamos y hacia dónde vamos',
      completada: 'Completada',
      items: [
        {
          version: 'v1',
          estado: 'Completada',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Builds de Esmeralda+ (EUW, LAN, LAS) con servidor propio',
            'Importación de runas, hechizos y objetos en un clic',
            'Overlay con avisos en español y voz opcional',
            'Instalador de Windows con actualizaciones automáticas',
            'Simulador de partida y LCU simulado para las pruebas',
          ],
        },
        {
          version: 'v2',
          estado: 'Completada',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Interfaz nueva de estilo profesional: arte del campeón, tarjetas y microanimaciones',
            'Esta web del producto',
            'Asistente IA de soporte en la web y en la app',
            'Todo gratis para todos, sin anuncios dentro de la app',
          ],
        },
        {
          version: 'v3',
          estado: 'Completada',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Overlay por widgets: objetivos, flecha de habilidad, CS y KDA, compra y avisos',
            'Pantalla de carga con rango, maestría y victorias del campeón',
            'Temporizadores de jungla manuales de tu lado, también sobre el minimapa',
            'Apartado Campeones con tier list, y modos ARAM, ARAM: Caos y Arena',
            'Runas seleccionables, tema «Sombra» y overlay adaptado a 2K y 4K',
          ],
        },
        {
          version: '3.1',
          estado: 'Disponible',
          clase: 'etiqueta-dorada',
          hecho: true,
          puntos: [
            'Voz natural neuronal y sin conexión en 5 idiomas, que se descarga sola en segundo plano (nunca en partida)',
            'Pantalla de carga a pantalla completa con tu tarjeta resaltada: Espacio la oculta, o elige solo tarjetas o desactivarla',
            '460 frases de voz por idioma con variantes, nivel de detalle y categorías que activas una a una',
          ],
        },
        {
          version: 'Después',
          estado: 'Ideas',
          clase: '',
          hecho: false,
          puntos: ['Análisis de la partida al terminar, con IA', 'Cuentas de usuario y avisos por correo'],
        },
      ],
    },

    faq: {
      antetitulo: 'FAQ',
      titulo: 'Preguntas frecuentes',
      escribir: 'Escribir a',
      ayuda:
        '¿No encuentras tu respuesta? Pregunta al **asistente IA**: está en el botón «Asistente IA» de esta web y en la vista «Ayuda» de la app.',
      ayudaAlt:
        'Captura de la vista Ayuda de Coach LoL IA: el chat del asistente IA con su saludo, el campo «Escribe tu pregunta…», el botón Enviar y la nota de que las respuestas son generadas por IA.',
      preguntas: [
        {
          p: '¿Me pueden sancionar por usar Coach LoL IA?',
          r: 'La app solo usa las API locales oficiales que Riot ofrece a herramientas de terceros (LCU API y Live Client Data API) y nunca toca el proceso del juego: no lee memoria, no inyecta código, no captura la pantalla y no simula teclas ni clics. Además, el overlay no muestra información que no veas ya en pantalla. Aun así, la decisión final sobre herramientas de terceros es siempre de Riot, y por eso revisamos cada aviso frente a su política vigente.',
        },
        {
          p: '¿Es gratis?',
          r: 'Sí, todo: las builds, las runas, la importación y el coach en partida (overlay y voz), para todo el mundo y sin anuncios dentro de la app. El proyecto se financia con anuncios en la web y donaciones voluntarias.',
        },
        {
          p: '¿Necesito Overwolf u otro programa?',
          r: 'No. Coach LoL IA es una app de escritorio propia para Windows: no necesita Overwolf ni ninguna otra plataforma. Solo el cliente de League of Legends.',
        },
        {
          p: '¿Por qué no veo el overlay durante la partida?',
          r: 'El overlay es una ventana de Windows encima del juego, así que solo se ve si LoL está en modo «Sin bordes» (Opciones → Vídeo → Modo de ventana). Si el juego está en pantalla completa, la app te avisa. Durante la partida lo ocultas o lo muestras con Ctrl+Mayús+O. Para colocar cada widget, en la vista Overlay de la app pulsa «Mover y calibrar», arrástralo y pulsa «Fijar aquí» (o Esc o Ctrl+Mayús+O). Desde esa vista también activas, escalas o apagas cada widget.',
        },
        {
          p: '¿Cómo importo las runas automáticamente?',
          r: 'En la selección de campeón, pulsa «Importar» en la app (o activa la importación automática en Ajustes). La app crea la página «Coach: <Campeón> <Rol>», elige los hechizos y añade el conjunto de objetos. Lo explicamos paso a paso en la guía [Cómo importar runas automáticamente](@guiaRunas).',
        },
        {
          p: '¿Cómo funcionan los temporizadores de jungla?',
          r: 'Son manuales y vienen apagados: los activas en la vista Overlay. Cuando limpias un campamento de tu lado o un Escarabajo, lo marcas con un clic o con una tecla que tú eliges, y la app cuenta cuánto le falta para reaparecer, en un widget y encima del minimapa. Con Alt+Mayús+L los muestras u ocultas durante la partida. Solo cuentan tu jungla y los Escarabajos, nunca los campamentos del rival: la app no sabe cuándo los limpia, y las políticas de Riot no permiten seguir lo que hace el enemigo fuera de tu vista.',
        },
        {
          p: '¿Qué enseña la pantalla de carga?',
          r: 'Mientras carga la partida, el overlay muestra a los diez jugadores con su campeón y su rol: el rango oficial de Solo/Dúo, la maestría con ese campeón y el porcentaje de victorias del campeón en su rol según nuestras builds. Añade etiquetas solo positivas o neutras, como «Especialista en Ahri» o «Escala a final de partida». No calcula un MMR propio ni pone etiquetas negativas a nadie, y se oculta en cuanto empieza la partida. Para pedir el rango y la maestría, la app solo envía al servidor el PUUID de cada jugador (nunca su Riot ID), y el servidor guarda la respuesta en memoria un máximo de 10 minutos.',
        },
        {
          p: '¿Qué me dice del jungla enemigo?',
          r: 'Solo lo que el juego ya te enseña. Cuando el jungla enemigo participa en una muerte, que sale en el registro de muertes, la app te avisa: «El jungla enemigo acaba de aparecer en bot (kill)». Hay además una opción, apagada por defecto, con su ruta habitual: una estimación de nuestras partidas sobre por qué lado suele empezar ese campeón y a qué calle suele ir primero. Ninguna de las dos dice dónde está ahora: la app no ve su posición ni sus enfriamientos.',
        },
        {
          p: '¿Va a borrar mis páginas de runas?',
          r: 'Solo si tú lo confirmas. La app crea sus propias páginas con el prefijo «Coach:» y, si queda una suya, reemplaza esa. Si no te queda ninguna libre y pulsas «Importar», te pregunta antes de sustituir una de las tuyas (la seleccionada o la más antigua; nunca una predefinida). La importación automática nunca borra nada.',
        },
        {
          p: '¿De dónde salen las builds?',
          r: `De partidas clasificatorias Solo/Dúo de jugadores Esmeralda o superior en EUW, LAN y LAS, que nuestro servidor descarga de la API oficial de Riot y agrega cada 6 horas. De esos mismos jugadores también descarga sus partidas de ARAM, ARAM: Caos y Arena. Cada build indica su número de partidas y su porcentaje de victorias. Una build se publica desde ${MIN_PARTIDAS_BUILD} partidas; de ${MIN_PARTIDAS_BUILD} a ${PARTIDAS_DATOS_LIMITADOS - 1} lleva la insignia «Datos limitados», y con menos de ${MIN_PARTIDAS_BUILD} la app dice «Build no disponible» en lugar de inventarse una. [Más sobre las builds y la tier list](@builds).`,
        },
        {
          p: '¿Qué modos de juego admite?',
          r: 'Clasificatoria (por campeón y rol), ARAM y ARAM: Caos (por campeón, con runas, hechizos, objetos y habilidades; en ARAM: Caos, también los aumentos más elegidos) y Arena (por campeón, con los aumentos y objetos más elegidos y los de mejor posición media, y las cifras de posición media, top 4 y primer puesto). Cada modo tiene su tier list en el apartado Campeones. La app reconoce el modo en la selección de campeón y en la partida, y el overlay se adapta: en ARAM y ARAM: Caos quita los objetivos, el CS y la jungla, y deja el KDA, la flecha de habilidad y la compra; en Arena tampoco hay flecha de habilidad.',
        },
        {
          p: '¿Qué es la tier list de Campeones?',
          r: 'Un apartado de la app con todos los campeones por rol y modo. Cada uno recibe un tier (S, A, B o C) que combina su porcentaje de victorias y su uso dentro del rol. Los que tienen menos de 30 partidas nunca pasan de B y se marcan con «Datos limitados». Pulsa un campeón para ver su build completa. Si te interesa cómo leerla, mira la guía [Qué es una tier list](@guiaTierList).',
        },
        {
          p: '¿Sirven las builds si juego en otro servidor?',
          r: 'Sí. Las builds se calculan con partidas de EUW, LAN y LAS, pero dependen del campeón, del rol y del parche, no del servidor en el que juegas.',
        },
        {
          p: '¿En qué idiomas está?',
          r: 'La app, el overlay, la voz y el asistente están en español, inglés, portugués (Brasil), francés y alemán, y esta web también. Por defecto la app usa el idioma de tu Windows y puedes cambiarlo en Ajustes.',
        },
        {
          p: '¿Me va a hacer subir de elo?',
          r: 'No prometemos eso. Coach LoL IA te da información y recordatorios (builds con datos, objetivos, CS, compras) para que tomes tus propias decisiones con más contexto. Lo que pase en la partida depende de cómo juegues.',
        },
        {
          p: '¿Necesito crear una cuenta?',
          r: 'No. Descargas la app, la abres junto al cliente de League of Legends y listo: no hay cuentas, claves ni registros.',
        },
        {
          p: '¿La voz necesita internet?',
          r: 'Solo una vez: el modelo de la voz natural (unos 124 MB) se descarga solo desde GitHub en segundo plano, nunca durante la selección de campeón, la carga ni la partida. Después funciona sin conexión, en tu PC. Hasta que termina, suena la voz de Windows.',
        },
        {
          p: '¿Qué pasa si me quedo sin conexión?',
          r: 'La app usa las últimas builds guardadas y te lo indica. El coach en partida funciona igual, porque solo necesita el cliente y la partida en tu equipo.',
        },
        {
          p: '¿Funciona en Mac o Linux?',
          r: 'Por ahora solo en Windows 10 y 11, que es donde se juega la gran mayoría de partidas de LoL. Mac y Linux quedan fuera de esta versión.',
        },
        {
          p: '¿Necesitas ayuda?',
          r: `Escríbenos a ${CORREO}. Si el problema es con el overlay, indica tu versión de Windows y si el juego está en modo «Sin bordes».`,
          correo: true,
        },
        {
          p: '¿Coach LoL IA es un producto oficial de Riot?',
          r: 'No. Es un proyecto independiente que no está respaldado por Riot Games.',
        },
      ],
    },

    cta: {
      titulo: 'Tu próxima partida, con coach',
      texto: 'Descarga Coach LoL IA gratis y prueba las builds en tu siguiente selección de campeón.',
    },
  },

  descargar: {
    antetitulo: 'Descargar',
    h1: 'Descarga Coach LoL IA gratis para Windows',
    intro:
      'Gratis, en 5 idiomas y con actualizaciones automáticas. El instalador se publica en GitHub Releases junto con las notas de cada versión.',
    ultima: 'Última versión:',
    archivo: 'Descarga el archivo',
    archivoFin: 'y ejecútalo.',
    queTrae: 'Qué trae la',
    requisitosTitulo: 'Requisitos',
    requisitos: [
      ['Sistema', 'Windows 10 u 11 de 64 bits.'],
      ['Juego', 'League of Legends instalado (cliente de Riot).'],
      ['Overlay', 'El juego en modo «Sin bordes» (Opciones → Vídeo → Modo de ventana).'],
      ['Conexión', 'Internet para descargar las builds; sin conexión usa las últimas guardadas.'],
    ],
    instalacionTitulo: 'Instalación',
    instalacion: [
      'Abre la [última release](https://github.com/pepeipto/coach-lol-ia/releases/latest) y descarga el instalador `.exe`.',
      'Ejecútalo. Si Windows SmartScreen muestra un aviso, pulsa «Más información» y «Ejecutar de todas formas».',
      'Abre Coach LoL IA y después el cliente de League of Legends. La app lo detecta sola y, la primera vez, una bienvenida de cuatro pasos te enseña lo básico.',
      'En la selección de campeón verás tu build. Pulsa «Importar» para aplicarla.',
      'Para el coach en partida, pon el juego en modo **Sin bordes**.',
    ],
    extras: [
      {
        titulo: 'Actualizaciones automáticas',
        texto: 'La app comprueba si hay una versión nueva al arrancar, la descarga en segundo plano y la instala al cerrarla.',
      },
      {
        titulo: 'Solo API oficiales de Riot',
        texto: 'No toca el proceso del juego: no lee su memoria ni inyecta código. [Más detalles](@inicio#seguridad).',
      },
      {
        titulo: 'Desinstalar',
        texto: 'Desde Configuración de Windows → Aplicaciones → Coach LoL IA. Tus runas y conjuntos de objetos del cliente no se tocan.',
      },
      {
        titulo: 'Código en GitHub',
        texto:
          'El código, el historial de cambios y las notas de cada versión están en [GitHub](https://github.com/pepeipto/coach-lol-ia).',
      },
    ],
    ayuda:
      '¿La app no detecta el cliente o el overlay no aparece? Escríbenos con tu versión de Windows y una descripción del problema.',
  },

  apoyar: {
    antetitulo: 'Apoya el proyecto',
    h1: 'Coach LoL IA es gratis para todos',
    intro:
      'Todas las funciones, incluido el coach en partida, están disponibles para todo el mundo, y la app no tiene anuncios. El proyecto se financia con los anuncios en la web y con donaciones voluntarias.',
    porQue: '¿Por qué apoyarlo?',
    porQueTexto:
      'Mantener Coach LoL IA cuesta dinero cada mes. Si te resulta útil, una donación ayuda a que siga siendo gratis y a que mejore. Donar es voluntario y no da ventajas en la app: todo el mundo tiene lo mismo.',
    quePagan: 'Qué pagan las donaciones',
    destinos: [
      ['El servidor', 'El alojamiento del servidor que descarga las partidas, calcula las builds cada 6 horas y las sirve a la app.'],
      ['Los datos', 'El almacenamiento y el procesamiento de miles de partidas de Esmeralda+ en EUW, LAN y LAS, y el asistente IA de soporte.'],
      ['El desarrollo', 'El tiempo para corregir errores, seguir cada parche de League of Legends y añadir funciones nuevas.'],
    ],
    cafe: '¿Quieres invitarnos a un café? Cualquier cantidad ayuda.',
    donar: 'Donar',
    pronto: 'Pronto podrás apoyar el proyecto con una donación.',
    mientras: 'Mientras tanto, si quieres ayudar, escríbenos a',
    otraForma: 'Otra forma de apoyarlo es contarlo a tus amigos o [descargar la app](@descargar) y usarla.',
  },

  novedades: {
    antetitulo: 'Novedades',
    h1: 'Qué hay de nuevo en Coach LoL IA',
    intro:
      'Todas las versiones de la app, de la más reciente a la más antigua. La app las enseña también en su vista «Novedades» y te resume cada versión nueva la primera vez que la abres.',
    notaIdioma: '',
    version: 'Versión',
    ultima: 'Última versión',
    proxima: {
      titulo: 'Nuevo en la 3.1',
      texto:
        'Voz natural neuronal y sin conexión en los 5 idiomas, que se descarga sola en segundo plano (nunca durante la selección, la carga ni la partida); pantalla de carga a pantalla completa con tu tarjeta resaltada, que se oculta con Espacio (o solo tarjetas, o desactivada); y 460 frases de voz por idioma con variantes, nivel de detalle y categorías.',
    },
    cierre: 'Las actualizaciones se instalan solas al cerrar la app. Si aún no la tienes, descárgala gratis.',
    notasGithub: 'Notas en GitHub',
    meses: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
    formatoFecha: '{d} de {m} de {a}',
  },

  legal: {
    antetitulo: 'Legal',
    plantilla:
      '**Plantilla pendiente de revisión.** Este texto es una plantilla razonable redactada para el proyecto y debe revisarlo el propietario (idealmente con asesoramiento legal) antes del lanzamiento público. Los campos entre corchetes, como *[nombre o razón social]*, deben completarse. No constituye asesoramiento jurídico.',
    actualizado: 'Última actualización: 20 de octubre de 2026.',
    traduccion: '',
    privacidad: {
      h1: 'Política de privacidad',
      secciones: [
        {
          h: '1. Responsable del tratamiento',
          p: [
            `Responsable: *[nombre o razón social]*, con NIF *[NIF]* y domicilio en *[dirección]*. Contacto para cualquier cuestión de privacidad: [${CORREO}](mailto:${CORREO}).`,
          ],
        },
        { h: '2. Qué datos tratamos y para qué', tabla: true },
        {
          h: '3. Datos que no recogemos',
          p: [
            'La app lee datos del cliente y de la partida **en tu propio PC** (LCU API y Live Client Data API) para mostrarte la build y los avisos. Esa información no se envía a nuestro servidor, salvo los datos de la pantalla de carga del apartado anterior: no recogemos tus credenciales ni guardamos un historial de tus partidas. Tampoco hay cuentas de usuario ni contraseñas en Coach LoL IA.',
          ],
        },
        {
          h: '4. Datos guardados en tu PC',
          p: [
            'La app guarda en tu carpeta de usuario los ajustes, la caché de builds y de Data Dragon, el modelo de la voz natural con su caché de frases y un registro local de errores. Se borran al desinstalar la app y eliminar su carpeta de datos.',
          ],
        },
        {
          h: '5. Encargados y destinatarios',
          lista: [
            '**Anthropic** (genera las respuestas del asistente IA a partir de los mensajes del chat). Puede tratar datos fuera del EEE con las garantías adecuadas.',
            '**Google** (AdSense en esta web, solo con tu consentimiento).',
            '**GitHub** (alojamiento de esta web, de las descargas de la app y del modelo de la voz natural, de unos 124 MB, que la app descarga sola; como en cualquier descarga, GitHub recibe tu dirección IP).',
            '*[Proveedor de alojamiento del servidor]* (servidor de builds y del asistente IA).',
          ],
          p: [
            'Si haces una donación, la gestiona la plataforma de donaciones en su propia web: nosotros no vemos ni guardamos tus datos de pago.',
            'No vendemos tus datos ni los cedemos a terceros salvo obligación legal.',
          ],
        },
        {
          h: '6. Conservación',
          p: ['Los registros técnicos del servidor se conservan como máximo *[indicar plazo]*. Los mensajes del asistente no se guardan.'],
        },
        {
          h: '7. Tus derechos',
          p: [
            `Puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a [${CORREO}](mailto:${CORREO}). Si crees que no hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española de Protección de Datos (aepd.es) o la autoridad de control de tu país.`,
          ],
        },
        { h: '8. Cookies', p: ['Consulta la [política de cookies](@cookies).'] },
      ],
      tabla: {
        cabecera: ['Origen', 'Datos', 'Finalidad', 'Base jurídica'],
        filas: [
          [
            'App de escritorio',
            'Campeón y rol consultados y dirección IP de la petición.',
            'Servir las builds.',
            'Ejecución del servicio que solicitas (art. 6.1.b RGPD).',
          ],
          [
            'Pantalla de carga (app)',
            'De los diez jugadores de tu partida: su identificador de Riot (PUUID), su campeón, su rol y su equipo, y la región de tu cliente. El Riot ID (nombre#etiqueta) no se envía.',
            'Pedir a la API oficial de Riot el rango de Solo/Dúo y la maestría de cada jugador para la pantalla de carga. El servidor guarda la respuesta solo en memoria, un máximo de 10 minutos, y no la escribe en su base de datos ni en sus registros.',
            'Ejecución del servicio que solicitas (art. 6.1.b RGPD) e interés legítimo respecto a los demás jugadores, con datos que Riot ya hace públicos (art. 6.1.f RGPD).',
          ],
          [
            'Asistente IA (web y app)',
            'Los mensajes que escribes en el chat del asistente y la dirección IP de la petición.',
            'Generar la respuesta: los mensajes se envían a nuestro servidor y a Anthropic, que procesa el texto con su modelo de IA. Nuestro servidor no los guarda más allá de ese procesamiento. No escribas datos personales en el chat.',
            'Ejecución del servicio que solicitas (art. 6.1.b RGPD).',
          ],
          [
            'Soporte',
            `Tu correo y lo que nos cuentes al escribir a ${CORREO}.`,
            'Responder a tu consulta.',
            'Interés legítimo en atenderte (art. 6.1.f RGPD).',
          ],
          [
            'Esta web',
            'Tu elección de cookies (en tu navegador) y, solo si las aceptas, cookies publicitarias de Google AdSense.',
            'Recordar tu elección y mostrar anuncios.',
            'Consentimiento (art. 6.1.a RGPD).',
          ],
        ],
      },
    },
    terminos: {
      h1: 'Términos de uso',
      secciones: [
        {
          h: '1. Quiénes somos',
          p: [
            `Coach LoL IA es un servicio de *[nombre o razón social]*, con NIF *[NIF]* y domicilio en *[dirección]*. Contacto: [${CORREO}](mailto:${CORREO}).`,
          ],
        },
        {
          h: '2. El servicio',
          p: [
            'Coach LoL IA es una aplicación de escritorio gratuita para Windows que sugiere builds en la selección de campeón y muestra avisos durante la partida. Las recomendaciones son orientativas y se basan en estadísticas de partidas; no garantizan ningún resultado.',
          ],
        },
        {
          h: '3. Uso de la app',
          lista: [
            'Te concedemos una licencia personal, no exclusiva e intransferible para usar la app.',
            'No puedes usarla para incumplir las normas de Riot Games ni modificarla para acceder al juego por otras vías.',
            'La app solo usa las API oficiales de Riot. Aun así, el uso de herramientas de terceros está sujeto a las políticas de Riot, que pueden cambiar.',
          ],
        },
        {
          h: '4. Precio y donaciones',
          lista: [
            'Coach LoL IA es gratis: todas sus funciones están disponibles para todo el mundo y la app no tiene anuncios.',
            'El proyecto se financia con anuncios en esta web y con donaciones voluntarias desde [Apoya el proyecto](@apoyar).',
            'Donar es voluntario y no da acceso a funciones ni ventajas en la app.',
          ],
        },
        {
          h: '5. Disponibilidad',
          p: [
            'Intentamos que el servicio esté siempre disponible, pero puede haber interrupciones por mantenimiento, cambios de parche o de las API de Riot. Si el servidor no responde, la app usa los últimos datos guardados.',
          ],
        },
        {
          h: '6. Responsabilidad',
          p: [
            'La app se ofrece «tal cual». En la medida que permita la ley, no respondemos de daños indirectos derivados de su uso. Nada de lo anterior limita los derechos que te reconoce la normativa de consumidores.',
          ],
        },
        {
          h: '7. Propiedad intelectual y Riot Games',
          riot: true,
          p: [
            'League of Legends y sus imágenes son marcas y contenido de Riot Games, Inc., usados conforme a su política para proyectos de terceros.',
          ],
        },
        {
          h: '8. Cambios y ley aplicable',
          p: [
            'Podemos actualizar estos términos; te avisaremos de los cambios relevantes en esta web. Se rigen por la ley *[española]* y, para consumidores, son competentes los tribunales de su domicilio.',
          ],
        },
      ],
    },
    cookies: {
      h1: 'Política de cookies',
      queUsamos: 'Qué usamos',
      queUsamosTexto:
        'Esta web no usa cookies propias de análisis ni de seguimiento. Solo guarda tu elección sobre la publicidad y, si la aceptas, carga los anuncios de Google AdSense, que sí usan cookies de terceros.',
      tabla: {
        cabecera: ['Nombre', 'Tipo', 'Finalidad', 'Duración'],
        filas: [
          ['`coach-cookies` (almacenamiento local)', 'Propia, técnica', 'Recordar si aceptaste o rechazaste la publicidad.', 'Hasta que la borres'],
          [
            'Cookies de Google AdSense',
            'De terceros, publicidad',
            'Mostrar y medir anuncios. Solo se cargan si aceptas. Más información en la política de Google.',
            'Según Google',
          ],
        ],
      },
      sinAnunciosApp: 'La app de escritorio nunca muestra publicidad: los anuncios solo aparecen en esta web.',
      cambiar: 'Cambiar tu elección',
      conAnuncios: 'Pulsa el botón para borrar tu elección; el aviso de cookies volverá a aparecer.',
      sinAnuncios:
        'Ahora mismo esta web no muestra anuncios, así que no hay nada que aceptar. Si los activamos, verás un aviso para elegir.',
      boton: 'Restablecer mi elección de cookies',
      borradaBanner:
        ' Elección borrada. Vuelve a elegir en el aviso; si ya se habían cargado anuncios, dejarán de cargarse al recargar la página.',
      borrada: ' Elección borrada. El cambio se aplica al recargar la página.',
      navegador: 'También puedes borrar los datos de este sitio desde la configuración de tu navegador.',
      contacto: 'Contacto',
      contactoTexto: 'Para cualquier duda:',
    },
  },

  builds: {
    antetitulo: 'Builds y tier list',
    h1: 'Builds de LoL y tier list con datos de partidas Esmeralda+',
    intro:
      'Coach LoL IA calcula sus builds de League of Legends y su tier list con partidas reales de jugadores **Esmeralda o superior** en EUW, LAN y LAS. No son opiniones ni listas hechas a mano: cada build muestra cuántas partidas la respaldan y su porcentaje de victorias, y se recalcula **cada 6 horas**.',
    capturaAlt:
      'Captura de la vista Campeón de Coach LoL IA con la build de Ahri en el rol Central: runas de Dominación y Brujería, Destello e Ignición, objetos de inicio, núcleo y botas, y el orden de habilidades, con el porcentaje de victorias, 33 partidas y el parche 16.20.',
    capturaPie: 'Build por campeón y rol, con su número de partidas.',
    queIncluye: {
      titulo: 'Qué incluye cada build',
      lista: [
        '**Runas**: la página más usada y, desde la 3.0.1, varias páginas para elegir, cada una con su % de victorias y sus partidas.',
        '**Hechizos de invocador**, como Destello e Ignición o Destello y Castigo.',
        '**Objetos**: iniciales, núcleo de 3 objetos, botas y situacionales.',
        '**Orden de habilidades**, con la prioridad de mejora (por ejemplo, Q > W > E).',
        'En **Arena**, los aumentos y objetos más elegidos y los de mejor posición media.',
      ],
    },
    origen: {
      titulo: 'De dónde salen los datos',
      texto:
        'Nuestro servidor usa la API oficial de Riot: League-v4 para encontrar jugadores Esmeralda+ y Match-v5 para descargar sus partidas clasificatorias Solo/Dúo, y también sus partidas de ARAM, ARAM: Caos y Arena. Con ellas calcula, para cada campeón y rol, lo que más se juega y cómo le va.',
      puntos: [
        '**Parche actual primero:** con 200 partidas o más en el parche se usan solo datos del parche; si hay menos, se combinan con el anterior y la build lo indica.',
        `**Mínimo de ${MIN_PARTIDAS_BUILD} partidas** para publicar una build; de ${MIN_PARTIDAS_BUILD} a ${PARTIDAS_DATOS_LIMITADOS - 1} lleva la insignia «Datos limitados».`,
        '**Sin inventos:** si no hay partidas suficientes, la app dice «Build no disponible».',
      ],
    },
    tierList: {
      titulo: 'Cómo se calcula la tier list',
      texto:
        'En el apartado Campeones de la app, cada campeón recibe un tier por rol y por modo que combina su **porcentaje de victorias** y su **uso** dentro de ese rol. Así, un campeón con muchas victorias pero muy pocas partidas no sube a lo más alto por casualidad.',
      tiers: [
        ['S', 'Rinde por encima de lo normal en su rol y se juega lo bastante como para fiarse del dato.'],
        ['A', 'Una elección sólida en el parche actual.'],
        ['B', 'Jugable y equilibrado. Aquí se quedan también los que tienen menos de 30 partidas.'],
        ['C', 'Por debajo de la media en este parche: puede funcionar, pero hoy cuesta más.'],
      ],
      alt: 'Captura del apartado Campeones de Coach LoL IA: tier list de Clasificatoria con el selector de modo, la búsqueda, los filtros por rol y la tabla de campeones con su tier, victorias, uso y partidas.',
      pie: 'La tier list completa se consulta en la app, con datos del parche actual.',
    },
    modos: {
      titulo: 'Clasificatoria, ARAM, ARAM: Caos y Arena',
      texto:
        'Cada modo tiene sus propias builds y su tier list. En ARAM y ARAM: Caos las builds van por campeón (sin rol), con los aumentos más elegidos en ARAM: Caos; en Arena se añaden la posición media, el top 4 y el primer puesto. Los modos con pocas partidas recogidas enseñan «Sin datos todavía» hasta que hay muestra suficiente.',
    },
    importar: {
      titulo: 'De la build al cliente en un clic',
      texto:
        'En la selección de campeón, la app detecta tu campeón y tu rol y te enseña la build en menos de 2 segundos. Con «Importar» crea la página de runas, elige los hechizos y añade el conjunto de objetos. [Paso a paso en la guía de runas](@guiaRunas).',
    },
    honestidad: {
      titulo: 'Lo que la tier list no es',
      texto:
        'Una tier list resume estadísticas; no dice qué campeón tienes que jugar. Tu dominio del campeón, tu equipo y el rival pesan mucho. Por eso Coach LoL IA enseña siempre el número de partidas y no promete resultados. [Cómo leer una tier list](@guiaTierList).',
    },
    faq: [
      {
        p: '¿Cada cuánto se actualizan las builds?',
        r: 'Cada 6 horas. Cuando sale un parche nuevo, el servidor y Data Dragon se ponen al día solos y la app indica el parche de los datos.',
      },
      {
        p: '¿Puedo ver la tier list en la web?',
        r: 'La tier list completa, con búsqueda, filtros y la build de cada campeón, está en el apartado Campeones de la app, que es gratis. Esta página explica cómo se calcula.',
      },
      {
        p: '¿Por qué una build dice «Datos limitados»?',
        r: `Porque se basa en menos de ${PARTIDAS_DATOS_LIMITADOS} partidas. Es útil como orientación, pero la muestra es pequeña y el porcentaje de victorias puede cambiar mucho con pocas partidas más.`,
      },
      {
        p: '¿Las builds sirven en otros servidores?',
        r: 'Sí: dependen del campeón, el rol y el parche, no del servidor en el que juegas.',
      },
    ],
    cta: 'Descarga la app y mira la build de tu campeón en la próxima selección.',
  },

  guias: {
    antetitulo: 'Guías',
    h1: 'Guías de League of Legends',
    intro:
      'Guías cortas y prácticas sobre overlays, tier lists y runas, escritas por el equipo de Coach LoL IA. Explicamos cómo funcionan las cosas, sin promesas de subir de elo.',
    otras: 'Más guías',
    articulos: {
      guiaOverlay: {
        resumen: 'Qué permite Riot a un overlay, qué señales de alarma vigilar y cómo configurarlo bien.',
        h1: 'Cómo usar un overlay en LoL de forma segura',
        entradilla:
          'Un overlay de League of Legends es una ventana que se dibuja encima del juego para enseñarte información: tu build, los tiempos de los objetivos o tu CS. Bien hecho, respeta las normas de Riot. Mal hecho, puede poner en riesgo tu cuenta. Esta guía te ayuda a distinguirlos.',
        secciones: [
          {
            h: 'Qué es un overlay y qué no es',
            p: [
              'Un overlay legítimo es una ventana normal de Windows, transparente y con clics pasantes, que se coloca encima del juego. No forma parte del juego ni lo modifica: solo pinta información en tu pantalla.',
              'Para que se vea, LoL tiene que estar en modo **Sin bordes** (Opciones → Vídeo → Modo de ventana). En pantalla completa exclusiva, Windows dibuja el juego por encima de cualquier otra ventana.',
            ],
          },
          {
            h: 'Lo que Riot permite a las apps de terceros',
            p: [
              'Riot publica interfaces oficiales para herramientas de terceros: la **LCU API** del cliente (selección de campeón, runas, objetos), la **Live Client Data API** de la partida (en `127.0.0.1:2999`, de solo lectura) y servicios públicos como Data Dragon. Una app que solo usa estas vías trabaja con datos que Riot decide compartir.',
              'Además, las políticas de Riot ponen límites a lo que se puede mostrar. En general, un overlay no debe darte información que no tendrías jugando sin él: nada de temporizadores de hechizos o definitivas enemigas, ni posiciones de rivales que no ves, ni decisiones que jueguen por ti.',
            ],
          },
          {
            h: 'Señales de alarma',
            lista: [
              'Lee la **memoria del juego** o inyecta código o DLL en el proceso.',
              'Te enseña **enfriamientos enemigos**, posiciones fuera de tu visión o timers de la jungla rival.',
              '**Simula teclado o ratón**, o automatiza acciones como esquivar o lanzar habilidades.',
              'Analiza **capturas de pantalla** o del minimapa para sacar información.',
              'Te pide tu **contraseña de Riot** o promete que es «indetectable».',
            ],
          },
          {
            h: 'Checklist antes de instalar un overlay',
            lista: [
              'Dice claramente qué API usa y qué no hace con el juego.',
              'No pide credenciales: el cliente ya está abierto en tu PC.',
              'Explica qué datos envía a sus servidores, en su política de privacidad.',
              'Incluye la línea legal de Riot y no se presenta como producto oficial.',
              'Puedes ocultarlo o apagar cada parte en cualquier momento.',
            ],
          },
          {
            h: 'Cómo lo hace Coach LoL IA',
            p: [
              'Coach LoL IA solo usa la LCU API, la Live Client Data API y Data Dragon. No lee ni escribe la memoria del juego, no inyecta código, no hace capturas para analizarlas y no simula teclas ni clics. Los temporizadores de jungla son solo de tu lado y los marcas tú, y del jungla enemigo solo repite lo que ya sale en el registro de muertes.',
              'Aun así, la última palabra sobre herramientas de terceros la tiene siempre Riot. Por eso revisamos cada aviso frente a su política vigente y te recomendamos hacer lo mismo con cualquier app que instales. [Ver la sección de seguridad](@inicio#seguridad).',
            ],
          },
          {
            h: 'Configurarlo para que no estorbe',
            lista: [
              'Pon el juego en modo **Sin bordes**.',
              'En la vista Overlay de la app, usa **«Mover y calibrar»** para colocar cada widget donde no tape el HUD.',
              'Baja la opacidad o apaga los widgets que no uses.',
              'Durante la partida, **Ctrl+Mayús+O** oculta o muestra el overlay.',
            ],
          },
        ],
      },
      guiaTierList: {
        resumen: 'Qué significa cada tier, cómo se calcula y por qué el número de partidas importa.',
        h1: 'Qué es una tier list en LoL y cómo leerla',
        entradilla:
          'Una tier list ordena a los campeones de League of Legends por lo bien que rinden en el parche actual, normalmente en letras: S, A, B, C. Es una herramienta útil para elegir o descubrir campeones, siempre que sepas de dónde salen los datos y qué no te dice.',
        secciones: [
          {
            h: 'Qué significa cada tier',
            p: [
              'No hay un estándar oficial, pero casi todas siguen la misma idea: **S** son los campeones que más destacan en su rol, **A** elecciones muy sólidas, **B** campeones equilibrados y **C** los que hoy lo tienen más difícil. Algunas añaden S+ o D.',
              'Lo importante es que el tier es **por rol**: un campeón puede ser S en jungla y B en la calle superior.',
            ],
          },
          {
            h: 'Cómo se calcula',
            p: [
              'Las tier lists basadas en datos combinan sobre todo dos cifras: el **porcentaje de victorias** (cuántas partidas gana el campeón en ese rol) y el **uso** o *pick rate* (cuántas veces se elige). Algunas añaden la tasa de bloqueos o el rendimiento en elos altos.',
              'Otras tier lists son **de opinión**: las hace un jugador o un equipo según su experiencia. No son malas, pero conviene saber cuál estás leyendo.',
            ],
          },
          {
            h: 'Por qué importa el número de partidas',
            p: [
              'Un 60 % de victorias con 20 partidas dice poco: con unas pocas derrotas más puede quedarse en 50 %. Un 52 % con miles de partidas es mucho más fiable. Por eso una buena tier list enseña la muestra, o al menos no deja subir a lo más alto a un campeón con pocos datos.',
              'También importa **qué partidas**: no rinde igual un campeón en Hierro que en Esmeralda+, y un parche nuevo puede cambiarlo todo en un día.',
            ],
          },
          {
            h: 'Cómo usarla sin que te engañe',
            lista: [
              'Mírala por **tu rol** y en el **parche actual**.',
              'Un campeón que dominas en tier B suele rendir más que uno en tier S que no conoces.',
              'Úsala para descubrir campeones y para saber qué está fuerte contra ti.',
              'Desconfía de cifras sin número de partidas.',
            ],
          },
          {
            h: 'La tier list de Coach LoL IA',
            p: [
              'En el apartado Campeones de la app, cada campeón recibe un tier S, A, B o C por rol y por modo (Clasificatoria, ARAM, ARAM: Caos y Arena) que combina victorias y uso, con partidas de jugadores Esmeralda+ en EUW, LAN y LAS. Los que tienen menos de 30 partidas nunca pasan de B y llevan el aviso «Datos limitados». [Más detalles sobre los datos](@builds).',
            ],
          },
        ],
      },
      guiaRunas: {
        resumen: 'Runas, hechizos y objetos en un clic desde la selección de campeón, sin perder tus páginas.',
        h1: 'Cómo importar runas automáticamente en LoL',
        entradilla:
          'Preparar las runas en cada selección de campeón lleva tiempo, sobre todo si cambias de campeón a última hora. Con una app que use la API oficial del cliente puedes importar runas, hechizos y objetos en un clic. Así se hace con Coach LoL IA.',
        secciones: [
          {
            h: 'Cómo funciona la importación',
            p: [
              'El cliente de League of Legends tiene una API local, la **LCU API**, que Riot pone a disposición de las herramientas de terceros. A través de ella, una app puede crear páginas de runas, elegir hechizos de invocador y añadir conjuntos de objetos a la tienda, igual que harías tú a mano.',
              'Coach LoL IA se conecta leyendo el archivo *lockfile* del cliente (puerto y contraseña locales). No te pide tu cuenta ni tu contraseña de Riot.',
            ],
          },
          {
            h: 'Paso a paso',
            ordenada: true,
            lista: [
              '[Descarga Coach LoL IA](@descargar) e instálala en Windows 10 u 11.',
              'Abre la app y el cliente de LoL, en cualquier orden. La app detecta el cliente sola.',
              'Entra en la selección de campeón. La app reconoce tu campeón y el rol que te asigna el cliente.',
              'Revisa la build: runas (puedes elegir entre varias páginas), hechizos, objetos y orden de habilidades.',
              'Pulsa **«Importar»**. Si prefieres no tocar nada, activa la importación automática en Ajustes.',
            ],
          },
          {
            h: 'Tus páginas de runas están a salvo',
            p: [
              'La app crea sus propias páginas con el prefijo **«Coach:»**, por ejemplo «Coach: Ahri Central», y reemplaza la suya si ya existe. Si no te queda ninguna libre, solo sustituye una de las tuyas cuando pulsas «Importar» y lo confirmas (nunca una predefinida); la importación automática nunca borra nada.',
            ],
          },
          {
            h: 'Si algo no funciona',
            lista: [
              '**«Esperando al cliente de League of Legends…»**: abre el cliente; la app lo vuelve a intentar cada 3 segundos.',
              '**«Build no disponible»**: hay menos de 10 partidas de ese campeón en ese rol. Prueba otro rol o espera a la siguiente actualización.',
              '**No se crea la página**: comprueba que tienes una página libre o una página «Coach:» que se pueda reemplazar.',
              'Si sigue fallando, pregunta al asistente IA o escríbenos a support@coachlolia.com.',
            ],
          },
          {
            h: 'Hacerlo a mano también vale',
            p: [
              'Si prefieres no instalar nada, puedes copiar la build a mano en el cliente: crea una página de runas, elige los hechizos y compra siguiendo el orden de objetos. La importación solo te ahorra ese tiempo en la selección de campeón.',
            ],
          },
        ],
      },
    },
  },

  noEncontrada: {
    h1: 'Página no encontrada',
    texto: 'La página que buscas no existe o ha cambiado de dirección.',
    volver: 'Ir a la portada',
    otros: 'Otros idiomas',
  },
};

export type Textos = typeof es;
