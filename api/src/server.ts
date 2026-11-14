import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const port = Number(process.env['PORT'] ?? 3100);

serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`Abaqo API listening on port ${info.port}`);
});
