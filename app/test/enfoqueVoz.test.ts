import { describe, expect, it } from 'vitest';
import type { Build } from '@coach/shared';
import { AJUSTES_POR_DEFECTO, normalizarAjustes } from '../src/main/ajustes';
import { cs10Tras, resumenOverlay } from '../src/main/consejos/motor';
import { SelectorFijo } from '../src/main/consejos/variantes';
import { DisparadorVoz } from '../src/main/consejos/voz';
import type { DatosEstaticos } from '../src/main/datos/estaticos';
import { ENFOQUES_VOZ, enfoqueActivo, fraseEnEnfoque, vozDiceFrase } from '../src/shared/enfoquesVoz';
import { t } from '../src/shared/i18n';
import type { AjustesVoz, EstadoPartida } from '../src/shared/tiposApp';

/*
 * 3.18: modo enfoque de la voz. Con un enfoque, en la Grieta solo se dicen las frases de ese aspecto (feedback de un
 * streamer: «que me diga solo eso, para ir asimilando de a poco»).
 */

const objetos = { 3108: { name: 'Códice demoníaco', gold: { total: 1250 }, from: [] } } as unknown as DatosEstaticos['objetos'];
const build = { nucleo: [3108], botas: null, situacionales: [], ordenHabilidades: ['Q', 'E', 'W', 'Q'] } as unknown as Build;
const VOZ: AjustesVoz = { ...AJUSTES_POR_DEFECTO.overlay.voz, activa: true };

function estado(p: Partial<EstadoPartida> = {}): EstadoPartida {
  return { tiempo: 20, oro: 0, nivel: 1, campeon: 'Ahri', objetos: [], habilidades: { Q: 1, W: 0, E: 0, R: 0 }, eventos: [], ...p };
}

function correr(estados: EstadoPartida[], voz: AjustesVoz): string[] {
  const d = new DisparadorVoz({ selector: new SelectorFijo() });
  let cs10: number | null = null;
  return estados.flatMap((e) => {
    cs10 = cs10Tras(cs10, e);
    return d.procesar({ estado: e, overlay: resumenOverlay(e, build, 'MIDDLE', objetos, '', cs10), rol: 'MIDDLE', marcas: {}, jungla: false }, voz).map((f) => f.texto);
  });
}

describe('modo enfoque de la voz (3.18)', () => {
  it('sin enfoque por defecto; los ajustes guardan solo enfoques válidos', () => {
    expect(AJUSTES_POR_DEFECTO.overlay.voz.enfoque).toBeNull();
    const conEnfoque = normalizarAjustes({ overlay: { voz: { enfoque: 'objetivos' } } });
    expect(conEnfoque.overlay.voz.enfoque).toBe('objetivos');
    expect(normalizarAjustes({ overlay: { voz: { enfoque: 'inventado' } } }).overlay.voz.enfoque).toBeNull();
    expect(normalizarAjustes({}).overlay.voz.enfoque).toBeNull();
  });

  it('objetivos: al empezar lo confirma, avisa a minuto y medio (prioridad y visión) y no dice nada más', () => {
    const voz: AjustesVoz = { ...VOZ, enfoque: 'objetivos' };
    // Ahri con oro para comprar y un punto de habilidad: sin enfoque lo diría; con enfoque, no.
    const dichas = correr(
      [estado({ tiempo: 5 }), estado({ tiempo: 205, oro: 1300, nivel: 2 }), estado({ tiempo: 241 }), estado({ tiempo: 271 }), estado({ tiempo: 300 })],
      voz,
    );
    expect(dichas).toEqual([
      t('voz.enfoque.inicio.objetivos.1'),
      t('voz.enfoque.objetivos.preparar.1', { objetivo: t('voz.nombre.dragon') }),
      // El aviso de un minuto lo cubre el de minuto y medio.
      'El dragón aparece en treinta segundos',
      'El dragón ha aparecido',
    ]);
    // Sin enfoque, en esos mismos momentos sí hay compra, habilidad y el aviso de un minuto.
    const normal = correr([estado({ tiempo: 5 }), estado({ tiempo: 205, oro: 1300, nivel: 2 }), estado({ tiempo: 241 })], VOZ);
    expect(normal).toContain('El dragón aparece en un minuto');
    expect(normal.some((x) => x.includes('Códice demoníaco'))).toBe(true);
  });

  it('visión: su propio aviso antes del objetivo, sin cuenta atrás del objetivo', () => {
    const dichas = correr([estado({ tiempo: 5 }), estado({ tiempo: 205 }), estado({ tiempo: 241 }), estado({ tiempo: 271 }), estado({ tiempo: 300 })], { ...VOZ, enfoque: 'vision' });
    expect(dichas).toEqual([t('voz.enfoque.inicio.vision.1'), t('voz.enfoque.vision.preparar.1', { objetivo: t('voz.nombre.dragon') })]);
  });

  it('farmeo: compras sí; objetivos no', () => {
    const dichas = correr([estado({ tiempo: 5 }), estado({ tiempo: 205, oro: 1300 }), estado({ tiempo: 241 }), estado({ tiempo: 300 })], { ...VOZ, enfoque: 'farmeo' });
    expect(dichas[0]).toBe(t('voz.enfoque.inicio.farmeo.1'));
    expect(dichas).toContain('Puedes comprar Códice demoníaco');
    expect(dichas.some((x) => /dragón/i.test(x))).toBe(false);
  });

  it('cada enfoque deja fuera las frases de ánimo, fases y combate', () => {
    for (const e of ENFOQUES_VOZ) {
      for (const base of ['voz.animo.inicio', 'voz.fase.MIDDLE.media', 'voz.combate.asesinato', 'voz.equipo.rachaAliado']) {
        expect(fraseEnEnfoque(e, 'animo', base), `${e}: ${base}`).toBe(false);
      }
      expect(fraseEnEnfoque(e, 'animo', `voz.enfoque.inicio.${e}`)).toBe(true);
    }
    // El jungla enemigo (sin base propia) solo en «morir menos».
    expect(fraseEnEnfoque('supervivencia', 'junglaEnemiga')).toBe(true);
    expect(fraseEnEnfoque('objetivos', 'junglaEnemiga')).toBe(false);
  });

  it('solo en la Grieta: en ARAM o Arena mandan las categorías de siempre', () => {
    const voz = { ...VOZ, enfoque: 'objetivos' as const };
    expect(enfoqueActivo(voz, 'clasificatoria')).toBe('objetivos');
    expect(enfoqueActivo(voz, 'aram')).toBeNull();
    expect(vozDiceFrase(voz, 'compra', 'voz.compra', 'aram')).toBe(true);
    expect(vozDiceFrase(voz, 'compra', 'voz.compra', 'clasificatoria')).toBe(false);
  });

  it('las frases del enfoque existen en los cinco idiomas', () => {
    for (const e of ENFOQUES_VOZ) expect(t(`voz.enfoque.inicio.${e}.1`)).not.toBe(`voz.enfoque.inicio.${e}.1`);
    for (const e of ['objetivos', 'vision']) expect(t(`voz.enfoque.${e}.preparar.1`)).not.toBe(`voz.enfoque.${e}.preparar.1`);
  });
});
