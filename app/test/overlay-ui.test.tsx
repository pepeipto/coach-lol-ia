// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Avisos } from '../src/renderer/overlay/Avisos';
import { Panel } from '../src/renderer/overlay/Panel';
import { t } from '../src/shared/i18n';

afterEach(cleanup);

describe('Panel del overlay', () => {
  it('muestra la próxima compra y el objetivo con sus etiquetas', () => {
    const compra = t('panel.compra', { objeto: 'Códice demoníaco', oro: 450 });
    const objetivo = t('aviso.objetivoPronto', { objetivo: t('objetivo.dragon'), segundos: 45 });
    render(<Panel panel={{ proximaCompra: compra, proximoObjetivo: objetivo }} />);
    expect(screen.getByText('Próxima compra')).toBeTruthy();
    expect(screen.getByText('Próximo objetivo')).toBeTruthy();
    expect(screen.getByText(compra)).toBeTruthy();
    expect(screen.getByText(objetivo)).toBeTruthy();
    // Cuenta atrás de 60 s: a 45 s del dragón han pasado 15.
    const barra = screen.getByRole('progressbar');
    expect(barra.getAttribute('aria-valuenow')).toBe('15');
    expect(barra.getAttribute('aria-valuemax')).toBe('60');
  });

  it('sin datos muestra un guion', () => {
    render(<Panel panel={null} />);
    expect(screen.getAllByText(t('overlay.nada'))).toHaveLength(2);
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('Avisos del overlay', () => {
  it('cada aviso lleva el icono de su tipo', () => {
    render(
      <Avisos
        avisos={[
          { id: 1, texto: t('aviso.vision'), tipo: 'vision' },
          { id: 2, texto: t('aviso.compra', { oro: 1250, objeto: 'Códice demoníaco' }) },
        ]}
      />,
    );
    expect(screen.getByRole('img', { name: t('ajustes.aviso.vision') })).toBeTruthy();
    // Sin tipo explícito se deduce del texto.
    expect(screen.getByRole('img', { name: t('ajustes.aviso.compra') })).toBeTruthy();
  });
});
