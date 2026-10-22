# Código abierto (MIT) y firma del instalador con SignPath

Este documento recoge por qué Coach LoL IA pasa a licencia MIT, qué se revisó antes, qué se decidió con el código Premium y cómo se configura la firma gratuita del instalador con [SignPath Foundation](https://signpath.org/).

## 1. Qué implica abrir el código

El repositorio ya era público, pero **sin licencia**: legalmente, nadie podía copiar, modificar ni redistribuir el código. Con el archivo `LICENSE` (MIT):

- **Cualquiera puede usar, copiar, modificar, redistribuir y hasta vender** el código o versiones derivadas, con una única condición: conservar el aviso de copyright y la licencia.
- **No hay garantía**: el software se ofrece «tal cual» y el autor no responde de daños.
- **Lo que NO se abre:** el nombre y la marca «Coach LoL IA», el dominio `coachlolia.com`, el servidor desplegado en Fly.io y su base de datos, y todas las claves (Riot, Anthropic, Stripe, ElevenLabs, Fly). Un fork tendría que montar su propio servidor y pedir su propia clave de Riot.
- **No se puede «des-abrir»:** quien descargue el código bajo MIT lo conserva con esa licencia para siempre, aunque más adelante se cambie la licencia de versiones nuevas.
- **Contribuciones:** quien envíe un PR lo aporta bajo MIT (es lo habitual en GitHub, «inbound = outbound»).
- **Riot:** las políticas de Riot no impiden publicar el código. La clave de la API nunca está en el repositorio ni en la app, solo en el servidor.
- **Terceros:** Electron, React, ONNX Runtime, sherpa-onnx, etc. tienen licencias MIT/Apache compatibles. El modelo de voz Supertonic 3 (BigScience OpenRAIL-M) **no va en el instalador**: la app lo descarga de la release `voces-v1`, así que no forma parte del binario firmado ni del código MIT.

## 2. Revisión de claves (antes de abrir)

Hecha el 22/10/2026 sobre **todas las ramas y etiquetas** (310 commits):

- [gitleaks](https://github.com/gitleaks/gitleaks) 8.21 sobre el historial completo y sobre los archivos actuales: **sin hallazgos**.
- Búsqueda manual de prefijos de claves (`RGAPI-`, `sk_live_`/`sk_test_`, `whsec_`, `sk-ant-`, `AIza`, `ghp_`, `FlyV1`, claves `CLIA-…`): solo aparecen **valores de ejemplo de las pruebas** (`RGAPI-00000000-…`, `CLIA-AAAA-BBBB-CCCC-DDDD`, `ca-pub-123`…).
- `server/.env.example` siempre ha tenido las variables vacías. `.env`, `*.db` y `.clave-riot` están en `.gitignore` y nunca se han subido.
- `web/public/riot.txt` contiene la cadena de verificación del sitio que da Riot; es pública por diseño (se sirve en `https://www.coachlolia.com/riot.txt`) y no es una credencial.
- A tener en cuenta: los commits llevan el correo personal del autor. Ya era visible porque el repositorio es público; si se quiere ocultar en adelante, activa *Keep my email addresses private* en GitHub y usa el correo `@users.noreply.github.com`.

## 3. Decisión sobre el código Premium

El código de Premium (licencias, pruebas gratuitas y Stripe) vive en:

- servidor: `server/src/premium/`, `server/src/herramientas/crear-licencia.ts`;
- web: `web/src/premium/`, `web/src/scripts/premium.ts`;
- app: `app/src/main/licencia.ts`, `app/src/renderer/principal/licencia.ts` y las vistas `Licencia.tsx`, `BannerPremium.tsx`, `VistaPremium.tsx`.

Está **apagado** (`PREMIUM_HABILITADO = false` en la app y la web; sin `PREMIUM_HABILITADO=1` el servidor no registra sus rutas) porque las políticas de Riot no permiten cobrar.

**Moverlo a un módulo o servidor privado no es una opción:** las condiciones de SignPath Foundation exigen una licencia OSI «sin doble licencia comercial para ningún componente» y que el proyecto «no contenga ningún componente propietario, no abierto». Un trozo privado haría que el proyecto dejara de cumplirlas.

**Tampoco hay nada que ocultar por seguridad:** el código no contiene secretos (las claves de Stripe solo existen como variables de entorno en Fly.io) y la validez de una licencia la decide siempre el servidor, no la app.

Por tanto, en este cambio el código Premium **se queda en el repositorio, bajo MIT y apagado**. Queda pendiente decidir si se elimina por completo antes de pedir la firma: es código muerto que va dentro del instalador y puede generar dudas en la revisión de SignPath (y Riot ya lo prohíbe). Si se elimina, se puede recuperar desde la etiqueta `v3.6.0`.

## 4. Configurar SignPath (una sola vez)

1. **Solicitar el programa gratuito:** rellena el formulario de [signpath.org](https://signpath.org/) (*Apply*) con el repositorio `pepeipto/coach-lol-ia`, la licencia MIT y la descripción de la app. SignPath revisa el proyecto a mano.
2. **Requisitos que comprueban** (resumen de [signpath.org/terms](https://signpath.org/terms)):
   - licencia OSI para todo el proyecto (✅ MIT) y ningún componente propietario;
   - el proyecto ya publicado y mantenido (✅ releases en GitHub);
   - **MFA** en GitHub y en SignPath para todos los miembros del equipo;
   - una **política de firma de código** en la página principal del proyecto (✅ sección *Code signing policy* del README; conviene enlazarla también desde www.coachlolia.com);
   - una **política de privacidad** si la app envía datos (`www.coachlolia.com/privacidad`, enlazada desde la política de firma). ⚠️ Aún tiene huecos sin rellenar (*[nombre o razón social]*, NIF, domicilio, proveedor del servidor y plazo de los registros): conviene completarlos antes de enviar la solicitud;
   - los binarios se compilan desde el código del repositorio de forma verificable (✅ workflow `release.yml`) y cada firma se **aprueba a mano**;
   - el instalador permite desinstalar (✅ NSIS crea el desinstalador).
3. **En SignPath, cuando aprueben la solicitud:**
   - En la organización, añade el *Trusted Build System* predefinido **GitHub.com** y vincúlalo al proyecto.
   - Instala la **SignPath GitHub App** en el repositorio (necesaria para la verificación de origen).
   - Crea el proyecto con slug `coach-lol-ia` (u otro, y lo pones en la variable de abajo).
   - Crea la *artifact configuration* pegando [`.github/signpath/artifact-configuration.xml`](../.github/signpath/artifact-configuration.xml) (slug `initial` o el que pongas en la variable).
   - Crea la *signing policy* `release-signing` con el certificado de SignPath Foundation y con aprobación manual (tú como Approver).
   - Crea un usuario de CI (o usa el tuyo) con rol de **Submitter** en esa política y genera su **API token**.
4. **En GitHub** (*Settings → Secrets and variables → Actions*):

   | Tipo | Nombre | Valor |
   |---|---|---|
   | Secreto | `SIGNPATH_API_TOKEN` | El API token del paso anterior. |
   | Variable | `SIGNPATH_ORGANIZATION_ID` | El id de la organización (sale en la URL de SignPath). |
   | Variable (opcional) | `SIGNPATH_PROJECT_SLUG` | Por defecto `coach-lol-ia`. |
   | Variable (opcional) | `SIGNPATH_SIGNING_POLICY_SLUG` | Por defecto `release-signing`. |
   | Variable (opcional) | `SIGNPATH_ARTIFACT_CONFIGURATION_SLUG` | Por defecto `initial`. |
   | Variable (opcional) | `COACH_SERVIDOR` | Por defecto `https://api.coachlolia.com`. |

## 5. Publicar una versión firmada

1. Sube la versión en `app/package.json` (y el `CHANGELOG.md`) y haz merge a `main`.
2. Crea y sube la etiqueta: `git tag v3.7.0 && git push origin v3.7.0`.
3. El workflow **Release** compila el instalador en Windows, pasa las pruebas y manda el `.exe` a SignPath.
4. **Aprueba la firma en SignPath** (te llega un correo). El workflow espera hasta 3 h.
5. El workflow comprueba la firma, rehace `latest.yml` y el `.blockmap` (la firma cambia el SHA-512 del `.exe`) y crea un **borrador** de release con los tres archivos.
6. Escribe las novedades en el borrador y pulsa *Publish release*. Desde ese momento las apps instaladas se actualizan solas.

Ya no hace falta publicar desde el equipo con `electron-builder --publish`: si se hace, la release ya existiría y el workflow fallaría al crear el borrador.

Notas:

- Solo se firma el instalador (`Coach LoL IA Setup X.exe`), que es lo que mira SmartScreen al descargar. El `.exe` de la app dentro del instalador y el desinstalador siguen sin firmar; firmarlos exigiría dos firmas (y dos aprobaciones) por versión.
- `win.publisherName` no está configurado a propósito: así electron-updater no exige que la actualización esté firmada, y las versiones antiguas sin firma pueden actualizarse a las firmadas.
- El certificado de SignPath Foundation empieza sin reputación en SmartScreen; el aviso desaparece a medida que más gente descarga versiones firmadas.
