import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avisos } from '../src/renderer/overlay/Avisos';
import { t } from '../src/shared/i18n';

/* 3.12: subtítulo del coach en el widget de avisos (lo que acaba de decir la voz). */
describe('subtítulo del coach', () => {
  it('enseña la etiqueta del coach y la frase, con su propio estilo', () => {
    render(<Avisos avisos={[{ id: 1, texto: 'Zed está muerto: empuja la oleada', coach: true }, { id: 2, texto: 'Nivel 6: sube la R', tipo: 'habilidad' }]} />);
    expect(screen.getByText(t('overlay.coach.etiqueta'))).toBeTruthy();
    const frase = screen.getByText('Zed está muerto: empuja la oleada');
    expect(frase.closest('.aviso')!.classList.contains('aviso-coach')).toBe(true);
    expect(screen.getByText('Nivel 6: sube la R').closest('.aviso')!.classList.contains('aviso-coach')).toBe(false);
  });
});
