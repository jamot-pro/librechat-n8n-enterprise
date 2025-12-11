const Profile = require('../models/Profile');
const jwt = require('jsonwebtoken');

const profileAuth = async (req, res, next) => {
  try {
    // Extract JWT token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No token provided',
        message: 'Authorization header must be in format: Bearer <token>',
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.userId || decoded.id;

    // For compatibility: create req.user object
    req.user = {
      _id: req.userId,
      id: req.userId,
      email: decoded.email,
      username: decoded.username || decoded.email,
    };

    // Fetch user profile
    const profile = await Profile.findOne({ userId: req.userId });
    if (!profile) {
      return res.status(403).json({
        error: 'No profile found',
        message: 'User profile not configured. Please contact administrator.',
      });
    }

    // Attach profile to request object (both names for compatibility)
    req.userProfile = profile;
    req.profile = profile;
    // Log for debugging (remove in production)
    console.log(`[ProfileAuth] User ${req.userId} authenticated as ${profile.profileType}`);
    next();
  } catch (error) {
    console.error('[ProfileAuth] Error:', error.message);
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(500).json({
      error: 'Authentication failed',
      message: error.message,
    });
  }
};

module.exports = profileAuth;
