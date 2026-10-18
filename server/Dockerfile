# Construir desde la raíz del repositorio:
#   docker build -f server/Dockerfile -t coach-lol-ia-server .
FROM node:24-slim
WORKDIR /repo
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN npm ci --workspace server --include-workspace-root
COPY shared/ shared/
COPY server/ server/
ENV PUERTO=8080 RUTA_DB=/datos/coach.db
VOLUME /datos
EXPOSE 8080
WORKDIR /repo/server
CMD ["npm", "start"]
