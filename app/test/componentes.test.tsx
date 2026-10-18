// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Aviso, Boton, Esqueleto, Insignia, Interruptor, Pestanas, Tarjeta } from '../src/renderer/comun/componentes';
import { IconoDDragon } from '../src/renderer/comun/IconoDDragon';

afterEach(cleanup);

describe('Interruptor', () => {
  it('expone role="switch" con aria-checked y llama a alCambiar(true) al hacer clic', async () => {
    const alCambiar = vi.fn();
    render(<Interruptor marcado={false} alCambiar={alCambiar} etiqueta="Voz" />);
    const sw = screen.getByRole('switch', { name: 'Voz' });
    expect(sw.getAttribute('aria-checked')).toBe('false');
    await userEvent.click(sw);
    expect(alCambiar).toHaveBeenCalledWith(true);
  });

  it('marcado llama a alCambiar(false)', async () => {
    const alCambiar = vi.fn();
    render(<Interruptor marcado alCambiar={alCambiar} etiqueta="Voz" />);
    const sw = screen.getByRole('switch', { name: 'Voz' });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    await userEvent.click(sw);
    expect(alCambiar).toHaveBeenCalledWith(false);
  });
});

describe('Pestanas', () => {
  it('marca la activa con aria-selected y avisa del cambio', async () => {
    const alCambiar = vi.fn();
    render(
      <Pestanas
        opciones={[
          { id: 'a', texto: 'Uno' },
          { id: 'b', texto: 'Dos' },
        ]}
        activa="b"
        alCambiar={alCambiar}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Dos' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Uno' }).getAttribute('aria-selected')).toBe('false');
    await userEvent.click(screen.getByRole('tab', { name: 'Uno' }));
    expect(alCambiar).toHaveBeenCalledWith('a');
  });
});

describe('IconoDDragon', () => {
  it('construye la URL del objeto y pone el nombre en title', () => {
    render(<IconoDDragon tipo="objeto" id={3157} version="16.20.1" nombre="Reloj de arena de Zhonya" />);
    const img = screen.getByRole('img', { name: 'Reloj de arena de Zhonya' });
    expect(img.getAttribute('src')).toBe('https://ddragon.leagueoflegends.com/cdn/16.20.1/img/item/3157.png');
    expect(img.getAttribute('title')).toBe('Reloj de arena de Zhonya');
  });

  it('construye las URLs de campeón, hechizo y runa', () => {
    render(
      <>
        <IconoDDragon tipo="campeon" id="Ahri" version="16.20.1" nombre="Ahri" />
        <IconoDDragon tipo="hechizo" id={4} version="16.20.1" nombre="Destello" imagen="SummonerFlash.png" />
        <IconoDDragon tipo="runa" id={8100} version="16.20.1" nombre="Dominación" imagen="perk-images/Styles/7200_Domination.png" />
      </>,
    );
    expect(screen.getByRole('img', { name: 'Ahri' }).getAttribute('src')).toBe(
      'https://ddragon.leagueoflegends.com/cdn/16.20.1/img/champion/Ahri.png',
    );
    expect(screen.getByRole('img', { name: 'Destello' }).getAttribute('src')).toBe(
      'https://ddragon.leagueoflegends.com/cdn/16.20.1/img/spell/SummonerFlash.png',
    );
    expect(screen.getByRole('img', { name: 'Dominación' }).getAttribute('src')).toBe(
      'https://ddragon.leagueoflegends.com/cdn/img/perk-images/Styles/7200_Domination.png',
    );
  });

  it('con id 0 o sin imagen deja un hueco del mismo tamaño', () => {
    const { container } = render(
      <>
        <IconoDDragon tipo="objeto" id={0} version="16.20.1" nombre="Nada" tamano={40} />
        <IconoDDragon tipo="runa" id={5008} version="16.20.1" nombre="Fragmento" tamano={40} />
      </>,
    );
    expect(screen.queryAllByRole('img')).toHaveLength(0);
    const huecos = container.querySelectorAll('.icono-dd.hueco');
    expect(huecos).toHaveLength(2);
    expect((huecos[0] as HTMLElement).style.width).toBe('40px');
    expect((huecos[1] as HTMLElement).getAttribute('title')).toBe('Fragmento');
  });
});

describe('otros componentes', () => {
  it('Boton aplica la variante y Tarjeta muestra el título', () => {
    render(
      <Tarjeta titulo="Runas">
        <Boton variante="fantasma">Hola</Boton>
      </Tarjeta>,
    );
    expect(screen.getByRole('heading', { name: 'Runas' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hola' }).className).toContain('boton-fantasma');
  });

  it('Insignia, Esqueleto y Aviso se pintan', () => {
    const { container } = render(
      <>
        <Insignia tono="exito">52 %</Insignia>
        <Esqueleto ancho={120} alto={16} />
        <Aviso tono="aviso">Cuidado</Aviso>
      </>,
    );
    expect(screen.getByText('52 %').className).toContain('insignia-exito');
    expect(container.querySelector('.esqueleto')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Cuidado');
  });
});
