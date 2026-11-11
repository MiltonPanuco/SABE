# Frontend de SABE para producción (F12): build de Vite servido por Caddy, que también
# reenvía /api, /admin y /static al backend y obtiene el certificado HTTPS.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Botones de acceso de demostración (estudiante y control escolar; el administrador no).
ENV VITE_ACCESOS_DEMO=1
RUN npm run build

FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
