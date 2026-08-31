const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../src/middleware/auth');

function generateTestToken(user = {}) {
  const payload = {
    id: user.id || 'usr_test_123',
    role: user.role || 'Admin',
    email: user.email || 'test@961.co',
    name: user.name || 'Test User'
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

function getAuthHeader(user = {}) {
  const token = generateTestToken(user);
  return { Authorization: `Bearer ${token}` };
}

module.exports = {
  generateTestToken,
  getAuthHeader
};
