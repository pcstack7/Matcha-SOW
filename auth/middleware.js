// Middleware to check if user is authenticated
export function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

// Middleware to check if user is an admin
export function isAdmin(req, res, next) {
  if (req.isAuthenticated() && req.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Admin access required' });
}

// Middleware to check if user is active
export function isActive(req, res, next) {
  if (req.isAuthenticated() && req.user.is_active) {
    return next();
  }
  res.status(403).json({ error: 'Account is inactive' });
}

// Combined middleware: authenticated and admin
export function requireAdmin(req, res, next) {
  isAuthenticated(req, res, () => {
    isAdmin(req, res, next);
  });
}
