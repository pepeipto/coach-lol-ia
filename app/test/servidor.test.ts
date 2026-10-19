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

describe('app empaquetada', () => {
  it('ignora COACH_SERVIDOR y usa la URL fijada al compilar', () => {
    expect(urlServidor({ COACH_SERVIDOR: 'http://malo:1' }, 'https://compilada', true)).toBe('https://compilada');
    expect(urlServidor({ COACH_SERVIDOR: 'http://local:1' }, 'https://compilada', false)).toBe('http://local:1');
    expect(urlServidor({ COACH_SERVIDOR: 'http://malo:1' }, undefined, true)).toBe('http://localhost:8080');
  });
});
