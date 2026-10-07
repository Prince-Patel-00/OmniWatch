import app, { ensureDB } from './app.js';
import { startPeriodicMirrorChecks } from './services/mirrorHealthService.js';

const PORT = process.env.PORT || 5000;

ensureDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🎬 OmniWatch Server 2.0 running at http://localhost:${PORT}`);
    console.log(`🌍 Global API: http://localhost:${PORT}/api/global`);
    console.log(`📚 Catalog API: http://localhost:${PORT}/api/catalog`);
    console.log(`⚙️ System API: http://localhost:${PORT}/api/system`);
    console.log(`🌐 Mirrors API: http://localhost:${PORT}/api/mirrors`);
    
    // Start non-blocking periodic health check for mirror domains
    startPeriodicMirrorChecks();
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
