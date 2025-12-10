FROM node:24.11-slim

WORKDIR /

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 9000

CMD ["node", "src/backend/index.js"]
