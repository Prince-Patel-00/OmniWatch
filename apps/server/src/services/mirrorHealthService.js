import { getAllMirrorSources, updateMirrorSourceDomain, updateMirrorStatus } from '../db.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const PROBE_TIMEOUT_MS = 4000;
const PERIODIC_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

let periodicCheckTimer = null;
let isCheckRunning = false;

/**
 * Probes a specific domain to verify reachability and measure latency.
 */
export async function probeDomain(domain) {
  if (!domain || typeof domain !== 'string') {
    return { isWorking: false, latencyMs: 0, error: 'Invalid domain' };
  }

  const cleanDomain = domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const url = `https://${cleanDomain}/`;
  const startTime = performance.now();

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      // Use follow so standard HTTPS/subdomain redirects complete, but we don't blindly switch domains
      redirect: 'follow',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS)
    });

    const latencyMs = Math.round(performance.now() - startTime);

    // Any HTTP status code < 500 indicates the domain is alive and server is reachable
    // (Note: 403 is Cloudflare/anti-bot protection, which confirms the domain is alive)
    if (res.status < 500) {
      let candidateRedirect = null;
      try {
        if (res.url) {
          const finalUrl = new URL(res.url);
          candidateRedirect = finalUrl.hostname.replace(/^www\./, '');
        }
      } catch (e) {}

      return {
        isWorking: true,
        latencyMs: Math.max(1, latencyMs),
        status: 'Working',
        statusCode: res.status,
        finalHost: candidateRedirect
      };
    }

    return {
      isWorking: false,
      latencyMs: Math.round(performance.now() - startTime),
      status: 'Offline',
      error: `HTTP ${res.status}`
    };
  } catch (err) {
    return {
      isWorking: false,
      latencyMs: 0,
      status: 'Offline',
      error: err.name === 'TimeoutError' ? 'Connection timed out' : err.message
    };
  }
}

/**
 * Checks a single mirror source. If current domain is down, tests candidates and auto-migrates.
 */
export async function checkMirrorSource(mirror) {
  if (!mirror || !mirror.id) return null;

  const validCandidates = Array.isArray(mirror.candidateDomains)
    ? mirror.candidateDomains.map(d => d.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '').toLowerCase())
    : [];

  // 1. Probe current active domain
  const currentResult = await probeDomain(mirror.currentDomain);

  if (currentResult.isWorking) {
    // Only migrate if redirected host is explicitly one of the approved candidate domains
    if (
      currentResult.finalHost &&
      currentResult.finalHost !== mirror.currentDomain.toLowerCase() &&
      validCandidates.includes(currentResult.finalHost)
    ) {
      await updateMirrorSourceDomain(
        mirror.id,
        currentResult.finalHost,
        'Working',
        currentResult.latencyMs,
        `Redirected to official candidate ${currentResult.finalHost}`
      );
      return {
        id: mirror.id,
        name: mirror.name,
        domain: currentResult.finalHost,
        previousDomain: mirror.currentDomain,
        migrated: true,
        status: 'Working',
        latencyMs: currentResult.latencyMs
      };
    }

    // Normal active working state
    await updateMirrorStatus(
      mirror.id,
      'Working',
      currentResult.latencyMs,
      `Responsive (${currentResult.latencyMs}ms)`
    );

    return {
      id: mirror.id,
      name: mirror.name,
      domain: mirror.currentDomain,
      migrated: false,
      status: 'Working',
      latencyMs: currentResult.latencyMs
    };
  }

  // 2. Current domain is down/unresponsive -> Check fallback candidate domains
  const fallbackCandidates = (mirror.candidateDomains || []).filter(
    (d) => d && typeof d === 'string' && d.trim().toLowerCase() !== mirror.currentDomain.toLowerCase()
  );

  for (const candidate of fallbackCandidates) {
    const candidateResult = await probeDomain(candidate);
    if (candidateResult.isWorking) {
      // Auto-migrate in DB to the working candidate!
      const activeDomain = candidate.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      await updateMirrorSourceDomain(
        mirror.id,
        activeDomain,
        'Working',
        candidateResult.latencyMs,
        `Auto-migrated from down domain ${mirror.currentDomain}`
      );

      console.log(`[MirrorHealth] 🔄 Auto-migrated ${mirror.name} from ${mirror.currentDomain} to ${activeDomain}`);

      return {
        id: mirror.id,
        name: mirror.name,
        domain: activeDomain,
        previousDomain: mirror.currentDomain,
        migrated: true,
        status: 'Working',
        latencyMs: candidateResult.latencyMs
      };
    }
  }

  // 3. No candidate domain succeeded -> Mark as Offline
  await updateMirrorStatus(
    mirror.id,
    'Offline',
    0,
    `All candidates unreachable (${currentResult.error || 'Connection failed'})`
  );

  return {
    id: mirror.id,
    name: mirror.name,
    domain: mirror.currentDomain,
    migrated: false,
    status: 'Offline',
    latencyMs: 0,
    error: currentResult.error
  };
}

/**
 * Executes health checks on all mirror sources concurrently with a controlled batch size.
 */
export async function checkAllMirrors(concurrency = 5) {
  if (isCheckRunning) {
    return { isRunning: true, message: 'A health check is already in progress' };
  }

  isCheckRunning = true;
  const startTime = Date.now();
  console.log('[MirrorHealth] 🚀 Starting mirror sources domain health verification...');

  try {
    const allMirrors = (await getAllMirrorSources()).filter((m) => m.isEnabled);
    const results = [];
    const queue = [...allMirrors];

    async function worker() {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;
        try {
          const res = await checkMirrorSource(item);
          if (res) results.push(res);
        } catch (err) {
          results.push({
            id: item.id,
            name: item.name,
            domain: item.currentDomain,
            status: 'Offline',
            latencyMs: 0,
            error: err.message
          });
        }
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
    await Promise.all(workers);

    const workingCount = results.filter((r) => r.status === 'Working').length;
    const migratedCount = results.filter((r) => r.migrated).length;
    const offlineCount = results.filter((r) => r.status === 'Offline').length;
    const durationMs = Date.now() - startTime;

    console.log(
      `[MirrorHealth] ✅ Health verification finished in ${durationMs}ms: ` +
      `${workingCount} Working, ${migratedCount} Auto-migrated, ${offlineCount} Offline`
    );

    return {
      success: true,
      total: results.length,
      working: workingCount,
      migrated: migratedCount,
      offline: offlineCount,
      durationMs,
      results
    };
  } finally {
    isCheckRunning = false;
  }
}

/**
 * Starts automated periodic mirror health checking.
 * Probes after 3 seconds of server startup, then runs every 12 hours.
 */
export function startPeriodicMirrorChecks() {
  if (periodicCheckTimer) return;

  // Run initial check 3 seconds after server startup (non-blocking)
  setTimeout(() => {
    checkAllMirrors().catch((err) => {
      console.warn('[MirrorHealth] Initial mirror check warning:', err.message);
    });
  }, 3000);

  // Recurring check every 12 hours
  periodicCheckTimer = setInterval(() => {
    checkAllMirrors().catch((err) => {
      console.warn('[MirrorHealth] Periodic mirror check warning:', err.message);
    });
  }, PERIODIC_CHECK_INTERVAL_MS);

  console.log('[MirrorHealth] 🕒 Periodic mirror health monitor scheduled (every 12h)');
}

export function stopPeriodicMirrorChecks() {
  if (periodicCheckTimer) {
    clearInterval(periodicCheckTimer);
    periodicCheckTimer = null;
  }
}
