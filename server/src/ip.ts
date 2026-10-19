import { isIPv4, isIPv6 } from 'node:net';

/**
 * Clave de una IP para los límites (pruebas, premium y asistente): una IPv4 mapeada en IPv6
 * (`::ffff:a.b.c.d`) cuenta como la IPv4, y una IPv6 se agrupa por su prefijo /64, que es lo que
 * suele tener un mismo cliente (así no basta con cambiar de dirección dentro de su red).
 */
export function claveIp(ip: string): string {
  const limpia = ip.trim();
  const mapeada = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(limpia);
  if (mapeada && isIPv4(mapeada[1]!)) return mapeada[1]!;
  if (!isIPv6(limpia)) return limpia;
  const [izquierda, derecha] = limpia.toLowerCase().split('::') as [string, string | undefined];
  const grupos = (t: string) => (t ? t.split(':') : []);
  const ini = grupos(izquierda);
  const fin = derecha === undefined ? [] : grupos(derecha);
  const completos = derecha === undefined ? ini : [...ini, ...Array(8 - ini.length - fin.length).fill('0'), ...fin];
  return `${completos.slice(0, 4).map((g) => String(parseInt(g, 16).toString(16))).join(':')}::/64`;
}
