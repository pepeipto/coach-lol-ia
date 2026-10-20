import { idiomaActual, t } from '../../shared/i18n';
import { AVISO_LEGAL_RIOT } from '../../shared/legal';

/**
 * Aviso legal de Riot en el idioma de la app y, si no es inglés, también el texto oficial en inglés (Riot no publica
 * traducciones oficiales). `Etiqueta` es el elemento de cada línea (`small` en el pie, `p` en Ajustes).
 */
export function AvisoLegal({ Etiqueta = 'small' }: { Etiqueta?: 'small' | 'p' }) {
  const ingles = idiomaActual() === 'en';
  return (
    <>
      <Etiqueta>{ingles ? AVISO_LEGAL_RIOT : t('legal.aviso')}</Etiqueta>
      {!ingles && (
        <Etiqueta lang="en" className="aviso-legal-oficial">
          {AVISO_LEGAL_RIOT}
        </Etiqueta>
      )}
    </>
  );
}

export function PieLegal() {
  return (
    <footer className="pie-legal">
      <AvisoLegal />
    </footer>
  );
}
