import app, { ensureDB } from '../apps/server/src/app.js';

export default async function handler(req, res) {
  // Normalize url if path prefix is stripped by serverless proxy
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  
  // Ensure database is initialized before processing request
  await ensureDB();
  
  return app(req, res);
}
