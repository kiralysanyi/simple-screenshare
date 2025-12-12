FROM node:24.12.0-alpine

WORKDIR /backend

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 9000

CMD ["node", "src/backend/index.js"]
