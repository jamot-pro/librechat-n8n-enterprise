const express = require('express');
const { getProfileController } = require('~/server/controllers/ProfileController');
const requireJwtAuth = require('~/server/middleware/requireJwtAuth');

const router = express.Router();

// Apply JWT authentication to all routes
router.use(requireJwtAuth);

// GET /api/profile - Get current user's profile
router.get('/', getProfileController);

module.exports = router;
