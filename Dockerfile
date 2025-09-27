# Use Node.js LTS version
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for development)
ARG NODE_ENV=production
RUN if [ -f package-lock.json ]; then \
        if [ "$NODE_ENV" = "development" ]; then \
            npm ci && npm cache clean --force; \
        else \
            npm ci --omit=dev && npm cache clean --force; \
        fi \
    else \
        if [ "$NODE_ENV" = "development" ]; then \
            npm install && npm cache clean --force; \
        else \
            npm install --only=production && npm cache clean --force; \
        fi \
    fi

# Copy application code
COPY . .

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); const options = { host: 'localhost', port: 5000, path: '/health', timeout: 2000 }; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => process.exit(1)); req.end();"

# Start the application
CMD ["npm", "start"]