// Herramienta de desarrollo: dibuja una tarjeta compartible de ejemplo en una página (para revisarla en un navegador).
import { establecerIdioma } from '../src/shared/i18n';
import { dibujarTarjeta, ANCHO_TARJETA, ALTO_TARJETA, cargarIcono } from '../src/renderer/principal/vistas/tarjetaCompartir';

establecerIdioma('es');
const lienzo = document.createElement('canvas');
lienzo.width = ANCHO_TARJETA;
lienzo.height = ALTO_TARJETA;
document.body.style.margin = '0';
document.body.appendChild(lienzo);
void cargarIcono('16.21.1', 'Jinx').then((icono) => {
  dibujarTarjeta(lienzo.getContext('2d')!, {
    campeon: 'Jinx',
    campeonDD: 'Jinx',
    victoria: true,
    subtitulo: 'Clasificatoria · Tirador · 28:41',
    nota: 78,
    notas: [
      { etiqueta: 'Combate', valor: 82 },
      { etiqueta: 'Farmeo', valor: 74 },
      { etiqueta: 'Visión', valor: 55 },
    ],
    kda: '6.3',
    kdaDetalle: '9/2/10',
    stats: [
      { etiqueta: 'CS/min', valor: '8.1' },
      { etiqueta: 'Participación', valor: '63 %' },
      { etiqueta: 'Daño del equipo', valor: '31 %' },
    ],
    etiquetas: ['MVP', 'Más daño', 'Más CS'],
    reto: 'Farmea bien · 3/5',
  }, icono);
  document.title = 'lista';
});
