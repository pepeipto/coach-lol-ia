// Textes du site en français. Même structure que es.ts (un test vérifie que les clés correspondent).
import { MIN_PARTIDAS_BUILD, PARTIDAS_DATOS_LIMITADOS } from '../../lib/cifras.ts';
import type { Textos } from './es.ts';

const CORREO = 'support@coachlolia.com';

export const fr: Textos = {
  meta: {
    lema: 'Ton coach League of Legends, en temps réel et dans ta langue.',
    paginas: {
      inicio: {
        titulo: 'Coach LoL IA : builds, tier list et overlay LoL gratuits',
        descripcion:
          'Appli gratuite pour League of Legends : builds Émeraude+, runes en un clic, tier list et un coach en jeu avec overlay et voix. API officielles de Riot.',
      },
      descargar: {
        titulo: 'Télécharger Coach LoL IA gratuitement pour Windows',
        descripcion:
          'Télécharge gratuitement Coach LoL IA pour Windows 10 et 11 : builds LoL, import des runes et overlay avec voix. Installateur officiel, mises à jour auto.',
      },
      apoyar: {
        titulo: 'Soutenir Coach LoL IA, l’appli LoL gratuite pour tous',
        descripcion:
          'Coach LoL IA est gratuit et sans publicité dans l’appli. Découvre comment le projet est financé et comment le soutenir par un don volontaire.',
      },
      novedades: {
        titulo: 'Nouveautés de Coach LoL IA : versions et changements',
        descripcion:
          'Toutes les versions de Coach LoL IA, de la plus récente à la plus ancienne : overlay en widgets, écran de chargement, tier list, ARAM, Arena et plus.',
      },
      builds: {
        titulo: 'Builds LoL et tier list basées sur l’Émeraude+ | Coach LoL IA',
        descripcion:
          'Comment Coach LoL IA calcule ses builds League of Legends et sa tier list : parties Émeraude+ en EUW, LAN et LAS, recalculées toutes les 6 heures.',
      },
      guias: {
        titulo: 'Guides LoL : overlay, tier list et runes | Coach LoL IA',
        descripcion:
          'Guides pratiques League of Legends : utiliser un overlay dans les règles de Riot, lire une tier list et importer ses runes automatiquement.',
      },
      guiaOverlay: {
        titulo: 'Utiliser un overlay sur LoL en toute sécurité | Coach LoL IA',
        descripcion:
          'Ce que Riot autorise à un overlay League of Legends, les signaux d’alerte d’une appli qui va trop loin et comment le configurer en mode sans bordure.',
      },
      guiaTierList: {
        titulo: 'Qu’est-ce qu’une tier list LoL et comment la lire',
        descripcion:
          'Ce que signifient les tiers S, A, B et C sur League of Legends, comment une tier list est calculée avec victoires et sélection, et pourquoi l’échantillon compte.',
      },
      guiaRunas: {
        titulo: 'Importer ses runes automatiquement sur LoL | Coach LoL IA',
        descripcion:
          'Pas à pas pour importer runes, sorts d’invocateur et objets sur League of Legends en un clic depuis la sélection des champions, sans perdre tes pages.',
      },
      privacidad: {
        titulo: 'Politique de confidentialité · Coach LoL IA',
        descripcion: 'Quelles données Coach LoL IA traite, pourquoi, sur quelle base juridique, et quels sont tes droits.',
      },
      terminos: {
        titulo: 'Conditions d’utilisation · Coach LoL IA',
        descripcion: 'Conditions d’utilisation de Coach LoL IA, une appli gratuite pour League of Legends qui n’utilise que les API officielles de Riot.',
      },
      cookies: {
        titulo: 'Politique de cookies · Coach LoL IA',
        descripcion: 'Quels cookies le site de Coach LoL IA utilise, quand les publicités se chargent et comment modifier ton choix à tout moment.',
      },
      noEncontrada: {
        titulo: 'Page introuvable · Coach LoL IA',
        descripcion: 'La page que tu cherches n’existe pas ou a changé d’adresse.',
      },
    },
    ogAlt: 'Coach LoL IA : builds, tier list et coach en jeu pour League of Legends, gratuitement.',
  },

  comun: {
    saltar: 'Aller au contenu',
    menuAbrir: 'Ouvrir le menu',
    menuCerrar: 'Fermer le menu',
    inicioAria: 'Coach LoL IA, accueil',
    navAria: 'Principale',
    idioma: 'Langue',
    idiomaAria: 'Changer de langue',
    nav: {
      queHace: 'Fonctions',
      enAccion: 'En action',
      builds: 'Builds et tier list',
      guias: 'Guides',
      faq: 'FAQ',
      novedades: 'Nouveautés',
    },
    descargar: 'Télécharger',
    apoyar: 'Soutenir',
    descargarWindows: 'Télécharger pour Windows',
    apoyaProyecto: 'Soutenir le projet',
    capturaReal: 'Capture réelle',
    publicidad: 'Publicité',
    migas: 'Fil d’Ariane',
    inicio: 'Accueil',
    ayudaTitulo: 'Besoin d’aide ?',
    ayudaTexto: 'Écris-nous et nous te répondrons dès que possible.',
    soporteAria: 'Support',
    leerGuia: 'Lire le guide',
    actualizado: 'Mis à jour le',
  },

  pie: {
    descripcion: 'Coach en temps réel pour League of Legends, en 5 langues. Version',
    soporte: 'Support',
    producto: 'Produit',
    proyecto: 'Projet',
    legal: 'Mentions légales',
    recursos: 'Ressources',
    idiomas: 'Langues',
    enlaces: {
      descargar: 'Télécharger',
      novedades: 'Nouveautés',
      apoyar: 'Soutenir le projet',
      hojaDeRuta: 'Feuille de route',
      arquitectura: 'Architecture',
      seguridad: 'Sécurité et Vanguard',
      calidad: 'Qualité',
      github: 'Code sur GitHub',
      builds: 'Builds et tier list',
      guias: 'Guides',
      privacidad: 'Confidentialité',
      terminos: 'Conditions',
      cookies: 'Cookies',
    },
    avisoRiot:
      "Coach LoL IA n’est pas approuvé par Riot Games et ne reflète pas les points de vue ou opinions de Riot Games ni de quiconque officiellement impliqué dans la production ou la gestion des propriétés de Riot Games. Riot Games et toutes les propriétés associées sont des marques commerciales ou des marques déposées de Riot Games, Inc.",
    marca:
      'League of Legends est une marque déposée de Riot Games, Inc. Images de League of Legends © Riot Games, Inc.',
  },

  cookies: {
    region: 'Consentement aux cookies',
    titulo: 'Cookies et publicité',
    texto:
      'Ce site affiche des publicités Google AdSense, qui utilisent des cookies tiers. Elles ne se chargent que si tu les acceptes. Tu peux changer d’avis à tout moment depuis la page',
    enlace: 'cookies',
    rechazar: 'Refuser',
    aceptar: 'Accepter',
  },

  asistente: {
    boton: 'Assistant IA',
    titulo: 'Assistant IA de Coach LoL IA',
    cerrar: 'Fermer l’assistant',
    intro: 'Demande-moi comment installer l’appli, importer des builds ou utiliser l’overlay.',
    conversacion: 'Conversation',
    pregunta: 'Ta question',
    placeholder: 'Écris ta question…',
    enviar: 'Envoyer',
    nota: `Réponses générées par IA ; elles peuvent contenir des erreurs. En cas de problème, écris à ${CORREO}.`,
    escribiendo: 'En train d’écrire…',
    tu: 'Toi : ',
    asistente: 'Assistant : ',
    errores: {
      noDisponible: `L’assistant n’est pas encore disponible. En attendant, écris-nous à ${CORREO}.`,
      limite: 'Tu as posé beaucoup de questions d’affilée. Patiente un peu et réessaie.',
      fallo: 'L’assistant n’a pas pu répondre pour le moment. Réessaie dans quelques minutes.',
      noValido: 'Ton message n’a pas pu être envoyé. Écris une question de 1000 caractères maximum.',
      sinConexion: 'Impossible de joindre le serveur. Vérifie ta connexion et réessaie.',
    },
  },

  diagrama: {
    aria: 'Schéma d’architecture (fais défiler horizontalement sur petit écran)',
    titulo: 'Architecture de Coach LoL IA',
    desc: 'Sur le PC du joueur, l’appli (Electron) se connecte au client League of Legends via la LCU API et à la partie via la Live Client Data API sur 127.0.0.1:2999. Dans le cloud, le serveur de builds (Fastify et SQLite) récupère les parties depuis l’API de Riot, les agrège toutes les 6 heures et envoie les builds à l’appli en HTTPS. L’appli télécharge noms et icônes depuis Data Dragon. Le site (Astro, GitHub Pages) et la vue Aide de l’appli interrogent l’assistant IA du serveur, qui génère les réponses avec Anthropic. L’appli n’utilise que les API officielles de Riot et ne touche jamais au processus du jeu.',
    pc: 'PC DU JOUEUR · WINDOWS 10/11',
    nube: 'CLOUD',
    cliente: 'Client LoL',
    clienteSub: 'salon et sélection',
    partida: 'Partie en cours',
    partidaSub: 'le jeu (sans y toucher)',
    vanguard1: 'ni lecture mémoire ni injection ;',
    vanguard2: 'ni captures ni touches',
    procesoPrincipal: 'PROCESSUS PRINCIPAL (Node.js)',
    conectorLcu: 'Connecteur LCU',
    conectorPartida: 'Connecteur de partie · chaque 1 s',
    motor: 'Moteur de conseils (règles)',
    clienteBuilds: 'Client de builds + cache',
    asistenteSoporte: 'Assistant de support',
    datosEstaticos: 'Données statiques',
    ventana: 'Fenêtre principale (React)',
    ventanaSub: 'build, import, réglages',
    overlay: 'Overlay (React)',
    overlaySub: 'transparent, clics traversants, voix',
    servidor: 'Serveur · Fastify + SQLite',
    recolector: 'Collecteur',
    recolectorSub: 'Solo/Duo, Émeraude+, EUW · LAN · LAS',
    agregador: 'Agrégateur · toutes les 6 h',
    agregadorSub: `≥ 200 parties par patch · minimum ${MIN_PARTIDAS_BUILD}`,
    api: 'API publique',
    asistenteIa: 'Assistant IA',
    asistenteIaSub: 'POST /api/asistente · usage limité',
    apiRiot: 'API de Riot',
    modeloIa: 'modèle de l’assistant IA',
    dataDragonSub: 'noms et icônes',
    estaWeb: 'Ce site',
    claves1: 'RIOT_API_KEY et ANTHROPIC_API_KEY n’existent que comme',
    claves2: 'variables d’environnement du serveur.',
    ayuda: 'aide',
    parche: 'patch',
    partidas: 'parties',
    pie: 'Schéma d’architecture. Les flèches bleues représentent les données de jeu et de builds ; les dorées, les questions à l’assistant IA.',
    respuestas: 'réponses',
  },

  inicio: {
    etiquetaVersion: 'Nouvelle version',
    hero: {
      desc: 'Les builds les plus populaires chez les joueurs Émeraude+, avec leurs statistiques, en sélection des champions, importées dans le client en un clic, un écran de chargement avec les deux équipes et un coach qui te prévient pendant la partie grâce à un overlay en widgets et à la voix. Uniquement avec les API officielles de Riot.',
      meta: 'Gratuit · Windows 10/11 · API officielles de Riot uniquement · Code sur',
      capturaAlt:
        'Capture de Coach LoL IA dans la vue Champion : Ahri au rôle Mid avec son taux de victoire, 33 parties et les données du patch 16.20, et le bouton Importer ; runes Domination et Sorcellerie, Saut éclair et Embrasement, objets de départ, objets principaux et bottes, et le tableau de l’ordre des compétences avec la priorité Q, W, E.',
      capturaPie: 'Vue Champion avec les vraies données du serveur de builds.',
    },
    cifras: [
      ['Régions', 'EUW · LAN · LAS'],
      ['Parties analysées', 'Émeraude+'],
      ['Mise à jour des builds', 'toutes les 6 h'],
    ],
    cifraPruebas: 'Tests automatisés',

    enAccion: {
      antetitulo: 'En action',
      titulo: 'Regarde-le en action',
      intro:
        'Des extraits réels : une partie de Zed en jungle avec l’overlay ouvert et une visite de l’appli. Les vidéos sont sans son et ne se chargent que lorsque tu arrives dessus.',
      videos: {
        partida: {
          titulo: 'Le coach dans une vraie partie',
          texto:
            'Le compte à rebours des objectifs, ton CS et ton KDA en direct, et la flèche qui indique quelle compétence monter. Enregistré lors d’une vraie partie de Zed en jungle.',
          etiqueta:
            'Vidéo d’une vraie partie de League of Legends avec Zed en jungle : l’overlay de Coach LoL IA affiche en haut le compte à rebours des objectifs, le dragon à 0:38, le widget CS et KDA qui passe au vert et la flèche dorée au passage de niveau.',
        },
        tour: {
          titulo: 'Visite de Coach LoL IA 3.0',
          texto:
            'Écran de chargement (avec des joueurs fictifs), build Émeraude+, import en un clic, alertes, timers de jungle, tier list et les modes ARAM et Arena.',
          etiqueta:
            'Vidéo de présentation de Coach LoL IA 3.0 : écran de chargement avec des données d’exemple, build d’Ahri au Mid, bouton Importer, overlay avec objectifs, alerte d’achat, CS et KDA, timers sur une minimap schématique et tier list par rôle et par mode.',
        },
      },
      textosVideo: 'Les textes de la vidéo sont en espagnol ; les sous-titres en français s’affichent par défaut.',
      reproducir: 'Lire',
      fotos: [
        {
          nombre: 'partida-objetivos',
          alt: 'Capture d’une vraie partie de League of Legends avec Zed en jungle à 4:22 : en haut, la barre d’objectifs de Coach LoL IA avec le dragon à 0:38, et à droite le widget de CS (20, à 4,6 par minute) et le KDA 0/0/1.',
          pie: 'Barre d’objectifs et CS dans une vraie partie (minute 4).',
        },
        {
          nombre: 'partida-dragon',
          alt: 'Capture d’une vraie partie de League of Legends : Zed juste après l’annonce d’un ennemi éliminé, avec la barre d’objectifs de Coach LoL IA en haut (dragon à 0:20) et le widget de CS, déjà vert à 6,4 par minute, dans le coin supérieur droit.',
          pie: 'Le widget de CS passe au vert quand tu dépasses ton objectif.',
        },
      ],
    },

    queHace: {
      antetitulo: 'Fonctions',
      titulo: 'Tout ce qu’il te faut, de la sélection à la victoire',
      intro:
        'Coach LoL IA t’accompagne aux deux moments qui comptent le plus : la sélection des champions, où il te montre les options les plus populaires avec leurs statistiques pour que tu choisisses, et la partie, où il te rappelle l’essentiel sans que tu quittes le jeu.',
      funciones: [
        {
          icono: 'capas',
          titulo: 'Builds par champion et par rôle',
          texto:
            'Jusqu’à 3 options d’objets et 3 pages de runes parmi les plus jouées, chacune avec son taux de sélection et de victoire : c’est toi qui choisis. Runes, sorts d’invocateur, objets de départ, trio d’objets principaux, bottes, objets situationnels et ordre des compétences, avec leur taux de victoire et le nombre de parties qui les appuient. Publiés dès 10 parties ; ceux qui en ont peu portent le badge « Données limitées ».',
        },
        {
          icono: 'grafico',
          titulo: 'Champions et tier list',
          texto:
            'La section Champions classe tous les champions par rôle en tiers S, A, B et C selon leurs victoires et leur taux de sélection, avec recherche et le build complet de chacun.',
        },
        {
          icono: 'usuario',
          titulo: 'Écran de chargement',
          texto:
            'Pendant le chargement, l’overlay présente les dix joueurs en plein écran, avec ta carte mise en valeur : rang officiel, maîtrise et victoires du champion à son rôle, avec des étiquettes uniquement positives ou neutres. Espace le masque.',
        },
        {
          icono: 'descarga',
          titulo: 'Import en un clic',
          texto:
            'Crée la page de runes « Coach: <Champion> <Rôle> », choisit les sorts d’invocateur et ajoute un set d’objets à la boutique. Ne touche qu’aux pages avec le préfixe « Coach: » ; s’il ne te reste aucune page libre, elle remplace l’une des tiennes uniquement si tu cliques sur « Importer » et que tu confirmes.',
        },
        {
          icono: 'brujula',
          titulo: 'Rôle automatique',
          texto:
            'Reprend le rôle attribué par le client. S’il n’y en a pas, il prend le rôle le plus joué avec ce champion, et tu peux le changer avec le sélecteur de rôle.',
        },
        {
          icono: 'monitor',
          titulo: 'Overlay en widgets',
          texto:
            'Barre d’objectifs en haut (avec le type du prochain dragon), une flèche au-dessus de la compétence à monter, ton CS et ton KDA, l’alerte d’achat et les alertes. Chaque widget se déplace, se redimensionne et se désactive séparément.',
        },
        {
          icono: 'voz',
          titulo: 'Beaucoup plus de voix',
          texto:
            'Une voix naturelle neuronale et hors ligne dans les 5 langues, avec 460 phrases par langue et leurs variantes : objectifs, achats, farm, vision, combats, phases de jeu et jungle, une à la fois et la plus urgente d’abord. Tu choisis le niveau de détail et les catégories à entendre.',
        },
        {
          icono: 'reloj',
          titulo: 'Timers de jungle',
          texto:
            'Optionnels et désactivés par défaut : tu indiques quand tu nettoies un camp de ton côté ou un Carapateur, et l’appli décompte sa réapparition, y compris par-dessus la minimap.',
        },
        {
          icono: 'diana',
          titulo: 'ARAM, ARAM : Chaos et Arena',
          texto:
            'Chaque mode a ses builds et sa tier list (avec les augments les plus choisis en ARAM : Chaos et en Arena), et un overlay qui n’affiche dans chaque mode que ce qui a du sens.',
        },
        {
          icono: 'nube',
          titulo: 'Fonctionne hors ligne',
          texto:
            'Les derniers builds sont mis en cache. Si le serveur ne répond pas, l’appli utilise la copie enregistrée et te le signale : « Données hors ligne (patch X) ».',
        },
        {
          icono: 'refrescar',
          titulo: 'Se met à jour toute seule',
          texto:
            'À l’ouverture, l’appli télécharge la dernière version depuis GitHub Releases, l’installe et redémarre ; jamais en pleine partie, elle attend la fin. Data Dragon et les builds suivent le patch actuel.',
        },
        {
          icono: 'idioma',
          titulo: 'En 5 langues',
          texto:
            'L’appli, l’overlay, la voix et l’assistant en espagnol, anglais, portugais (Brésil), français et allemand. Choisis la langue dans les Réglages ; par défaut, celle de ton Windows. Ce site aussi, dans les cinq.',
        },
      ],
      vitrina: {
        titulo: 'C’est toi qui décides ce que le coach te dit',
        texto:
          'Depuis la vue Overlay, tu vois un aperçu des widgets, tu choisis lesquels tu veux, leur taille et leur emplacement, et tu décides ce que la voix te dit : le niveau de détail (Basique, Normal ou Complet) et chaque catégorie séparément.',
        lista: [
          'Aperçu des widgets tels qu’ils apparaîtront en partie',
          '« Déplacer et calibrer » pour placer chaque widget là où il ne gêne rien',
          'Opacité générale, plus une taille et un interrupteur pour chaque widget',
          'Voix naturelle ou de Windows, volume, niveau de détail et catégories, avec « Tester la voix »',
        ],
        alt: 'Capture de la vue Overlay de Coach LoL IA : aperçu avec la barre d’objectifs, le CS et le KDA, l’alerte « Niveau 6 : monte le R », la flèche au-dessus du R et l’alerte d’achat ; à droite, le bouton « Déplacer et calibrer », l’opacité, ainsi que les interrupteurs et tailles des widgets Objectifs, Flèche de compétence et Performance (CS et KDA).',
        pie: 'Vue Overlay : widgets, position, taille et voix.',
      },
    },

    novedades3: {
      antetitulo: 'Nouveautés de la 3.0',
      titulo: 'Avant, pendant et entre les parties',
      intro:
        'La 3.0 ajoute l’écran de chargement, la section Champions avec sa tier list, les modes ARAM, ARAM : Chaos et Arena, et les timers de jungle. Les versions 3.0.1 et 3.0.2 apportent les runes au choix, le thème « Ombre » et un overlay adapté aux écrans 2K et 4K. Le tout avec des données que le jeu ou l’API officielle de Riot fournissent déjà. [Voir toutes les nouveautés](@novedades).',
      carga: {
        titulo: 'Écran de chargement',
        texto:
          'Pendant le chargement, l’overlay place les dix joueurs comme le jeu : les adversaires en haut et ton équipe en bas. Pour chacun, tu vois son rang officiel en Solo/Duo, sa maîtrise du champion et les victoires de ce champion à son rôle.',
        lista: [
          'Étiquettes uniquement positives ou neutres : « Spécialiste de… », « Monte en puissance en fin de partie »',
          'Pas de MMR inventé ni d’étiquette négative pour personne',
          'Disparaît tout seul dès le début de la partie',
        ],
        alt: 'Capture de l’écran de chargement dans l’overlay de Coach LoL IA : dix cartes de joueurs avec des noms fictifs, cinq adversaires en haut et cinq alliés en bas, chacune avec le champion, le rôle, le rang (d’Or à Diamant, ou Non classé), les victoires et défaites, la maîtrise, le taux de victoire du champion et des étiquettes comme « Spécialiste de Darius », « Série positive cette saison » ou « Protège son équipe ».',
        pie: 'Écran de chargement avec des joueurs fictifs.',
      },
      campeones: {
        titulo: 'Champions et tier list',
        texto:
          'Tous les champions par rôle, avec leur tier (S, A, B ou C) selon leurs victoires et leur taux de sélection, le nombre de parties et le build complet en un clic. Un sélecteur bascule entre Classée, ARAM, ARAM : Chaos et Arena.',
        lista: [
          'Recherche, filtre par rôle et tri par tier, victoires, sélection ou parties',
          'Mention « Données limitées » pour ceux qui ont moins de 30 parties',
          'En Arena, place moyenne et taux de top 4',
        ],
        alt: 'Capture de la section Champions de Coach LoL IA : tier list de Classée avec les données du patch 16.20, le sélecteur de mode (Classée, ARAM, ARAM : Chaos, Arena), la recherche, les filtres par rôle et un tableau avec champion, rôle, tier, victoires, sélection et parties ; en haut, Yunara et Viego en tier S, et plus bas des champions en tier B avec la mention de données limitées.',
        pie: 'Section Champions : tier list par mode et par rôle.',
        enlace: 'Comment sont calculés les builds et la tier list',
      },
      jungla: {
        titulo: 'Les timers de jungle, à ta façon',
        texto:
          'Optionnels et désactivés par défaut. Quand tu nettoies un camp de ton côté ou un Carapateur, tu le marques d’un clic ou avec ta touche, et l’appli décompte sa réapparition par-dessus la minimap, comme les timers du jeu. Alt+Maj+L les affiche ou les masque.',
        lista: [
          'Uniquement ta jungle et les deux Carapateurs : jamais les camps adverses',
          'En doré pendant les 30 dernières secondes et une coche quand le camp est réapparu',
          '« Gromp dans 30 secondes » à la voix, si tu le souhaites',
        ],
        alt: 'Détail des timers de jungle de Coach LoL IA sur une minimap schématique du côté bleu : décomptes de 15 s et 1:40 sur deux camps, 1:08 et 1:13 sur deux autres, et une coche sur ceux qui sont déjà réapparus.',
        pie: 'Timers sur la minimap (schéma de la carte).',
      },
    },

    comoFunciona: {
      antetitulo: 'Fonctionnement',
      titulo: 'De la sélection des champions à la partie',
      intro: 'Aucune configuration : ouvre l’appli avant ou après le client, elle s’occupe du reste.',
      pasos: [
        {
          titulo: 'Ouvre l’appli et le client LoL',
          texto:
            'Coach LoL IA trouve le client en lisant son fichier lockfile (port et mot de passe locaux). Tant qu’il ne le trouve pas, il affiche « En attente du client League of Legends… » et réessaie toutes les 3 secondes.',
          detalle: 'LCU API · WebSocket',
        },
        {
          titulo: 'Choisis ton champion',
          texto:
            'Le client transmet ton champion et ton rôle par WebSocket. L’appli demande le build au serveur et l’affiche en moins de 2 secondes. « Importer » (ou l’import automatique) applique les runes, les sorts et les objets.',
          detalle: 'Sélection des champions',
        },
        {
          titulo: 'Joue avec le coach',
          texto:
            'Pendant le chargement, l’overlay affiche l’écran de chargement avec les deux équipes. En partie, l’appli interroge la Live Client Data API sur https://127.0.0.1:2999 chaque seconde. Le moteur de conseils compare ton état avec le build et affiche les objectifs, la compétence à monter, ton CS et ton KDA, le prochain achat et les alertes. Ctrl+Maj+O le masque ou l’affiche.',
          detalle: 'Live Client Data API',
        },
        {
          titulo: 'Fin de la partie',
          texto:
            'À la fin de la partie, l’overlay se masque et l’appli arrête d’interroger le port 2999. La sélection des champions suivante relance le cycle.',
          detalle: 'Aucun processus résiduel',
        },
      ],
      overlay: {
        alt: 'Capture de l’overlay de Coach LoL IA sur l’illustration de Jinx : en haut, la barre d’objectifs (Larves du Néant disponibles, dragon à 0:38, Héraut à 5:38 et Baron à 10:38) ; à droite, le CS (61, à 6,5 par minute pour un objectif de 8) ; à gauche, l’alerte « Niveau 6 : monte le R » ; en bas, une flèche au-dessus du R et l’alerte « Tu peux acheter l’Ouragan de Runaan ».',
        pie: 'Overlay en partie, chaque widget à sa place.',
        titulo: 'Ce que le coach te dit en partie',
        avisos: [
          ['Achat', '« Tu peux acheter l’Ouragan de Runaan »'],
          ['Compétences', '« Niveau 6 : monte le R »'],
          ['Objectifs', 'À 1 minute, à 30 secondes et à l’apparition, avec le type de dragon'],
          ['CS', '« Tu es en dessous de ton objectif de farm » (aux minutes 5, 10, 15 et 20)'],
          ['Vision', '« Achète une balise de contrôle »'],
          ['Jungle', '« Gromp dans 30 secondes » (seulement si tu utilises les timers)'],
          ['Jungler adverse', '« Le jungler adverse vient d’apparaître bot (kill) »'],
          ['Phase de jeu', '« Milieu de partie : regroupe-toi avec ton équipe pour les objectifs »'],
        ],
        nota: 'Chaque widget a sa place : les objectifs en haut, la flèche au-dessus de ta barre de compétences et le reste où tu veux. La voix dit une phrase à la fois, la plus urgente d’abord, et une même alerte ne se répète pas tant que sa condition ne change pas. Ton CS est comparé à une référence de ton rôle, sans couleur rouge ni message négatif.',
      },
      junglaEnemiga: {
        titulo: 'Le jungler adverse, uniquement avec ce que le jeu montre déjà',
        nota1:
          'Quand le jungler adverse participe à un kill, le fil des éliminations du jeu l’affiche et l’appli te le dit : « Le jungler adverse vient d’apparaître bot (kill) ». Ce n’est pas un suivi : l’appli ne connaît ni sa position ni ses temps de recharge, et l’alerte parle toujours de ce kill-là.',
        nota2:
          'Si tu veux, tu peux activer une estimation de son parcours habituel (désactivée par défaut) : de quel côté ce champion commence généralement et quelle voie il visite en premier, d’après nos parties. C’est ce qu’il fait d’habitude, pas ce qu’il fait dans ta partie.',
        alt: 'Capture de l’overlay de Coach LoL IA avec l’alerte « Le jungler adverse vient d’apparaître bot (kill) », à côté de la barre d’objectifs, du CS, de la flèche au-dessus du R, de l’alerte d’achat et des timers de jungle sur une minimap schématique.',
        pie: 'Alerte basée sur le fil des éliminations.',
      },
    },

    arquitectura: {
      antetitulo: 'Architecture',
      titulo: 'Trois briques qui travaillent ensemble',
      intro:
        'Un monorepo avec l’appli de bureau, le serveur de builds et ce site. La clé de l’API de Riot n’existe que sur le serveur ; l’appli distribuée ne contient aucun secret.',
      piezas: [
        {
          titulo: 'Appli de bureau',
          texto:
            'Electron avec deux fenêtres en React. Le processus principal réunit le **connecteur LCU** (client), le **connecteur de partie** (port 2999), le **moteur de conseils** (une fonction pure et déterministe : état de la partie + build + rôle → alertes), le client de builds avec cache disque et les données Data Dragon.',
        },
        {
          titulo: 'Serveur de builds',
          texto:
            'Node avec Fastify et SQLite, empaqueté dans Docker. Le collecteur télécharge les parties depuis l’API de Riot en respectant ses limites de requêtes ; l’agrégateur calcule les builds toutes les 6 heures et l’API publique les sert en JSON avec le patch et la date de calcul.',
        },
        {
          titulo: 'Site et assistant',
          texto:
            'Ce site statique (Astro) est publié sur GitHub Pages. Son assistant IA, comme la vue Aide de l’appli, interroge le serveur, qui limite l’usage et est le seul à détenir la clé du modèle.',
        },
      ],
    },

    seguridad: {
      antetitulo: 'Sécurité et Vanguard',
      titulo: 'API officielles uniquement. Nous ne touchons jamais au jeu',
      intro:
        'Vanguard est le système anti-triche de Riot et il surveille le processus du jeu. Coach LoL IA est conçu pour s’en tenir à l’écart : tout ce qu’il sait provient des interfaces que Riot publie pour les outils tiers.',
      si: {
        titulo: 'Ce qu’il fait',
        lista: [
          'Lit le **lockfile** du client pour se connecter à la **LCU API**, une API locale protégée par mot de passe.',
          'Interroge la **Live Client Data API** sur `127.0.0.1:2999`, en lecture seule, pendant la partie.',
          'Télécharge noms et icônes depuis **Data Dragon**, le service public de Riot.',
          'Affiche l’overlay comme une fenêtre Windows normale, transparente et aux clics traversants.',
          'Enregistre le raccourci avec la touche globale d’Electron, sans rien envoyer au jeu.',
        ],
      },
      nunca: {
        titulo: 'Ce qu’il ne fait jamais',
        lista: [
          'Lire ou écrire la mémoire du jeu.',
          'Injecter du code ou une DLL dans un processus.',
          'Faire des captures d’écran pour les analyser.',
          'Simuler le clavier ou la souris, ni automatiser des actions.',
          'Effacer tes pages de runes ou tes sets d’objets.',
        ],
      },
      noMuestra: {
        titulo: 'Ce que l’overlay n’affiche pas',
        lista: [
          'Les timers des sorts d’invocateur ou des ultimes adverses.',
          'Les timers des camps de la jungle adverse : les timers de jungle ne concernent que ton côté et c’est toi qui les lances.',
          'La position des ennemis ou toute information que tu ne vois pas à l’écran. Pour le jungler adverse, il répète seulement ce qui apparaît déjà dans le fil des éliminations.',
        ],
        nota: 'Avant de demander la clé de production de Riot, chaque alerte est vérifiée au regard de la politique en vigueur pour les développeurs.',
      },
      datos:
        '**Tes données :** la clé de l’API de Riot n’existe que sur le serveur, en variable d’environnement. L’appli n’envoie jamais tes identifiants. Elle demande le build de ton champion et de ton rôle et, pour l’écran de chargement, uniquement le PUUID (identifiant public de Riot) des dix joueurs, avec leur champion et leur rôle ; le Riot ID n’est pas envoyé. Avec le PUUID, le serveur consulte le rang et la maîtrise dans l’API officielle et garde la réponse uniquement en mémoire, 10 minutes au maximum. Pour le coach IA (analyse de fin de partie et conseils des temps morts), elle envoie les statistiques, objets et événements de la partie, sans ton Riot ID ; notre fournisseur d’IA les traite et ils ne sont pas conservés.',
      guia: 'Guide : utiliser un overlay sur LoL en toute sécurité',
    },

    datos: {
      antetitulo: 'Données',
      titulo: 'Des builds tirés de vraies parties, recalculés toutes les 6 h',
      intro:
        'Les recommandations ne sont pas des opinions : elles proviennent de parties classées récentes de joueurs de haut niveau, traitées par notre propre serveur.',
      tuberia: [
        {
          icono: 'usuario',
          titulo: 'Collecteur',
          texto:
            'Utilise League-v4 pour trouver des joueurs **Émeraude ou plus** en **EUW, LAN et LAS**, et Match-v5 pour télécharger leurs parties **classées Solo/Duo**, d’**ARAM**, d’**ARAM : Chaos** et d’**Arena**. Il respecte les limites de Riot et traite des milliers de nouvelles parties par région à chaque cycle, réparties entre les modes ; ce qu’un mode n’utilise pas revient aux parties classées.',
        },
        {
          icono: 'grafico',
          titulo: 'Agrégateur',
          texto:
            'Pour chaque champion et rôle, il calcule la page de runes, les sorts, les objets de départ, le trio d’objets principaux, les bottes, les objets situationnels et l’ordre des compétences les plus fréquents, avec leur taux de victoire et leur nombre de parties. En ARAM et ARAM : Chaos, il regroupe par champion, et en Arena il ajoute la place moyenne du champion et les augments et objets les plus choisis, avec leur seul taux de sélection. Il calcule aussi le tier de chaque champion à son rôle.',
        },
        {
          icono: 'reloj',
          titulo: 'Publication',
          texto:
            'Le cycle se répète **toutes les 6 h**. L’API sert chaque build avec son patch et sa date de calcul, et l’appli le met en cache pour l’utiliser hors ligne.',
        },
      ],
      umbrales: [
        {
          cifra: '200',
          texto:
            '**parties sur le patch actuel** pour n’utiliser que les données du patch. En dessous de 200 parties, elles sont combinées avec celles du patch précédent et le build l’indique (`mezclaParches`).',
        },
        {
          cifra: String(MIN_PARTIDAS_BUILD),
          texto: `**${MIN_PARTIDAS_BUILD} parties au total** au minimum pour publier un build. De ${MIN_PARTIDAS_BUILD} à ${PARTIDAS_DATOS_LIMITADOS - 1} parties, il porte le badge **« Données limitées »**, et en dessous de ${MIN_PARTIDAS_BUILD} l’appli affiche « Build indisponible » au lieu d’en inventer un.`,
        },
        {
          cifra: '6 h',
          texto:
            '**entre deux mises à jour.** Quand un nouveau patch sort, le serveur et Data Dragon se mettent à jour tout seuls et l’appli affiche « Données du patch X.Y ».',
        },
      ],
    },

    tecnologias: {
      antetitulo: 'Technologies',
      titulo: 'Une stack moderne, typée de bout en bout',
      intro:
        'Overwolf a été écarté (il impose d’installer sa plateforme), tout comme Tauri (son overlay transparent aux clics traversants est moins abouti sous Windows). Electron offre le contrôle nécessaire sur l’overlay avec une seule base de code TypeScript.',
      lista: [
        ['Electron', 'Appli de bureau : fenêtre principale et overlay transparent aux clics traversants.'],
        ['React 19', 'Interface des deux fenêtres, avec un CSS maison basé sur des design tokens.'],
        ['TypeScript', 'Tout le code (appli, serveur et types partagés) avec vérification stricte.'],
        ['Node.js 24', 'Processus principal de l’appli et serveur de builds.'],
        ['SQLite', 'Base de données du serveur (better-sqlite3) : parties et builds.'],
        ['Fastify', 'API HTTP du serveur : builds, rôles et assistant IA.'],
        ['Vitest', 'Tests automatisés de l’appli, du serveur et du code partagé.'],
        ['Astro', 'Ce site : statique, sans framework côté client, publié sur GitHub Pages.'],
        ['electron-builder', 'Installateur Windows et mises à jour automatiques via GitHub Releases.'],
        ['Docker', 'Image du serveur prête à déployer chez n’importe quel hébergeur.'],
        ['GitHub Actions', 'Intégration continue et déploiement du site.'],
      ],
    },

    calidad: {
      antetitulo: 'Qualité',
      titulo: 'Testé avant chaque changement',
      cifra: 'tests automatisés avec Vitest dans l’appli, le serveur et le code partagé, exécutés à chaque changement.',
      tarjetas: [
        {
          icono: 'prueba',
          titulo: 'Des tests avec de vraies données',
          texto:
            'Le moteur de conseils et l’agrégateur sont testés avec des parties enregistrées. Un **simulateur de partie** rejoue une vraie partie comme une fausse Live Client Data API, et un **LCU simulé** permet de tester la sélection des champions et l’import sans ouvrir LoL.',
        },
        {
          icono: 'ramas',
          titulo: 'Intégration continue',
          texto:
            'GitHub Actions vérifie les types TypeScript de chaque paquet et lance tous les tests sous Windows à chaque push. Il construit aussi l’image Docker du serveur et vérifie que SQLite s’y charge.',
        },
        {
          icono: 'revisar',
          titulo: 'Revue tâche par tâche',
          texto:
            'Chaque version part d’une spécification et d’un plan découpé en petites tâches. Chaque tâche suit le TDD (d’abord un test qui échoue, puis le code) et passe une revue de spécification et une revue de qualité avant d’être fusionnée.',
        },
        {
          icono: 'rayo',
          titulo: 'Test réel en partie',
          texto:
            'Avant chaque publication, la version est testée dans une vraie partie d’entraînement. Ce site a aussi ses tests : ils compilent le site et vérifient le HTML généré.',
        },
      ],
    },

    planes: {
      antetitulo: 'Gratuit',
      titulo: 'Gratuit pour tout le monde',
      intro:
        'Coach LoL IA est gratuit et tout est inclus. Pas d’abonnement, d’essai ni de clé : tout le monde a la même appli.',
      incluido: {
        titulo: 'Tout est inclus',
        lista: [
          'Builds Émeraude+ par champion et par rôle',
          'Section Champions avec tier list',
          'Modes ARAM, ARAM : Chaos et Arena, avec augments',
          'Runes, sorts, objets et ordre des compétences',
          'Import dans le client en un clic',
          'Écran de chargement avec les deux équipes',
          'Coach en partie : overlay en widgets, voix et timers de jungle',
          'Assistant IA de support',
        ],
      },
      sinAnuncios: {
        titulo: 'Pas de publicité dans l’appli',
        texto:
          'L’appli n’a ni publicité ni bannière. Le projet est financé par la **publicité sur le site** (seulement si tu acceptes les cookies publicitaires) et par des **dons volontaires**.',
      },
      apoya: {
        titulo: 'Soutenir le projet',
        texto:
          'Les dons paient le serveur, les données des builds et le développement. Ils sont volontaires et ne donnent aucun avantage : l’appli est la même pour tous.',
        boton: 'Comment soutenir',
      },
    },

    hojaDeRuta: {
      antetitulo: 'Feuille de route',
      titulo: 'Où nous en sommes et où nous allons',
      completada: 'Terminée',
      items: [
        {
          version: 'v1',
          estado: 'Terminée',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Builds Émeraude+ (EUW, LAN, LAS) avec notre propre serveur',
            'Import des runes, sorts et objets en un clic',
            'Overlay avec alertes et voix optionnelle',
            'Installateur Windows avec mises à jour automatiques',
            'Simulateur de partie et LCU simulé pour les tests',
          ],
        },
        {
          version: 'v2',
          estado: 'Terminée',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Nouvelle interface au style professionnel : illustrations des champions, cartes et micro-animations',
            'Ce site produit',
            'Assistant IA de support sur le site et dans l’appli',
            'Tout gratuit pour tous, sans publicité dans l’appli',
          ],
        },
        {
          version: 'v3',
          estado: 'Terminée',
          clase: 'etiqueta-exito',
          hecho: true,
          puntos: [
            'Overlay en widgets : objectifs, flèche de compétence, CS et KDA, achats et alertes',
            'Écran de chargement avec rang, maîtrise et victoires du champion',
            'Timers manuels de ta jungle, aussi sur la minimap',
            'Section Champions avec tier list, et modes ARAM, ARAM : Chaos et Arena',
            'Runes au choix, thème « Ombre » et overlay adapté au 2K et au 4K',
          ],
        },
        {
          version: '3.1',
          estado: 'Disponible',
          clase: 'etiqueta-dorada',
          hecho: true,
          puntos: [
            'Voix naturelle neuronale et hors ligne en 5 langues, téléchargée toute seule en arrière-plan (jamais en partie)',
            'Écran de chargement plein écran avec ta carte mise en valeur : Espace le masque, ou choisis cartes seules ou désactivé',
            '460 phrases vocales par langue avec variantes, un niveau de détail et des catégories à activer une par une',
          ],
        },
        {
          version: 'Ensuite',
          estado: 'Idées',
          clase: '',
          hecho: false,
          puntos: ['Analyse de la partie par IA à la fin', 'Comptes utilisateur et alertes par e-mail'],
        },
      ],
    },

    faq: {
      antetitulo: 'FAQ',
      titulo: 'Questions fréquentes',
      escribir: 'Écrire à',
      ayuda:
        'Tu ne trouves pas ta réponse ? Demande à l’**assistant IA** : il est derrière le bouton « Assistant IA » de ce site et dans la vue « Aide » de l’appli.',
      ayudaAlt:
        'Capture de la vue Aide de Coach LoL IA : le chat de l’assistant IA avec son message d’accueil, le champ de saisie, le bouton Envoyer et la mention indiquant que les réponses sont générées par IA.',
      preguntas: [
        {
          p: 'Est-ce que je risque un ban en utilisant Coach LoL IA ?',
          r: 'L’appli n’utilise que les API locales officielles que Riot met à disposition des outils tiers (LCU API et Live Client Data API) et ne touche jamais au processus du jeu : pas de lecture mémoire, pas d’injection de code, pas de capture d’écran, pas de touches ni de clics simulés. En plus, l’overlay n’affiche aucune information que tu ne vois pas déjà à l’écran. Cela dit, la décision finale sur les outils tiers revient toujours à Riot, et c’est pourquoi nous vérifions chaque alerte au regard de sa politique en vigueur.',
        },
        {
          p: 'C’est gratuit ?',
          r: 'Oui, tout : les builds, les runes, l’import et le coach en partie (overlay et voix), pour tout le monde et sans publicité dans l’appli. Le projet est financé par la publicité sur le site et par des dons volontaires.',
        },
        {
          p: 'Faut-il Overwolf ou un autre programme ?',
          r: 'Non. Coach LoL IA est une appli de bureau autonome pour Windows : elle n’a besoin ni d’Overwolf ni d’aucune autre plateforme. Juste du client League of Legends.',
        },
        {
          p: 'Pourquoi je ne vois pas l’overlay pendant la partie ?',
          r: 'L’overlay est une fenêtre Windows au-dessus du jeu : il n’apparaît donc que si LoL est en mode « Sans bordure » (Options → Vidéo → Mode fenêtre). Si le jeu est en plein écran, l’appli te prévient. En partie, Ctrl+Maj+O le masque ou l’affiche. Pour placer chaque widget, dans la vue Overlay de l’appli, clique sur « Déplacer et calibrer », fais-le glisser puis clique sur « Fixer ici » (ou Échap ou Ctrl+Maj+O). Depuis cette vue, tu peux aussi activer, redimensionner ou désactiver chaque widget.',
        },
        {
          p: 'Comment importer mes runes automatiquement ?',
          r: 'En sélection des champions, clique sur « Importer » dans l’appli (ou active l’import automatique dans les Réglages). L’appli crée la page « Coach: <Champion> <Rôle> », choisit les sorts d’invocateur et ajoute le set d’objets. On t’explique tout pas à pas dans le guide [Importer ses runes automatiquement](@guiaRunas).',
        },
        {
          p: 'Comment fonctionnent les timers de jungle ?',
          r: 'Ils sont manuels et désactivés par défaut : tu les actives dans la vue Overlay. Quand tu nettoies un camp de ton côté ou un Carapateur, tu le marques d’un clic ou avec une touche de ton choix, et l’appli décompte le temps avant sa réapparition, dans un widget et par-dessus la minimap. Alt+Maj+L les affiche ou les masque en partie. Ils ne concernent que ta jungle et les Carapateurs, jamais les camps adverses : l’appli ne sait pas quand l’adversaire les nettoie, et les règles de Riot n’autorisent pas à suivre ce que fait l’ennemi hors de ta vision.',
        },
        {
          p: 'Que montre l’écran de chargement ?',
          r: 'Pendant le chargement, l’overlay affiche les dix joueurs avec leur champion et leur rôle : leur rang officiel en Solo/Duo, leur maîtrise de ce champion et le taux de victoire du champion à ce rôle d’après nos builds. Il ajoute uniquement des étiquettes positives ou neutres, comme « Spécialiste d’Ahri » ou « Monte en puissance en fin de partie ». Il ne calcule pas de MMR maison, ne colle d’étiquette négative à personne et disparaît dès le début de la partie. Pour obtenir rang et maîtrise, l’appli n’envoie au serveur que le PUUID de chaque joueur (jamais son Riot ID), et le serveur garde la réponse en mémoire 10 minutes au maximum.',
        },
        {
          p: 'Que me dit-il sur le jungler adverse ?',
          r: 'Uniquement ce que le jeu te montre déjà. Quand le jungler adverse participe à un kill, qui apparaît dans le fil des éliminations, l’appli te prévient : « Le jungler adverse vient d’apparaître bot (kill) ». Il existe aussi une option, désactivée par défaut, avec son parcours habituel : une estimation tirée de nos parties sur le côté par lequel ce champion commence généralement et la voie qu’il visite en premier. Aucune des deux ne dit où il se trouve maintenant : l’appli ne voit ni sa position ni ses temps de recharge.',
        },
        {
          p: 'Va-t-il effacer mes pages de runes ?',
          r: 'Seulement si tu le confirmes. L’appli crée ses propres pages avec le préfixe « Coach: » et, si l’une d’elles existe, c’est celle-là qu’elle remplace. S’il ne te reste aucune page libre et que tu cliques sur « Importer », elle te demande avant de remplacer l’une des tiennes (la sélectionnée ou la plus ancienne ; jamais une prédéfinie). L’import automatique ne supprime jamais rien.',
        },
        {
          p: 'D’où viennent les builds ?',
          r: `De parties classées Solo/Duo de joueurs Émeraude ou plus en EUW, LAN et LAS, que notre serveur télécharge depuis l’API officielle de Riot et agrège toutes les 6 heures. Pour ces mêmes joueurs, il télécharge aussi leurs parties d’ARAM, d’ARAM : Chaos et d’Arena. Chaque build indique son nombre de parties et son taux de victoire. Un build est publié dès ${MIN_PARTIDAS_BUILD} parties ; de ${MIN_PARTIDAS_BUILD} à ${PARTIDAS_DATOS_LIMITADOS - 1}, il porte le badge « Données limitées », et en dessous de ${MIN_PARTIDAS_BUILD} l’appli affiche « Build indisponible » au lieu d’en inventer un. [En savoir plus sur les builds et la tier list](@builds).`,
        },
        {
          p: 'Quels modes de jeu sont pris en charge ?',
          r: 'Classée (par champion et par rôle), ARAM et ARAM : Chaos (par champion, avec runes, sorts, objets et compétences ; en ARAM : Chaos, aussi les augments les plus choisis) et Arena (par champion, avec les augments et objets les plus choisis et leur taux de sélection, ainsi que la place moyenne, le taux de top 4 et de première place du champion). Chaque mode a sa tier list dans la section Champions. L’appli reconnaît le mode en sélection des champions et en partie, et l’overlay s’adapte : en ARAM et ARAM : Chaos, il retire les objectifs, le CS et la jungle, et garde le KDA, la flèche de compétence et les achats ; en Arena, il n’y a pas non plus de flèche de compétence.',
        },
        {
          p: 'Qu’est-ce que la tier list de la section Champions ?',
          r: 'Une section de l’appli avec tous les champions par rôle et par mode. Chacun reçoit un tier (S, A, B ou C) qui combine son taux de victoire et son taux de sélection à ce rôle. Ceux qui ont moins de 30 parties ne dépassent jamais le tier B et portent la mention « Données limitées ». Clique sur un champion pour voir son build complet. Pour savoir comment la lire, consulte le guide [Qu’est-ce qu’une tier list](@guiaTierList).',
        },
        {
          p: 'Les builds fonctionnent-ils si je joue sur un autre serveur ?',
          r: 'Oui. Les builds sont calculés à partir de parties EUW, LAN et LAS, mais ils dépendent du champion, du rôle et du patch, pas du serveur sur lequel tu joues.',
        },
        {
          p: 'Dans quelles langues est-il disponible ?',
          r: 'L’appli, l’overlay, la voix et l’assistant sont disponibles en espagnol, anglais, portugais (Brésil), français et allemand, tout comme ce site. Par défaut, l’appli utilise la langue de ton Windows, et tu peux la changer dans les Réglages.',
        },
        {
          p: 'Est-ce qu’il va me faire monter en elo ?',
          r: 'Nous ne promettons pas ça. Coach LoL IA te donne des informations et des rappels (builds basés sur des données, objectifs, CS, achats) pour que tu prennes tes propres décisions avec plus de contexte. Le résultat de la partie dépend de ta façon de jouer.',
        },
        {
          p: 'Faut-il créer un compte ?',
          r: 'Non. Tu télécharges l’appli, tu l’ouvres avec le client League of Legends et c’est tout : pas de compte, pas de clé, pas d’inscription.',
        },
        {
          p: 'La voix a-t-elle besoin d’Internet ?',
          r: 'Une seule fois : le modèle de la voix naturelle (environ 124 Mo) se télécharge tout seul depuis GitHub en arrière-plan, jamais pendant la sélection des champions, le chargement ou la partie. Ensuite, il fonctionne hors ligne, sur ton PC. En attendant, c’est la voix de Windows.',
        },
        {
          p: 'Et si je n’ai plus de connexion ?',
          r: 'L’appli utilise les derniers builds enregistrés et te le signale. Le coach en partie fonctionne de la même façon, car il n’a besoin que du client et de la partie sur ton PC.',
        },
        {
          p: 'Ça marche sur Mac ou Linux ?',
          r: 'Pour l’instant uniquement sur Windows 10 et 11, où se joue la grande majorité des parties de LoL. Mac et Linux ne sont pas pris en charge dans cette version.',
        },
        {
          p: 'Besoin d’aide ?',
          r: `Écris-nous à ${CORREO}. Si le problème concerne l’overlay, indique ta version de Windows et si le jeu est en mode « Sans bordure ».`,
          correo: true,
        },
        {
          p: 'Coach LoL IA est-il un produit officiel de Riot ?',
          r: 'Non. C’est un projet indépendant qui n’est pas approuvé par Riot Games.',
        },
      ],
    },

    cta: {
      titulo: 'Ta prochaine partie, avec un coach',
      texto: 'Télécharge Coach LoL IA gratuitement et teste les builds lors de ta prochaine sélection des champions.',
    },
  },

  descargar: {
    antetitulo: 'Télécharger',
    h1: 'Télécharge Coach LoL IA gratuitement pour Windows',
    intro:
      'Gratuit, en 5 langues et avec mises à jour automatiques. L’installateur est publié sur GitHub Releases avec les notes de chaque version.',
    ultima: 'Dernière version :',
    archivo: 'Télécharge le fichier',
    archivoFin: 'et lance-le.',
    queTrae: 'Nouveautés de la',
    requisitosTitulo: 'Configuration requise',
    requisitos: [
      ['Système', 'Windows 10 ou 11 64 bits.'],
      ['Jeu', 'League of Legends installé (client Riot).'],
      ['Overlay', 'Le jeu en mode « Sans bordure » (Options → Vidéo → Mode fenêtre).'],
      ['Connexion', 'Internet pour télécharger les builds ; hors ligne, l’appli utilise les derniers enregistrés.'],
    ],
    instalacionTitulo: 'Installation',
    instalacion: [
      'Ouvre la [dernière release](https://github.com/pepeipto/coach-lol-ia/releases/latest) et télécharge l’installateur `.exe`.',
      'Lance-le. Si Windows SmartScreen affiche un avertissement, clique sur « Informations complémentaires » puis « Exécuter quand même ».',
      'Ouvre Coach LoL IA puis le client League of Legends. L’appli le détecte toute seule et, la première fois, un accueil en quatre étapes t’explique l’essentiel.',
      'En sélection des champions, tu verras ton build. Clique sur « Importer » pour l’appliquer.',
      'Pour le coach en partie, mets le jeu en mode **Sans bordure**.',
    ],
    extras: [
      {
        titulo: 'Mises à jour automatiques',
        texto: 'L’appli vérifie s’il existe une nouvelle version au démarrage, la télécharge en arrière-plan et l’installe à la fermeture.',
      },
      {
        titulo: 'API officielles de Riot uniquement',
        texto: 'Elle ne touche pas au processus du jeu : ni lecture de sa mémoire ni injection de code. [Plus de détails](@inicio#seguridad).',
      },
      {
        titulo: 'Désinstaller',
        texto: 'Depuis Paramètres Windows → Applications → Coach LoL IA. Tes runes et sets d’objets du client restent intacts.',
      },
      {
        titulo: 'Code sur GitHub',
        texto:
          'Le code, l’historique des changements et les notes de chaque version sont sur [GitHub](https://github.com/pepeipto/coach-lol-ia).',
      },
    ],
    ayuda:
      'L’appli ne détecte pas le client ou l’overlay n’apparaît pas ? Écris-nous avec ta version de Windows et une description du problème.',
  },

  apoyar: {
    antetitulo: 'Soutenir le projet',
    h1: 'Coach LoL IA est gratuit pour tout le monde',
    intro:
      'Toutes les fonctions, y compris le coach en partie, sont disponibles pour tous, et l’appli n’a pas de publicité. Le projet est financé par la publicité sur le site et par des dons volontaires.',
    porQue: 'Pourquoi le soutenir ?',
    porQueTexto:
      'Faire tourner Coach LoL IA coûte de l’argent chaque mois. S’il t’est utile, un don l’aide à rester gratuit et à s’améliorer. Donner est volontaire et ne donne aucun avantage dans l’appli : tout le monde a la même chose.',
    quePagan: 'Ce que financent les dons',
    destinos: [
      ['Le serveur', 'L’hébergement du serveur qui télécharge les parties, calcule les builds toutes les 6 heures et les envoie à l’appli.'],
      ['Les données', 'Le stockage et le traitement de milliers de parties Émeraude+ en EUW, LAN et LAS, et l’assistant IA de support.'],
      ['Le développement', 'Le temps de corriger les bugs, de suivre chaque patch de League of Legends et d’ajouter de nouvelles fonctions.'],
    ],
    cafe: 'Tu veux nous offrir un café ? Chaque montant compte.',
    donar: 'Faire un don',
    pronto: 'Bientôt, tu pourras soutenir le projet par un don.',
    mientras: 'En attendant, si tu veux aider, écris-nous à',
    otraForma: 'Tu peux aussi le soutenir en parlant de lui à tes amis, ou en [téléchargeant l’appli](@descargar) et en l’utilisant.',
  },

  novedades: {
    antetitulo: 'Nouveautés',
    h1: 'Quoi de neuf dans Coach LoL IA',
    intro:
      'Toutes les versions de l’appli, de la plus récente à la plus ancienne. L’appli les affiche aussi dans sa vue « Nouveautés » et te résume chaque nouvelle version à la première ouverture.',
    notaIdioma:
      'Les notes de version sont rédigées en espagnol. Les versions 3.x sont traduites ci-dessous ; les plus anciennes restent dans leur version espagnole d’origine.',
    version: 'Version',
    ultima: 'Dernière version',
    proxima: {
      titulo: 'Nouveau dans la 3.1',
      texto:
        'Une voix naturelle neuronale et hors ligne dans les 5 langues, téléchargée toute seule en arrière-plan (jamais pendant la sélection des champions, le chargement ou la partie) ; un écran de chargement plein écran avec ta carte mise en valeur, qu’Espace masque (ou cartes seules, ou désactivé) ; et 460 phrases vocales par langue avec variantes, niveau de détail et catégories.',
    },
    cierre: 'Les mises à jour s’installent toutes seules à la fermeture de l’appli. Si tu ne l’as pas encore, télécharge-la gratuitement.',
    notasGithub: 'Notes sur GitHub',
    meses: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
    formatoFecha: '{d} {m} {a}',
  },

  legal: {
    antetitulo: 'Mentions légales',
    plantilla:
      '**Modèle en attente de relecture.** Ce texte est un modèle raisonnable rédigé pour le projet et doit être relu par le responsable (idéalement avec un conseil juridique) avant le lancement public. Les champs entre crochets, comme *[nom ou raison sociale]*, doivent être complétés. Il ne constitue pas un conseil juridique.',
    actualizado: 'Dernière mise à jour : 20 octobre 2026.',
    traduccion: 'Ceci est une traduction de l’original espagnol. En cas de divergence, la version espagnole fait foi.',
    privacidad: {
      h1: 'Politique de confidentialité',
      secciones: [
        {
          h: '1. Responsable du traitement',
          p: [
            `Responsable : *[nom ou raison sociale]*, NIF *[NIF]*, domicilié à *[adresse]*. Contact pour toute question de confidentialité : [${CORREO}](mailto:${CORREO}).`,
          ],
        },
        { h: '2. Quelles données nous traitons et pourquoi', tabla: true },
        {
          h: '3. Données que nous ne collectons pas',
          p: [
            'L’appli lit les données du client et de la partie **sur ton propre PC** (LCU API et Live Client Data API) pour t’afficher le build et les alertes. Ces informations ne sont pas envoyées à notre serveur, à l’exception des données de l’écran de chargement et du coach IA décrites à la section précédente : nous ne collectons pas tes identifiants et ne conservons pas d’historique de tes parties. Coach LoL IA n’a pas non plus de comptes utilisateur ni de mots de passe.',
          ],
        },
        {
          h: '4. Données enregistrées sur ton PC',
          p: [
            'L’appli enregistre dans ton dossier utilisateur les réglages, le cache des builds et de Data Dragon, le modèle de la voix naturelle avec son cache de phrases, l’historique de tes analyses par IA (les 50 dernières) et un journal local des erreurs. Ils sont supprimés lorsque tu désinstalles l’appli et effaces son dossier de données.',
          ],
        },
        {
          h: '5. Sous-traitants et destinataires',
          lista: [
            '**Anthropic**, notre fournisseur d’IA (génère les réponses de l’assistant IA à partir des messages du chat, ainsi que les analyses et conseils du coach IA à partir des données de partie, sans ton Riot ID). Peut traiter des données hors de l’EEE avec les garanties appropriées.',
            '**Google** (AdSense sur ce site, uniquement avec ton consentement).',
            '**GitHub** (hébergement de ce site, des téléchargements de l’appli et du modèle de la voix naturelle, environ 124 Mo, que l’appli télécharge toute seule ; comme pour tout téléchargement, GitHub reçoit ton adresse IP).',
            '*[Hébergeur du serveur]* (serveur de builds et de l’assistant IA).',
          ],
          p: [
            'Si tu fais un don, il est géré par la plateforme de dons sur son propre site : nous ne voyons ni ne conservons tes données de paiement.',
            'Nous ne vendons pas tes données et ne les cédons pas à des tiers, sauf obligation légale.',
          ],
        },
        {
          h: '6. Conservation',
          p: ['Les journaux techniques du serveur sont conservés au maximum *[indiquer la durée]*. Les messages de l’assistant et les données de partie reçues par le coach IA ne sont pas conservés.'],
        },
        {
          h: '7. Tes droits',
          p: [
            `Tu peux exercer tes droits d’accès, de rectification, d’effacement, d’opposition, de limitation et de portabilité en écrivant à [${CORREO}](mailto:${CORREO}). Si tu estimes que nous n’avons pas correctement traité ta demande, tu peux introduire une réclamation auprès de l’Agence espagnole de protection des données (aepd.es) ou de l’autorité de contrôle de ton pays.`,
          ],
        },
        { h: '8. Cookies', p: ['Consulte la [politique de cookies](@cookies).'] },
      ],
      tabla: {
        cabecera: ['Origine', 'Données', 'Finalité', 'Base juridique'],
        filas: [
          [
            'Appli de bureau',
            'Champion et rôle consultés et adresse IP de la requête.',
            'Fournir les builds.',
            'Exécution du service que tu demandes (art. 6.1.b RGPD).',
          ],
          [
            'Écran de chargement (appli)',
            'Pour les dix joueurs de ta partie : leur identifiant Riot (PUUID), leur champion, leur rôle et leur équipe, ainsi que la région de ton client. Le Riot ID (nom#tag) n’est pas envoyé.',
            'Demander à l’API officielle de Riot le rang en Solo/Duo et la maîtrise de chaque joueur pour l’écran de chargement. Le serveur conserve la réponse uniquement en mémoire, 10 minutes au maximum, et ne l’écrit ni dans sa base de données ni dans ses journaux.',
            'Exécution du service que tu demandes (art. 6.1.b RGPD) et intérêt légitime à l’égard des autres joueurs, avec des données que Riot rend déjà publiques (art. 6.1.f RGPD).',
          ],
          [
            'Assistant IA (site et appli)',
            'Les messages que tu écris dans le chat de l’assistant et l’adresse IP de la requête.',
            'Générer la réponse : les messages sont envoyés à notre serveur et à Anthropic, qui traite le texte avec son modèle d’IA. Notre serveur ne les conserve pas au-delà de ce traitement. N’écris pas de données personnelles dans le chat.',
            'Exécution du service que tu demandes (art. 6.1.b RGPD).',
          ],
          [
            'Coach IA (appli)',
            'Données de la partie en cours ou tout juste terminée, sans ton nom d’invocateur ni ton Riot ID : ton champion, ton rôle et le mode ; statistiques (KDA, CS, or, niveau, dégâts, vision), objets et achats avec leur minute, morts avec leur minute et objectifs issus des événements officiels ; pour les conseils, aussi les champions, niveaux, objets et kills du tableau des scores (TAB). Et l’adresse IP de la requête.',
            'Générer l’analyse de fin de partie et les conseils des temps morts (que tu peux activer ou désactiver dans Paramètres) : les données sont envoyées à notre serveur et à Anthropic, qui les traite avec son modèle d’IA. Notre serveur ne les conserve pas et ne les écrit pas dans ses journaux : il compte seulement les requêtes pour ses limites quotidiennes. Tes analyses sont enregistrées uniquement sur ton PC.',
            'Exécution du service que tu demandes (art. 6.1.b RGPD).',
          ],
          [
            'Support',
            `Ton adresse e-mail et ce que tu nous dis en écrivant à ${CORREO}.`,
            'Répondre à ta demande.',
            'Intérêt légitime à te répondre (art. 6.1.f RGPD).',
          ],
          [
            'Ce site',
            'Ton choix en matière de cookies (dans ton navigateur) et, uniquement si tu les acceptes, les cookies publicitaires de Google AdSense.',
            'Mémoriser ton choix et afficher des publicités.',
            'Consentement (art. 6.1.a RGPD).',
          ],
        ],
      },
    },
    terminos: {
      h1: 'Conditions d’utilisation',
      secciones: [
        {
          h: '1. Qui sommes-nous',
          p: [
            `Coach LoL IA est un service de *[nom ou raison sociale]*, NIF *[NIF]*, domicilié à *[adresse]*. Contact : [${CORREO}](mailto:${CORREO}).`,
          ],
        },
        {
          h: '2. Le service',
          p: [
            'Coach LoL IA est une application de bureau gratuite pour Windows qui suggère des builds en sélection des champions et affiche des alertes pendant la partie. Les recommandations sont indicatives et reposent sur des statistiques de parties ; elles ne garantissent aucun résultat.',
          ],
        },
        {
          h: '3. Utilisation de l’appli',
          lista: [
            'Nous t’accordons une licence personnelle, non exclusive et incessible pour utiliser l’appli.',
            'Tu ne peux pas l’utiliser pour enfreindre les règles de Riot Games ni la modifier pour accéder au jeu par d’autres moyens.',
            'L’appli n’utilise que les API officielles de Riot. Néanmoins, l’utilisation d’outils tiers est soumise aux politiques de Riot, qui peuvent évoluer.',
          ],
        },
        {
          h: '4. Prix et dons',
          lista: [
            'Coach LoL IA est gratuit : toutes ses fonctions sont accessibles à tous et l’appli n’a pas de publicité.',
            'Le projet est financé par la publicité sur ce site et par des dons volontaires via [Soutenir le projet](@apoyar).',
            'Faire un don est volontaire et ne donne accès à aucune fonction ni aucun avantage dans l’appli.',
          ],
        },
        {
          h: '5. Disponibilité',
          p: [
            'Nous faisons en sorte que le service soit toujours disponible, mais des interruptions peuvent survenir pour maintenance, changement de patch ou modification des API de Riot. Si le serveur ne répond pas, l’appli utilise les dernières données enregistrées.',
          ],
        },
        {
          h: '6. Responsabilité',
          p: [
            'L’appli est fournie « en l’état ». Dans la mesure permise par la loi, nous ne sommes pas responsables des dommages indirects liés à son utilisation. Rien de ce qui précède ne limite les droits que te reconnaît le droit de la consommation.',
          ],
        },
        {
          h: '7. Propriété intellectuelle et Riot Games',
          riot: true,
          p: [
            'League of Legends et ses images sont des marques et contenus de Riot Games, Inc., utilisés conformément à sa politique relative aux projets tiers.',
          ],
        },
        {
          h: '8. Modifications et droit applicable',
          p: [
            'Nous pouvons mettre à jour ces conditions ; nous annoncerons les changements importants sur ce site. Elles sont régies par le droit *[espagnol]* et, pour les consommateurs, les tribunaux de leur domicile sont compétents.',
          ],
        },
      ],
    },
    cookies: {
      h1: 'Politique de cookies',
      queUsamos: 'Ce que nous utilisons',
      queUsamosTexto:
        'Ce site n’utilise pas ses propres cookies d’analyse ou de suivi. Il enregistre seulement ton choix concernant la publicité et, si tu l’acceptes, charge les publicités Google AdSense, qui utilisent des cookies tiers.',
      tabla: {
        cabecera: ['Nom', 'Type', 'Finalité', 'Durée'],
        filas: [
          ['`coach-cookies` (stockage local)', 'Interne, technique', 'Mémoriser si tu as accepté ou refusé la publicité.', 'Jusqu’à ce que tu le supprimes'],
          [
            'Cookies Google AdSense',
            'Tiers, publicité',
            'Afficher et mesurer les publicités. Chargés uniquement si tu acceptes. Plus d’informations dans la politique de Google.',
            'Selon Google',
          ],
        ],
      },
      sinAnunciosApp: 'L’appli de bureau n’affiche jamais de publicité : les publicités n’apparaissent que sur ce site.',
      cambiar: 'Modifier ton choix',
      conAnuncios: 'Clique sur le bouton pour effacer ton choix ; le bandeau cookies réapparaîtra.',
      sinAnuncios:
        'Ce site n’affiche pas de publicité pour le moment, il n’y a donc rien à accepter. Si nous l’activons, un bandeau te demandera de choisir.',
      boton: 'Réinitialiser mon choix de cookies',
      borradaBanner:
        ' Choix effacé. Choisis à nouveau dans le bandeau ; si des publicités étaient déjà chargées, elles ne se chargeront plus au rechargement de la page.',
      borrada: ' Choix effacé. Le changement s’applique au rechargement de la page.',
      navegador: 'Tu peux aussi supprimer les données de ce site depuis les réglages de ton navigateur.',
      contacto: 'Contact',
      contactoTexto: 'Pour toute question :',
    },
  },

  builds: {
    antetitulo: 'Builds et tier list',
    h1: 'Builds LoL et tier list basées sur des parties Émeraude+',
    intro:
      'Coach LoL IA calcule ses builds League of Legends et sa tier list à partir de vraies parties de joueurs **Émeraude ou plus** en EUW, LAN et LAS. Ce ne sont ni des opinions ni des listes faites à la main : chaque build indique combien de parties le soutiennent et son taux de victoire, et il est recalculé **toutes les 6 heures**.',
    capturaAlt:
      'Capture de la vue Champion de Coach LoL IA avec le build d’Ahri au Mid : runes Domination et Sorcellerie, Saut éclair et Embrasement, objets de départ, objets principaux et bottes, et l’ordre des compétences, avec le taux de victoire, 33 parties et le patch 16.20.',
    capturaPie: 'Build par champion et par rôle, avec son nombre de parties.',
    queIncluye: {
      titulo: 'Ce que contient chaque build',
      lista: [
        '**Runes** : la page la plus jouée et, depuis la 3.0.1, plusieurs pages au choix, chacune avec son taux de victoire et ses parties.',
        '**Sorts d’invocateur**, comme Saut éclair et Embrasement ou Saut éclair et Châtiment.',
        '**Objets** : de départ, trio principal, bottes et objets situationnels.',
        '**Ordre des compétences**, avec la priorité de montée (par exemple Q > W > E).',
        'En **Arena**, les augments et objets les plus choisis, avec leur seul taux de sélection.',
      ],
    },
    origen: {
      titulo: 'D’où viennent les données',
      texto:
        'Notre serveur utilise l’API officielle de Riot : League-v4 pour trouver des joueurs Émeraude+ et Match-v5 pour télécharger leurs parties classées Solo/Duo, ainsi que leurs parties d’ARAM, d’ARAM : Chaos et d’Arena. À partir de là, il calcule pour chaque champion et chaque rôle ce qui se joue le plus et avec quels résultats.',
      puntos: [
        '**Le patch actuel d’abord :** avec 200 parties ou plus sur le patch, seules ses données sont utilisées ; en dessous, elles sont combinées avec le patch précédent et le build l’indique.',
        `**Au moins ${MIN_PARTIDAS_BUILD} parties** pour publier un build ; de ${MIN_PARTIDAS_BUILD} à ${PARTIDAS_DATOS_LIMITADOS - 1}, il porte le badge « Données limitées ».`,
        '**Rien d’inventé :** s’il n’y a pas assez de parties, l’appli affiche « Build indisponible ».',
      ],
    },
    tierList: {
      titulo: 'Comment la tier list est calculée',
      texto:
        'Dans la section Champions de l’appli, chaque champion reçoit un tier par rôle et par mode qui combine son **taux de victoire** et son **taux de sélection** à ce rôle. Ainsi, un champion avec beaucoup de victoires mais très peu de parties ne grimpe pas au sommet par hasard.',
      tiers: [
        ['S', 'Performe au-dessus de la normale à son rôle et est assez joué pour que la donnée soit fiable.'],
        ['A', 'Un choix solide sur le patch actuel.'],
        ['B', 'Jouable et équilibré. Les champions avec moins de 30 parties restent aussi ici.'],
        ['C', 'Sous la moyenne sur ce patch : il peut fonctionner, mais c’est plus difficile aujourd’hui.'],
      ],
      alt: 'Capture de la section Champions de Coach LoL IA : tier list de Classée avec le sélecteur de mode, la recherche, les filtres par rôle et le tableau des champions avec tier, victoires, sélection et parties.',
      pie: 'La tier list complète se consulte dans l’appli, avec les données du patch actuel.',
    },
    modos: {
      titulo: 'Classée, ARAM, ARAM : Chaos et Arena',
      texto:
        'Chaque mode a ses propres builds et sa tier list. En ARAM et ARAM : Chaos, les builds sont par champion (sans rôle), avec les augments les plus choisis en ARAM : Chaos ; en Arena s’ajoutent la place moyenne, le top 4 et la première place du champion. Les augments et les objets d’Arena n’affichent que leur taux de sélection, sans taux de victoire, comme l’exige la politique de Riot. Les modes avec peu de parties collectées affichent « Pas encore de données » jusqu’à obtenir un échantillon suffisant.',
    },
    importar: {
      titulo: 'Du build au client en un clic',
      texto:
        'En sélection des champions, l’appli détecte ton champion et ton rôle et affiche le build en moins de 2 secondes. « Importer » crée la page de runes, choisit les sorts d’invocateur et ajoute le set d’objets. [Pas à pas dans le guide des runes](@guiaRunas).',
    },
    honestidad: {
      titulo: 'Ce que la tier list n’est pas',
      texto:
        'Une tier list résume des statistiques ; elle ne te dit pas quel champion jouer. Ta maîtrise du champion, ton équipe et l’adversaire comptent beaucoup. C’est pourquoi Coach LoL IA affiche toujours le nombre de parties et ne promet aucun résultat. [Comment lire une tier list](@guiaTierList).',
    },
    faq: [
      {
        p: 'À quelle fréquence les builds sont-ils mis à jour ?',
        r: 'Toutes les 6 heures. Quand un nouveau patch sort, le serveur et Data Dragon se mettent à jour tout seuls et l’appli indique le patch des données.',
      },
      {
        p: 'Puis-je voir la tier list sur le site ?',
        r: 'La tier list complète, avec recherche, filtres et le build de chaque champion, se trouve dans la section Champions de l’appli, qui est gratuite. Cette page explique comment elle est calculée.',
      },
      {
        p: 'Pourquoi un build affiche-t-il « Données limitées » ?',
        r: `Parce qu’il repose sur moins de ${PARTIDAS_DATOS_LIMITADOS} parties. Il reste utile comme repère, mais l’échantillon est petit et le taux de victoire peut beaucoup varier avec quelques parties de plus.`,
      },
      {
        p: 'Les builds fonctionnent-ils sur d’autres serveurs ?',
        r: 'Oui : ils dépendent du champion, du rôle et du patch, pas du serveur sur lequel tu joues.',
      },
    ],
    cta: 'Télécharge l’appli et regarde le build de ton champion lors de ta prochaine sélection.',
  },

  guias: {
    antetitulo: 'Guides',
    h1: 'Guides League of Legends',
    intro:
      'Des guides courts et pratiques sur les overlays, les tier lists et les runes, écrits par l’équipe de Coach LoL IA. Nous expliquons comment les choses fonctionnent, sans promesse de te faire monter en elo.',
    otras: 'Autres guides',
    articulos: {
      guiaOverlay: {
        resumen: 'Ce que Riot autorise à un overlay, les signaux d’alerte à surveiller et comment bien le configurer.',
        h1: 'Comment utiliser un overlay sur LoL en toute sécurité',
        entradilla:
          'Un overlay League of Legends est une fenêtre dessinée au-dessus du jeu pour t’afficher des informations : ton build, les timers des objectifs ou ton CS. Bien conçu, il respecte les règles de Riot. Mal conçu, il peut mettre ton compte en danger. Ce guide t’aide à faire la différence.',
        secciones: [
          {
            h: 'Ce qu’est un overlay, et ce qu’il n’est pas',
            p: [
              'Un overlay légitime est une fenêtre Windows normale, transparente et aux clics traversants, placée au-dessus du jeu. Il ne fait pas partie du jeu et ne le modifie pas : il se contente d’afficher des informations sur ton écran.',
              'Pour qu’il apparaisse, LoL doit être en mode **Sans bordure** (Options → Vidéo → Mode fenêtre). En plein écran exclusif, Windows affiche le jeu au-dessus de toutes les autres fenêtres.',
            ],
          },
          {
            h: 'Ce que Riot autorise aux applis tierces',
            p: [
              'Riot publie des interfaces officielles pour les outils tiers : la **LCU API** du client (sélection des champions, runes, objets), la **Live Client Data API** de la partie (sur `127.0.0.1:2999`, en lecture seule) et des services publics comme Data Dragon. Une appli qui n’utilise que ces voies travaille avec des données que Riot choisit de partager.',
              'Les règles de Riot limitent aussi ce qui peut être affiché. En général, un overlay ne doit pas te donner d’informations que tu n’aurais pas en jouant sans lui : pas de timers de sorts ou d’ultimes adverses, pas de positions d’ennemis que tu ne vois pas, et pas de décisions qui jouent à ta place.',
            ],
          },
          {
            h: 'Les signaux d’alerte',
            lista: [
              'Il lit la **mémoire du jeu** ou injecte du code ou une DLL dans le processus.',
              'Il affiche les **temps de recharge adverses**, des positions hors de ta vision ou les timers de la jungle adverse.',
              'Il **simule le clavier ou la souris**, ou automatise des actions comme esquiver ou lancer des compétences.',
              'Il analyse des **captures d’écran** ou la minimap pour en tirer des informations.',
              'Il te demande ton **mot de passe Riot** ou se dit « indétectable ».',
            ],
          },
          {
            h: 'Checklist avant d’installer un overlay',
            lista: [
              'Il indique clairement quelles API il utilise et ce qu’il ne fait pas au jeu.',
              'Il ne demande pas d’identifiants : le client est déjà ouvert sur ton PC.',
              'Sa politique de confidentialité explique quelles données il envoie à ses serveurs.',
              'Il inclut la mention légale de Riot et ne se présente pas comme un produit officiel.',
              'Tu peux le masquer ou désactiver chaque élément à tout moment.',
            ],
          },
          {
            h: 'Comment fait Coach LoL IA',
            p: [
              'Coach LoL IA n’utilise que la LCU API, la Live Client Data API et Data Dragon. Il ne lit ni n’écrit la mémoire du jeu, n’injecte pas de code, ne fait pas de captures pour les analyser et ne simule ni touches ni clics. Les timers de jungle ne concernent que ton côté et c’est toi qui les lances ; pour le jungler adverse, il répète seulement ce qui apparaît déjà dans le fil des éliminations.',
              'Malgré tout, le dernier mot sur les outils tiers revient toujours à Riot. C’est pourquoi nous vérifions chaque alerte au regard de sa politique en vigueur, et nous te conseillons de faire de même avec toute appli que tu installes. [Voir la section sécurité](@inicio#seguridad).',
            ],
          },
          {
            h: 'Le configurer pour qu’il ne gêne pas',
            lista: [
              'Mets le jeu en mode **Sans bordure**.',
              'Dans la vue Overlay de l’appli, utilise **« Déplacer et calibrer »** pour placer chaque widget là où il ne couvre pas l’interface du jeu.',
              'Baisse l’opacité ou désactive les widgets que tu n’utilises pas.',
              'En partie, **Ctrl+Maj+O** masque ou affiche l’overlay.',
            ],
          },
        ],
      },
      guiaTierList: {
        resumen: 'Ce que signifie chaque tier, comment il est calculé et pourquoi le nombre de parties compte.',
        h1: 'Qu’est-ce qu’une tier list sur LoL et comment la lire',
        entradilla:
          'Une tier list classe les champions de League of Legends selon leurs performances sur le patch actuel, généralement avec des lettres : S, A, B, C. C’est un outil utile pour choisir ou découvrir des champions, à condition de savoir d’où viennent les données et ce qu’elle ne dit pas.',
        secciones: [
          {
            h: 'Ce que signifie chaque tier',
            p: [
              'Il n’existe pas de standard officiel, mais presque toutes suivent la même idée : **S** regroupe les champions qui se démarquent le plus à leur rôle, **A** des choix très solides, **B** des champions équilibrés et **C** ceux qui ont plus de mal en ce moment. Certaines ajoutent S+ ou D.',
              'L’essentiel : le tier est **par rôle**. Un champion peut être S en jungle et B en top.',
            ],
          },
          {
            h: 'Comment elle est calculée',
            p: [
              'Les tier lists basées sur les données combinent surtout deux chiffres : le **taux de victoire** (combien de parties le champion gagne à ce rôle) et le **taux de sélection** ou *pick rate* (à quelle fréquence il est choisi). Certaines ajoutent le taux de ban ou les performances à haut elo.',
              'D’autres tier lists sont **d’opinion** : un joueur ou une équipe les établit selon son expérience. Elles ne sont pas mauvaises, mais mieux vaut savoir laquelle tu lis.',
            ],
          },
          {
            h: 'Pourquoi le nombre de parties compte',
            p: [
              'Un taux de victoire de 60 % sur 20 parties ne dit pas grand-chose : quelques défaites de plus et il peut retomber à 50 %. Un taux de 52 % sur des milliers de parties est bien plus fiable. C’est pourquoi une bonne tier list affiche l’échantillon, ou au moins empêche un champion avec peu de données d’atteindre le sommet.',
              '**Quelles parties** compte aussi : un champion ne performe pas pareil en Fer et en Émeraude+, et un nouveau patch peut tout changer du jour au lendemain.',
            ],
          },
          {
            h: 'L’utiliser sans se faire piéger',
            lista: [
              'Regarde-la pour **ton rôle** et sur le **patch actuel**.',
              'Un champion tier B que tu maîtrises performe souvent mieux qu’un tier S que tu ne connais pas.',
              'Utilise-la pour découvrir des champions et savoir ce qui est fort contre toi.',
              'Méfie-toi des chiffres sans nombre de parties.',
            ],
          },
          {
            h: 'La tier list de Coach LoL IA',
            p: [
              'Dans la section Champions de l’appli, chaque champion reçoit un tier S, A, B ou C par rôle et par mode (Classée, ARAM, ARAM : Chaos et Arena) qui combine victoires et sélection, à partir de parties de joueurs Émeraude+ en EUW, LAN et LAS. Ceux qui ont moins de 30 parties ne dépassent jamais le tier B et portent la mention « Données limitées ». [Plus de détails sur les données](@builds).',
            ],
          },
        ],
      },
      guiaRunas: {
        resumen: 'Runes, sorts et objets en un clic depuis la sélection des champions, sans perdre tes pages.',
        h1: 'Comment importer ses runes automatiquement sur LoL',
        entradilla:
          'Préparer ses runes à chaque sélection des champions prend du temps, surtout si tu changes de champion au dernier moment. Avec une appli qui utilise l’API officielle du client, tu peux importer runes, sorts d’invocateur et objets en un clic. Voici comment faire avec Coach LoL IA.',
        secciones: [
          {
            h: 'Comment fonctionne l’import',
            p: [
              'Le client League of Legends dispose d’une API locale, la **LCU API**, que Riot met à disposition des outils tiers. Grâce à elle, une appli peut créer des pages de runes, choisir les sorts d’invocateur et ajouter des sets d’objets à la boutique, exactement comme tu le ferais à la main.',
              'Coach LoL IA se connecte en lisant le fichier *lockfile* du client (port et mot de passe locaux). Il ne te demande jamais ton compte ni ton mot de passe Riot.',
            ],
          },
          {
            h: 'Pas à pas',
            ordenada: true,
            lista: [
              '[Télécharge Coach LoL IA](@descargar) et installe-le sur Windows 10 ou 11.',
              'Ouvre l’appli et le client LoL, dans n’importe quel ordre. L’appli détecte le client toute seule.',
              'Entre en sélection des champions. L’appli reconnaît ton champion et le rôle que le client t’attribue.',
              'Vérifie le build : runes (tu peux choisir entre plusieurs pages), sorts d’invocateur, objets et ordre des compétences.',
              'Clique sur **« Importer »**. Si tu préfères ne rien toucher, active l’import automatique dans les Réglages.',
            ],
          },
          {
            h: 'Tes pages de runes sont en sécurité',
            p: [
              'L’appli crée ses propres pages avec le préfixe **« Coach: »**, par exemple « Coach: Ahri Mid », et remplace la sienne si elle existe déjà. S’il ne te reste aucune page libre, elle ne remplace l’une des tiennes que si tu cliques sur « Importer » et que tu confirmes (jamais une prédéfinie) ; l’import automatique ne supprime jamais rien.',
            ],
          },
          {
            h: 'Si quelque chose ne marche pas',
            lista: [
              '**« En attente du client League of Legends… »** : ouvre le client ; l’appli réessaie toutes les 3 secondes.',
              '**« Build indisponible »** : il y a moins de 10 parties pour ce champion à ce rôle. Essaie un autre rôle ou attends la prochaine mise à jour.',
              '**La page n’est pas créée** : vérifie que tu as une page libre ou une page « Coach: » qui peut être remplacée.',
              'Si ça ne marche toujours pas, demande à l’assistant IA ou écris-nous à support@coachlolia.com.',
            ],
          },
          {
            h: 'Le faire à la main, ça marche aussi',
            p: [
              'Si tu préfères ne rien installer, tu peux recopier le build à la main dans le client : crée une page de runes, choisis tes sorts d’invocateur et achète en suivant l’ordre des objets. L’import te fait juste gagner ce temps en sélection des champions.',
            ],
          },
        ],
      },
    },
  },

  noEncontrada: {
    h1: 'Page introuvable',
    texto: 'La page que tu cherches n’existe pas ou a changé d’adresse.',
    volver: 'Aller à l’accueil',
    otros: 'Autres langues',
  },
};
