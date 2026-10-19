// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VistaAyuda } from '../src/renderer/principal/vistas/VistaAyuda';
import { t } from '../src/shared/i18n';
import type { ApiCoach, MensajeAsistente } from '../src/shared/tiposApp';

function Envoltorio() {
  const [historial, setHistorial] = useState<MensajeAsistente[]>([]);
  return <VistaAyuda historial={historial} alCambiarHistorial={setHistorial} />;
}

beforeEach(() => {
  window.coach = { asistente: vi.fn().mockResolvedValue({ ok: true, respuesta: 'Pulsa «Importar» en la vista Campeón.' }) } as unknown as ApiCoach;
});
afterEach(cleanup);

describe('VistaAyuda', () => {
  it('envía la pregunta con el historial y muestra la respuesta', async () => {
    render(<Envoltorio />);
    expect(screen.getByText(t('ayuda.nota'))).toBeTruthy();
    await userEvent.type(screen.getByLabelText(t('ayuda.pregunta')), '¿Cómo importo la build?');
    await userEvent.click(screen.getByRole('button', { name: t('ayuda.enviar') }));
    expect(window.coach.asistente).toHaveBeenCalledWith([{ rol: 'usuario', texto: '¿Cómo importo la build?' }]);
    expect(await screen.findByText('Pulsa «Importar» en la vista Campeón.')).toBeTruthy();
    expect(screen.getByText('¿Cómo importo la build?')).toBeTruthy();
    // La segunda pregunta lleva el historial completo.
    await userEvent.type(screen.getByLabelText(t('ayuda.pregunta')), '¿Y las runas?');
    await userEvent.click(screen.getByRole('button', { name: t('ayuda.enviar') }));
    await waitFor(() => expect(window.coach.asistente).toHaveBeenCalledTimes(2));
    expect(vi.mocked(window.coach.asistente).mock.calls[1]![0]).toEqual([
      { rol: 'usuario', texto: '¿Cómo importo la build?' },
      { rol: 'asistente', texto: 'Pulsa «Importar» en la vista Campeón.' },
      { rol: 'usuario', texto: '¿Y las runas?' },
    ]);
  });

  it('muestra «Escribiendo…» mientras espera', async () => {
    let soltar!: (v: unknown) => void;
    vi.mocked(window.coach.asistente).mockReturnValue(new Promise((r) => (soltar = r)) as never);
    render(<Envoltorio />);
    await userEvent.type(screen.getByLabelText(t('ayuda.pregunta')), 'Hola');
    await userEvent.click(screen.getByRole('button', { name: t('ayuda.enviar') }));
    expect(screen.getByText(t('ayuda.escribiendo'))).toBeTruthy();
    soltar({ ok: true, respuesta: 'Hola, ¿en qué te ayudo?' });
    expect(await screen.findByText('Hola, ¿en qué te ayudo?')).toBeTruthy();
    expect(screen.queryByText(t('ayuda.escribiendo'))).toBeNull();
  });

  it.each(['no_configurado', 'limite', 'no_disponible', 'no_valido', 'sin_conexion'] as const)(
    'el error %s se muestra en español y la pregunta vuelve al campo',
    async (error) => {
      vi.mocked(window.coach.asistente).mockResolvedValue({ ok: false, error });
      render(<Envoltorio />);
      await userEvent.type(screen.getByLabelText(t('ayuda.pregunta')), 'Hola');
      await userEvent.click(screen.getByRole('button', { name: t('ayuda.enviar') }));
      expect((await screen.findByRole('alert')).textContent).toContain(t(`ayuda.error.${error}`));
      expect((screen.getByLabelText(t('ayuda.pregunta')) as HTMLTextAreaElement).value).toBe('Hola');
    },
  );

  it('un fallo del IPC cuenta como sin conexión', async () => {
    vi.mocked(window.coach.asistente).mockRejectedValue(new Error('No handler registered'));
    render(<Envoltorio />);
    await userEvent.type(screen.getByLabelText(t('ayuda.pregunta')), 'Hola');
    await userEvent.click(screen.getByRole('button', { name: t('ayuda.enviar') }));
    expect((await screen.findByRole('alert')).textContent).toContain(t('ayuda.error.sin_conexion'));
  });
});
