FROM node:23-alpine AS build
WORKDIR /src
COPY package.json package-lock.json* ./
COPY app/package.json app/package-lock.json ./app/
RUN npm --prefix app ci
COPY . .
RUN node lectures/_assets/build.mjs && npm --prefix app run build

FROM nginx:alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/app/dist /usr/share/nginx/html
EXPOSE 80
