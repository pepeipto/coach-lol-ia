import es from './i18n/es.json';

const textos: Record<string, string> = es;

/** Devuelve el texto en español de `clave`, interpolando `{param}`. Si no existe, devuelve la clave. */
export function t(clave: string, params?: Record<string, string | number>): string {
  const texto = textos[clave];
  if (texto === undefined) return clave;
  if (!params) return texto;
  return texto.replace(/\{(\w+)\}/g, (coincidencia, nombre: string) =>
    nombre in params ? String(params[nombre]) : coincidencia,
  );
}
