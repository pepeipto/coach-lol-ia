# Construir desde la raíz del repositorio:
#   docker build -f server/Dockerfile -t coach-lol-ia-server .

# Dependencias: se instalan con el package-lock.json del monorepo, que exige los manifiestos de
# todos los workspaces (también app/package.json, aunque de app no se instala nada).
FROM node:24-slim AS dependencias
# Por si better-sqlite3 no encuentra binario precompilado y tiene que compilarse.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY app/package.json app/
# npm 12 solo ejecuta los scripts de instalación permitidos en allowScripts (package.json de la raíz): esbuild.
# better-sqlite3 usa su binario precompilado (prebuilds/linux-x64.node), así que no necesita compilar nada.
RUN npm ci --workspace server --include-workspace-root --strict-allow-scripts

FROM node:24-slim
WORKDIR /repo
COPY --from=dependencias /repo ./
COPY shared/ shared/
COPY server/ server/
ENV PUERTO=8080 RUTA_DB=/datos/coach.db
# Seguridad (hallazgo 11): el servidor corre como el usuario «node» (uid 1000), sin privilegios. Fly monta el volumen
# /datos (RUTA_DB=/datos/coach.db en fly.toml) como root al arrancar, así que el ENTRYPOINT, que empieza como root, solo
# hace dos cosas: da a «node» los archivos de /datos que aún no sean suyos (la base de despliegues anteriores) y
# cambia a ese usuario con setpriv (util-linux, ya viene en la imagen) antes de ejecutar nada de la aplicación.
# Va en línea, no en un .sh, para que un checkout de Windows con CRLF no lo rompa.
RUN command -v setpriv >/dev/null && mkdir -p /datos && chown node:node /datos
VOLUME /datos
EXPOSE 8080
WORKDIR /repo/server
ENTRYPOINT ["/bin/sh", "-c", "find /datos ! -user node -exec chown node:node {} + 2>/dev/null; export HOME=/home/node; exec setpriv --reuid=node --regid=node --init-groups -- \"$@\"", "--"]
CMD ["npm", "start"]
