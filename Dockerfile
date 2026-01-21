FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

ENV PORT=5173

EXPOSE 5173 5180

CMD sh -c "npm run dev -- --host --port $PORT"
