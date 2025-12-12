FROM node:24.12.0-alpine

# Install Python (and optionally build tools)
# Média leves miatt (needed for mediasoup)
RUN apk add --no-cache python3 py3-pip make g++

WORKDIR /

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 9000

CMD ["node", "src/backend/index.js"]
