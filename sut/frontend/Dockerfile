# syntax=docker/dockerfile:1.4
FROM node:20-alpine AS base

WORKDIR /app

# Install wget for healthcheck (cached layer)
RUN apk add --no-cache wget

# ============================================
# Dependencies stage - cached separately
# ============================================
FROM base AS deps

# Copy package files first (better cache utilization)
COPY package*.json ./

# Install dependencies with BuildKit cache mount
# npm cache persists between builds
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ============================================
# Final stage
# ============================================
FROM base AS final

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy package files (needed for scripts)
COPY package*.json ./

# Copy app code (changes most frequently - last layer)
COPY . .

# Build arg for API URL (used at build time by Vite)
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=$VITE_API_URL

# Create non-root user ownership
RUN chown -R node:node /app

# Switch to non-root user (node user UID 1000 exists in alpine)
USER node

EXPOSE 5173

# Run dev server (for dev/CI) - use `npm run build && npm run preview` for prod
CMD ["npm", "run", "dev", "--", "--host"]
