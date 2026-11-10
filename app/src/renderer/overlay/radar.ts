import { useEffect, useRef } from 'react';
import { t } from '../../shared/i18n';
import { firmaPlantilla, LADO_ANALISIS, RadarJungla, type Plantilla } from '../../shared/radarMinimapa';
import type { PeligroGank, RadarMinimapa } from '../../shared/tiposApp';
import type { MarcoPx } from './posiciones';

/** Cada cuánto se analiza el minimapa (4 veces por segundo). */
const CADA_MS = 250;
const LADO_ICONO = 64;
const DURACION_MS = 6_000;

function cargarIcono(version: string, campeon: string): Promise<HTMLImageElement> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => mal(new Error(`icono de ${campeon}`));
    img.src = `https://ddragon.leagueoflegends.com/cdn/${encodeURIComponent(version)}/img/champion/${encodeURIComponent(campeon)}.png`;
  });
}

/** Firma de color de cada enemigo, a partir de su icono de Data Dragon. */
async function plantillas(radar: RadarMinimapa): Promise<Plantilla[]> {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = LADO_ICONO;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
  const salida: Plantilla[] = [];
  for (const campeon of radar.enemigos) {
    try {
      const img = await cargarIcono(radar.version, campeon);
      ctx.clearRect(0, 0, LADO_ICONO, LADO_ICONO);
      ctx.drawImage(img, 0, 0, LADO_ICONO, LADO_ICONO);
      salida.push({ campeon, firma: firmaPlantilla(ctx.getImageData(0, 0, LADO_ICONO, LADO_ICONO).data, LADO_ICONO) });
    } catch {
      // Sin su icono, ese enemigo no se puede distinguir: identificar() pide margen frente a los demás igualmente.
    }
  }
  return salida;
}

/**
 * 3.19: alerta de gank leyendo el minimapa (opción apagada por defecto). Con `radar` (lo manda main solo con la
 * opción encendida) captura la pantalla principal, recorta el minimapa 4 veces por segundo y enciende el borde rojo
 * cuando el jungla rival se ve cerca de tu calle. Solo píxeles que el jugador ya ve; nada se guarda ni se envía.
 * Mientras hay un borde rojo en pantalla no analiza (su resplandor rojo podría confundir la detección).
 */
export function useRadarMinimapa(radar: RadarMinimapa | null, marco: MarcoPx, hayBorde: boolean, alPeligro: (p: PeligroGank) => void): void {
  const marcoRef = useRef(marco);
  marcoRef.current = marco;
  const bordeRef = useRef(hayBorde);
  bordeRef.current = hayBorde;
  const alPeligroRef = useRef(alPeligro);
  alPeligroRef.current = alPeligro;
  const clave = radar ? JSON.stringify(radar) : '';

  useEffect(() => {
    if (!radar) return;
    let parado = false;
    let flujo: MediaStream | null = null;
    let intervalo: ReturnType<typeof setInterval> | null = null;
    void (async () => {
      try {
        const [lista, fuente] = await Promise.all([plantillas(radar), window.coachOverlay.fuenteRadar?.() ?? Promise.resolve(null)]);
        if (parado || !fuente || lista.length === 0) return;
        flujo = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: fuente, maxFrameRate: 5 } } as MediaTrackConstraints,
        });
        if (parado) return flujo.getTracks().forEach((p) => p.stop());
        const video = document.createElement('video');
        video.muted = true;
        video.srcObject = flujo;
        await video.play();
        const lienzo = document.createElement('canvas');
        lienzo.width = lienzo.height = LADO_ANALISIS;
        const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
        const detector = new RadarJungla(radar.jungla, radar.calle, lista);
        let id = 1;
        intervalo = setInterval(() => {
          if (bordeRef.current || video.readyState < 2 || !video.videoWidth) return;
          const escala = video.videoWidth / window.innerWidth;
          const m = marcoRef.current;
          ctx.drawImage(video, m.x * escala, m.y * escala, m.lado * escala, m.lado * escala, 0, 0, LADO_ANALISIS, LADO_ANALISIS);
          const datos = ctx.getImageData(0, 0, LADO_ANALISIS, LADO_ANALISIS).data;
          if (!detector.procesar(datos, LADO_ANALISIS, performance.now())) return;
          alPeligroRef.current({
            id: -id++,
            motivo: 'minimapa',
            etiqueta: t('peligroGank.etiqueta'),
            texto: t('peligroGank.minimapa'),
            duracionMs: DURACION_MS,
          });
        }, CADA_MS);
      } catch (e) {
        console.warn(`Alerta del minimapa no disponible: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => {
      parado = true;
      if (intervalo) clearInterval(intervalo);
      flujo?.getTracks().forEach((p) => p.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);
}
