# Backend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install rclone for backups
RUN apk add --no-cache rclone

# Copy application files
COPY . .

# Expose port
EXPOSE 3001

# Start the server
CMD ["node", "server.js"]
