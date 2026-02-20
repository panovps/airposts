#!/bin/sh
set -e

echo "🔄 Starting AirPost application..."

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL..."
until pg_isready -h postgres -U ${POSTGRES_USER:-airpost}; do
  echo "⏳ PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "✅ PostgreSQL is ready"

# Run migrations
echo "🔄 Running database migrations..."
npm run migration:run

echo "✅ Migrations completed"

# Start the application
echo "🚀 Starting application..."
exec node dist/main.js
