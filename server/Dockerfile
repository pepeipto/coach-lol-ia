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
# npm 12 bloquea los scripts de instalación salvo los permitidos; --allow-scripts no se admite en la
# línea de órdenes de un proyecto, así que se permite en un .npmrc temporal (npm 11 lo ignora).
RUN printf 'allow-scripts=better-sqlite3,esbuild\n' > .npmrc \
  && npm ci --workspace server --include-workspace-root \
  && rm .npmrc

FROM node:24-slim
WORKDIR /repo
COPY --from=dependencias /repo ./
COPY shared/ shared/
COPY server/ server/
ENV PUERTO=8080 RUTA_DB=/datos/coach.db
VOLUME /datos
EXPOSE 8080
WORKDIR /repo/server
CMD ["npm", "start"]
