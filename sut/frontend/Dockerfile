FROM node:20-alpine

WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy app
COPY . .

# Build arg for API URL (used at build time by Vite)
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# Create non-root user and set ownership
RUN chown -R node:node /app

# Switch to non-root user (node user already exists in alpine image, UID 1000)
USER node

# Expose port
EXPOSE 5173

# Run dev server (for dev/CI) - use `npm run build && npm run preview` for prod
CMD ["npm", "run", "dev", "--", "--host"]
