import { describe, expect, it } from 'vitest';
import { urlServidor } from '../src/main/servidor';

describe('urlServidor', () => {
  it('COACH_SERVIDOR en tiempo de ejecución tiene prioridad sobre la URL compilada', () => {
    expect(urlServidor({ COACH_SERVIDOR: 'http://local:1' }, 'https://compilada')).toBe('http://local:1');
  });
  it('sin variable de entorno usa la URL compilada', () => {
    expect(urlServidor({}, 'https://compilada')).toBe('https://compilada');
  });
  it('sin nada usa localhost', () => {
    expect(urlServidor({}, '')).toBe('http://localhost:8080');
    expect(urlServidor({ COACH_SERVIDOR: '' }, undefined)).toBe('http://localhost:8080');
  });
});
