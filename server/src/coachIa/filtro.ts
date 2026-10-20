import { LIMITES_IA, type IdiomaIa, type MomentoConsejo } from '@coach/shared';

/*
 * Filtro de salida de los consejos de momentos muertos (B). El prompt ya pide una frase educativa, pero lo que vuelve
 * del modelo se comprueba aquí antes de llegar a la app: si tiene pinta de posición enemiga, de enfriamientos o
 * temporizadores que no son públicos, o de una orden en tiempo real («ve a gankear»), se descarta y se usa un consejo
 * genérico seguro. Así se cumple la política de Riot aunque el modelo se equivoque.
 */

/** Minúsculas y sin tildes, para comparar en los cinco idiomas con las mismas expresiones. */
export function plano(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/** Patrones prohibidos (sobre el texto plano), con su motivo para las pruebas. */
export const PATRONES_PROHIBIDOS: { motivo: string; patron: RegExp }[] = [
  // Enfriamientos y hechizos de invocador o definitivas del rival.
  { motivo: 'enfriamiento', patron: /\b(cooldowns?|enfriamientos?|recarga|recharge|abklingzeit\w*|tempo de recarga|\bcds?\b)/ },
  {
    motivo: 'enfriamiento',
    patron:
      /\b(sin|no tiene[n]?|without|has no|have no|no|sem|nao tem|sans|n'a pas|ohne|hat kein\w*)\s+(su |sua |seu |their |his |her |leur |son |sa |sein\w* |ihr\w* )?(flash|destello|ult|ulti|ulte|definitiva|ultimate|teleport\w*|tp|heal|curar|barrera|barrier|ignite|prender|incendiar|ignicion|embrasement|entzunden)\b/,
  },
  { motivo: 'enfriamiento', patron: /\b(flash|destello)\b.*\b(usad[oa]|gastad[oa]|used|burned|burnt|usado|utilise|benutzt|verbraucht|caido|down)\b/ },
  { motivo: 'enfriamiento', patron: /\b(usad[oa]|gastad[oa]|used|burned|burnt|utilise|benutzt|verbraucht)\b.*\b(flash|destello)\b/ },
  // Temporizadores: ningún número de segundos ni marcas de tiempo (los temporizadores públicos ya los dice la voz fija).
  { motivo: 'temporizador', patron: /\b\d+\s*(s|seg|segs|segundos?|sec|secs|seconds?|secondes?|sek|sekunden?)\b/ },
  { motivo: 'temporizador', patron: /\b\d{1,2}:\d{2}\b/ },
  // Posiciones o seguimiento de enemigos.
  { motivo: 'posicion', patron: /\b(visto|vista|vistos|avistad[oa]s?|seen|spotted|vu|vue|aperçu|apercu|gesehen|gesichtet)\b/ },
  { motivo: 'posicion', patron: /\b(mia|missing|ss|desaparecid[oa]s?|sumiu|sumiram|disparu|disparue|verschwunden|fehlt)\b/ },
  {
    motivo: 'posicion',
    patron:
      /\b(esta|estan|is|are|was|were|esta|estao|est|sont|ist|sind|anda|va|vai|geht|heads?|going)\s+(en|por|hacia|in|at|on|to|towards|no|na|pelo|pela|para|dans|au|vers|a|im|in der|auf|bei|nach|zum|zur)\s+(el |la |tu |su |the |your |o |a |seu |sua |le |la |ta |ton |votre |den |die |das |deine\w* )?(top|mid|bot|bottom|middle|jungla|jungle|selva|rio|river|riviere|fluss|base|arbusto\w*|matorral\w*|bush\w*|mato|moita|buisson\w*|busch\w*|calle|linea|lane|rota|voie|lane)\b/,
  },
  { motivo: 'posicion', patron: /\b(posicion|position|posicao|standort)\s+(del|de la|de los|of the|do|da|des|du|de l|vom|von)\s+\w*\s*(enemig\w*|rival\w*|enemy|enemies|inimig\w*|ennemi\w*|gegner\w*)/ },
  // Órdenes en tiempo real: emboscadas, invasiones y «ahora mismo».
  { motivo: 'orden', patron: /\b(gank\w*|ganque\w*)\b/ },
  { motivo: 'orden', patron: /\b(invad\w*|invasion\w*|envahi\w*)\b/ },
  { motivo: 'orden', patron: /\b(ahora mismo|ya mismo|right now|immediately|inmediatamente|agora mesmo|imediatamente|tout de suite|immediatement|sofort|jetzt sofort)\b/ },
  {
    motivo: 'orden',
    patron:
      /\b(ve|vete|anda|corre|ir|go|run|head|vai|va|corra|allez|vas|cours|geh|lauf|renn)\s+(a|al|a la|hacia|to|for|para|pro|pra|ao|a|au|vers|zu|zum|zur|nach)\s+(top|mid|bot|bottom|jungla|jungle|selva|rio|river|base|calle|lane|rota|voie|linie)\b/,
  },
  // Enlaces o direcciones: nunca en una frase de voz.
  { motivo: 'enlace', patron: /(https?:|www\.|@)/ },
];

export interface ConsejoFiltrado {
  texto: string;
  /** true si es el texto del modelo; false si se sustituyó por el genérico. */
  delModelo: boolean;
  motivo?: string;
}

/** Deja una sola frase: sin saltos de línea, comillas de los extremos ni espacios de más. */
export function limpiarFrase(crudo: string): string {
  let t = crudo.replace(/\s+/g, ' ').trim();
  // Solo la primera frase si el modelo escribió varias (el punto puede ir antes de unas comillas de cierre).
  const fin = /[.!?]["'»”’]*(\s|$)/.exec(t);
  if (fin) t = t.slice(0, fin.index + fin[0].trimEnd().length);
  return t.replace(/^["'«“‘„]+|["'»”’]+$/g, '').trim();
}

export const contarPalabras = (t: string) => t.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;

/** Motivo por el que una frase no vale como consejo; null si vale. */
export function motivoRechazo(texto: string): string | null {
  if (!texto) return 'vacio';
  if (contarPalabras(texto) > LIMITES_IA.palabrasConsejo) return 'larga';
  if (texto.length > 160) return 'larga';
  const p = plano(texto);
  for (const { motivo, patron } of PATRONES_PROHIBIDOS) if (patron.test(p)) return motivo;
  return null;
}

/** Consejos genéricos y seguros por idioma y momento (cuando el modelo falla, rechaza o se sale de las reglas). */
export const CONSEJOS_GENERICOS: Record<IdiomaIa, Record<MomentoConsejo, string[]>> = {
  es: {
    muerte: [
      'Mientras esperas, mira los objetos del rival en el marcador y piensa qué compra te conviene.',
      'Revisa en el marcador quién va más fuerte del rival y planifica tu próxima compra.',
      'Aprovecha para pensar qué objetivo puede disputar tu equipo cuando vuelvas.',
    ],
    tienda: [
      'Tienes oro para gastar: un componente ahora vale más que guardarlo para luego.',
      'Antes de salir, completa un componente y no olvides un guardián de control.',
    ],
    objetivo: [
      'Se acerca un objetivo: llegar con tu equipo agrupado vale más que una baja suelta.',
      'Los objetivos ganan partidas: piensa cómo puede ayudar tu equipo a prepararlo.',
    ],
  },
  en: {
    muerte: [
      'While you wait, check enemy items on the scoreboard and plan your next purchase.',
      'Use this time to see which enemy is strongest and how your build can answer.',
      'Think about which objective your team can contest once you are back.',
    ],
    tienda: [
      'You have gold to spend: a finished component now beats saving it for later.',
      'Before leaving base, finish a component and grab a control ward.',
    ],
    objetivo: [
      'An objective is coming up: arriving grouped matters more than a single kill.',
      'Objectives win games: think about how your team can set up for the next one.',
    ],
  },
  'pt-BR': {
    muerte: [
      'Enquanto espera, veja os itens dos inimigos no placar e planeje sua próxima compra.',
      'Aproveite para ver qual inimigo está mais forte e como sua build pode responder.',
      'Pense em qual objetivo seu time pode disputar quando você voltar.',
    ],
    tienda: [
      'Você tem ouro para gastar: um componente agora vale mais que guardar para depois.',
      'Antes de sair da base, complete um componente e leve uma sentinela de controle.',
    ],
    objetivo: [
      'Um objetivo está chegando: chegar agrupado vale mais que um abate isolado.',
      'Objetivos ganham partidas: pense em como seu time pode se preparar para o próximo.',
    ],
  },
  fr: {
    muerte: [
      'En attendant, regarde les objets adverses dans le tableau des scores et prépare ton prochain achat.',
      'Profites-en pour repérer l’adversaire le plus fort et adapter ton build.',
      'Réfléchis à l’objectif que ton équipe pourra disputer à ton retour.',
    ],
    tienda: [
      'Tu as de l’or à dépenser : un composant maintenant vaut mieux que l’économiser.',
      'Avant de quitter la base, termine un composant et prends une balise de contrôle.',
    ],
    objetivo: [
      'Un objectif approche : arriver groupés compte plus qu’un kill isolé.',
      'Les objectifs gagnent les parties : pense à comment ton équipe peut s’y préparer.',
    ],
  },
  de: {
    muerte: [
      'Schau dir beim Warten die gegnerischen Items auf der Anzeigetafel an und plane deinen nächsten Kauf.',
      'Nutze die Zeit: Welcher Gegner ist am stärksten und wie antwortet dein Build darauf?',
      'Überlege, welches Objective dein Team nach deiner Rückkehr umkämpfen kann.',
    ],
    tienda: [
      'Du hast Gold: Eine fertige Komponente jetzt bringt mehr als Sparen.',
      'Bevor du die Basis verlässt, kauf eine Komponente und ein Kontrollauge.',
    ],
    objetivo: [
      'Ein Objective steht an: Gemeinsam ankommen zählt mehr als ein einzelner Kill.',
      'Objectives gewinnen Spiele: Überlege, wie dein Team sich darauf vorbereiten kann.',
    ],
  },
};

/** Consejo genérico del idioma y el momento; `semilla` elige la variante (p. ej. el minuto de la partida). */
export function consejoGenerico(idioma: IdiomaIa, momento: MomentoConsejo, semilla = 0): string {
  const lista = CONSEJOS_GENERICOS[idioma][momento];
  return lista[Math.abs(Math.floor(semilla)) % lista.length]!;
}

/** Limpia la frase del modelo y la acepta, o la sustituye por un consejo genérico si incumple alguna regla. */
export function filtrarConsejo(crudo: string | null, idioma: IdiomaIa, momento: MomentoConsejo, semilla = 0): ConsejoFiltrado {
  const texto = limpiarFrase(crudo ?? '');
  const motivo = motivoRechazo(texto);
  if (motivo) return { texto: consejoGenerico(idioma, momento, semilla), delModelo: false, motivo };
  return { texto, delModelo: true };
}
