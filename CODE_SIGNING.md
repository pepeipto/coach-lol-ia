# Code signing policy / Política de firma de código

**English**

- **Certificate:** Microsoft Artifact Signing (Public Trust), issued to ESTRADA GLOBAL GESTION, S.L., the company behind Coach LoL IA.
- **What is signed:** the Windows app (`Coach LoL IA.exe`), its uninstaller and its installer (`Coach-LoL-IA-Setup-<version>.exe`) published in [GitHub Releases](https://github.com/pepeipto/coach-lol-ia/releases).
- **How it is built:** every release is built from the source code of its git tag by the [Release workflow](.github/workflows/release.yml) on GitHub Actions. Signing only happens inside that workflow, which logs in to Azure with OpenID Connect (no stored passwords). Nothing built on a personal computer is signed.
- **Team:** [Carlos Fernandez Medina (@pepeipto)](https://github.com/pepeipto) writes, reviews and releases the code. All accounts use multi-factor authentication.
- **Privacy:** the data the app sends, and how to turn each feature off, is described in the [privacy policy](https://www.coachlolia.com/privacidad) and shown during installation.
- **Uninstall:** Windows Settings → Apps → Coach LoL IA → Uninstall.
- **License:** [MIT](LICENSE).

**Español**

- **Certificado:** Microsoft Artifact Signing (confianza pública), a nombre de ESTRADA GLOBAL GESTION, S.L., la empresa que está detrás de Coach LoL IA.
- **Qué se firma:** la app de Windows (`Coach LoL IA.exe`), su desinstalador y su instalador (`Coach-LoL-IA-Setup-<versión>.exe`) que se publican en [GitHub Releases](https://github.com/pepeipto/coach-lol-ia/releases).
- **Cómo se compila:** cada versión se compila desde el código de su etiqueta de git con el [workflow Release](.github/workflows/release.yml) de GitHub Actions. Solo se firma dentro de ese workflow, que entra en Azure con OpenID Connect (sin contraseñas guardadas). Nunca se firma nada compilado en un ordenador personal.
- **Equipo:** Carlos Fernandez Medina ([@pepeipto](https://github.com/pepeipto)) escribe, revisa y publica el código. Todas las cuentas usan verificación en dos pasos.
- **Privacidad:** qué datos envía la app y cómo desactivar cada función está en la [política de privacidad](https://www.coachlolia.com/privacidad) y se muestra al instalar.
- **Desinstalar:** Configuración de Windows → Aplicaciones → Coach LoL IA → Desinstalar.
- **Licencia:** [MIT](LICENSE).

<sub>Hecho con ayuda de IA.</sub>
