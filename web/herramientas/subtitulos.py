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
    (0.0, 3.0, {
        'es': '¿Juegas LoL? Mira esto',
        'en': 'Play LoL? Check this out',
        'pt-br': 'Joga LoL? Olha só isso',
        'fr': 'Tu joues à LoL ? Regarde ça',
        'de': 'Du spielst LoL? Schau dir das an',
    }),
    (3.0, 7.5, {
        'es': 'Sabes a quién te enfrentas\nRango, maestría y % de victorias con su campeón (datos de ejemplo)',
        'en': 'Know who you are up against\nRank, mastery and win rate on their champion (sample data)',
        'pt-br': 'Saiba contra quem você vai jogar\nElo, maestria e taxa de vitória com o campeão (dados de exemplo)',
        'fr': 'Sache contre qui tu joues\nRang, maîtrise et taux de victoire sur leur champion (données d’exemple)',
        'de': 'Wisse, gegen wen du spielst\nRang, Meisterschaft und Siegesrate mit ihrem Champion (Beispieldaten)',
    }),
    (7.5, 10.2, {
        'es': 'Build Esmeralda+ para tu campeón\nRunas, hechizos, objetos y orden de habilidades',
        'en': 'Emerald+ build for your champion\nRunes, summoner spells, items and skill order',
        'pt-br': 'Build Esmeralda+ para o seu campeão\nRunas, feitiços, itens e ordem de habilidades',
        'fr': 'Build Émeraude+ pour ton champion\nRunes, sorts, objets et ordre des compétences',
        'de': 'Smaragd+-Build für deinen Champion\nRunen, Beschwörerzauber, Items und Skill-Reihenfolge',
    }),
    (10.2, 12.5, {
        'es': 'Un clic en Importar y listo\nTe crea las runas, los hechizos y los objetos',
        'en': 'One click on Import and you are set\nIt creates your runes, summoner spells and items',
        'pt-br': 'Um clique em Importar e pronto\nCria as runas, os feitiços e os itens',
        'fr': 'Un clic sur Importer et c’est prêt\nIl crée tes runes, tes sorts et tes objets',
        'de': 'Ein Klick auf Importieren, fertig\nLegt Runen, Beschwörerzauber und Items an',
    }),
    (12.5, 14.4, {
        'es': 'En partida: objetivos con cuenta atrás\nSiempre a la vista, arriba del todo',
        'en': 'In game: objective countdowns\nAlways in sight, right at the top',
        'pt-br': 'Na partida: objetivos com contagem regressiva\nSempre à vista, lá no topo',
        'fr': 'En partie : compte à rebours des objectifs\nToujours visible, tout en haut',
        'de': 'Im Spiel: Objectives mit Countdown\nImmer im Blick, ganz oben',
    }),
    (14.4, 16.0, {
        'es': 'Qué habilidad subir y qué comprar\nLa flecha marca la habilidad; el aviso, la compra',
        'en': 'Which ability to level and what to buy\nThe arrow marks the ability; the alert, the purchase',
        'pt-br': 'Qual habilidade upar e o que comprar\nA seta marca a habilidade; o aviso, a compra',
        'fr': 'Quelle compétence monter et quoi acheter\nLa flèche montre la compétence ; l’alerte, l’achat',
        'de': 'Welche Fähigkeit skillen und was kaufen\nDer Pfeil zeigt die Fähigkeit, der Hinweis den Kauf',
    }),
    (16.0, 17.9, {
        'es': 'Te avisa por voz en español\nCon las voces de Windows, sin coste',
        'en': 'Voice alerts in your language\nUsing Windows voices, at no cost',
        'pt-br': 'Avisos por voz no seu idioma\nCom as vozes do Windows, sem custo',
        'fr': 'Des alertes vocales dans ta langue\nAvec les voix de Windows, sans frais',
        'de': 'Sprachhinweise in deiner Sprache\nMit den Windows-Stimmen, kostenlos',
    }),
    (17.9, 19.5, {
        'es': 'Tu CS y tu KDA al momento\nCon tu objetivo de CS por minuto',
        'en': 'Your CS and KDA at a glance\nWith your CS-per-minute target',
        'pt-br': 'Seu CS e seu KDA na hora\nCom sua meta de CS por minuto',
        'fr': 'Ton CS et ton KDA en un coup d’œil\nAvec ton objectif de CS par minute',
        'de': 'Dein CS und KDA auf einen Blick\nMit deinem CS-pro-Minute-Ziel',
    }),
    (19.5, 23.0, {
        'es': 'Tiempos de jungla en el minimapa\nOpcionales · en dorado los últimos 30 s',
        'en': 'Jungle timers on the minimap\nOptional · gold for the last 30 s',
        'pt-br': 'Timers da selva no minimapa\nOpcionais · dourados nos últimos 30 s',
        'fr': 'Timers de jungle sur la minimap\nOptionnels · en doré les 30 dernières s',
        'de': 'Jungle-Timer auf der Minimap\nOptional · Gold in den letzten 30 s',
    }),
    (23.0, 26.5, {
        'es': 'Tier list por rol y por modo\nVictorias, uso y partidas de Esmeralda+',
        'en': 'Tier list by role and mode\nWin rate, pick rate and games from Emerald+',
        'pt-br': 'Tier list por rota e por modo\nVitórias, escolhas e partidas Esmeralda+',
        'fr': 'Tier list par rôle et par mode\nVictoires, sélection et parties Émeraude+',
        'de': 'Tier-List nach Position und Modus\nSiegesrate, Pickrate und Spiele aus Smaragd+',
    }),
    (26.5, 30.0, {
        'es': 'También en ARAM y Arena\nEl overlay se adapta a cada modo',
        'en': 'Also in ARAM and Arena\nThe overlay adapts to each mode',
        'pt-br': 'Também no ARAM e na Arena\nO overlay se adapta a cada modo',
        'fr': 'Aussi en ARAM et en Arena\nL’overlay s’adapte à chaque mode',
        'de': 'Auch in ARAM und Arena\nDas Overlay passt sich jedem Modus an',
    }),
    (30.0, 33.0, {
        'es': 'Gratis · Solo API oficiales de Riot · En español',
        'en': 'Free · Official Riot APIs only · In your language',
        'pt-br': 'Grátis · Só APIs oficiais da Riot · No seu idioma',
        'fr': 'Gratuit · API officielles de Riot uniquement · Dans ta langue',
        'de': 'Kostenlos · Nur offizielle Riot-APIs · In deiner Sprache',
    }),
    (33.0, 37.0, {
        'es': 'Coach LoL IA 3.0 · Descárgalo gratis en www.coachlolia.com\nWindows 10/11 · Builds de EUW, LAN y LAS',
        'en': 'Coach LoL IA 3.0 · Download it for free at www.coachlolia.com\nWindows 10/11 · Builds from EUW, LAN and LAS',
        'pt-br': 'Coach LoL IA 3.0 · Baixe grátis em www.coachlolia.com\nWindows 10/11 · Builds de EUW, LAN e LAS',
        'fr': 'Coach LoL IA 3.0 · Télécharge-le gratuitement sur www.coachlolia.com\nWindows 10/11 · Builds EUW, LAN et LAS',
        'de': 'Coach LoL IA 3.0 · Kostenlos auf www.coachlolia.com\nWindows 10/11 · Builds aus EUW, LAN und LAS',
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
