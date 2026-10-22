// Texte der Website auf Deutsch. Gleiche Struktur wie es.ts (ein Test prüft, dass die Schlüssel übereinstimmen).
import { MIN_PARTIDAS_BUILD, PARTIDAS_DATOS_LIMITADOS } from '../../lib/cifras.ts';
import type { Textos } from './es.ts';

const CORREO = 'support@coachlolia.com';

export const de: Textos = {
  meta: {
    lema: 'Dein League-of-Legends-Coach, in Echtzeit und in deiner Sprache.',
    paginas: {
      inicio: {
        titulo: 'Coach LoL IA: kostenlose LoL-Builds, Tier-List und Overlay',
        descripcion:
          'Kostenlose App für League of Legends: Smaragd+-Builds, Runen per Klick, Tier-List und ein Ingame-Coach mit Overlay und Sprachausgabe. Nur offizielle Riot-APIs.',
      },
      descargar: {
        titulo: 'Coach LoL IA kostenlos für Windows 10 und 11 herunterladen',
        descripcion:
          'Lade Coach LoL IA kostenlos für Windows 10 und 11 herunter: LoL-Builds, Runen-Import und Overlay mit Sprachausgabe. Offizieller Installer mit Auto-Updates.',
      },
      apoyar: {
        titulo: 'Unterstütze Coach LoL IA, die kostenlose LoL-App für alle',
        descripcion:
          'Coach LoL IA ist kostenlos und hat keine Werbung in der App. Erfahre, wie sich das Projekt finanziert und wie du es mit einer freiwilligen Spende unterstützt.',
      },
      novedades: {
        titulo: 'Neuigkeiten von Coach LoL IA: Versionen und Änderungen',
        descripcion:
          'Alle Versionen von Coach LoL IA, die neueste zuerst: Widget-Overlay, Ladebildschirm, Tier-List, ARAM- und Arena-Modus, wählbare Runen und vieles mehr.',
      },
      builds: {
        titulo: 'LoL-Builds und Tier-List aus Smaragd+-Spielen | Coach LoL IA',
        descripcion:
          'So berechnet Coach LoL IA seine League-of-Legends-Builds und die Tier-List: Smaragd+-Ranglistenspiele aus EUW, LAN und LAS, alle 6 Stunden neu berechnet.',
      },
      guias: {
        titulo: 'LoL-Ratgeber: Overlay, Tier-List und Runen | Coach LoL IA',
        descripcion:
          'Praktische League-of-Legends-Ratgeber: ein Overlay im Rahmen der Riot-Regeln nutzen, eine Tier-List richtig lesen und Runen automatisch importieren.',
      },
      guiaOverlay: {
        titulo: 'LoL-Overlay sicher nutzen: darauf solltest du achten',
        descripcion:
          'Was Riot einem League-of-Legends-Overlay erlaubt, an welchen Warnsignalen du erkennst, dass eine App zu weit geht, und wie du es im Randlos-Modus einrichtest.',
      },
      guiaTierList: {
        titulo: 'Was ist eine LoL-Tier-List und wie liest man sie?',
        descripcion:
          'Was S-, A-, B- und C-Tier in League of Legends bedeuten, wie eine Tier-List aus Siegesrate und Pickrate entsteht und warum die Stichprobengröße zählt.',
      },
      guiaRunas: {
        titulo: 'Runen in LoL automatisch importieren | Coach LoL IA',
        descripcion:
          'Schritt für Schritt: Runen, Beschwörerzauber und Item-Sets in League of Legends per Klick aus der Championauswahl importieren, ohne deine Seiten zu verlieren.',
      },
      privacidad: {
        titulo: 'Datenschutzerklärung · Coach LoL IA',
        descripcion: 'Welche Daten Coach LoL IA verarbeitet, wozu, auf welcher Rechtsgrundlage und welche Rechte du hast.',
      },
      terminos: {
        titulo: 'Nutzungsbedingungen · Coach LoL IA',
        descripcion: 'Nutzungsbedingungen von Coach LoL IA, einer kostenlosen App für League of Legends, die nur offizielle Riot-APIs nutzt.',
      },
      cookies: {
        titulo: 'Cookie-Richtlinie · Coach LoL IA',
        descripcion: 'Welche Cookies die Website von Coach LoL IA nutzt, wann Werbung geladen wird und wie du deine Auswahl jederzeit änderst.',
      },
      noEncontrada: {
        titulo: 'Seite nicht gefunden · Coach LoL IA',
        descripcion: 'Die gesuchte Seite gibt es nicht oder sie ist umgezogen.',
      },
    },
    ogAlt: 'Coach LoL IA: Builds, Tier-List und Ingame-Coach für League of Legends, kostenlos.',
  },

  comun: {
    saltar: 'Zum Inhalt springen',
    menuAbrir: 'Menü öffnen',
    menuCerrar: 'Menü schließen',
    inicioAria: 'Coach LoL IA, Startseite',
    navAria: 'Hauptnavigation',
    idioma: 'Sprache',
    idiomaAria: 'Sprache wechseln',
    nav: {
      queHace: 'Funktionen',
      enAccion: 'In Aktion',
      builds: 'Builds & Tier-List',
      guias: 'Ratgeber',
      faq: 'FAQ',
      novedades: 'Neuigkeiten',
    },
    descargar: 'Download',
    apoyar: 'Unterstützen',
    descargarWindows: 'Für Windows herunterladen',
    apoyaProyecto: 'Projekt unterstützen',
    capturaReal: 'Echter Screenshot',
    publicidad: 'Werbung',
    migas: 'Brotkrumennavigation',
    inicio: 'Start',
    ayudaTitulo: 'Brauchst du Hilfe?',
    ayudaTexto: 'Schreib uns, wir antworten so schnell wie möglich.',
    discord: 'Tritt der Discord-Community bei',
    soporteAria: 'Support',
    leerGuia: 'Ratgeber lesen',
    actualizado: 'Aktualisiert am',
  },

  pie: {
    descripcion: 'Echtzeit-Coach für League of Legends, in 5 Sprachen. Version',
    soporte: 'Support',
    producto: 'Produkt',
    proyecto: 'Projekt',
    legal: 'Rechtliches',
    recursos: 'Ressourcen',
    idiomas: 'Sprachen',
    enlaces: {
      descargar: 'Download',
      novedades: 'Neuigkeiten',
      apoyar: 'Projekt unterstützen',
      hojaDeRuta: 'Roadmap',
      arquitectura: 'Architektur',
      seguridad: 'Sicherheit und Vanguard',
      calidad: 'Qualität',
      github: 'Code auf GitHub',
      discord: 'Discord-Community',
      builds: 'Builds & Tier-List',
      guias: 'Ratgeber',
      privacidad: 'Datenschutz',
      terminos: 'Nutzungsbedingungen',
      cookies: 'Cookies',
    },
    avisoRiot:
      "Coach LoL IA wird nicht von Riot Games unterstützt und gibt nicht die Ansichten oder Meinungen von Riot Games oder einer anderen Person wieder, die offiziell an der Produktion oder Verwaltung von Riot-Games-Eigentum beteiligt ist. Riot Games und alle zugehörigen Eigentumsrechte sind Marken oder eingetragene Marken von Riot Games, Inc.",
    marca:
      'League of Legends ist eine eingetragene Marke von Riot Games, Inc. Bilder aus League of Legends © Riot Games, Inc.',
  },

  cookies: {
    region: 'Cookie-Einwilligung',
    titulo: 'Cookies und Werbung',
    texto:
      'Diese Website zeigt Werbung von Google AdSense, die Cookies von Drittanbietern verwendet. Sie wird nur geladen, wenn du zustimmst. Du kannst deine Meinung jederzeit auf der',
    enlace: 'Cookie-Seite ändern',
    rechazar: 'Ablehnen',
    aceptar: 'Akzeptieren',
  },

  asistente: {
    boton: 'KI-Assistent',
    titulo: 'KI-Assistent von Coach LoL IA',
    cerrar: 'Assistent schließen',
    intro: 'Frag mich, wie du die App installierst, Builds importierst oder das Overlay nutzt.',
    conversacion: 'Unterhaltung',
    pregunta: 'Deine Frage',
    placeholder: 'Schreib deine Frage…',
    enviar: 'Senden',
    nota: `KI-generierte Antworten; sie können Fehler enthalten. Bei Problemen schreib an ${CORREO}.`,
    escribiendo: 'Schreibt…',
    tu: 'Du: ',
    asistente: 'Assistent: ',
    errores: {
      noDisponible: `Der Assistent ist noch nicht verfügbar. Schreib uns in der Zwischenzeit an ${CORREO}.`,
      limite: 'Du hast viele Fragen hintereinander gestellt. Warte kurz und versuch es noch einmal.',
      fallo: 'Der Assistent konnte gerade nicht antworten. Versuch es in ein paar Minuten noch einmal.',
      noValido: 'Deine Nachricht konnte nicht gesendet werden. Schreib eine Frage mit bis zu 1000 Zeichen.',
      sinConexion: 'Keine Verbindung zum Server. Prüfe deine Verbindung und versuch es noch einmal.',
    },
  },

  diagrama: {
    aria: 'Architekturdiagramm (auf schmalen Bildschirmen horizontal scrollen)',
    titulo: 'Architektur von Coach LoL IA',
    desc: 'Auf dem PC des Spielers verbindet sich die App (Electron) über die LCU API mit dem League-of-Legends-Client und über die Live Client Data API auf 127.0.0.1:2999 mit dem Spiel. In der Cloud sammelt der Build-Server (Fastify und SQLite) Spiele aus der Riot-API, wertet sie alle 6 Stunden aus und liefert die Builds per HTTPS an die App. Die App lädt Namen und Icons von Data Dragon. Die Website (Astro, GitHub Pages) und die Hilfe-Ansicht der App fragen den KI-Assistenten des Servers, der die Antworten mit Anthropic erzeugt. Die App nutzt nur offizielle Riot-APIs und greift nie in den Spielprozess ein.',
    pc: 'PC DES SPIELERS · WINDOWS 10/11',
    nube: 'CLOUD',
    cliente: 'LoL-Client',
    clienteSub: 'Lobby und Auswahl',
    partida: 'Laufendes Spiel',
    partidaSub: 'das Spiel (unangetastet)',
    vanguard1: 'kein Speicherlesen, keine Injection;',
    vanguard2: 'keine Screenshots, keine Tasten',
    procesoPrincipal: 'HAUPTPROZESS (Node.js)',
    conectorLcu: 'LCU-Connector',
    conectorPartida: 'Spiel-Connector · jede 1 s',
    motor: 'Tipp-Engine (Regeln)',
    clienteBuilds: 'Build-Client + Cache',
    asistenteSoporte: 'Support-Assistent',
    datosEstaticos: 'Statische Daten',
    ventana: 'Hauptfenster (React)',
    ventanaSub: 'Build, Import, Einstellungen',
    overlay: 'Overlay (React)',
    overlaySub: 'transparent, klickdurchlässig, Sprache',
    servidor: 'Server · Fastify + SQLite',
    recolector: 'Collector',
    recolectorSub: 'Solo/Duo, Smaragd+, EUW · LAN · LAS',
    agregador: 'Aggregator · alle 6 h',
    agregadorSub: `≥ 200 Spiele pro Patch · mindestens ${MIN_PARTIDAS_BUILD}`,
    api: 'Öffentliche API',
    asistenteIa: 'KI-Assistent',
    asistenteIaSub: 'POST /api/asistente · mit Nutzungslimit',
    apiRiot: 'Riot-API',
    modeloIa: 'Modell des KI-Assistenten',
    dataDragonSub: 'Namen und Icons',
    estaWeb: 'Diese Website',
    claves1: 'RIOT_API_KEY und ANTHROPIC_API_KEY gibt es nur als',
    claves2: 'Umgebungsvariablen auf dem Server.',
    ayuda: 'Hilfe',
    parche: 'Patch',
    partidas: 'Spiele',
    pie: 'Architekturdiagramm. Blaue Pfeile stehen für Spiel- und Build-Daten, goldene für Fragen an den KI-Assistenten.',
    respuestas: 'Antworten',
  },

  inicio: {
    etiquetaVersion: 'Neue Version',
    hero: {
      desc: 'Die beliebtesten Builds von Smaragd+-Spielern mit ihren Statistiken in der Championauswahl, mit einem Klick in den Client importiert, ein Ladebildschirm mit beiden Teams und ein Coach, der dich im Spiel mit einem Widget-Overlay und Sprachausgabe auf dem Laufenden hält. Nur mit den offiziellen Riot-APIs.',
      meta: 'Kostenlos · Windows 10/11 · Nur offizielle Riot-APIs · Code auf',
      capturaAlt:
        'Screenshot von Coach LoL IA in der Champion-Ansicht: Ahri auf der Mid-Position mit ihrer Siegesrate, 33 Spielen und Daten aus Patch 16.20 sowie der Importieren-Schaltfläche; Runen aus Dominanz und Zauberei, Blitz und Entzünden, Start-Items, Kern-Items und Stiefel sowie die Tabelle der Skill-Reihenfolge mit Priorität Q, W, E.',
      capturaPie: 'Champion-Ansicht mit echten Daten vom Build-Server.',
    },
    cifras: [
      ['Regionen', 'EUW · LAN · LAS'],
      ['Ausgewertete Spiele', 'Smaragd+'],
      ['Build-Aktualisierung', 'alle 6 h'],
    ],
    cifraPruebas: 'Automatisierte Tests',

    enAccion: {
      antetitulo: 'In Aktion',
      titulo: 'So sieht es in Aktion aus',
      intro:
        'Echte Clips: ein Zed-Jungle-Spiel mit aktivem Overlay und eine Tour durch die App. Die Videos haben keinen Ton und laden erst, wenn du zu ihnen scrollst.',
      videos: {
        partida: {
          titulo: 'Der Coach in einem echten Spiel',
          texto:
            'Countdown der Objectives, dein CS und KDA live und der Pfeil, der zeigt, welche Fähigkeit du skillen solltest. Aufgenommen in einem echten Zed-Jungle-Spiel.',
          etiqueta:
            'Video eines echten League-of-Legends-Spiels mit Zed im Jungle: Das Overlay von Coach LoL IA zeigt oben den Countdown der Objectives, den Drachen bei 0:38, das CS- und KDA-Widget, das grün wird, und den goldenen Pfeil beim Level-up.',
        },
        tour: {
          titulo: 'Tour durch Coach LoL IA 3.0',
          texto:
            'Ladebildschirm (mit Beispielspielern), Smaragd+-Build, Import per Klick, Hinweise, Jungle-Timer, Tier-List sowie die Modi ARAM und Arena.',
          etiqueta:
            'Vorstellungsvideo von Coach LoL IA 3.0: Ladebildschirm mit Beispieldaten, Ahris Mid-Build, die Importieren-Schaltfläche, Overlay mit Objectives, Kaufhinweis, CS und KDA, Timer auf einer schematischen Minimap und die Tier-List nach Position und Modus.',
        },
      },
      textosVideo: 'Die Texte im Video sind auf Spanisch; deutsche Untertitel sind standardmäßig aktiviert.',
      reproducir: 'Abspielen',
      fotos: [
        {
          nombre: 'partida-objetivos',
          alt: 'Screenshot eines echten League-of-Legends-Spiels mit Zed im Jungle bei 4:22: oben die Objective-Leiste von Coach LoL IA mit dem Drachen bei 0:38, rechts das CS-Widget (20, bei 4,6 pro Minute) und KDA 0/0/1.',
          pie: 'Objective-Leiste und CS in einem echten Spiel (Minute 4).',
        },
        {
          nombre: 'partida-dragon',
          alt: 'Screenshot eines echten League-of-Legends-Spiels: Zed direkt nach der Meldung über einen besiegten Gegner, mit der Objective-Leiste von Coach LoL IA oben (Drache bei 0:20) und dem CS-Widget, schon grün bei 6,4 pro Minute, in der rechten oberen Ecke.',
          pie: 'Das CS-Widget wird grün, sobald du dein Ziel übertriffst.',
        },
      ],
    },

    queHace: {
      antetitulo: 'Funktionen',
      titulo: 'Alles, was du brauchst, von der Auswahl bis zum Sieg',
      intro:
        'Coach LoL IA begleitet dich in den zwei Momenten, die am meisten zählen: in der Championauswahl, wo er dir die beliebtesten Optionen mit ihren Statistiken zeigt, damit du wählst, und im Spiel, wo er dich an das Wichtige erinnert, ohne dass du das Spiel verlassen musst.',
      funciones: [
        {
          icono: 'capas',
          titulo: 'Builds nach Champion und Position',
          texto:
            'Bis zu 3 Item-Optionen und 3 Runenseiten unter den meistgespielten, jeweils mit Pick- und Siegesrate: Du entscheidest. Runen, Beschwörerzauber, Start-Items, 3-Item-Kern, Stiefel, situative Items und Skill-Reihenfolge, jeweils mit Siegesrate und Anzahl der Spiele dahinter. Veröffentlicht ab 10 Spielen; solche mit wenigen Spielen tragen das Abzeichen „Begrenzte Daten“.',
        },
        {
          icono: 'grafico',
          titulo: 'Champions und Tier-List',
          texto:
            'Der Bereich Champions ordnet alle Champions pro Position in die Tiers S, A, B und C nach Siegesrate und Pickrate, mit Suche und dem vollständigen Build für jeden.',
        },
        {
          icono: 'usuario',
          titulo: 'Ladebildschirm',
          texto:
            'Während das Spiel lädt, zeigt das Overlay alle zehn Spieler im Vollbild, deine eigene Karte hervorgehoben: offizieller Rang, Meisterschaft und Siegesrate des Champions auf seiner Position, nur mit positiven oder neutralen Labels. Die Leertaste blendet es aus.',
        },
        {
          icono: 'descarga',
          titulo: 'Import per Klick',
          texto:
            'Erstellt die Runenseite „Coach: <Champion> <Position>“, wählt die Beschwörerzauber und fügt dem Shop ein Item-Set hinzu. Fasst nur Seiten mit dem Präfix „Coach:“ an; hast du keine freie Seite mehr, ersetzt sie eine deiner Seiten nur, wenn du auf „Importieren“ klickst und es bestätigst.',
        },
        {
          icono: 'brujula',
          titulo: 'Automatische Position',
          texto:
            'Übernimmt die Position, die dir der Client zuweist. Gibt es keine, nimmt er die meistgespielte Position dieses Champions; du kannst sie im Positionswähler ändern.',
        },
        {
          icono: 'monitor',
          titulo: 'Widget-Overlay',
          texto:
            'Objective-Leiste oben (mit dem Typ des nächsten Drachen), ein Pfeil über der Fähigkeit zum Skillen, dein CS und KDA, der Kaufhinweis und Meldungen. Jedes Widget lässt sich einzeln verschieben, skalieren und ausschalten.',
        },
        {
          icono: 'voz',
          titulo: 'Viel mehr Sprachausgabe',
          texto:
            'Eine natürliche, neuronale Offline-Stimme in allen 5 Sprachen mit 460 Sätzen pro Sprache samt Varianten: Objectives, Käufe, Farmen, Sicht, Kämpfe, Spielphasen und Jungle, einer nach dem anderen und das Dringendste zuerst. Du wählst die Detailstufe und welche Kategorien du hörst.',
        },
        {
          icono: 'reloj',
          titulo: 'Jungle-Timer',
          texto:
            'Optional und standardmäßig aus: Du markierst, wann du ein Camp auf deiner Seite oder eine Scuttle Crab cleared hast, und die App zählt bis zum Respawn herunter, auch direkt auf der Minimap.',
        },
        {
          icono: 'diana',
          titulo: 'ARAM, ARAM: Chaos und Arena',
          texto:
            'Jeder Modus mit eigenen Builds und eigener Tier-List (mit den meistgewählten Augments in ARAM: Chaos und Arena) und einem Overlay, das in jedem Modus nur zeigt, was dort Sinn ergibt.',
        },
        {
          icono: 'nube',
          titulo: 'Funktioniert offline',
          texto:
            'Die letzten Builds werden zwischengespeichert. Antwortet der Server nicht, nutzt die App die gespeicherte Kopie und sagt dir das: „Offline-Daten (Patch X)“.',
        },
        {
          icono: 'refrescar',
          titulo: 'Aktualisiert sich selbst',
          texto:
            'Beim Öffnen lädt die App die neueste Version von GitHub Releases, installiert sie und startet neu; nie mitten im Spiel, sie wartet, bis es vorbei ist. Data Dragon und die Builds folgen dem aktuellen Patch.',
        },
        {
          icono: 'idioma',
          titulo: 'In 5 Sprachen',
          texto:
            'App, Overlay, Sprachausgabe und Assistent auf Spanisch, Englisch, Portugiesisch (Brasilien), Französisch und Deutsch. Die Sprache wählst du in den Einstellungen; standardmäßig die deines Windows. Diese Website ebenfalls in allen fünf.',
        },
      ],
      vitrina: {
        titulo: 'Du entscheidest, was der Coach dir sagt',
        texto:
          'In der Overlay-Ansicht siehst du eine Vorschau der Widgets, wählst aus, welche du willst, wie groß sie sind und wo sie sitzen, und bestimmst, was dir die Stimme sagt: die Detailstufe (Einfach, Normal oder Vollständig) und jede Kategorie einzeln.',
        lista: [
          'Vorschau der Widgets genau so, wie sie im Spiel aussehen',
          '„Verschieben und kalibrieren“, um jedes Widget so zu platzieren, dass es nichts verdeckt',
          'Gesamte Deckkraft sowie Größe und Ein/Aus-Schalter für jedes Widget',
          'Natürliche oder Windows-Stimme, Lautstärke, Detailstufe und Kategorien, mit „Stimme testen“',
        ],
        alt: 'Screenshot der Overlay-Ansicht von Coach LoL IA: Vorschau mit Objective-Leiste, CS und KDA, dem Hinweis „Level 6: skill R“, dem Pfeil über R und dem Kaufhinweis; rechts die Schaltfläche „Verschieben und kalibrieren“, die Deckkraft sowie Schalter und Größen der Widgets Objectives, Fähigkeitspfeil und Leistung (CS und KDA).',
        pie: 'Overlay-Ansicht: Widgets, Position, Größe und Stimme.',
      },
    },

    novedades3: {
      antetitulo: 'Neu in 3.0',
      titulo: 'Vor, während und zwischen den Spielen',
      intro:
        'Version 3.0 bringt den Ladebildschirm, den Bereich Champions mit Tier-List, die Modi ARAM, ARAM: Chaos und Arena sowie die Jungle-Timer. 3.0.1 und 3.0.2 ergänzen wählbare Runen, das Design „Schatten“ und ein Overlay, das sich an 2K- und 4K-Bildschirme anpasst. Alles mit Daten, die das Spiel oder die offizielle Riot-API ohnehin liefern. [Alle Neuigkeiten ansehen](@novedades).',
      carga: {
        titulo: 'Ladebildschirm',
        texto:
          'Während das Spiel lädt, ordnet das Overlay die zehn Spieler wie das Spiel an: Gegner oben, dein Team unten. Zu jedem siehst du den offiziellen Solo/Duo-Rang, die Meisterschaft mit dem Champion und die Siegesrate dieses Champions auf seiner Position.',
        lista: [
          'Nur positive oder neutrale Labels: „Spezialist für …“, „Skaliert ins Lategame“',
          'Kein erfundenes MMR und keine negativen Labels für irgendwen',
          'Blendet sich automatisch aus, sobald das Spiel beginnt',
        ],
        alt: 'Screenshot des Ladebildschirms im Overlay von Coach LoL IA: zehn Spielerkarten mit Beispielnamen, fünf Gegner oben und fünf Verbündete unten, jeweils mit Champion, Position, Rang (von Gold bis Diamant oder ohne Rang), Siegen und Niederlagen, Meisterschaft, Siegesrate des Champions und Labels wie „Darius-Spezialist“, „Positive Serie in dieser Saison“ oder „Schützt sein Team“.',
        pie: 'Ladebildschirm mit Beispielspielern.',
      },
      campeones: {
        titulo: 'Champions und Tier-List',
        texto:
          'Alle Champions nach Position, mit ihrem Tier (S, A, B oder C) nach Siegesrate und Pickrate, der Anzahl der Spiele und dem vollständigen Build per Klick. Ein Wähler wechselt zwischen Rangliste, ARAM, ARAM: Chaos und Arena.',
        lista: [
          'Suche, Positionsfilter und Sortierung nach Tier, Siegesrate, Pickrate oder Spielen',
          'Hinweis „Begrenzte Daten“ bei Champions mit weniger als 30 Spielen',
          'In Arena: durchschnittliche Platzierung und Top-4-Rate',
        ],
        alt: 'Screenshot des Bereichs Champions von Coach LoL IA: Ranglisten-Tier-List mit Daten aus Patch 16.20, dem Moduswähler (Rangliste, ARAM, ARAM: Chaos, Arena), Suche, Positionsfiltern und einer Tabelle mit Champion, Position, Tier, Siegesrate, Pickrate und Spielen; oben Yunara und Viego im S-Tier, weiter unten B-Tier-Champions mit dem Hinweis auf begrenzte Daten.',
        pie: 'Bereich Champions: Tier-List nach Modus und Position.',
        enlace: 'So werden Builds und Tier-List berechnet',
      },
      jungla: {
        titulo: 'Jungle-Timer, wie du sie willst',
        texto:
          'Optional und standardmäßig aus. Wenn du ein Camp auf deiner Seite oder eine Scuttle Crab cleared hast, markierst du das per Klick oder mit deiner Taste, und die App zählt den Respawn direkt auf der Minimap herunter, wie die Timer des Spiels. Mit Alt+Umschalt+L blendest du sie ein oder aus.',
        lista: [
          'Nur dein Jungle und die beiden Scuttle Crabs: nie die Camps des Gegners',
          'Gold in den letzten 30 Sekunden und ein Haken, sobald das Camp wieder da ist',
          '„Gromp in 30 Sekunden“ per Sprachausgabe, wenn du willst',
        ],
        alt: 'Nahaufnahme der Jungle-Timer von Coach LoL IA auf einer schematischen Minimap der blauen Seite: Countdowns von 15 s und 1:40 bei zwei Camps, 1:08 und 1:13 bei zwei weiteren und ein Haken bei denen, die schon respawnt sind.',
        pie: 'Timer auf der Minimap (schematische Karte).',
      },
    },

    comoFunciona: {
      antetitulo: 'So funktioniert’s',
      titulo: 'Von der Championauswahl ins Spiel',
      intro: 'Keine Einrichtung nötig: Öffne die App vor oder nach dem Client, sie erledigt den Rest.',
      pasos: [
        {
          titulo: 'App und LoL-Client öffnen',
          texto:
            'Coach LoL IA findet den Client über dessen Lockfile (lokaler Port und Passwort). Solange er ihn nicht findet, zeigt er „Warte auf den League-of-Legends-Client…“ und versucht es alle 3 Sekunden erneut.',
          detalle: 'LCU API · WebSocket',
        },
        {
          titulo: 'Champion wählen',
          texto:
            'Der Client meldet Champion und Position per WebSocket. Die App fragt den Build beim Server an und zeigt ihn in unter 2 Sekunden. „Importieren“ (oder der automatische Import) übernimmt Runen, Beschwörerzauber und Items.',
          detalle: 'Championauswahl',
        },
        {
          titulo: 'Mit dem Coach spielen',
          texto:
            'Während des Ladens zeigt das Overlay den Ladebildschirm mit beiden Teams. Im Spiel fragt die App jede Sekunde die Live Client Data API unter https://127.0.0.1:2999 ab. Die Tipp-Engine vergleicht deinen Stand mit dem Build und zeigt Objectives, die Fähigkeit zum Skillen, CS und KDA, den nächsten Kauf und Hinweise. Strg+Umschalt+O blendet es aus oder ein.',
          detalle: 'Live Client Data API',
        },
        {
          titulo: 'Spielende',
          texto:
            'Wenn das Spiel endet, blendet sich das Overlay aus und die App fragt Port 2999 nicht mehr ab. Die nächste Championauswahl startet den Zyklus neu.',
          detalle: 'Keine Restprozesse',
        },
      ],
      overlay: {
        alt: 'Screenshot des Overlays von Coach LoL IA über dem Artwork von Jinx: oben die Objective-Leiste (Voidgrubs verfügbar, Drache bei 0:38, Herold bei 5:38 und Baron bei 10:38); rechts der CS (61, bei 6,5 pro Minute gegenüber einem Ziel von 8); links der Hinweis „Level 6: skill R“; unten ein Pfeil über R und der Hinweis „Du kannst jetzt Runaans Hurrikan kaufen“.',
        pie: 'Overlay im Spiel, jedes Widget an seinem Platz.',
        titulo: 'Was dir der Coach im Spiel sagt',
        avisos: [
          ['Kauf', '„Du kannst Runaans Hurrikan kaufen“'],
          ['Fähigkeiten', '„Level 6: skill R“'],
          ['Objectives', 'Bei 1 Minute, bei 30 Sekunden und beim Spawn, mit dem Drachentyp'],
          ['CS', '„Du liegst unter deinem Farmziel“ (in Minute 5, 10, 15 und 20)'],
          ['Sicht', '„Kauf ein Kontrollauge“'],
          ['Jungle', '„Gromp in 30 Sekunden“ (nur, wenn du die Timer nutzt)'],
          ['Gegnerischer Jungler', '„Der gegnerische Jungler ist gerade bot aufgetaucht (Kill)“'],
          ['Spielphase', '„Midgame: Grupp dich mit deinem Team für die Objectives“'],
        ],
        nota: 'Jedes Widget hat seinen Platz: Objectives oben, der Pfeil über deiner Fähigkeitenleiste und der Rest, wo du willst. Die Stimme sagt einen Satz nach dem anderen, das Dringendste zuerst, und derselbe Hinweis wiederholt sich erst, wenn sich die Lage ändert. Dein CS wird mit einem Richtwert deiner Position verglichen, ohne rote Farben oder negative Meldungen.',
      },
      junglaEnemiga: {
        titulo: 'Der gegnerische Jungler, nur mit dem, was das Spiel schon zeigt',
        nota1:
          'Wenn der gegnerische Jungler an einem Kill beteiligt ist, zeigt der Kill-Feed des Spiels das an und die App sagt es dir: „Der gegnerische Jungler ist gerade bot aufgetaucht (Kill)“. Das ist kein Tracking: Die App kennt weder seine Position noch seine Abklingzeiten, und der Hinweis bezieht sich immer auf diesen Kill.',
        nota2:
          'Wenn du willst, kannst du eine Schätzung seines üblichen Pfads aktivieren (standardmäßig aus): auf welcher Seite dieser Champion meist startet und welche Lane er meist zuerst besucht, laut unseren Spielen. Das ist, was er üblicherweise tut, nicht, was er in deinem Spiel tut.',
        alt: 'Screenshot des Overlays von Coach LoL IA mit dem Hinweis „Der gegnerische Jungler ist gerade bot aufgetaucht (Kill)“, neben Objective-Leiste, CS, dem Pfeil über R, dem Kaufhinweis und den Jungle-Timern auf einer schematischen Minimap.',
        pie: 'Hinweis aus dem Kill-Feed.',
      },
    },

    arquitectura: {
      antetitulo: 'Architektur',
      titulo: 'Drei Bausteine, die zusammenarbeiten',
      intro:
        'Ein Monorepo mit der Desktop-App, dem Build-Server und dieser Website. Der Riot-API-Schlüssel liegt nur auf dem Server; die ausgelieferte App enthält keine Geheimnisse.',
      piezas: [
        {
          titulo: 'Desktop-App',
          texto:
            'Electron mit zwei React-Fenstern. Der Hauptprozess vereint den **LCU-Connector** (Client), den **Spiel-Connector** (Port 2999), die **Tipp-Engine** (eine reine, deterministische Funktion: Spielstand + Build + Position → Hinweise), den Build-Client mit Festplatten-Cache und die Data-Dragon-Daten.',
        },
        {
          titulo: 'Build-Server',
          texto:
            'Node mit Fastify und SQLite, verpackt in Docker. Der Collector lädt Spiele aus der Riot-API und hält dabei deren Rate-Limits ein; der Aggregator berechnet die Builds alle 6 Stunden und die öffentliche API liefert sie als JSON mit Patch und Berechnungsdatum.',
        },
        {
          titulo: 'Website und Assistent',
          texto:
            'Diese statische Website (Astro) wird auf GitHub Pages veröffentlicht. Ihr KI-Assistent fragt, wie die Hilfe-Ansicht der App, beim Server nach, der die Nutzung begrenzt und als Einziger den Modellschlüssel hat.',
        },
      ],
    },

    seguridad: {
      antetitulo: 'Sicherheit und Vanguard',
      titulo: 'Nur offizielle APIs. Wir fassen das Spiel nie an',
      intro:
        'Vanguard ist das Anti-Cheat-System von Riot und überwacht den Spielprozess. Coach LoL IA ist so gebaut, dass es sich davon fernhält: Alles, was es weiß, stammt aus den Schnittstellen, die Riot für Drittanbieter-Tools veröffentlicht.',
      si: {
        titulo: 'Was es tut',
        lista: [
          'Liest das **Lockfile** des Clients, um sich mit der **LCU API** zu verbinden, einer lokalen, passwortgeschützten API.',
          'Fragt während des Spiels die schreibgeschützte **Live Client Data API** unter `127.0.0.1:2999` ab.',
          'Lädt Namen und Icons von **Data Dragon**, dem öffentlichen Dienst von Riot.',
          'Zeigt das Overlay als normales Windows-Fenster, transparent und klickdurchlässig.',
          'Registriert das Tastenkürzel über den globalen Shortcut von Electron, ohne etwas an das Spiel zu senden.',
        ],
      },
      nunca: {
        titulo: 'Was es nie tut',
        lista: [
          'Den Speicher des Spiels lesen oder beschreiben.',
          'Code oder DLLs in irgendeinen Prozess injizieren.',
          'Screenshots machen, um sie auszuwerten.',
          'Tastatur- oder Mauseingaben simulieren oder Aktionen automatisieren.',
          'Deine Runenseiten oder Item-Sets löschen.',
        ],
      },
      noMuestra: {
        titulo: 'Was das Overlay nicht zeigt',
        lista: [
          'Timer für gegnerische Beschwörerzauber oder Ultimates.',
          'Timer für gegnerische Jungle-Camps: Jungle-Timer gibt es nur für deine Seite und du setzt sie selbst.',
          'Positionen von Gegnern oder Informationen, die du nicht auf dem Bildschirm siehst. Zum gegnerischen Jungler wiederholt es nur, was ohnehin im Kill-Feed steht.',
        ],
        nota: 'Bevor wir den Produktionsschlüssel von Riot beantragen, wird jeder Hinweis anhand der aktuellen Entwicklerrichtlinien geprüft.',
      },
      datos:
        '**Deine Daten:** Der Riot-API-Schlüssel liegt nur auf dem Server als Umgebungsvariable. Die App sendet nie deine Zugangsdaten. Sie fragt den Build für Champion und Position an und für den Ladebildschirm nur die PUUID (öffentliche Riot-Kennung) der zehn Spieler mit Champion und Position; die Riot-ID wird nicht gesendet. Mit der PUUID fragt der Server Rang und Meisterschaft über die offizielle API ab und hält die Antwort nur im Arbeitsspeicher, höchstens 10 Minuten lang. Für den KI-Coach (Analyse nach dem Spiel und Tipps in Leerlaufmomenten) sendet sie Statistiken, Items und Ereignisse des Spiels, ohne deine Riot ID; unser KI-Anbieter verarbeitet sie, gespeichert werden sie nicht.',
      guia: 'Ratgeber: ein LoL-Overlay sicher nutzen',
    },

    datos: {
      antetitulo: 'Daten',
      titulo: 'Builds aus echten Spielen, alle 6 h neu berechnet',
      intro:
        'Die Empfehlungen sind keine Meinungen: Sie stammen aus aktuellen Ranglistenspielen starker Spieler und werden von unserem eigenen Server verarbeitet.',
      tuberia: [
        {
          icono: 'usuario',
          titulo: 'Collector',
          texto:
            'Nutzt League-v4, um Spieler ab **Smaragd** in **EUW, LAN und LAS** zu finden, und Match-v5, um ihre **Solo/Duo-Ranglistenspiele** sowie ihre Spiele in **ARAM**, **ARAM: Chaos** und **Arena** herunterzuladen. Er hält Riots Limits ein und verarbeitet pro Zyklus und Region Tausende neue Spiele, verteilt auf die Modi; was ein Modus nicht braucht, geht an die Rangliste.',
        },
        {
          icono: 'grafico',
          titulo: 'Aggregator',
          texto:
            'Berechnet für jeden Champion und jede Position die häufigste Runenseite, Beschwörerzauber, Start-Items, den 3-Item-Kern, Stiefel, situative Items und die Skill-Reihenfolge, jeweils mit Siegesrate und Anzahl der Spiele. In ARAM und ARAM: Chaos gruppiert er nach Champion, in Arena kommen die durchschnittliche Platzierung des Champions und die meistgewählten Augments und Items hinzu, nur mit ihrer Pickrate. Außerdem berechnet er das Tier jedes Champions auf seiner Position.',
        },
        {
          icono: 'reloj',
          titulo: 'Veröffentlichung',
          texto:
            'Der Zyklus wiederholt sich **alle 6 h**. Die API liefert jeden Build mit Patch und Berechnungsdatum, und die App speichert ihn für die Offline-Nutzung zwischen.',
        },
      ],
      umbrales: [
        {
          cifra: '200',
          texto:
            '**Spiele im aktuellen Patch**, um nur Daten dieses Patches zu verwenden. Bei weniger als 200 Spielen werden sie mit dem vorherigen Patch kombiniert, und der Build weist darauf hin (`mezclaParches`).',
        },
        {
          cifra: String(MIN_PARTIDAS_BUILD),
          texto: `**${MIN_PARTIDAS_BUILD} Spiele insgesamt** als Minimum, um einen Build zu veröffentlichen. Von ${MIN_PARTIDAS_BUILD} bis ${PARTIDAS_DATOS_LIMITADOS - 1} Spielen trägt er das Abzeichen **„Begrenzte Daten“**, und unter ${MIN_PARTIDAS_BUILD} zeigt die App „Build nicht verfügbar“, statt sich einen auszudenken.`,
        },
        {
          cifra: '6 h',
          texto:
            '**zwischen den Aktualisierungen.** Wenn ein neuer Patch erscheint, ziehen Server und Data Dragon von selbst nach und die App zeigt „Daten aus Patch X.Y“.',
        },
      ],
    },

    tecnologias: {
      antetitulo: 'Technologien',
      titulo: 'Ein moderner Stack, durchgehend typisiert',
      intro:
        'Overwolf (zwingt dich, seine Plattform zu installieren) und Tauri (sein transparentes, klickdurchlässiges Overlay ist unter Windows weniger ausgereift) wurden verworfen. Electron bietet die nötige Kontrolle über das Overlay mit einer einzigen TypeScript-Codebasis.',
      lista: [
        ['Electron', 'Desktop-App: Hauptfenster und transparentes, klickdurchlässiges Overlay.'],
        ['React 19', 'Oberfläche beider Fenster, mit eigenem CSS auf Basis von Design-Tokens.'],
        ['TypeScript', 'Der gesamte Code (App, Server und gemeinsame Typen) mit strenger Prüfung.'],
        ['Node.js 24', 'Hauptprozess der App und Build-Server.'],
        ['SQLite', 'Datenbank des Servers (better-sqlite3): Spiele und Builds.'],
        ['Fastify', 'HTTP-API des Servers: Builds, Positionen und der KI-Assistent.'],
        ['Vitest', 'Automatisierte Tests für App, Server und gemeinsamen Code.'],
        ['Astro', 'Diese Website: statisch, ohne Client-Framework, veröffentlicht auf GitHub Pages.'],
        ['electron-builder', 'Windows-Installer und automatische Updates über GitHub Releases.'],
        ['Docker', 'Server-Image, das sich bei jedem Hoster deployen lässt.'],
        ['GitHub Actions', 'Continuous Integration und Deployment der Website.'],
      ],
    },

    calidad: {
      antetitulo: 'Qualität',
      titulo: 'Vor jeder Änderung getestet',
      cifra: 'automatisierte Vitest-Tests in App, Server und gemeinsamem Code, die bei jeder Änderung laufen.',
      tarjetas: [
        {
          icono: 'prueba',
          titulo: 'Tests mit echten Daten',
          texto:
            'Tipp-Engine und Aggregator werden mit aufgezeichneten Spielen getestet. Ein **Spielsimulator** spielt ein echtes Spiel als gefälschte Live Client Data API ab, und ein **simulierter LCU** erlaubt es, Championauswahl und Import zu testen, ohne LoL zu öffnen.',
        },
        {
          icono: 'ramas',
          titulo: 'Continuous Integration',
          texto:
            'GitHub Actions prüft die TypeScript-Typen jedes Pakets und führt bei jedem Push alle Tests unter Windows aus. Außerdem baut es das Docker-Image des Servers und prüft, ob SQLite darin lädt.',
        },
        {
          icono: 'revisar',
          titulo: 'Review Aufgabe für Aufgabe',
          texto:
            'Jede Version beginnt mit einer Spezifikation und einem Plan aus kleinen Aufgaben. Jede Aufgabe folgt TDD (erst ein fehlschlagender Test, dann der Code) und durchläuft vor dem Merge ein Spezifikations- und ein Qualitäts-Review.',
        },
        {
          icono: 'rayo',
          titulo: 'Echter Test im Spiel',
          texto:
            'Vor jeder Veröffentlichung wird die Version in einem echten Übungsspiel getestet. Auch diese Website hat Tests: Sie bauen die Seite und prüfen das erzeugte HTML.',
        },
      ],
    },

    planes: {
      antetitulo: 'Kostenlos',
      titulo: 'Kostenlos für alle',
      intro:
        'Coach LoL IA ist kostenlos und alles ist enthalten. Keine Bezahlpläne, Testphasen oder Schlüssel: Alle bekommen dieselbe App.',
      incluido: {
        titulo: 'Alles inklusive',
        lista: [
          'Smaragd+-Builds nach Champion und Position',
          'Bereich Champions mit Tier-List',
          'Modi ARAM, ARAM: Chaos und Arena, mit Augments',
          'Runen, Beschwörerzauber, Items und Skill-Reihenfolge',
          'Import in den Client per Klick',
          'Ladebildschirm mit beiden Teams',
          'Ingame-Coach: Widget-Overlay, Sprachausgabe und Jungle-Timer',
          'KI-Support-Assistent',
        ],
      },
      sinAnuncios: {
        titulo: 'Keine Werbung in der App',
        texto:
          'Die App hat weder Werbung noch Banner. Das Projekt finanziert sich über **Werbung auf der Website** (nur, wenn du Werbe-Cookies zustimmst) und **freiwillige Spenden**.',
      },
      apoya: {
        titulo: 'Projekt unterstützen',
        texto:
          'Spenden bezahlen den Server, die Build-Daten und die Entwicklung. Sie sind freiwillig und bringen keine Vorteile: Die App ist für alle gleich.',
        boton: 'So kannst du unterstützen',
      },
    },

    hojaDeRuta: {
      antetitulo: 'Roadmap',
      titulo: 'Wo wir stehen und wohin es geht',
      completada: 'Erledigt',
      items: [
        {
          version: 'v1',
          estado: 'Erledigt',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Smaragd+-Builds (EUW, LAN, LAS) vom eigenen Server',
            'Import von Runen, Beschwörerzaubern und Items per Klick',
            'Overlay mit Hinweisen und optionaler Sprachausgabe',
            'Windows-Installer mit automatischen Updates',
            'Spielsimulator und simulierter LCU für die Tests',
          ],
        },
        {
          version: 'v2',
          estado: 'Erledigt',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Neue, professionelle Oberfläche: Champion-Artwork, Karten und Mikroanimationen',
            'Diese Produkt-Website',
            'KI-Support-Assistent auf der Website und in der App',
            'Alles kostenlos für alle, ohne Werbung in der App',
          ],
        },
        {
          version: 'v3',
          estado: 'Erledigt',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Widget-Overlay: Objectives, Fähigkeitspfeil, CS und KDA, Käufe und Hinweise',
            'Ladebildschirm mit Rang, Meisterschaft und Siegesrate des Champions',
            'Manuelle Jungle-Timer für deine Seite, auch auf der Minimap',
            'Bereich Champions mit Tier-List sowie die Modi ARAM, ARAM: Chaos und Arena',
            'Wählbare Runen, Design „Schatten“ und ein an 2K und 4K angepasstes Overlay',
          ],
        },
        {
          version: '3.1',
          estado: 'Verfügbar',
          clase: 'etiqueta-dorada',
          hecho: true,
          puntos: [
            'Natürliche, neuronale Offline-Stimme in 5 Sprachen, die sich im Hintergrund selbst herunterlädt (nie im Spiel)',
            'Ladebildschirm im Vollbild mit hervorgehobener eigener Karte: Leertaste blendet ihn aus, alternativ nur Karten oder aus',
            '460 Sprachsätze pro Sprache mit Varianten, Detailstufe und einzeln schaltbaren Kategorien',
          ],
        },
        {
          version: 'Später',
          estado: 'Ideen',
          clase: '',
          hecho: false,
          puntos: ['KI-Analyse nach dem Spiel', 'Benutzerkonten und Benachrichtigungen per E-Mail'],
        },
      ],
    },

    faq: {
      antetitulo: 'FAQ',
      titulo: 'Häufige Fragen',
      escribir: 'Schreib an',
      ayuda:
        'Keine Antwort gefunden? Frag den **KI-Assistenten**: Er steckt hinter der Schaltfläche „KI-Assistent“ auf dieser Website und in der Ansicht „Hilfe“ der App.',
      ayudaAlt:
        'Screenshot der Hilfe-Ansicht von Coach LoL IA: der Chat des KI-Assistenten mit seiner Begrüßung, dem Eingabefeld, der Senden-Schaltfläche und dem Hinweis, dass die Antworten KI-generiert sind.',
      preguntas: [
        {
          p: 'Kann ich für die Nutzung von Coach LoL IA gebannt werden?',
          r: 'Die App nutzt nur die offiziellen lokalen APIs, die Riot Drittanbieter-Tools anbietet (LCU API und Live Client Data API), und greift nie in den Spielprozess ein: kein Speicherlesen, keine Code-Injection, keine Bildschirmaufnahme und keine simulierten Tasten oder Klicks. Außerdem zeigt das Overlay nichts, was du nicht ohnehin auf dem Bildschirm siehst. Trotzdem hat Riot bei Drittanbieter-Tools immer das letzte Wort, deshalb prüfen wir jeden Hinweis anhand der jeweils aktuellen Richtlinien.',
        },
        {
          p: 'Ist es kostenlos?',
          r: 'Ja, alles: Builds, Runen, Import und der Ingame-Coach (Overlay und Sprachausgabe), für alle und ohne Werbung in der App. Das Projekt finanziert sich über Werbung auf der Website und freiwillige Spenden.',
        },
        {
          p: 'Brauche ich Overwolf oder ein anderes Programm?',
          r: 'Nein. Coach LoL IA ist eine eigenständige Desktop-App für Windows: Sie braucht weder Overwolf noch eine andere Plattform. Nur den League-of-Legends-Client.',
        },
        {
          p: 'Warum sehe ich das Overlay im Spiel nicht?',
          r: 'Das Overlay ist ein Windows-Fenster über dem Spiel und erscheint deshalb nur, wenn LoL im Modus „Randlos“ läuft (Optionen → Video → Fenstermodus). Ist das Spiel im Vollbild, warnt dich die App. Im Spiel blendest du es mit Strg+Umschalt+O aus oder ein. Um jedes Widget zu platzieren, klick in der Overlay-Ansicht der App auf „Verschieben und kalibrieren“, zieh es an die gewünschte Stelle und klick auf „Hier fixieren“ (oder Esc bzw. Strg+Umschalt+O). In derselben Ansicht kannst du jedes Widget aktivieren, skalieren oder ausschalten.',
        },
        {
          p: 'Wie importiere ich Runen automatisch?',
          r: 'Klick in der Championauswahl in der App auf „Importieren“ (oder aktiviere den automatischen Import in den Einstellungen). Die App erstellt die Seite „Coach: <Champion> <Position>“, wählt die Beschwörerzauber und fügt das Item-Set hinzu. Schritt für Schritt erklären wir es im Ratgeber [Runen automatisch importieren](@guiaRunas).',
        },
        {
          p: 'Wie funktionieren die Jungle-Timer?',
          r: 'Sie sind manuell und standardmäßig aus: Du aktivierst sie in der Overlay-Ansicht. Wenn du ein Camp auf deiner Seite oder eine Scuttle Crab cleared hast, markierst du das per Klick oder mit einer Taste deiner Wahl, und die App zählt bis zum Respawn herunter, in einem Widget und auf der Minimap. Mit Alt+Umschalt+L blendest du sie im Spiel ein oder aus. Sie gelten nur für deinen Jungle und die Scuttle Crabs, nie für die Camps des Gegners: Die App weiß nicht, wann der Gegner sie cleared, und Riots Richtlinien erlauben es nicht, zu verfolgen, was der Gegner außerhalb deiner Sicht tut.',
        },
        {
          p: 'Was zeigt der Ladebildschirm?',
          r: 'Während das Spiel lädt, zeigt das Overlay alle zehn Spieler mit Champion und Position: den offiziellen Solo/Duo-Rang, die Meisterschaft mit diesem Champion und die Siegesrate des Champions auf der Position laut unseren Builds. Es ergänzt nur positive oder neutrale Labels wie „Ahri-Spezialist“ oder „Skaliert ins Lategame“. Es berechnet kein eigenes MMR, verteilt keine negativen Labels und blendet sich aus, sobald das Spiel beginnt. Für Rang und Meisterschaft sendet die App nur die PUUID jedes Spielers an den Server (nie die Riot-ID), und der Server hält die Antwort höchstens 10 Minuten im Arbeitsspeicher.',
        },
        {
          p: 'Was sagt mir die App über den gegnerischen Jungler?',
          r: 'Nur, was dir das Spiel ohnehin zeigt. Ist der gegnerische Jungler an einem Kill beteiligt, der im Kill-Feed erscheint, sagt dir die App: „Der gegnerische Jungler ist gerade bot aufgetaucht (Kill)“. Außerdem gibt es eine Option, standardmäßig aus, mit seinem üblichen Pfad: eine Schätzung aus unseren Spielen, auf welcher Seite dieser Champion meist startet und welche Lane er meist zuerst besucht. Keins von beidem sagt, wo er gerade ist: Die App sieht weder seine Position noch seine Abklingzeiten.',
        },
        {
          p: 'Löscht die App meine Runenseiten?',
          r: 'Nur wenn du es bestätigst. Die App legt eigene Seiten mit dem Präfix „Coach:“ an und ersetzt, falls vorhanden, diese. Hast du keine freie Seite mehr und klickst auf „Importieren“, fragt sie, bevor sie eine deiner Seiten ersetzt (die ausgewählte oder die älteste; nie eine vordefinierte). Der automatische Import löscht nie etwas.',
        },
        {
          p: 'Woher kommen die Builds?',
          r: `Aus Solo/Duo-Ranglistenspielen von Spielern ab Smaragd in EUW, LAN und LAS, die unser Server über die offizielle Riot-API herunterlädt und alle 6 Stunden auswertet. Von denselben Spielern lädt er auch ihre Spiele in ARAM, ARAM: Chaos und Arena. Jeder Build zeigt seine Anzahl an Spielen und seine Siegesrate. Ein Build wird ab ${MIN_PARTIDAS_BUILD} Spielen veröffentlicht; von ${MIN_PARTIDAS_BUILD} bis ${PARTIDAS_DATOS_LIMITADOS - 1} trägt er das Abzeichen „Begrenzte Daten“, und unter ${MIN_PARTIDAS_BUILD} zeigt die App „Build nicht verfügbar“, statt sich einen auszudenken. [Mehr zu Builds und Tier-List](@builds).`,
        },
        {
          p: 'Welche Spielmodi werden unterstützt?',
          r: 'Rangliste (nach Champion und Position), ARAM und ARAM: Chaos (nach Champion, mit Runen, Beschwörerzaubern, Items und Fähigkeiten; in ARAM: Chaos auch die meistgewählten Augments) und Arena (nach Champion, mit den meistgewählten Augments und Items und ihrer Pickrate, dazu durchschnittliche Platzierung, Top-4- und Siegquote des Champions). Jeder Modus hat seine Tier-List im Bereich Champions. Die App erkennt den Modus in der Championauswahl und im Spiel, und das Overlay passt sich an: In ARAM und ARAM: Chaos fallen Objectives, CS und Jungle weg, KDA, Fähigkeitspfeil und Kaufhinweis bleiben; in Arena gibt es auch keinen Fähigkeitspfeil.',
        },
        {
          p: 'Was ist die Tier-List im Bereich Champions?',
          r: 'Ein Bereich der App mit allen Champions nach Position und Modus. Jeder bekommt ein Tier (S, A, B oder C), das Siegesrate und Pickrate auf der Position kombiniert. Champions mit weniger als 30 Spielen kommen nie über B hinaus und tragen den Hinweis „Begrenzte Daten“. Klick auf einen Champion, um seinen vollständigen Build zu sehen. Wie man sie liest, erklärt der Ratgeber [Was ist eine Tier-List](@guiaTierList).',
        },
        {
          p: 'Funktionieren die Builds auch auf anderen Servern?',
          r: 'Ja. Die Builds werden aus Spielen in EUW, LAN und LAS berechnet, hängen aber vom Champion, der Position und dem Patch ab, nicht vom Server, auf dem du spielst.',
        },
        {
          p: 'In welchen Sprachen gibt es die App?',
          r: 'App, Overlay, Sprachausgabe und Assistent gibt es auf Spanisch, Englisch, Portugiesisch (Brasilien), Französisch und Deutsch, und diese Website ebenso. Standardmäßig nutzt die App die Sprache deines Windows; du kannst sie in den Einstellungen ändern.',
        },
        {
          p: 'Bringt mich die App im Elo nach oben?',
          r: 'Das versprechen wir nicht. Coach LoL IA gibt dir Informationen und Erinnerungen (datenbasierte Builds, Objectives, CS, Käufe), damit du deine eigenen Entscheidungen mit mehr Kontext triffst. Was im Spiel passiert, hängt davon ab, wie du spielst.',
        },
        {
          p: 'Muss ich ein Konto anlegen?',
          r: 'Nein. Du lädst die App herunter, öffnest sie zusammen mit dem League-of-Legends-Client und fertig: keine Konten, keine Schlüssel, keine Registrierung.',
        },
        {
          p: 'Braucht die Stimme Internet?',
          r: 'Nur einmal: Das Modell der natürlichen Stimme (etwa 124 MB) lädt sich im Hintergrund selbst von GitHub herunter, nie in der Championauswahl, im Ladebildschirm oder im Spiel. Danach funktioniert es offline auf deinem PC. Bis dahin spricht die Windows-Stimme.',
        },
        {
          p: 'Was passiert, wenn ich offline bin?',
          r: 'Die App nutzt die zuletzt gespeicherten Builds und sagt dir das. Der Ingame-Coach funktioniert genauso, denn er braucht nur den Client und das Spiel auf deinem PC.',
        },
        {
          p: 'Läuft es auf Mac oder Linux?',
          r: 'Vorerst nur unter Windows 10 und 11, wo die große Mehrheit der LoL-Spiele läuft. Mac und Linux werden in dieser Version nicht unterstützt.',
        },
        {
          p: 'Brauchst du Hilfe?',
          r: `Schreib uns an ${CORREO}. Wenn es um das Overlay geht, nenn uns deine Windows-Version und ob das Spiel im Modus „Randlos“ läuft.`,
          correo: true,
        },
        {
          p: 'Ist Coach LoL IA ein offizielles Riot-Produkt?',
          r: 'Nein. Es ist ein unabhängiges Projekt, das nicht von Riot Games unterstützt wird.',
        },
      ],
    },

    cta: {
      titulo: 'Dein nächstes Spiel, mit Coach',
      texto: 'Lade Coach LoL IA kostenlos herunter und probier die Builds in deiner nächsten Championauswahl aus.',
    },
  },

  descargar: {
    antetitulo: 'Download',
    h1: 'Coach LoL IA kostenlos für Windows herunterladen',
    intro:
      'Kostenlos, in 5 Sprachen und mit automatischen Updates. Der Installer erscheint auf GitHub Releases, zusammen mit den Notizen zu jeder Version.',
    ultima: 'Neueste Version:',
    archivo: 'Lade die Datei',
    archivoFin: 'herunter und führe sie aus.',
    queTrae: 'Neu in',
    requisitosTitulo: 'Voraussetzungen',
    requisitos: [
      ['System', 'Windows 10 oder 11, 64 Bit.'],
      ['Spiel', 'League of Legends installiert (Riot-Client).'],
      ['Overlay', 'Das Spiel im Modus „Randlos“ (Optionen → Video → Fenstermodus).'],
      ['Verbindung', 'Internet für die Builds; offline nutzt die App die zuletzt gespeicherten.'],
    ],
    instalacionTitulo: 'Installation',
    instalacion: [
      'Öffne das [neueste Release](https://github.com/pepeipto/coach-lol-ia/releases/latest) und lade den `.exe`-Installer herunter.',
      'Führe ihn aus. Zeigt Windows SmartScreen eine Warnung, klick auf „Weitere Informationen“ und dann auf „Trotzdem ausführen“.',
      'Öffne Coach LoL IA und danach den League-of-Legends-Client. Die App erkennt ihn selbst, und beim ersten Start zeigt dir eine Begrüßung in vier Schritten das Wichtigste.',
      'In der Championauswahl siehst du deinen Build. Klick auf „Importieren“, um ihn zu übernehmen.',
      'Für den Ingame-Coach stellst du das Spiel auf **Randlos**.',
    ],
    extras: [
      {
        titulo: 'Automatische Updates',
        texto: 'Die App prüft beim Start, ob es eine neue Version gibt, lädt sie im Hintergrund und installiert sie beim Schließen.',
      },
      {
        titulo: 'Nur offizielle Riot-APIs',
        texto: 'Sie greift nicht in den Spielprozess ein: kein Speicherlesen, keine Code-Injection. [Mehr dazu](@inicio#seguridad).',
      },
      {
        titulo: 'Deinstallieren',
        texto: 'Über Windows-Einstellungen → Apps → Coach LoL IA. Deine Runen und Item-Sets im Client bleiben unangetastet.',
      },
      {
        titulo: 'Code auf GitHub',
        texto:
          'Code, Änderungsverlauf und Versionshinweise findest du auf [GitHub](https://github.com/pepeipto/coach-lol-ia).',
      },
      {
        titulo: 'Codesignatur und Prüfung',
        texto:
          'Kostenlose Codesignatur von SignPath.io, Zertifikat von SignPath Foundation (Antrag läuft). Jeder Installer wird mit GitHub Actions aus dem veröffentlichten Quellcode (MIT-Lizenz) gebaut; sein SHA-256 steht in `SHA256SUMS.txt`. [Signaturrichtlinie](https://github.com/pepeipto/coach-lol-ia/blob/main/CODE_SIGNING.md).',
      },
    ],
    ayuda:
      'Die App erkennt den Client nicht oder das Overlay erscheint nicht? Schreib uns deine Windows-Version und eine Beschreibung des Problems.',
  },

  apoyar: {
    antetitulo: 'Projekt unterstützen',
    h1: 'Coach LoL IA ist für alle kostenlos',
    intro:
      'Alle Funktionen, auch der Ingame-Coach, stehen allen zur Verfügung, und die App hat keine Werbung. Das Projekt finanziert sich über Werbung auf der Website und freiwillige Spenden.',
    porQue: 'Warum unterstützen?',
    porQueTexto:
      'Coach LoL IA zu betreiben, kostet jeden Monat Geld. Wenn dir die App hilft, sorgt eine Spende dafür, dass sie kostenlos bleibt und besser wird. Spenden ist freiwillig und bringt keine Vorteile in der App: Alle bekommen dasselbe.',
    quePagan: 'Wofür die Spenden verwendet werden',
    destinos: [
      ['Der Server', 'Das Hosting des Servers, der die Spiele herunterlädt, alle 6 Stunden die Builds berechnet und sie an die App liefert.'],
      ['Die Daten', 'Speicherung und Verarbeitung Tausender Smaragd+-Spiele aus EUW, LAN und LAS sowie der KI-Support-Assistent.'],
      ['Die Entwicklung', 'Die Zeit, um Fehler zu beheben, jedem League-of-Legends-Patch zu folgen und neue Funktionen zu bauen.'],
    ],
    cafe: 'Magst du uns einen Kaffee ausgeben? Jeder Betrag hilft.',
    donar: 'Spenden',
    pronto: 'Bald kannst du das Projekt mit einer Spende unterstützen.',
    mientras: 'Bis dahin: Wenn du helfen möchtest, schreib uns an',
    otraForma: 'Du kannst es auch unterstützen, indem du deinen Freunden davon erzählst oder [die App herunterlädst](@descargar) und sie nutzt.',
  },

  novedades: {
    antetitulo: 'Neuigkeiten',
    h1: 'Was ist neu in Coach LoL IA',
    intro:
      'Alle Versionen der App, die neueste zuerst. Die App zeigt sie auch in ihrer Ansicht „Neuigkeiten“ und fasst jede neue Version beim ersten Öffnen zusammen.',
    notaIdioma:
      'Die Versionshinweise werden auf Spanisch verfasst. Die 3.x-Versionen sind unten übersetzt; ältere Versionen erscheinen im spanischen Original.',
    version: 'Version',
    ultima: 'Neueste Version',
    proxima: {
      titulo: 'Neu in 3.1',
      texto:
        'Eine natürliche, neuronale Offline-Stimme in allen 5 Sprachen, die sich im Hintergrund selbst herunterlädt (nie in der Championauswahl, im Ladebildschirm oder im Spiel); ein Ladebildschirm im Vollbild mit hervorgehobener eigener Karte, den die Leertaste ausblendet (oder nur Karten, oder aus); und 460 Sprachsätze pro Sprache mit Varianten, Detailstufe und Kategorien.',
    },
    cierre: 'Updates installieren sich beim Schließen der App von selbst. Wenn du sie noch nicht hast, lade sie kostenlos herunter.',
    notasGithub: 'Notizen auf GitHub',
    meses: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    formatoFecha: '{d}. {m} {a}',
  },

  legal: {
    antetitulo: 'Rechtliches',
    plantilla:
      '**Vorlage, noch zu prüfen.** Dieser Text ist eine sinnvolle, für das Projekt erstellte Vorlage und muss vor dem öffentlichen Start vom Verantwortlichen geprüft werden (idealerweise mit rechtlicher Beratung). Die Felder in eckigen Klammern, etwa *[Name oder Firma]*, müssen ausgefüllt werden. Dies ist keine Rechtsberatung.',
    actualizado: 'Zuletzt aktualisiert: 20. Oktober 2026.',
    traduccion: 'Dies ist eine Übersetzung des spanischen Originals. Bei Abweichungen ist die spanische Fassung maßgeblich.',
    privacidad: {
      h1: 'Datenschutzerklärung',
      secciones: [
        {
          h: '1. Verantwortlicher',
          p: [
            `Verantwortlich: *[Name oder Firma]*, Steuernummer *[Steuernummer]*, Anschrift *[Adresse]*. Kontakt für alle Datenschutzfragen: [${CORREO}](mailto:${CORREO}).`,
          ],
        },
        { h: '2. Welche Daten wir verarbeiten und wozu', tabla: true },
        {
          h: '3. Daten, die wir nicht erheben',
          p: [
            'Die App liest Client- und Spieldaten **auf deinem eigenen PC** (LCU API und Live Client Data API), um dir Build und Hinweise anzuzeigen. Diese Informationen werden nicht an unseren Server gesendet, mit Ausnahme der im vorigen Abschnitt beschriebenen Daten für den Ladebildschirm und den KI-Coach: Wir erheben weder deine Zugangsdaten noch speichern wir einen Verlauf deiner Spiele. Coach LoL IA hat auch keine Benutzerkonten oder Passwörter.',
          ],
        },
        {
          h: '4. Auf deinem PC gespeicherte Daten',
          p: [
            'Die App speichert in deinem Benutzerordner die Einstellungen, den Cache der Builds und von Data Dragon, das Modell der natürlichen Stimme mit seinem Satz-Cache, den Verlauf deiner KI-Analysen (die letzten 50) sowie ein lokales Fehlerprotokoll. Sie werden gelöscht, wenn du die App deinstallierst und ihren Datenordner entfernst.',
          ],
        },
        {
          h: '5. Auftragsverarbeiter und Empfänger',
          lista: [
            '**Anthropic**, unser KI-Anbieter (erzeugt die Antworten des KI-Assistenten aus den Chatnachrichten sowie die Analysen und Tipps des KI-Coachs aus den Spieldaten, ohne deine Riot ID). Kann Daten mit geeigneten Garantien außerhalb des EWR verarbeiten.',
            '**Google** (AdSense auf dieser Website, nur mit deiner Einwilligung).',
            '**GitHub** (Hosting dieser Website, der App-Downloads und des Modells der natürlichen Stimme, etwa 124 MB, das die App selbst herunterlädt; wie bei jedem Download erhält GitHub deine IP-Adresse).',
            '*[Hosting-Anbieter des Servers]* (Build-Server und Server des KI-Assistenten).',
          ],
          p: [
            'Wenn du spendest, wickelt die Spendenplattform das auf ihrer eigenen Website ab: Wir sehen und speichern deine Zahlungsdaten nicht.',
            'Wir verkaufen deine Daten nicht und geben sie nicht an Dritte weiter, es sei denn, wir sind gesetzlich dazu verpflichtet.',
          ],
        },
        {
          h: '6. Speicherdauer',
          p: ['Technische Protokolle des Servers werden höchstens *[Frist angeben]* aufbewahrt. Nachrichten an den Assistenten und die Spieldaten, die der KI-Coach erhält, werden nicht gespeichert.'],
        },
        {
          h: '7. Deine Rechte',
          p: [
            `Du kannst deine Rechte auf Auskunft, Berichtigung, Löschung, Widerspruch, Einschränkung und Datenübertragbarkeit ausüben, indem du an [${CORREO}](mailto:${CORREO}) schreibst. Wenn du meinst, dass wir deine Anfrage nicht angemessen bearbeitet haben, kannst du dich bei der spanischen Datenschutzbehörde (aepd.es) oder der Aufsichtsbehörde deines Landes beschweren.`,
          ],
        },
        { h: '8. Cookies', p: ['Siehe die [Cookie-Richtlinie](@cookies).'] },
      ],
      tabla: {
        cabecera: ['Quelle', 'Daten', 'Zweck', 'Rechtsgrundlage'],
        filas: [
          [
            'Desktop-App',
            'Abgefragter Champion und Position sowie die IP-Adresse der Anfrage.',
            'Bereitstellung der Builds.',
            'Erbringung des von dir angeforderten Dienstes (Art. 6 Abs. 1 lit. b DSGVO).',
          ],
          [
            'Ladebildschirm (App)',
            'Für die zehn Spieler deines Spiels: ihre Riot-Kennung (PUUID), ihr Champion, ihre Position und ihr Team sowie die Region deines Clients. Die Riot-ID (Name#Tag) wird nicht gesendet.',
            'Abfrage von Solo/Duo-Rang und Meisterschaft jedes Spielers über die offizielle Riot-API für den Ladebildschirm. Der Server hält die Antwort nur im Arbeitsspeicher, höchstens 10 Minuten, und schreibt sie weder in seine Datenbank noch in seine Protokolle.',
            'Erbringung des von dir angeforderten Dienstes (Art. 6 Abs. 1 lit. b DSGVO) und berechtigtes Interesse gegenüber den übrigen Spielern, mit Daten, die Riot bereits öffentlich macht (Art. 6 Abs. 1 lit. f DSGVO).',
          ],
          [
            'KI-Assistent (Website und App)',
            'Die Nachrichten, die du in den Chat des Assistenten schreibst, und die IP-Adresse der Anfrage.',
            'Erzeugung der Antwort: Die Nachrichten werden an unseren Server und an Anthropic gesendet, das den Text mit seinem KI-Modell verarbeitet. Unser Server speichert sie nicht über diese Verarbeitung hinaus. Schreib keine personenbezogenen Daten in den Chat.',
            'Erbringung des von dir angeforderten Dienstes (Art. 6 Abs. 1 lit. b DSGVO).',
          ],
          [
            'KI-Coach (App)',
            'Daten des laufenden oder gerade beendeten Spiels, ohne deinen Beschwörernamen und deine Riot ID: dein Champion, deine Rolle und der Modus; Statistiken (KDA, CS, Gold, Level, Schaden, Sicht), Items und Käufe mit ihrer Minute, Tode mit ihrer Minute und Objectives aus den offiziellen Ereignissen; bei den Tipps außerdem Champions, Level, Items und Kills der Anzeigetafel (TAB). Und die IP-Adresse der Anfrage.',
            'Erstellung der Analyse nach dem Spiel und der Tipps in Leerlaufmomenten (in den Einstellungen ein- und ausschaltbar): Die Daten werden an unseren Server und an Anthropic gesendet, das sie mit seinem KI-Modell verarbeitet. Unser Server speichert sie nicht und schreibt sie nicht in seine Protokolle: Er zählt nur die Anfragen für seine Tageslimits. Deine Analysen werden nur auf deinem PC gespeichert.',
            'Erbringung des von dir angeforderten Dienstes (Art. 6 Abs. 1 lit. b DSGVO).',
          ],
          [
            'Support',
            `Deine E-Mail-Adresse und alles, was du uns schreibst, wenn du dich an ${CORREO} wendest.`,
            'Beantwortung deiner Anfrage.',
            'Berechtigtes Interesse, dir zu helfen (Art. 6 Abs. 1 lit. f DSGVO).',
          ],
          [
            'Diese Website',
            'Deine Cookie-Auswahl (in deinem Browser) und, nur wenn du zustimmst, Werbe-Cookies von Google AdSense.',
            'Speichern deiner Auswahl und Anzeigen von Werbung.',
            'Einwilligung (Art. 6 Abs. 1 lit. a DSGVO).',
          ],
        ],
      },
    },
    terminos: {
      h1: 'Nutzungsbedingungen',
      secciones: [
        {
          h: '1. Wer wir sind',
          p: [
            `Coach LoL IA ist ein Dienst von *[Name oder Firma]*, Steuernummer *[Steuernummer]*, Anschrift *[Adresse]*. Kontakt: [${CORREO}](mailto:${CORREO}).`,
          ],
        },
        {
          h: '2. Der Dienst',
          p: [
            'Coach LoL IA ist eine kostenlose Desktop-Anwendung für Windows, die in der Championauswahl Builds vorschlägt und im Spiel Hinweise anzeigt. Die Empfehlungen dienen nur der Orientierung und beruhen auf Spielstatistiken; sie garantieren kein Ergebnis.',
          ],
        },
        {
          h: '3. Nutzung der App',
          lista: [
            'Wir räumen dir eine persönliche, nicht ausschließliche und nicht übertragbare Lizenz zur Nutzung der App ein.',
            'Du darfst sie nicht nutzen, um gegen die Regeln von Riot Games zu verstoßen, und sie nicht verändern, um auf anderem Weg auf das Spiel zuzugreifen.',
            'Die App nutzt nur offizielle Riot-APIs. Dennoch unterliegt die Nutzung von Drittanbieter-Tools den Richtlinien von Riot, die sich ändern können.',
          ],
        },
        {
          h: '4. Preis und Spenden',
          lista: [
            'Coach LoL IA ist kostenlos: Alle Funktionen stehen allen zur Verfügung und die App hat keine Werbung.',
            'Das Projekt finanziert sich über Werbung auf dieser Website und über freiwillige Spenden unter [Projekt unterstützen](@apoyar).',
            'Spenden ist freiwillig und gewährt keinen Zugang zu Funktionen oder Vorteilen in der App.',
          ],
        },
        {
          h: '5. Verfügbarkeit',
          p: [
            'Wir bemühen uns, den Dienst jederzeit verfügbar zu halten, es kann aber zu Unterbrechungen durch Wartung, Patch-Wechsel oder Änderungen an den Riot-APIs kommen. Antwortet der Server nicht, nutzt die App die zuletzt gespeicherten Daten.',
          ],
        },
        {
          h: '6. Haftung',
          p: [
            'Die App wird „wie besehen“ bereitgestellt. Soweit gesetzlich zulässig, haften wir nicht für mittelbare Schäden aus ihrer Nutzung. Nichts davon schränkt die Rechte ein, die dir das Verbraucherschutzrecht gewährt.',
          ],
        },
        {
          h: '7. Geistiges Eigentum und Riot Games',
          riot: true,
          p: [
            'League of Legends und seine Bilder sind Marken und Inhalte von Riot Games, Inc. und werden gemäß dessen Richtlinien für Drittanbieter-Projekte verwendet.',
          ],
        },
        {
          h: '8. Änderungen und anwendbares Recht',
          p: [
            'Wir können diese Bedingungen aktualisieren; wesentliche Änderungen kündigen wir auf dieser Website an. Es gilt *[spanisches]* Recht; für Verbraucher sind die Gerichte an ihrem Wohnsitz zuständig.',
          ],
        },
      ],
    },
    cookies: {
      h1: 'Cookie-Richtlinie',
      queUsamos: 'Was wir verwenden',
      queUsamosTexto:
        'Diese Website verwendet keine eigenen Analyse- oder Tracking-Cookies. Sie speichert nur deine Entscheidung zur Werbung und lädt, wenn du zustimmst, die Werbung von Google AdSense, die Cookies von Drittanbietern verwendet.',
      tabla: {
        cabecera: ['Name', 'Art', 'Zweck', 'Dauer'],
        filas: [
          ['`coach-cookies` (lokaler Speicher)', 'Eigen, technisch', 'Speichern, ob du Werbung akzeptiert oder abgelehnt hast.', 'Bis du ihn löschst'],
          [
            'Cookies von Google AdSense',
            'Drittanbieter, Werbung',
            'Anzeigen und Messen von Werbung. Nur geladen, wenn du zustimmst. Mehr dazu in den Richtlinien von Google.',
            'Laut Google',
          ],
        ],
      },
      sinAnunciosApp: 'Die Desktop-App zeigt nie Werbung: Werbung erscheint nur auf dieser Website.',
      cambiar: 'Deine Auswahl ändern',
      conAnuncios: 'Klick auf die Schaltfläche, um deine Auswahl zu löschen; der Cookie-Hinweis erscheint dann erneut.',
      sinAnuncios:
        'Diese Website zeigt derzeit keine Werbung, es gibt also nichts zuzustimmen. Falls wir sie aktivieren, siehst du einen Hinweis zur Auswahl.',
      boton: 'Meine Cookie-Auswahl zurücksetzen',
      borradaBanner:
        ' Auswahl gelöscht. Triff im Hinweis eine neue Wahl; falls schon Werbung geladen war, wird sie nach dem Neuladen der Seite nicht mehr geladen.',
      borrada: ' Auswahl gelöscht. Die Änderung gilt nach dem Neuladen der Seite.',
      navegador: 'Du kannst die Daten dieser Website auch in den Einstellungen deines Browsers löschen.',
      contacto: 'Kontakt',
      contactoTexto: 'Bei Fragen:',
    },
  },

  builds: {
    antetitulo: 'Builds & Tier-List',
    h1: 'LoL-Builds und Tier-List aus Smaragd+-Spielen',
    intro:
      'Coach LoL IA berechnet seine League-of-Legends-Builds und die Tier-List aus echten Spielen von Spielern ab **Smaragd** in EUW, LAN und LAS. Das sind weder Meinungen noch handgemachte Listen: Jeder Build zeigt, wie viele Spiele dahinterstehen und welche Siegesrate er hat, und wird **alle 6 Stunden** neu berechnet.',
    capturaAlt:
      'Screenshot der Champion-Ansicht von Coach LoL IA mit Ahris Mid-Build: Runen aus Dominanz und Zauberei, Blitz und Entzünden, Start-Items, Kern-Items und Stiefel sowie die Skill-Reihenfolge, mit Siegesrate, 33 Spielen und Patch 16.20.',
    capturaPie: 'Build nach Champion und Position, mit Anzahl der Spiele.',
    queIncluye: {
      titulo: 'Was jeder Build enthält',
      lista: [
        '**Runen**: die meistgespielte Seite und seit 3.0.1 mehrere Seiten zur Auswahl, jeweils mit Siegesrate und Spielen.',
        '**Beschwörerzauber**, etwa Blitz und Entzünden oder Blitz und Zerschmettern.',
        '**Items**: Start-Items, 3-Item-Kern, Stiefel und situative Items.',
        '**Skill-Reihenfolge**, mit der Priorität beim Maxen (zum Beispiel Q > W > E).',
        'In **Arena** die meistgewählten Augments und Items, nur mit ihrer Pickrate.',
      ],
    },
    origen: {
      titulo: 'Woher die Daten kommen',
      texto:
        'Unser Server nutzt die offizielle Riot-API: League-v4, um Smaragd+-Spieler zu finden, und Match-v5, um ihre Solo/Duo-Ranglistenspiele sowie ihre Spiele in ARAM, ARAM: Chaos und Arena herunterzuladen. Daraus berechnet er für jeden Champion und jede Position, was am meisten gespielt wird und wie gut es läuft.',
      puntos: [
        '**Aktueller Patch zuerst:** Ab 200 Spielen im Patch werden nur dessen Daten genutzt; darunter werden sie mit dem vorherigen Patch kombiniert, und der Build weist darauf hin.',
        `**Mindestens ${MIN_PARTIDAS_BUILD} Spiele**, um einen Build zu veröffentlichen; von ${MIN_PARTIDAS_BUILD} bis ${PARTIDAS_DATOS_LIMITADOS - 1} trägt er das Abzeichen „Begrenzte Daten“.`,
        '**Nichts erfunden:** Gibt es nicht genug Spiele, zeigt die App „Build nicht verfügbar“.',
      ],
    },
    tierList: {
      titulo: 'So wird die Tier-List berechnet',
      texto:
        'Im Bereich Champions der App bekommt jeder Champion pro Position und Modus ein Tier, das **Siegesrate** und **Pickrate** auf dieser Position kombiniert. So landet ein Champion mit hoher Siegesrate, aber sehr wenigen Spielen nicht zufällig ganz oben.',
      tiers: [
        ['S', 'Leistet auf seiner Position überdurchschnittlich viel und wird oft genug gespielt, um dem Wert zu trauen.'],
        ['A', 'Eine solide Wahl im aktuellen Patch.'],
        ['B', 'Spielbar und ausgeglichen. Hier bleiben auch Champions mit weniger als 30 Spielen.'],
        ['C', 'Unter dem Durchschnitt in diesem Patch: kann funktionieren, ist heute aber schwerer.'],
      ],
      alt: 'Screenshot des Bereichs Champions von Coach LoL IA: Ranglisten-Tier-List mit Moduswähler, Suche, Positionsfiltern und der Championtabelle mit Tier, Siegesrate, Pickrate und Spielen.',
      pie: 'Die vollständige Tier-List findest du in der App, mit Daten aus dem aktuellen Patch.',
    },
    modos: {
      titulo: 'Rangliste, ARAM, ARAM: Chaos und Arena',
      texto:
        'Jeder Modus hat eigene Builds und eine eigene Tier-List. In ARAM und ARAM: Chaos gelten die Builds pro Champion (ohne Position), in ARAM: Chaos mit den meistgewählten Augments; in Arena kommen durchschnittliche Platzierung, Top-4- und Siegquote des Champions hinzu. Augments und Arena-Items zeigen nur ihre Pickrate, ohne Siegrate, wie es Riots Richtlinie verlangt. Modi mit wenigen gesammelten Spielen zeigen „Noch keine Daten“, bis die Stichprobe groß genug ist.',
    },
    importar: {
      titulo: 'Vom Build in den Client mit einem Klick',
      texto:
        'In der Championauswahl erkennt die App deinen Champion und deine Position und zeigt den Build in unter 2 Sekunden. „Importieren“ legt die Runenseite an, wählt die Beschwörerzauber und fügt das Item-Set hinzu. [Schritt für Schritt im Runen-Ratgeber](@guiaRunas).',
    },
    honestidad: {
      titulo: 'Was die Tier-List nicht ist',
      texto:
        'Eine Tier-List fasst Statistiken zusammen; sie sagt dir nicht, welchen Champion du spielen musst. Wie gut du den Champion beherrschst, dein Team und der Gegner zählen viel. Deshalb zeigt Coach LoL IA immer die Anzahl der Spiele und verspricht keine Ergebnisse. [So liest du eine Tier-List](@guiaTierList).',
    },
    faq: [
      {
        p: 'Wie oft werden die Builds aktualisiert?',
        r: 'Alle 6 Stunden. Wenn ein neuer Patch erscheint, ziehen Server und Data Dragon selbst nach und die App zeigt, aus welchem Patch die Daten stammen.',
      },
      {
        p: 'Kann ich die Tier-List auf der Website sehen?',
        r: 'Die vollständige Tier-List mit Suche, Filtern und dem Build jedes Champions findest du im Bereich Champions der App, die kostenlos ist. Diese Seite erklärt, wie sie berechnet wird.',
      },
      {
        p: 'Warum steht bei einem Build „Begrenzte Daten“?',
        r: `Weil er auf weniger als ${PARTIDAS_DATOS_LIMITADOS} Spielen beruht. Als Orientierung ist er nützlich, aber die Stichprobe ist klein und die Siegesrate kann sich mit wenigen weiteren Spielen stark ändern.`,
      },
      {
        p: 'Funktionieren die Builds auch auf anderen Servern?',
        r: 'Ja: Sie hängen vom Champion, der Position und dem Patch ab, nicht vom Server, auf dem du spielst.',
      },
    ],
    cta: 'Lade die App herunter und sieh dir in der nächsten Championauswahl den Build deines Champions an.',
  },

  guias: {
    antetitulo: 'Ratgeber',
    h1: 'League-of-Legends-Ratgeber',
    intro:
      'Kurze, praktische Ratgeber zu Overlays, Tier-Lists und Runen, geschrieben vom Team von Coach LoL IA. Wir erklären, wie die Dinge funktionieren, ohne Elo-Versprechen.',
    otras: 'Weitere Ratgeber',
    articulos: {
      guiaOverlay: {
        resumen: 'Was Riot einem Overlay erlaubt, auf welche Warnsignale du achten solltest und wie du es richtig einrichtest.',
        h1: 'Ein LoL-Overlay sicher nutzen',
        entradilla:
          'Ein League-of-Legends-Overlay ist ein Fenster, das über dem Spiel gezeichnet wird und dir Informationen zeigt: deinen Build, die Timer der Objectives oder deinen CS. Gut gemacht, hält es sich an Riots Regeln. Schlecht gemacht, kann es deinen Account gefährden. Dieser Ratgeber hilft dir, den Unterschied zu erkennen.',
        secciones: [
          {
            h: 'Was ein Overlay ist und was nicht',
            p: [
              'Ein legitimes Overlay ist ein normales Windows-Fenster, transparent und klickdurchlässig, das über dem Spiel liegt. Es ist kein Teil des Spiels und verändert es nicht: Es zeichnet nur Informationen auf deinen Bildschirm.',
              'Damit es sichtbar ist, muss LoL im Modus **Randlos** laufen (Optionen → Video → Fenstermodus). Im exklusiven Vollbild zeichnet Windows das Spiel über jedes andere Fenster.',
            ],
          },
          {
            h: 'Was Riot Drittanbieter-Apps erlaubt',
            p: [
              'Riot veröffentlicht offizielle Schnittstellen für Drittanbieter-Tools: die **LCU API** des Clients (Championauswahl, Runen, Items), die **Live Client Data API** des Spiels (unter `127.0.0.1:2999`, schreibgeschützt) und öffentliche Dienste wie Data Dragon. Eine App, die nur diese Wege nutzt, arbeitet mit Daten, die Riot bewusst teilt.',
              'Riots Richtlinien begrenzen außerdem, was angezeigt werden darf. Grundsätzlich sollte ein Overlay dir keine Informationen geben, die du ohne es nicht hättest: keine Timer für gegnerische Beschwörerzauber oder Ultimates, keine Positionen von Gegnern, die du nicht siehst, und keine Entscheidungen, die für dich spielen.',
            ],
          },
          {
            h: 'Warnsignale',
            lista: [
              'Es liest den **Speicher des Spiels** oder injiziert Code oder DLLs in den Prozess.',
              'Es zeigt **gegnerische Abklingzeiten**, Positionen außerhalb deiner Sicht oder Timer des gegnerischen Jungles.',
              'Es **simuliert Tastatur oder Maus** oder automatisiert Aktionen wie Ausweichen oder Fähigkeiten einsetzen.',
              'Es wertet **Screenshots** oder die Minimap aus, um Informationen zu gewinnen.',
              'Es fragt nach deinem **Riot-Passwort** oder behauptet, „nicht erkennbar“ zu sein.',
            ],
          },
          {
            h: 'Checkliste vor der Installation eines Overlays',
            lista: [
              'Es sagt klar, welche APIs es nutzt und was es mit dem Spiel nicht tut.',
              'Es verlangt keine Zugangsdaten: Der Client ist auf deinem PC ja schon offen.',
              'Seine Datenschutzerklärung erklärt, welche Daten an seine Server gehen.',
              'Es enthält den rechtlichen Hinweis von Riot und gibt sich nicht als offizielles Produkt aus.',
              'Du kannst es jederzeit ausblenden oder einzelne Teile abschalten.',
            ],
          },
          {
            h: 'So macht es Coach LoL IA',
            p: [
              'Coach LoL IA nutzt nur die LCU API, die Live Client Data API und Data Dragon. Es liest oder beschreibt nicht den Speicher des Spiels, injiziert keinen Code, macht keine Screenshots zur Auswertung und simuliert weder Tasten noch Klicks. Die Jungle-Timer gelten nur für deine Seite und du setzt sie selbst, und zum gegnerischen Jungler wiederholt es nur, was ohnehin im Kill-Feed steht.',
              'Trotzdem hat Riot bei Drittanbieter-Tools immer das letzte Wort. Deshalb prüfen wir jeden Hinweis anhand der aktuellen Richtlinien und empfehlen dir, das bei jeder App, die du installierst, genauso zu halten. [Zum Abschnitt Sicherheit](@inicio#seguridad).',
            ],
          },
          {
            h: 'So stört es nicht',
            lista: [
              'Stell das Spiel auf **Randlos**.',
              'Nutze in der Overlay-Ansicht der App **„Verschieben und kalibrieren“**, um jedes Widget so zu platzieren, dass es das HUD nicht verdeckt.',
              'Senk die Deckkraft oder schalte Widgets ab, die du nicht brauchst.',
              'Im Spiel blendet **Strg+Umschalt+O** das Overlay aus oder ein.',
            ],
          },
        ],
      },
      guiaTierList: {
        resumen: 'Was jedes Tier bedeutet, wie es berechnet wird und warum die Anzahl der Spiele zählt.',
        h1: 'Was ist eine Tier-List in LoL und wie liest man sie?',
        entradilla:
          'Eine Tier-List ordnet die Champions von League of Legends danach, wie gut sie im aktuellen Patch abschneiden, meist mit Buchstaben: S, A, B, C. Sie ist ein nützliches Werkzeug, um Champions auszuwählen oder zu entdecken, solange du weißt, woher die Daten kommen und was sie nicht verrät.',
        secciones: [
          {
            h: 'Was jedes Tier bedeutet',
            p: [
              'Einen offiziellen Standard gibt es nicht, aber fast alle folgen derselben Idee: **S** sind die Champions, die auf ihrer Position am stärksten herausstechen, **A** sehr solide Picks, **B** ausgeglichene Champions und **C** die, die es gerade schwerer haben. Manche ergänzen S+ oder D.',
              'Wichtig ist: Das Tier gilt **pro Position**. Ein Champion kann im Jungle S-Tier und auf der Toplane B-Tier sein.',
            ],
          },
          {
            h: 'Wie sie berechnet wird',
            p: [
              'Datenbasierte Tier-Lists kombinieren vor allem zwei Zahlen: die **Siegesrate** (wie viele Spiele der Champion auf dieser Position gewinnt) und die **Pickrate** (wie oft er gewählt wird). Manche beziehen auch die Banrate oder die Leistung in hohen Elos ein.',
              'Andere Tier-Lists beruhen auf **Meinungen**: Ein Spieler oder ein Team erstellt sie aus Erfahrung. Die sind nicht schlecht, aber du solltest wissen, welche Art du gerade liest.',
            ],
          },
          {
            h: 'Warum die Anzahl der Spiele zählt',
            p: [
              'Eine Siegesrate von 60 % aus 20 Spielen sagt wenig: Ein paar Niederlagen mehr, und sie fällt auf 50 %. 52 % aus Tausenden von Spielen sind viel verlässlicher. Deshalb zeigt eine gute Tier-List die Stichprobengröße oder lässt zumindest keinen Champion mit wenig Daten ganz nach oben.',
              'Auch **welche Spiele** zählt: Ein Champion schneidet in Eisen anders ab als in Smaragd+, und ein neuer Patch kann über Nacht alles ändern.',
            ],
          },
          {
            h: 'So nutzt du sie, ohne dich täuschen zu lassen',
            lista: [
              'Schau sie dir für **deine Position** und den **aktuellen Patch** an.',
              'Ein B-Tier-Champion, den du beherrschst, bringt meist mehr als ein S-Tier-Champion, den du nicht kennst.',
              'Nutze sie, um Champions zu entdecken und zu wissen, was gerade stark gegen dich ist.',
              'Misstraue Zahlen ohne Anzahl der Spiele.',
            ],
          },
          {
            h: 'Die Tier-List von Coach LoL IA',
            p: [
              'Im Bereich Champions der App bekommt jeder Champion pro Position und Modus (Rangliste, ARAM, ARAM: Chaos und Arena) ein Tier S, A, B oder C, das Siegesrate und Pickrate kombiniert, auf Basis von Spielen von Smaragd+-Spielern in EUW, LAN und LAS. Champions mit weniger als 30 Spielen kommen nie über B hinaus und tragen den Hinweis „Begrenzte Daten“. [Mehr zu den Daten](@builds).',
            ],
          },
        ],
      },
      guiaRunas: {
        resumen: 'Runen, Beschwörerzauber und Items per Klick aus der Championauswahl, ohne deine Seiten zu verlieren.',
        h1: 'Runen in LoL automatisch importieren',
        entradilla:
          'In jeder Championauswahl die Runen einzustellen, kostet Zeit, vor allem, wenn du in letzter Sekunde den Champion wechselst. Mit einer App, die die offizielle API des Clients nutzt, importierst du Runen, Beschwörerzauber und Items mit einem Klick. So geht es mit Coach LoL IA.',
        secciones: [
          {
            h: 'So funktioniert der Import',
            p: [
              'Der League-of-Legends-Client hat eine lokale API, die **LCU API**, die Riot Drittanbieter-Tools zur Verfügung stellt. Darüber kann eine App Runenseiten anlegen, Beschwörerzauber wählen und dem Shop Item-Sets hinzufügen, genau wie du es von Hand tun würdest.',
              'Coach LoL IA verbindet sich, indem es das *Lockfile* des Clients liest (lokaler Port und Passwort). Es fragt nie nach deinem Riot-Account oder Passwort.',
            ],
          },
          {
            h: 'Schritt für Schritt',
            ordenada: true,
            lista: [
              '[Lade Coach LoL IA herunter](@descargar) und installiere es unter Windows 10 oder 11.',
              'Öffne die App und den LoL-Client, in beliebiger Reihenfolge. Die App erkennt den Client selbst.',
              'Geh in die Championauswahl. Die App erkennt deinen Champion und die Position, die dir der Client zuweist.',
              'Prüf den Build: Runen (du kannst zwischen mehreren Seiten wählen), Beschwörerzauber, Items und Skill-Reihenfolge.',
              'Klick auf **„Importieren“**. Wenn du gar nichts anfassen willst, aktiviere den automatischen Import in den Einstellungen.',
            ],
          },
          {
            h: 'Deine Runenseiten sind sicher',
            p: [
              'Die App legt eigene Seiten mit dem Präfix **„Coach:“** an, zum Beispiel „Coach: Ahri Mid“, und ersetzt ihre eigene, falls es sie schon gibt. Hast du keine freie Seite mehr, ersetzt sie eine deiner Seiten nur, wenn du auf „Importieren“ klickst und es bestätigst (nie eine vordefinierte); der automatische Import löscht nie etwas.',
            ],
          },
          {
            h: 'Wenn etwas nicht klappt',
            lista: [
              '**„Warte auf den League-of-Legends-Client…“**: Öffne den Client; die App versucht es alle 3 Sekunden erneut.',
              '**„Build nicht verfügbar“**: Es gibt weniger als 10 Spiele für diesen Champion auf dieser Position. Probier eine andere Position oder warte auf das nächste Update.',
              '**Die Seite wird nicht angelegt**: Prüf, ob du eine freie Seite oder eine ersetzbare „Coach:“-Seite hast.',
              'Klappt es weiterhin nicht, frag den KI-Assistenten oder schreib uns an support@coachlolia.com.',
            ],
          },
          {
            h: 'Von Hand geht es auch',
            p: [
              'Wenn du nichts installieren willst, kannst du den Build von Hand in den Client übertragen: Leg eine Runenseite an, wähl die Beschwörerzauber und kauf nach der Item-Reihenfolge. Der Import spart dir nur diese Zeit in der Championauswahl.',
            ],
          },
        ],
      },
    },
  },

  noEncontrada: {
    h1: 'Seite nicht gefunden',
    texto: 'Die gesuchte Seite gibt es nicht oder sie ist umgezogen.',
    volver: 'Zur Startseite',
    otros: 'Andere Sprachen',
  },
};
