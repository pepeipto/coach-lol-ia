export const URL_VERSIONES = 'https://ddragon.leagueoflegends.com/api/versions.json';

export function urlDatosDDragon(
  version: string,
  archivo: 'champion' | 'item' | 'runesReforged' | 'summoner',
  idioma = 'es_MX',
): string {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/data/${idioma}/${archivo}.json`;
}

export function parcheDeVersion(version: string): string {
  return version.split('.').slice(0, 2).join('.');
}
