const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const ROLE_TIERS = {
  contributor: 1,
  editor: 2,
  admin: 3
};

/**
 * Normalizes a role string to lowercase and trimmed string.
 */
function normalizeRole(role) {
  if (!role || typeof role !== 'string') return '';
  return role.trim().toLowerCase();
}

/**
 * Helper to get numeric tier for a role string.
 */
function getRoleTier(role) {
  return ROLE_TIERS[normalizeRole(role)] || 0;
}

/**
 * JWT Authentication Middleware
 * Extracts Bearer token from Authorization header and verifies it.
 * Injects user identity and role context into req.user and req.authenticatedUser.
 */
function authenticateJwt(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.toLowerCase().startsWith('bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization Bearer header'
    });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication token is required'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id || decoded.userId || decoded.sub || 'unknown';
    const userRole = decoded.role || 'Contributor';

    req.user = {
      id: userId,
      role: userRole,
      ...decoded
    };
    req.authenticatedUser = req.user;

    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired authentication token'
    });
  }
}

/**
 * Role-Based Access Control (RBAC) Guard Middleware
 * Restricts access to users meeting required role tier or allowed role list.
 *
 * @param {string|string[]} allowedRolesOrMinTier Role name (e.g. 'Editor') or array of allowed roles
 */
function requireRole(allowedRolesOrMinTier) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'User authentication required'
      });
    }

    const userRole = req.user.role;
    const userTier = getRoleTier(userRole);
    let isAllowed = false;

    if (Array.isArray(allowedRolesOrMinTier)) {
      const normalizedAllowed = allowedRolesOrMinTier.map(r => normalizeRole(r));
      isAllowed = normalizedAllowed.includes(normalizeRole(userRole));
    } else if (typeof allowedRolesOrMinTier === 'string') {
      const minRole = normalizeRole(allowedRolesOrMinTier);
      const minTier = ROLE_TIERS[minRole] || 0;
      if (minTier > 0) {
        isAllowed = userTier >= minTier;
      } else {
        isAllowed = normalizeRole(userRole) === minRole;
      }
    }

    if (!isAllowed) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Insufficient permissions. Role '${userRole}' is not authorized for this operation.`
      });
    }

    next();
  };
}

/**
 * Middleware for Article creation/updates:
 * Allows Contributors to create/update draft content, but restricts setting status to 'published'
 * to Editor or Admin roles.
 */
function checkArticlePublishingRole(req, res, next) {
  if (req.body && typeof req.body.status === 'string' && req.body.status.toLowerCase() === 'published') {
    const userTier = getRoleTier(req.user ? req.user.role : '');
    if (userTier < ROLE_TIERS.editor) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Publishing articles requires Editor or Admin role.'
      });
    }
  }
  next();
}

/**
 * Mutation Audit Logging Middleware
 * Records requesting user ID, role context, HTTP action, and path for audit logs.
 */
function auditLogger(req, res, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const userId = req.user ? req.user.id : 'unauthenticated';
    const userRole = req.user ? req.user.role : 'unknown';

    const originalSend = res.send;
    res.send = function (...args) {
      console.log(`[MUTATION AUDIT] User ID: ${userId} | Role: ${userRole} | Action: ${req.method} ${req.originalUrl || req.url} | Status: ${res.statusCode}`);
      return originalSend.apply(res, args);
    };
  }
  next();
}

module.exports = {
  authenticateJwt,
  requireRole,
  checkArticlePublishingRole,
  auditLogger,
  JWT_SECRET,
  ROLE_TIERS
};
