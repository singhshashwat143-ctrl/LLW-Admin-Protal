FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY src ./src
COPY public ./public
COPY server ./server
COPY db ./db
COPY static ./static
COPY index.html admin.html database.html webinar.html ./
COPY tsconfig.json vite.config.ts ./

RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/db ./db

RUN chown -R node:node /app

USER node

EXPOSE 8080

CMD ["node", "server/webinar-server.mjs"]
