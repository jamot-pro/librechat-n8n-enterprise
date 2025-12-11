/**
 * Middleware to validate profileType before forwarding to n8n
 * Usage: validateProfileType(['ceo', 'admin']) or validateProfileType('customer')
 */

const validateProfileType = (allowedTypes) => {
  // Normalize to array
  const allowed = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];

  return (req, res, next) => {
    try {
      // Check if profile exists (should be set by profileAuth middleware)
      if (!req.userProfile) {
        console.error('[ValidateProfileType] No user profile found in request');
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'User profile not found. Please authenticate first.',
        });
      }

      const userProfileType = req.userProfile.profileType;

      // Check if user's profile type is in allowed list
      if (!allowed.includes(userProfileType)) {
        console.warn(
          `[ValidateProfileType] Access denied for ${userProfileType}. Required: ${allowed.join(' or ')}`,
        );

        return res.status(403).json({
          success: false,
          error: 'Access denied',
          message: `This endpoint requires ${allowed.join(' or ')} profile. Your profile: ${userProfileType}`,
          required: allowed,
          current: userProfileType,
        });
      }

      console.log(`[ValidateProfileType] ✓ ${userProfileType} authorized for ${allowed.join('/')}`);
      next();
    } catch (error) {
      console.error('[ValidateProfileType] Error:', error);
      return res.status(500).json({
        success: false,
        error: 'Profile validation failed',
        message: error.message,
      });
    }
  };
};

module.exports = validateProfileType;
