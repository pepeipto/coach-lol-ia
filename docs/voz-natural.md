# Voz de Coach LoL IA (3.1)

La app tiene tres voces, que se eligen en **Overlay → Voz → Tipo de voz**:

| Tipo | Qué es | Sin conexión | Coste para el usuario |
|---|---|---|---|
| **Voz Coach LoL IA (pregrabada)**, por defecto | Clips generados **una vez** con ElevenLabs (voz «Dan Dan», `9F4C8ztpNUmXkdDDbz3J`, plan Creator con licencia comercial) y distribuidos como audio | Sí | Ninguno |
| **Natural (neuronal)** | Supertonic 3 (Supertone Inc.) sobre ONNX Runtime, en un proceso aparte de prioridad baja | Sí | Ninguno |
| **Windows** | Las voces SAPI / Web Speech del sistema | Sí | Ninguno |

Reglas de reserva: una frase suena con la pregrabada solo si **todos** sus segmentos están en el paquete del
idioma; si falta uno, la frase **entera** sale con la natural (nunca se mezclan dos voces en una frase). Lo que no
esté descargado, falle o tarde más de 4 s sale con la de Windows, sin avisar. La app nunca se conecta a
ElevenLabs.

Nada de esto va en el instalador: la app descarga el modelo neuronal (124 MB, vale para los 5 idiomas) y el
paquete pregrabado del idioma la primera vez que se enciende la voz (o con «Descargar voz»), comprueba su
SHA-256, reanuda si se corta y lo guarda en `userData/voz-natural`.

## Dónde se alojan los paquetes

En la release **`voces-v1`** de `pepeipto/coach-lol-ia` (una release aparte, que no es la de la app y no cambia
con cada versión):

- `voz-supertonic3-int8-v1.tar.gz`: el modelo neuronal. Su tamaño y su SHA-256 están fijados en
  `app/src/main/voz/catalogo.ts`.
- `voz-pack-<idioma>-<suma>.tar.gz`: la voz pregrabada de cada idioma. Su entrada (archivo, tamaño y SHA-256)
  está en `app/src/main/voz/packs.json`, que escribe el generador. Un idioma sin entrada no tiene voz pregrabada.

`COACH_VOCES_URL` cambia la base de las descargas (pruebas y espejos).

### Subir el modelo neuronal (una vez)

1. Descarga `sherpa-onnx-supertonic-3-tts-int8-2026-05-11.tar.bz2` de la release `tts-models` de
   k2-fsa/sherpa-onnx y descomprímelo.
2. Descarga de `huggingface.co/Supertone/supertonic-3` las carpetas `onnx/` (solo `tts.json` y
   `unicode_indexer.json`) y `voice_styles/`, y el `LICENSE`.
3. `npm run voz:empaquetar -w app -- --int8 <carpeta 1> --oficial <carpeta 2> --salida voz-paquetes`
   (imprime tamaño y SHA-256; si cambian, actualiza `PAQUETE_SUPERTONIC`).
4. `gh release create voces-v1 --repo pepeipto/coach-lol-ia --title "Voces" --notes "Paquetes de voz de Coach LoL IA"`
   (solo la primera vez) y `gh release upload voces-v1 voz-paquetes/voz-supertonic3-int8-v1.tar.gz --repo pepeipto/coach-lol-ia --clobber`.

El paquete de la 3.1 ya está generado en `E:\coach-lol-ia-wt\v31-voz-paquetes\voz-supertonic3-int8-v1.tar.gz`
(124 033 960 bytes, SHA-256 `786db3c49b93f02f294a8827c2c310eadcd277a0625fc2b5ea3fc7fdfdf74b8c`).

### Generar la voz pregrabada (ElevenLabs)

Lo ejecuta el dueño con su cuenta: doble clic en **`Generar voz ElevenLabs.bat`** (raíz del repo) o

```
npx tsx app/tools/generar-voz-pack.ts --env E:\jarvis\.env --max-creditos 20000 --yes
```

- Del `.env` solo se lee la línea `ELEVENLABS_API_KEY`; la clave no se imprime ni se guarda en el repo.
- Voz por defecto: «Dan Dan» (`9F4C8ztpNUmXkdDDbz3J`); `--voz <id>` la cambia.
- Antes de gastar nada: `GET /v1/voices/{id}` (categoría y restricciones; para si una voz de la biblioteca no
  permite uso comercial o redistribución), `GET /v1/user/subscription` (créditos que quedan) y `GET /v1/models`
  (créditos por carácter; si no lo da, 0,5 para Flash v2.5 y 1 para Multilingual v2, como estimación). Muestra
  segmentos, caracteres y créditos y pide confirmación (`--yes` / `--si` la salta; `--dry-run` / `--seco` se para ahí).
- Los segmentos salen en ese momento de los textos i18n (`voz.*`, `fase.*`, `junglaEnemiga.*`) y de Data Dragon
  (campeones y objetos del idioma): plantillas sin huecos enteras, plantillas de un hueco con ≤ 12 valores
  expandidas enteras, y el resto en partes fijas + valores (números 0-60, calles, campeones, objetos).
- Presupuesto: `--max-creditos N` (por defecto, lo que queda menos un 5 %). Genera por prioridad (1 frases fijas
  frecuentes, 2 resto de fijas, 3 números y calles, 4 campeones, 5 objetos) hasta el presupuesto; otra ejecución
  completa lo pendiente sin repetir. Un paquete parcial es seguro (ver la regla de reserva).
- `--idiomas es,en,pt-BR,fr,de` (por defecto solo `es`); `--modelo eleven_multilingual_v2` para más calidad.
- Reintenta los 429; normaliza el volumen con ffmpeg (loudnorm, `FFMPEG` cambia la ruta).
- Al final escribe `voz-pack/<idioma>/` (clips y `manifest.json`), empaqueta `voz-pack-<idioma>-<suma>.tar.gz`,
  actualiza `app/src/main/voz/packs.json` e imprime el `gh release upload` de cada paquete. Haz commit de
  `packs.json` antes de compilar la versión.

Estimación con las frases de la 3.1 (Data Dragon 16.20.1): español ≈ 36 900 caracteres (≈ 18 400 créditos con
Flash v2.5); los cinco idiomas ≈ 185 700 caracteres (≈ 92 800 créditos).

## Licencias y créditos

- **Supertonic 3** (Supertone Inc.): pesos bajo **BigScience OpenRAIL-M** (redistribuible, con restricciones de uso
  que se transmiten: el paquete lleva el `LICENSE` y un `LEEME.txt`); código de referencia MIT. Versión int8 de
  sherpa-onnx (k2-fsa, Apache-2.0), sin otros cambios.
- **ONNX Runtime** (Microsoft): MIT. Solo se incluye el binario de Windows x64 (sin DirectML).
- **Voz pregrabada**: generada con ElevenLabs en un plan con licencia comercial; se distribuye como audio.
- Descartados: Piper y Kokoro (dependen de eSpeak NG, GPL-3.0, enlazado en los binarios de sherpa-onnx; además
  Kokoro tarda ~1,7 s por frase), voces Piper con licencias NC/ND (miro, dii, hfc, ryan) y endpoints no oficiales
  (edge-tts).

Los créditos también están en la vista **Ayuda** de la app.
