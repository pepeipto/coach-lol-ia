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

describe('VistaAyuda: historial', () => {
  it('una respuesta larga del asistente seguida de otra pregunta sigue funcionando (se reenvía recortada a 8000)', async () => {
    const larga = 'y'.repeat(9000);
    vi.mocked(window.coach.asistente).mockResolvedValueOnce({ ok: true, respuesta: larga }).mockResolvedValueOnce({ ok: true, respuesta: 'Segunda' });
    render(<Envoltorio />);
    await userEvent.type(screen.getByLabelText(t('ayuda.pregunta')), 'Primera');
    await userEvent.click(screen.getByRole('button', { name: t('ayuda.enviar') }));
    await screen.findByText(larga);
    await userEvent.type(screen.getByLabelText(t('ayuda.pregunta')), 'Otra');
    await userEvent.click(screen.getByRole('button', { name: t('ayuda.enviar') }));
    expect(await screen.findByText('Segunda')).toBeTruthy();
    const enviados = vi.mocked(window.coach.asistente).mock.calls[1]![0];
    expect(enviados.map((m) => m.rol)).toEqual(['usuario', 'asistente', 'usuario']);
    expect(enviados[1]!.texto).toHaveLength(8000);
  });
});

describe('normalizarHistorial y paraEnviar', () => {
  const u = (texto: string) => ({ rol: 'usuario' as const, texto });
  const a = (texto: string) => ({ rol: 'asistente' as const, texto });
  it('alterna, quita la pregunta final sin respuesta, recorta a 8000 y deja como mucho 11 + la nueva', async () => {
    const { normalizarHistorial, paraEnviar } = await import('../src/shared/asistente');
    expect(normalizarHistorial([u('1'), a('2'), u('3')])).toEqual([u('1'), a('2')]);
    expect(normalizarHistorial([a('x'), u('1'), u('1b'), a('2'), a('2b')])).toEqual([u('1'), a('2')]);
    expect(normalizarHistorial([u('1'), a('y'.repeat(9000))])[1]!.texto).toHaveLength(8000);
    const largo = Array.from({ length: 30 }, (_, i) => (i % 2 === 0 ? u(String(i)) : a(String(i))));
    const m = paraEnviar(largo, 'nueva');
    expect(m.length).toBeLessThanOrEqual(12);
    expect(m[0]!.rol).toBe('usuario');
    expect(m.at(-1)).toEqual(u('nueva'));
    expect(paraEnviar([u('1'), a('2'), u('perdida')], 'otra')).toEqual([u('1'), a('2'), u('otra')]);
  });
});
