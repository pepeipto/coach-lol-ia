import { describe, expect, it } from 'vitest';
import { clavesVariantes, limpiarEspacios, SelectorFijo, SelectorVariantes, textosVariantes } from '../src/main/consejos/variantes';
import { establecerIdioma, IDIOMAS, t, textosDe } from '../src/shared/i18n';

/*
 * 3.1: catálogo de frases de voz. Cuenta las variantes (plantillas distintas) de cada situación, por categoría y por
 * idioma, y comprueba que suenan bien leídas por una voz neuronal: sin cifras ni abreviaturas raras.
 */

/** Claves de variantes de voz: voz.<…>.<n> y las variantes del jungla enemigo (base y base.<n>). */
const VARIANTE = /^voz\.(.+)\.(\d+)$/;
const JUNGLA_ENEMIGA = /^junglaEnemiga\.(aviso|objetivo\.\w+|estructura\.\w+)(\.\d+)?$/;

function situaciones(idioma: (typeof IDIOMAS)[number]): Map<string, string[]> {
  const textos = textosDe(idioma);
  const mapa = new Map<string, string[]>();
  for (const [clave, texto] of Object.entries(textos)) {
    const v = VARIANTE.exec(clave);
    const j = JUNGLA_ENEMIGA.exec(clave);
    const base = v ? `voz.${v[1]}` : j ? `junglaEnemiga.${j[1]}` : null;
    if (!base) continue;
    mapa.set(base, [...(mapa.get(base) ?? []), texto]);
  }
  return mapa;
}

/** Categoría de una situación para el recuento (la segunda parte de la clave). */
const categoria = (base: string) => (base.startsWith('junglaEnemiga.') ? 'junglaEnemiga' : base.split('.')[1]!);

function recuento(idioma: (typeof IDIOMAS)[number]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const [base, textos] of situaciones(idioma)) r[categoria(base)] = (r[categoria(base)] ?? 0) + new Set(textos).size;
  return r;
}
const total = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe('catálogo de frases de voz (3.1)', () => {
  it('más de 400 frases distintas en español', () => {
    const r = recuento('es');
    expect(total(r)).toBeGreaterThanOrEqual(400);
    // Todas las categorías del coach tienen frases.
    for (const c of ['obj', 'tomado', 'robo', 'alma', 'estructura', 'equipo', 'jungla', 'junglaEnemiga', 'habilidad', 'nivel', 'compra', 'economia', 'cs', 'vision', 'combate', 'muerte', 'animo', 'fase', 'marcador', 'modo']) {
      expect(r[c], c).toBeGreaterThan(0);
    }
  });

  it('la misma cobertura en los cinco idiomas (mismas situaciones y mismo número de variantes)', () => {
    const es = situaciones('es');
    for (const idioma of IDIOMAS) {
      const otro = situaciones(idioma);
      expect([...otro.keys()].sort(), idioma).toEqual([...es.keys()].sort());
      for (const [base, textos] of es) expect(otro.get(base)!.length, `${idioma}: ${base}`).toBe(textos.length);
      expect(total(recuento(idioma)), idioma).toBeGreaterThanOrEqual(400);
    }
  });

  it('cada situación tiene de 3 a 6 variantes distintas, salvo la ruta estimada', () => {
    for (const idioma of IDIOMAS) {
      for (const [base, textos] of situaciones(idioma)) {
        expect(textos.length, `${idioma}: ${base}`).toBeGreaterThanOrEqual(3);
        // Los consejos mientras estás muerto y los de ARAM son una bolsa más grande a propósito.
        if (!/muerte\.consejo|modo\.aram\.consejo/.test(base)) expect(textos.length, `${idioma}: ${base}`).toBeLessThanOrEqual(6);
        expect(new Set(textos).size, `${idioma}: ${base} repite una variante`).toBe(textos.length);
      }
    }
  });

  it('pensadas para una voz neuronal: sin cifras, sin «CS» en español y cortas', () => {
    for (const idioma of IDIOMAS) {
      for (const [base, textos] of situaciones(idioma)) {
        for (const texto of textos) {
          expect(/\d/.test(texto), `${idioma}: ${base}: «${texto}» lleva cifras`).toBe(false);
          // Una frase hablada corta: como mucho unas 14 palabras (las plantillas llevan un nombre dentro).
          expect(texto.split(/\s+/).length, `${idioma}: ${base}: «${texto}»`).toBeLessThanOrEqual(14);
        }
      }
    }
    for (const [base, textos] of situaciones('es')) for (const texto of textos) expect(/\bCS\b|\bKDA\b/.test(texto), `${base}: ${texto}`).toBe(false);
  });

  it('nunca etiquetas negativas sobre nadie', () => {
    const feas = /\b(manco|malo|noob|inútil|pésimo|horrible|idiota|tonto|culpa|bad|useless|trash|ruim|lixo|nul|nulle|schlecht|nutzlos)\b/i;
    for (const idioma of IDIOMAS) for (const [base, textos] of situaciones(idioma)) for (const x of textos) expect(feas.test(x), `${idioma}: ${base}: ${x}`).toBe(false);
  });

  it('política de Riot: nada sobre la definitiva del rival ni órdenes de evitar peleas o quedarse bajo torre', () => {
    const prohibidas: Record<(typeof IDIOMAS)[number], RegExp> = {
      es: /rival aún no|evitad pelear|bajo torre/i,
      en: /opponent does not yet|avoid fights|stay together near/i,
      fr: /adversaire pas encore|évitez les combats|restez groupés sous tour/i,
      de: /Gegner noch nicht|meidet eine Weile|bleibt zusammen bei/i,
      'pt-BR': /oponente ainda não|evitem lutas|fiquem juntos perto/i,
    };
    for (const idioma of IDIOMAS)
      for (const [base, textos] of situaciones(idioma)) for (const x of textos) expect(prohibidas[idioma].test(x), `${idioma}: ${base}: ${x}`).toBe(false);
  });

  it('los avisos del jungla enemigo siguen hablando de lo que acaba de pasar, nunca de dónde está', () => {
    for (const [base, textos] of situaciones('es')) {
      if (!base.startsWith('junglaEnemiga.')) continue;
      for (const x of textos) expect(x, base).toMatch(/acaba(n)? de/);
    }
  });

  it('recuento por categoría e idioma (para el informe)', () => {
    const tabla = Object.fromEntries(IDIOMAS.map((i) => [i, recuento(i)]));
    // Mismo recuento en todos los idiomas.
    for (const idioma of IDIOMAS) expect(tabla[idioma], idioma).toEqual(tabla.es);
  });
});

describe('selector de variantes', () => {
  it('lista las variantes de una situación (base.1, base.2…) y, si existe, la propia base', () => {
    expect(clavesVariantes('voz.obj.baron.60')).toEqual(['voz.obj.baron.60.1', 'voz.obj.baron.60.2', 'voz.obj.baron.60.3', 'voz.obj.baron.60.4']);
    expect(clavesVariantes('junglaEnemiga.objetivo.baron')[0]).toBe('junglaEnemiga.objetivo.baron');
    expect(clavesVariantes('no.existe')).toEqual([]);
  });

  it('al azar, nunca repite la variante anterior de la misma situación', () => {
    // Un azar que siempre daría la misma variante: el selector salta a otra.
    const s = new SelectorVariantes(() => 0.1);
    const dichas = Array.from({ length: 40 }, () => s.texto('voz.combate.asesinato'));
    for (let i = 1; i < dichas.length; i++) expect(dichas[i]).not.toBe(dichas[i - 1]);
    // Con Math.random también, y salen todas las variantes con el tiempo.
    const r = new SelectorVariantes();
    const muchas = Array.from({ length: 300 }, () => r.texto('voz.combate.asesinato'));
    for (let i = 1; i < muchas.length; i++) expect(muchas[i]).not.toBe(muchas[i - 1]);
    expect(new Set(muchas)).toEqual(new Set(textosVariantes('voz.combate.asesinato')));
  });

  it('cada situación lleva su propia memoria: otra situación no cuenta como repetición', () => {
    const s = new SelectorVariantes(() => 0);
    expect(s.texto('voz.combate.asesinato')).toBe(t('voz.combate.asesinato.1'));
    expect(s.texto('voz.combate.asistencia')).toBe(t('voz.combate.asistencia.1'));
    expect(s.texto('voz.combate.asesinato')).toBe(t('voz.combate.asesinato.2'));
    s.reiniciar();
    expect(s.texto('voz.combate.asesinato')).toBe(t('voz.combate.asesinato.1'));
  });

  it('interpola los marcadores y quita los espacios de más (p. ej. sin tipo de dragón)', () => {
    expect(new SelectorFijo().texto('voz.obj.dragon.60', { dragon: t('voz.dragonNombre.oceano') })).toBe('El dragón del océano aparece en un minuto');
    expect(limpiarEspacios('El  dragón   aparece ')).toBe('El dragón aparece');
  });

  it('sigue el idioma de la app', () => {
    establecerIdioma('de');
    try {
      expect(new SelectorFijo().texto('voz.obj.baron.ya')).toBe('Baron Nashor ist erschienen');
    } finally {
      establecerIdioma('es');
    }
  });
});
