FROM node:24-slim

WORKDIR /

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 9000

CMD ["node", "src/index.js"]
