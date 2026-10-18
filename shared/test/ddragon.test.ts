import { describe, expect, it } from 'vitest';
import { parcheDeVersion, urlDatosDDragon } from '../src/ddragon';

describe('ddragon', () => {
  it('parcheDeVersion', () => expect(parcheDeVersion('15.20.1')).toBe('15.20'));
  it('urlDatosDDragon usa es_MX', () =>
    expect(urlDatosDDragon('15.20.1', 'item')).toBe('https://ddragon.leagueoflegends.com/cdn/15.20.1/data/es_MX/item.json'));
});
