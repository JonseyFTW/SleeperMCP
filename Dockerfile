# Railway-optimized Dockerfile for Sleeper MCP Server
FROM node:18-alpine

# Update npm to latest version and install system dependencies
RUN npm install -g npm@11.4.2 && \
    apk add --no-cache \
    bash \
    curl \
    postgresql-client \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Disable Husky during Docker build since Git is not available
ENV HUSKY=0

# Remove prepare script temporarily to avoid Husky issues
RUN npm pkg delete scripts.prepare

# Install production dependencies first
RUN npm install --omit=dev && npm cache clean --force

# Copy TypeScript config and source
COPY tsconfig*.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/

# Install all dependencies and build
RUN npm install && npm run build && npm prune --production

# Create necessary directories
RUN mkdir -p logs data

# Make scripts executable
RUN chmod +x scripts/*.sh 2>/dev/null || true

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8080}/health || exit 1

# Expose port
EXPOSE 8080

# Create startup script that handles database initialization
RUN echo '#!/bin/bash\n\
set -e\n\
echo "🚀 Starting Sleeper MCP Server..."\n\
\n\
# Wait for database to be ready\n\
echo "⏳ Waiting for database connection..."\n\
for i in {1..30}; do\n\
  if npm run analytics:setup 2>/dev/null; then\n\
    echo "✅ Database connection established"\n\
    break\n\
  fi\n\
  if [ $i -eq 30 ]; then\n\
    echo "⚠️ Database setup failed, continuing anyway"\n\
    break\n\
  fi\n\
  sleep 2\n\
done\n\
\n\
# Try to update current data (non-critical)\n\
echo "📊 Updating current player data..."\n\
npm run analytics:update || echo "⚠️ Current data update failed (non-critical)"\n\
\n\
# Start the main application\n\
echo "🌟 Starting MCP server on port ${PORT:-8080}"\n\
exec npm start\n\
' > /app/start.sh && chmod +x /app/start.sh

# Start the application
CMD ["/app/start.sh"]