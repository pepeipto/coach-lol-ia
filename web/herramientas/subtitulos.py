# Genera los subtítulos WebVTT de los clips de la web (public/video/subs/<clip>.<idioma>.vtt).
# Los vídeos llevan los textos incrustados en español; estos subtítulos los traducen (y sirven de
# transcripción accesible en español). Uso: python herramientas/subtitulos.py (desde web/).
from pathlib import Path

SALIDA = Path(__file__).resolve().parent.parent / 'public' / 'video' / 'subs'

# (inicio, fin, {idioma: texto})
PARTIDA = [
    (0.0, 3.0, {
        'es': 'Así se ve Coach LoL IA en una partida\nGrabación real · Zed jungla',
        'en': 'This is Coach LoL IA in a real game\nReal recording · Zed jungle',
        'pt-br': 'Assim é o Coach LoL IA em uma partida\nGravação real · Zed jungle',
        'fr': 'Voici Coach LoL IA en pleine partie\nEnregistrement réel · Zed jungle',
        'de': 'So sieht Coach LoL IA im Spiel aus\nEchte Aufnahme · Zed Jungle',
    }),
    (3.0, 5.0, {
        'es': 'Cuenta atrás de objetivos\nDragón, larvas, heraldo y barón',
        'en': 'Objective timers\nDragon, Voidgrubs, Herald and Baron',
        'pt-br': 'Contagem regressiva dos objetivos\nDragão, Vastilarvas, Arauto e Barão',
        'fr': 'Compte à rebours des objectifs\nDragon, Larves du Néant, Héraut et Baron',
        'de': 'Countdown der Objectives\nDrache, Voidgrubs, Herold und Baron',
    }),
    (5.0, 7.0, {
        'es': 'Dragón en 0:38\nEn dorado cuando falta menos de 1 min',
        'en': 'Dragon at 0:38\nGold when less than 1 min is left',
        'pt-br': 'Dragão em 0:38\nDourado quando falta menos de 1 min',
        'fr': 'Dragon à 0:38\nEn doré quand il reste moins d’1 min',
        'de': 'Drache bei 0:38\nGold, wenn weniger als 1 Min. übrig ist',
    }),
    (7.0, 12.0, {
        'es': 'Tu CS y KDA en tiempo real\nCS por minuto frente a tu objetivo',
        'en': 'Your CS and KDA in real time\nCS per minute against your target',
        'pt-br': 'Seu CS e KDA em tempo real\nCS por minuto comparado à sua meta',
        'fr': 'Ton CS et ton KDA en temps réel\nCS par minute face à ton objectif',
        'de': 'Dein CS und KDA in Echtzeit\nCS pro Minute im Vergleich zu deinem Ziel',
    }),
    (12.0, 16.0, {
        'es': 'Te marca qué habilidad subir\nLa flecha dorada, al subir de nivel',
        'en': 'It shows which ability to level\nThe golden arrow, on level-up',
        'pt-br': 'Mostra qual habilidade upar\nA seta dourada, ao subir de nível',
        'fr': 'Il t’indique quelle compétence monter\nLa flèche dorée, au passage de niveau',
        'de': 'Zeigt dir, welche Fähigkeit du skillen solltest\nDer goldene Pfeil beim Level-up',
    }),
    (16.0, 19.2, {
        'es': 'Coach LoL IA · Gratis\nwww.coachlolia.com',
        'en': 'Coach LoL IA · Free\nwww.coachlolia.com',
        'pt-br': 'Coach LoL IA · Grátis\nwww.coachlolia.com',
        'fr': 'Coach LoL IA · Gratuit\nwww.coachlolia.com',
        'de': 'Coach LoL IA · Kostenlos\nwww.coachlolia.com',
    }),
]

TOUR = [
    (0, 3.2, {
        'es': "¿Juegas LoL? Mira esto\nCoach LoL IA 3.16 · tu coach en la Grieta",
        'en': "Play LoL? Check this out\nCoach LoL IA 3.16 · your coach on the Rift",
        'pt-br': "Joga LoL? Olha só isso\nCoach LoL IA 3.16 · seu coach no Rift",
        'fr': "Tu joues à LoL ? Regarde ça\nCoach LoL IA 3.16 · ton coach sur la Faille",
        'de': "Du spielst LoL? Schau dir das an\nCoach LoL IA 3.16 · dein Coach auf der Kluft",
    }),
    (3.2, 6.2, {
        'es': "Sabes a quién te enfrentas\nRango, maestría y % de victorias (jugadores de ejemplo)",
        'en': "Know who you are up against\nRank, mastery and win rate (sample players)",
        'pt-br': "Saiba contra quem você joga\nElo, maestria e % de vitórias (jogadores de exemplo)",
        'fr': "Sache contre qui tu joues\nRang, maîtrise et % de victoires (joueurs fictifs)",
        'de': "Wisse, gegen wen du spielst\nRang, Meisterschaft und Siegquote (Beispielspieler)",
    }),
    (6.2, 9.2, {
        'es': "Build Esmeralda+ para tu campeón\nRunas, hechizos, objetos y habilidades · Importar en un clic",
        'en': "Emerald+ build for your champion\nRunes, spells, items and skills · one-click import",
        'pt-br': "Build Esmeralda+ para o seu campeão\nRunas, feitiços, itens e habilidades · importar em um clique",
        'fr': "Build Émeraude+ pour ton champion\nRunes, sorts, objets et compétences · import en un clic",
        'de': "Smaragd+-Build für deinen Champion\nRunen, Zauber, Items und Fähigkeiten · Import per Klick",
    }),
    (9.2, 12.2, {
        'es': "En partida, todo a la vista\nObjetivos, siguiente objeto, CS y qué habilidad subir",
        'en': "In game, everything at a glance\nObjectives, next item, CS and which ability to level",
        'pt-br': "Na partida, tudo à vista\nObjetivos, próximo item, CS e qual habilidade upar",
        'fr': "En partie, tout sous les yeux\nObjectifs, prochain objet, CS et compétence à monter",
        'de': "Im Spiel alles im Blick\nObjectives, nächstes Item, CS und welche Fähigkeit du skillst",
    }),
    (12.2, 15.2, {
        'es': "Te avisa por voz\nVoz natural en 5 idiomas · sin conexión",
        'en': "It talks to you\nNatural voice in 5 languages · works offline",
        'pt-br': "Avisa você por voz\nVoz natural em 5 idiomas · sem conexão",
        'fr': "Il te prévient à la voix\nVoix naturelle en 5 langues · hors ligne",
        'de': "Hinweise per Stimme\nNatürliche Stimme in 5 Sprachen · offline",
    }),
    (15.2, 18.2, {
        'es': "Elige el estilo del overlay\nFilo, Hextech, Neón y Cristal",
        'en': "Pick your overlay style\nEdge, Hextech, Neon and Glass",
        'pt-br': "Escolha o estilo do overlay\nFilo, Hextech, Neon e Cristal",
        'fr': "Choisis le style de l’overlay\nFilo, Hextech, Néon et Cristal",
        'de': "Wähle den Overlay-Stil\nFilo, Hextech, Neon und Kristall",
    }),
    (18.2, 21.2, {
        'es': "Tiempos de jungla sobre tu minimapa\nOpcionales · marcas el campamento y te avisa al reaparecer",
        'en': "Jungle timers on your minimap\nOptional · mark the camp and it tells you when it respawns",
        'pt-br': "Timers da selva no seu minimapa\nOpcionais · marque o acampamento e ele avisa quando nascer",
        'fr': "Timers de jungle sur ta minimap\nOptionnels · marque le camp et il te prévient à la réapparition",
        'de': "Jungle-Timer auf deiner Minimap\nOptional · Camp markieren und beim Respawn Bescheid bekommen",
    }),
    (21.2, 24.2, {
        'es': "Coach con IA tras cada partida\nGratis: 3 análisis y 5 preguntas al mes",
        'en': "AI coach after every game\nFree: 3 reviews and 5 questions a month",
        'pt-br': "Coach com IA depois de cada partida\nGrátis: 3 análises e 5 perguntas por mês",
        'fr': "Coach IA après chaque partie\nGratuit : 3 analyses et 5 questions par mois",
        'de': "KI-Coach nach jedem Spiel\nGratis: 3 Analysen und 5 Fragen pro Monat",
    }),
    (24.2, 27.4, {
        'es': "Gratis · Solo API oficiales de Riot\nDescárgalo en www.coachlolia.com · Windows 10/11 · 5 idiomas",
        'en': "Free · Official Riot APIs only\nDownload it at www.coachlolia.com · Windows 10/11 · 5 languages",
        'pt-br': "Grátis · Só APIs oficiais da Riot\nBaixe em www.coachlolia.com · Windows 10/11 · 5 idiomas",
        'fr': "Gratuit · API officielles de Riot uniquement\nTélécharge-le sur www.coachlolia.com · Windows 10/11 · 5 langues",
        'de': "Kostenlos · Nur offizielle Riot-APIs\nDownload auf www.coachlolia.com · Windows 10/11 · 5 Sprachen",
    }),
]


def marca(s: float) -> str:
    m, seg = divmod(s, 60)
    return f'00:{int(m):02d}:{seg:06.3f}'


def escribir(nombre: str, cues, ajustes: str = '') -> None:
    for lang in ('es', 'en', 'pt-br', 'fr', 'de'):
        lineas = ['WEBVTT', '']
        for i, (a, b, textos) in enumerate(cues, 1):
            lineas += [str(i), f'{marca(a)} --> {marca(b)}{ajustes}', textos[lang], '']
        (SALIDA / f'{nombre}.{lang}.vtt').write_text('\n'.join(lineas), encoding='utf-8')


if __name__ == '__main__':
    SALIDA.mkdir(parents=True, exist_ok=True)
    # En el clip vertical, los subtítulos van a media altura: abajo está el HUD y arriba, los textos del vídeo.
    escribir('coach-en-partida', PARTIDA, ' line:58%')
    escribir('coach-lol-ia-3-tour', TOUR)
    print('Subtítulos escritos en', SALIDA)
