import { describe, it, expect } from 'vitest';
import { crearIndiceNombresTft, nombreLegibleTft, normalizarResultadoTft, nucleoIdTft } from '../src/tft';

describe('TFT: nombres', () => {
  it('saca el núcleo del id interno', () => {
    expect(nucleoIdTft('TFT15_Ahri')).toBe('Ahri');
    expect(nucleoIdTft('18_Ahri')).toBe('Ahri');
    expect(nucleoIdTft('Krug18')).toBe('Krug');
    expect(nucleoIdTft('DA_18_Brawler')).toBe('Brawler');
    expect(nucleoIdTft('DA_Riftbeast18')).toBe('Riftbeast');
    expect(nucleoIdTft('MasterYi_AD')).toBe('MasterYi_AD');
    expect(nombreLegibleTft('18_ElderDragon')).toBe('Elder Dragon');
    expect(nombreLegibleTft('MasterYi_AD')).toBe('Master Yi');
  });

  it('casa ids nuevos con Data Dragon por id, núcleo o nombre en inglés', () => {
    const local = {
      'Maps/Shipping/TFT18_Ahri': { id: 'TFT18_Ahri', name: 'Ahri', image: { full: 'TFT18_Ahri.png', group: 'tft-champion' } },
      TFT18_MasterYi: { id: 'TFT18_MasterYi', name: 'Maestro Yi', image: { full: 'yi.png', group: 'tft-champion' } },
      TFT18_Brawler: { id: 'TFT18_Brawler', name: 'Peleador' },
    };
    const ingles = { TFT18_MasterYi: { id: 'TFT18_MasterYi', name: 'Master Yi' }, TFT18_Brawler: { id: 'TFT18_Brawler', name: 'Brawler' } };
    const nombre = crearIndiceNombresTft(local, ingles);
    expect(nombre('18_Ahri')).toEqual({ nombre: 'Ahri', icono: { grupo: 'tft-champion', archivo: 'TFT18_Ahri.png' } });
    expect(nombre('MasterYi_AD').nombre).toBe('Maestro Yi');
    expect(nombre('DA_18_Brawler')).toEqual({ nombre: 'Peleador' });
    expect(nombre('Krug18')).toEqual({ nombre: 'Krug' });
  });

  it('valida la respuesta del servidor', () => {
    expect(normalizarResultadoTft(null)).toBeNull();
    const r = normalizarResultadoTft({
      parche: '16.22',
      partidas: 10,
      comps: [
        { id: 'a|b', rasgos: ['a'], portador: 'b', unidades: [{ id: 'b', frecuencia: 1 }], objetosPortador: ['x'], nivelMedio: 8, tier: 'S', tableros: 40, frecuencia: 0.1, puestoMedio: 3, top4: 0.7, victorias: 0.2 },
        { id: 'roto' },
      ],
    });
    expect(r?.comps).toHaveLength(1);
  });
});
