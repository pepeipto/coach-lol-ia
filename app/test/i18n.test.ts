import { describe, expect, it } from 'vitest';
import {
  alCambiarIdioma,
  esIdioma,
  establecerIdioma,
  IDIOMAS,
  idiomaActual,
  idiomaDeSistema,
  LOCALE_DDRAGON,
  localeActual,
  NOMBRES_IDIOMA,
  t,
  textosDe,
} from '../src/shared/i18n';
import es from '../src/shared/i18n/es.json';

describe('t', () => {
  it('interpola parámetros', () => {
    expect(t('aviso.compra', { oro: 1250, objeto: 'Códice demoníaco' })).toBe(
      'Tienes 1250 de oro: ya puedes comprar Códice demoníaco',
    );
  });
  it('devuelve la clave si no existe', () => {
    expect(t('no.existe')).toBe('no.existe');
  });
  it('tiene los 15 consejos de fase con su prefijo', () => {
    const prefijos = { temprana: 'Fase temprana: ', media: 'Fase media: ', tardia: 'Fase tardía: ' };
    for (const rol of ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']) {
      for (const [fase, prefijo] of Object.entries(prefijos)) {
        expect(t(`fase.${rol}.${fase}`).startsWith(prefijo)).toBe(true);
      }
    }
    expect(t('fase.MIDDLE.media')).toBe('Fase media: agrupa con tu equipo para los objetivos');
  });
  it('contiene el aviso legal', () => {
    expect(es['legal.aviso' as keyof typeof es]).toContain('no está respaldado por Riot Games');
  });
});

describe('idiomas (Fase 3)', () => {
  const marcadores = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it('todas las claves de es.json existen en cada idioma, con los mismos marcadores', () => {
    const claves = Object.keys(textosDe('es')).sort();
    for (const idioma of IDIOMAS) {
      const textos = textosDe(idioma);
      expect(Object.keys(textos).sort(), idioma).toEqual(claves);
      for (const clave of claves) {
        expect(typeof textos[clave], `${idioma}: ${clave}`).toBe('string');
        expect(textos[clave]!.trim().length > 0 || textosDe('es')[clave] === '', `${idioma}: ${clave} vacío`).toBe(true);
        expect(marcadores(textos[clave]!), `${idioma}: ${clave}`).toEqual(marcadores(textosDe('es')[clave]!));
      }
    }
  });

  it('los idiomas están traducidos (no son una copia del español)', () => {
    for (const idioma of IDIOMAS.filter((i) => i !== 'es')) {
      expect(textosDe(idioma)['ui.sinSeleccion'], idioma).not.toBe(textosDe('es')['ui.sinSeleccion']);
      // Algunos textos coinciden con razón (CS, KDA, Premium, nombres propios…), pero nunca la mayoría.
      const claves = Object.keys(textosDe('es'));
      const iguales = claves.filter((c) => textosDe(idioma)[c] === textosDe('es')[c]).length;
      expect(iguales / claves.length, idioma).toBeLessThan(0.2);
      expect(textosDe(idioma)['legal.aviso'], idioma).toContain('Riot Games');
    }
  });

  it('el idioma del sistema elige uno de los nuestros; cualquier otro, español', () => {
    expect(idiomaDeSistema('en-US')).toBe('en');
    expect(idiomaDeSistema('en-GB')).toBe('en');
    expect(idiomaDeSistema('pt-BR')).toBe('pt-BR');
    expect(idiomaDeSistema('pt-PT')).toBe('pt-BR');
    expect(idiomaDeSistema('fr')).toBe('fr');
    expect(idiomaDeSistema('fr-CA')).toBe('fr');
    expect(idiomaDeSistema('de-AT')).toBe('de');
    expect(idiomaDeSistema('es-ES')).toBe('es');
    expect(idiomaDeSistema('it-IT')).toBe('es');
    expect(idiomaDeSistema('')).toBe('es');
    expect(idiomaDeSistema(undefined)).toBe('es');
  });

  it('cambia el idioma de t(), avisa a los oyentes y vuelve al español con un valor raro', () => {
    const vistos: string[] = [];
    const dejar = alCambiarIdioma((i) => vistos.push(i));
    try {
      establecerIdioma('de');
      expect(idiomaActual()).toBe('de');
      expect(localeActual()).toBe('de');
      expect(t('ui.importar')).toBe(textosDe('de')['ui.importar']);
      establecerIdioma('xx');
      expect(idiomaActual()).toBe('es');
      expect(vistos).toEqual(['de', 'es']);
    } finally {
      dejar();
      establecerIdioma('es');
    }
  });

  it('las claves de las etiquetas que manda el servidor existen', () => {
    const claves = ['carga.etiqueta.especialista', 'carga.etiqueta.racha', 'carga.rasgo.dificil'];
    for (const tag of ['Assassin', 'Fighter', 'Mage', 'Marksman', 'Support', 'Tank']) claves.push(`carga.rasgo.${tag}`);
    for (const c of claves) expect(textosDe('es')[c], c).toBeTruthy();
  });

  it('no hay etiqueta de «poca experiencia» en ningún idioma (nada negativo sobre otros jugadores)', () => {
    for (const idioma of ['es', 'en', 'pt-BR', 'fr', 'de'] as const) {
      expect(Object.keys(textosDe(idioma)).filter((c) => /pocaExperiencia/i.test(c))).toEqual([]);
    }
  });

  it('cada idioma tiene su locale de Data Dragon y su nombre propio', () => {
    expect(LOCALE_DDRAGON).toEqual({ es: 'es_MX', en: 'en_US', 'pt-BR': 'pt_BR', fr: 'fr_FR', de: 'de_DE' });
    expect(NOMBRES_IDIOMA.de).toBe('Deutsch');
    expect(esIdioma('pt-BR')).toBe(true);
    expect(esIdioma('pt')).toBe(false);
  });
});
