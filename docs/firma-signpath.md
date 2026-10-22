# Firma del instalador con SignPath Foundation (gratis para código abierto)

Objetivo: que Windows deje de mostrar «Editor desconocido» al instalar Coach LoL IA. El editor que aparecerá será
**SignPath Foundation**.

## Lo que ya está hecho en el repositorio

- Licencia [MIT](../LICENSE) para todo el código.
- [Política de firma](../CODE_SIGNING.md), que SignPath pide publicar.
- El instalador muestra, antes de instalar, qué datos se envían y cómo desactivarlos (`app/build/license_*.txt`, en 5 idiomas).
- [Workflow Release](../.github/workflows/release.yml): compila en GitHub Actions desde la etiqueta, firma con SignPath
  si está configurado y publica un borrador en GitHub Releases con `latest.yml` y `SHA256SUMS.txt`.

## Lo que tienes que hacer tú (en este orden)

1. **Verificación en dos pasos en GitHub** (obligatoria para SignPath): github.com → Settings → Password and
   authentication → Two-factor authentication.
2. **Enviar la solicitud** en https://signpath.org/apply con los datos de la sección siguiente.
3. **Cuando te aprueben**, SignPath te crea una organización. En ella:
   - Proyecto con el slug `coach-lol-ia`, enlazado al repositorio `pepeipto/coach-lol-ia` (Trusted Build System: GitHub).
   - Configuración de artefacto: el artefacto es un `.zip` que contiene un único `.exe` (así sube GitHub los
     artefactos); dentro, firmar con Authenticode el `Coach-LoL-IA-Setup-*.exe`.
   - Política de firma con el slug `release-signing` y aprobación manual (tú como Approver).
   - Un usuario de CI con permiso para enviar solicitudes; copia su **API token**.
4. **En GitHub** (repositorio → Settings → Secrets and variables → Actions):
   - Variable `SIGNPATH_ORGANIZATION_ID` = el id de tu organización de SignPath.
   - Secreto `SIGNPATH_API_TOKEN` = el token del usuario de CI.
5. **Para publicar una versión**: sube la versión en `app/package.json`, haz commit, crea la etiqueta y súbela:
   `git tag -a v3.7.0 -m "Coach LoL IA 3.7.0"` y `git push origin main v3.7.0`. El workflow compila; tú apruebas la
   firma en SignPath; el workflow publica el borrador; revisas y pulsas «Publish release».

Mientras SignPath no apruebe, el mismo workflow publica el instalador sin firmar con su SHA-256, para que cualquiera
pueda comprobar que la descarga es la buena.

## Datos para la solicitud (signpath.org/apply)

- **Project name:** Coach LoL IA
- **Repository:** https://github.com/pepeipto/coach-lol-ia
- **Homepage / download page:** https://www.coachlolia.com/descargar
- **License:** MIT (OSI-approved), all components. No commercial dual licensing. Third-party runtime dependencies
  (Electron, React, ONNX Runtime, etc.) are open source.
- **Build:** GitHub Actions, `.github/workflows/release.yml`, from the source code of each tag. Signing is requested
  only from that workflow.
- **What to sign:** the NSIS installer `Coach-LoL-IA-Setup-<version>.exe` (Windows x64).
- **Maintainer:** Carlos Fernandez Medina (@pepeipto), support@coachlolia.com. MFA enabled on GitHub and SignPath.
- **Description (en inglés, para el formulario):**

  > Coach LoL IA is a free, open-source companion app for League of Legends (Windows). It imports the most popular
  > runes, summoner spells and item builds into the League client, shows an in-game overlay (objective timers,
  > next ability to level, CS/KDA, item gold vs. lane opponent), gives optional voice coaching, and offers an
  > optional AI post-game analysis and personal coach. It only uses Riot's official APIs (the local League Client
  > API and the Live Client Data API on 127.0.0.1); it never reads or modifies game memory and is not a cheat. It
  > is my end-of-course project as a developer student and is already released (v3.6.0) on GitHub Releases and at
  > coachlolia.com, in 5 languages. Privacy: the data sent to our server and how to disable each feature is shown
  > during installation and in the privacy policy (https://www.coachlolia.com/privacidad). It is registered with
  > Riot Games' developer portal (production application under review).

- **Reputación** (SignPath pide «cierta reputación verificable»): web propia en 5 idiomas, 30+ versiones publicadas en
  GitHub Releases, 1500+ pruebas automáticas y CI público. Si piden más, sube estrellas o menciones (Reddit, TikTok)
  y vuelve a escribirles.

## Si SignPath no lo aprueba

Alternativa de pago: un certificado OV de una autoridad de certificación (unos 200-400 € al año, con token físico).
Se añadiría al workflow en lugar del paso de SignPath.
