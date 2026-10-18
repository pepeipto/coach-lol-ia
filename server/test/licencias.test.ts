import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { abrirDb, type Db } from '../src/db';
import { crearRepoLicencias, generarClave, type RepoLicencias } from '../src/premium/licencias';

describe('licencias', () => {
  let db: Db;
  let repo: RepoLicencias;
  beforeEach(() => {
    db = abrirDb(':memory:');
    repo = crearRepoLicencias(db);
  });
  afterEach(() => db.cerrar());

  const datos = { checkoutSession: 'cs_1', stripeCustomer: 'cus_1', stripeSubscription: 'sub_1', renuevaEn: '2026-11-18T00:00:00.000Z' };

  it('generarClave cumple el formato CLIA-XXXX-XXXX-XXXX-XXXX', () => {
    for (let i = 0; i < 50; i++) expect(generarClave()).toMatch(/^CLIA(-[A-HJ-NP-Z2-9]{4}){4}$/);
  });

  it('crearSiNoExiste es idempotente por sesión', () => {
    const a = repo.crearSiNoExiste(datos);
    const b = repo.crearSiNoExiste(datos);
    expect(b.clave).toBe(a.clave);
    expect(a.estado).toBe('activa');
    expect(repo.porSesion('cs_1')?.clave).toBe(a.clave);
    expect(repo.porClave(a.clave)?.stripeCustomer).toBe('cus_1');
    expect(repo.porSuscripcion('sub_1')?.clave).toBe(a.clave);
  });

  it('devuelve null para lo desconocido', () => {
    expect(repo.porSesion('x')).toBeNull();
    expect(repo.porClave('x')).toBeNull();
    expect(repo.porSuscripcion('x')).toBeNull();
  });

  it('actualizarPorSuscripcion cambia el estado y la renovación', () => {
    const l = repo.crearSiNoExiste(datos);
    const act = repo.actualizarPorSuscripcion('sub_1', { estado: 'cancelada', renuevaEn: null });
    expect(act?.estado).toBe('cancelada');
    expect(act?.renuevaEn).toBeNull();
    expect(repo.porClave(l.clave)?.estado).toBe('cancelada');
    expect(repo.actualizarPorSuscripcion('nada', { estado: 'impagada' })).toBeNull();
  });
});
