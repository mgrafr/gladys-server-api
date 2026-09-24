
FROM node:24-alpine
RUN apk update && apk add bash  --no-cache bash

WORKDIR /app

COPY package*.json ./
COPY --chown=node:node . .
RUN npm install

CMD ["node", "index.js"]
