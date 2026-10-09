import crypto from 'node:crypto';

const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'omniwatch-jwt-secret-2026-secure-salt';
export const DEFAULT_USER_ID = 'user_makisanis106';
export const DEFAULT_USER_EMAIL = 'makisanis106@gmail.com';

/**
 * Hash a plain text password using salted scrypt.
 */
export function hashPassword(password) {
  if (!password || typeof password !== 'string') {
    throw new Error('Password must be a non-empty string');
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verify a plain text password against a stored salted hash.
 */
export function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) {
    return false;
  }
  try {
    const [salt, key] = storedHash.split(':');
    const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(derivedKey, 'hex'));
  } catch (err) {
    return false;
  }
}

/**
 * Sign a JWT token using HMAC-SHA256.
 */
export function signToken(payload, expiresInSeconds = 30 * 24 * 3600) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const fullPayload = { ...payload, exp };

  const toBase64Url = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const hB64 = toBase64Url(header);
  const pB64 = toBase64Url(fullPayload);

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${hB64}.${pB64}`)
    .digest('base64url');

  return `${hB64}.${pB64}.${signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 JWT token.
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [hB64, pB64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${hB64}.${pB64}`)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(pB64, 'base64url').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Optional or relaxed auth middleware:
 * Extracts user from Bearer token if present; defaults to DEFAULT_USER_ID if omitted.
 */
export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ success: false, error: 'Invalid or expired authentication token' });
    }
    req.user = payload;
    req.userId = payload.userId || payload.id;
  } else {
    // Unauthenticated request
    req.user = null;
    req.userId = null;
  }
  next();
}

/**
 * Strict auth middleware:
 * Rejects with 401 if no valid Bearer token is provided.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required. Missing Bearer token.' });
  }
  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
  }
  req.user = payload;
  req.userId = payload.userId || payload.id;
  next();
}
