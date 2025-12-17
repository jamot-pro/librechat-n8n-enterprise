const { logger } = require('@librechat/data-schemas');
const Profile = require('~/server/models/Profile');

/**
 * Get user's profile data
 * @route GET /api/profile
 * @access Private
 */
const getProfileController = async (req, res) => {
  try {
    logger.info('[Profile] GET /api/profile request received');
    logger.info('[Profile] User from req.user:', req.user);

    const userId = req.user.id;
    logger.info('[Profile] Searching for profile with userId:', userId);

    // Find profile for the authenticated user
    const profile = await Profile.findOne({ userId }).lean();
    logger.info('[Profile] Profile found:', profile ? 'YES' : 'NO');
    logger.info('[Profile] Profile data:', JSON.stringify(profile));

    if (!profile) {
      return res.status(404).json({
        error: 'Profile not found',
        message: 'No profile configured for this user. Please contact your administrator.',
      });
    }

    // Transform to match frontend ProfileData interface
    const profileData = {
      userId: profile.userId.toString(),
      profileType: profile.profileType,
      permissions: profile.permissions || [],
      allowedWorkflows: profile.allowedWorkflows || [],
      metadata: profile.metadata || {},
    };

    logger.debug('[Profile] Retrieved profile for user:', {
      userId,
      profileType: profile.profileType,
    });

    return res.status(200).json(profileData);
  } catch (error) {
    logger.error('[Profile] Error fetching profile:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve profile data',
    });
  }
};

module.exports = {
  getProfileController,
};
