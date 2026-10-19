import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { AJUSTES_POR_DEFECTO, cargarAjustes, conservarPosicion, guardarAjustes } from '../src/main/ajustes';

const dir = () => mkdtempSync(join(tmpdir(), 'coach-ajustes-'));

describe('ajustes', () => {
  it('valores por defecto', () => {
    expect(AJUSTES_POR_DEFECTO.avisos).toEqual({ compra: true, habilidad: true, objetivo: true, vision: true, fase: true });
    expect(AJUSTES_POR_DEFECTO.voz).toBe(false);
    expect(AJUSTES_POR_DEFECTO.importacionAutomatica).toBe(false);
    expect(AJUSTES_POR_DEFECTO.teclaOverlay).toBe('CommandOrControl+Shift+O');
    expect(AJUSTES_POR_DEFECTO.posicionOverlay).toBeNull();
  });
  it('archivo ausente → por defecto', () => {
    expect(cargarAjustes(join(dir(), 'no.json'))).toEqual(AJUSTES_POR_DEFECTO);
  });
  it('JSON roto → por defecto', () => {
    const r = join(dir(), 'a.json');
    writeFileSync(r, '{ roto');
    expect(cargarAjustes(r)).toEqual(AJUSTES_POR_DEFECTO);
  });
  it('JSON parcial → mezcla con los defectos', () => {
    const r = join(dir(), 'a.json');
    writeFileSync(r, JSON.stringify({ voz: true, avisos: { compra: false } }));
    expect(cargarAjustes(r)).toEqual({
      ...AJUSTES_POR_DEFECTO,
      bienvenidaVista: true, // archivo antiguo sin el campo: usuario veterano
      voz: true,
      avisos: { ...AJUSTES_POR_DEFECTO.avisos, compra: false },
    });
  });
  it('guardar y cargar', () => {
    const r = join(dir(), 'sub', 'a.json');
    const a = { ...AJUSTES_POR_DEFECTO, importacionAutomatica: true, posicionOverlay: { x: 3, y: 4 } };
    guardarAjustes(r, a);
    expect(JSON.parse(readFileSync(r, 'utf8'))).toEqual(a);
    expect(cargarAjustes(r)).toEqual(a);
  });

  it('la URL del servidor ya no es un ajuste: un ajustes.json antiguo con urlServidor se ignora', () => {
    const r = join(dir(), 'a.json');
    writeFileSync(r, JSON.stringify({ urlServidor: 'http://localhost:8080', voz: true }));
    const a = cargarAjustes(r);
    expect(a).not.toHaveProperty('urlServidor');
    expect(a.voz).toBe(true);
    expect(AJUSTES_POR_DEFECTO).not.toHaveProperty('urlServidor');
  });

  it('conservarPosicion ignora la posición de los ajustes que llegan de la ventana', () => {
    const guardados = { ...AJUSTES_POR_DEFECTO, posicionOverlay: { x: 300, y: 40 } };
    const obsoletos = { ...AJUSTES_POR_DEFECTO, voz: true, posicionOverlay: null };
    expect(conservarPosicion(obsoletos, guardados)).toEqual({ ...obsoletos, posicionOverlay: { x: 300, y: 40 } });
  });
});
