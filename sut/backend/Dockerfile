# syntax=docker/dockerfile:1.4
FROM python:3.11-slim AS base

WORKDIR /app

# Install curl for healthcheck (cached layer)
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user early (cached layer)
RUN useradd -m -u 1000 appuser

# ============================================
# Dependencies stage - cached separately
# ============================================
FROM base AS deps

# Copy only requirements first (better cache utilization)
COPY requirements.txt .

# Install dependencies with BuildKit cache mount
# Cache persists between builds, dramatically speeding up rebuilds
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

# ============================================
# Final stage
# ============================================
FROM base AS final

# Copy installed packages from deps stage
COPY --from=deps /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin

# Copy app code (changes most frequently - last layer)
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
