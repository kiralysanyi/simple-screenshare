FROM node:24.12.0-alpine

# Install Python (and optionally build tools)
# Média leves miatt (needed for mediasoup)
RUN apt-get update && apt-get install -y python3 python3-pip make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /

COPY package*.json ./

RUN npm install --production

COPY . .

EXPOSE 9000

CMD ["node", "src/backend/index.js"]
