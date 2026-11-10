# Firma de la app con Microsoft Artifact Signing (Azure)

Objetivo: que Windows (Control inteligente de aplicaciones y SmartScreen) deje de bloquear el instalador y la app.
El editor que aparecerá al instalar será **ESTRADA GLOBAL GESTION, S.L.**

Coste: plan Basic de Artifact Signing (unos 10 € al mes, 5.000 firmas al mes; cada versión usa unas pocas). Se
cobra desde que se crea la cuenta y no se prorratea.

## Lo que ya está hecho en el repositorio

- [Workflow Release](../.github/workflows/release.yml): si el bloque `env` tiene los datos de Azure, entra en Azure
  con OpenID Connect (sin contraseñas guardadas en GitHub) y electron-builder firma `Coach LoL IA.exe`, el
  desinstalador y el instalador. Después comprueba que las firmas son válidas. Con los datos vacíos sale sin firmar.
- [Política de firma](../CODE_SIGNING.md) actualizada.

## Lo que tiene que hacer Carlos (necesita tarjeta y los papeles de la S.L.)

1. **Cuenta de Azure de pago** en https://portal.azure.com (pago por uso, con la tarjeta de la S.L.). Las
   suscripciones gratis o de prueba no sirven.
2. En el portal, buscar **Artifact Signing Accounts** → **Crear**:
   - Grupo de recursos: `coachlolia-firma` (nuevo).
   - Nombre de la cuenta: `coachloliafirma` (si está cogido, otro solo con letras y números).
   - Región: **North Europe** (West Europe no admite clientes nuevos). Plan: **Basic**.
   - Si pide registrar el proveedor `Microsoft.CodeSigning`, aceptarlo (Suscripciones → Proveedores de recursos).
3. En la cuenta creada: **Control de acceso (IAM)** → Agregar asignación de rol → **Artifact Signing Identity
   Verifier** → a tu propio usuario.
4. En la cuenta: **Identity validations** → **New** → **Organization** → **Public**. Datos de la S.L.:
   ESTRADA GLOBAL GESTION, S.L., NIF B72985229, Carrer del Campament 25, 46035 València, web
   https://www.coachlolia.com y un correo de `@coachlolia.com` que se lea. Si pide documentos: nota simple o
   escritura del Registro Mercantil de menos de 12 meses y la factura del dominio. Microsoft tarda de 1 a 20 días
   laborables.
5. Cuando la validación salga **Completed**, avisar en el hilo. Claude prepara el resto (perfil de certificado,
   aplicación con credencial federada para GitHub, permiso de firma y los datos del workflow) con un único bloque
   para pegar en Azure Cloud Shell, y deja el PR con los datos rellenos.

## Bloque para Azure Cloud Shell (paso 5)

Se abre con el icono `>_` de arriba en el portal (Bash). Antes, crear el perfil en la cuenta: **Certificate
profiles** → **Create** → **Public Trust** → nombre `CoachLoLPublico` → elegir la validación completada.

```bash
CUENTA=coachloliafirma; GRUPO=coachlolia-firma
ID_CUENTA=$(az resource show -g $GRUPO -n $CUENTA --resource-type Microsoft.CodeSigning/codeSigningAccounts --query id -o tsv)
APP=$(az ad app create --display-name coachlolia-firma-github --query appId -o tsv)
az ad sp create --id $APP >/dev/null
az ad app federated-credential create --id $APP --parameters '{"name":"github-firma","issuer":"https://token.actions.githubusercontent.com","subject":"repo:pepeipto/coach-lol-ia:environment:firma","audiences":["api://AzureADTokenExchange"]}' >/dev/null
az role assignment create --assignee $APP --scope $ID_CUENTA --role "Artifact Signing Certificate Profile Signer" >/dev/null \
  || az role assignment create --assignee $APP --scope $ID_CUENTA --role "Trusted Signing Certificate Profile Signer" >/dev/null
echo "AZURE_TENANT_ID=$(az account show --query tenantId -o tsv)"
echo "AZURE_SUBSCRIPTION_ID=$(az account show --query id -o tsv)"
echo "AZURE_CLIENT_ID=$APP"
echo "AZURE_FIRMA_CUENTA=$CUENTA"
```

Lo que imprime se copia en el hilo (no son secretos) y va al bloque `env` del workflow junto con
`AZURE_FIRMA_ENDPOINT=https://neu.codesigning.azure.net/`, `AZURE_FIRMA_PERFIL=CoachLoLPublico` y
`AZURE_FIRMA_EDITOR` (el nombre de la organización exactamente como lo muestra la validación).

## Notas

- SmartScreen puede seguir avisando los primeros días con cada versión nueva hasta que gane reputación de descargas;
  el Control inteligente de aplicaciones acepta las apps firmadas con un certificado de confianza pública.
- La validación de identidad caduca: Azure avisa 60 días antes. Si caduca, la firma se para (la release fallará con
  un error claro, no sale nada a medio firmar).
- Las versiones ya instaladas sin firmar se actualizan a la firmada sin problema. Desde la primera versión firmada,
  electron-updater solo acepta actualizaciones firmadas por `AZURE_FIRMA_EDITOR`.
- SignPath queda en espera ([firma-signpath.md](firma-signpath.md)); si algún día se activa, el workflow solo lo
  usa cuando Azure no está configurado.

<sub>Hecho con ayuda de IA.</sub>
