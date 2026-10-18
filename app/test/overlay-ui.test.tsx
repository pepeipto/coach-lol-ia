// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Avisos } from '../src/renderer/overlay/Avisos';
import { Panel } from '../src/renderer/overlay/Panel';
import { t } from '../src/shared/i18n';

afterEach(cleanup);

describe('Panel del overlay', () => {
  it('muestra la próxima compra y el objetivo con sus etiquetas', () => {
    const compra = t('panel.compra', { objeto: 'Códice demoníaco', oro: 450 });
    const objetivo = t('aviso.objetivoPronto', { objetivo: t('objetivo.dragon'), segundos: 45 });
    render(<Panel panel={{ proximaCompra: compra, proximoObjetivo: objetivo, proximaHabilidad: null, objetivos: [] }} />);
    expect(screen.getByText('Próxima compra')).toBeTruthy();
    expect(screen.getByText('Próximo objetivo')).toBeTruthy();
    expect(screen.getByText(compra)).toBeTruthy();
    expect(screen.getByText(objetivo)).toBeTruthy();
    // Cuenta atrás de 60 s: a 45 s del dragón han pasado 15.
    const barra = screen.getByRole('progressbar');
    expect(barra.getAttribute('aria-valuenow')).toBe('15');
    expect(barra.getAttribute('aria-valuemax')).toBe('60');
  });

  it('muestra la próxima habilidad con su tecla', () => {
    render(<Panel panel={{ proximaCompra: null, proximoObjetivo: null, proximaHabilidad: 'R', objetivos: [] }} />);
    expect(screen.getByText('Próxima habilidad')).toBeTruthy();
    const tecla = screen.getByRole('img', { name: 'Habilidad R' });
    expect(tecla.textContent).toBe('R');
    expect(tecla.className).toContain('hab-R');
  });

  it('lista los objetivos con su cuenta atrás (m:ss) o «Ya»', () => {
    render(
      <Panel
        panel={{
          proximaCompra: null,
          proximoObjetivo: null,
          proximaHabilidad: 'Q',
          objetivos: [
            { id: 'larvas', nombre: 'Larvas', aparece: null, disponible: true },
            { id: 'dragon', nombre: 'Dragón', aparece: 65, disponible: false },
            { id: 'baron', nombre: 'Barón', aparece: 1170, disponible: false },
          ],
        }}
      />,
    );
    const lista = screen.getByRole('list', { name: 'Objetivos' });
    const filas = within(lista).getAllByRole('listitem');
    expect(filas.map((f) => f.textContent)).toEqual(['LarvasYa', 'Dragón1:05', 'Barón19:30']);
    expect(filas[0]!.className).toContain('disponible');
    expect(filas[1]!.getAttribute('data-objetivo')).toBe('dragon');
  });

  it('el próximo objetivo reconoce los nombres nuevos y el plural (icono y cuenta atrás)', () => {
    const objetivo = t('aviso.objetivoProntoPlural', { objetivo: t('objetivo.larvas'), segundos: 30 });
    const { container } = render(<Panel panel={{ proximaCompra: null, proximoObjetivo: objetivo, proximaHabilidad: null, objetivos: [] }} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('30');
    expect(container.querySelector('.ov-icono.objetivo.larvas')).toBeTruthy();
  });

  it('sin datos muestra un guion', () => {
    render(<Panel panel={null} />);
    expect(screen.getAllByText(t('overlay.nada'))).toHaveLength(3);
    expect(screen.queryByRole('list', { name: 'Objetivos' })).toBeNull();
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
