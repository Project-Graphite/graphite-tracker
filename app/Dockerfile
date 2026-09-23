FROM node:22-alpine AS development

WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci
COPY . .

FROM development AS build
RUN npm run build

FROM node:22-alpine AS production-dependencies

WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci --omit=dev

FROM node:22-alpine AS web

ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/frontend/dist ./frontend/dist
COPY package.json ./
COPY backend/package.json ./backend/
COPY backend/prisma.config.ts ./backend/
COPY backend/prisma ./backend/prisma
USER node
EXPOSE 3000
CMD ["node", "backend/dist/main.js"]
