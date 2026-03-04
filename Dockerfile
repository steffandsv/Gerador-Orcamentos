FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npx tsc

FROM node:20-alpine AS runner
WORKDIR /app

# Copy built files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/views ./views

# Copy static assets
COPY --from=builder /app/style.css ./style.css
COPY --from=builder /app/js ./js
RUN mkdir -p ./arquivos
EXPOSE 3000

# Start Express server
CMD ["node", "dist/index.js"]
