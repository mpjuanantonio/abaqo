import { Hono } from 'hono';
import { health } from './routes/health.js';

export function createApp(): Hono {
  const app = new Hono();
  // Every route lives under /api so dev (Vite proxy) and production (reverse proxy) use the same paths.
  app.route('/api', health);
  return app;
}
