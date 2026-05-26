FROM node:22-alpine AS client-build

WORKDIR /app

COPY client/package*.json ./client/
RUN npm ci --prefix client

COPY client ./client
RUN npm run build --prefix client

FROM node:22-alpine AS server

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY server ./server
COPY --from=client-build /app/client/dist ./client/dist

EXPOSE 3000

CMD ["npm", "start"]
