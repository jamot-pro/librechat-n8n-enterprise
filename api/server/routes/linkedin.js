const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { requireJwtAuth } = require('../middleware');
const SocialAccount = require('~/models/SocialAccount');
const LinkedInService = require('../services/LinkedInService');
const logger = require('~/config/winston');
const { parseLinkedInPostUrn } = require('../utils/parseLinkedInPostUrn');

function tryDecodeURIComponent(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Generate secure OAuth state parameter
 * @param {string} userId - User ID to encode
 * @returns {string} Signed JWT token
 */
function generateState(userId) {
  const payload = {
    userId,
    platform: 'linkedin',
    mode: 'posting',
    timestamp: Date.now(),
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10m' });
}

function generateCommentsState(userId) {
  const payload = {
    userId,
    platform: 'linkedin',
    mode: 'comments',
    timestamp: Date.now(),
  };

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '10m' });
}

/**
 * Verify and decode OAuth state parameter
 * @param {string} state - State parameter from OAuth callback
 * @returns {Object} Decoded payload with userId
 */
function verifyState(state) {
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    if (decoded.platform !== 'linkedin') {
      throw new Error('Invalid platform in state');
    }
    return decoded;
  } catch (error) {
    logger.error('[LinkedIn] Invalid OAuth state:', error.message);
    throw new Error('Invalid or expired OAuth state');
  }
}

function getCommentsTokenData(account) {
  return account?.metadata?.linkedinComments ?? null;
}

function setCommentsTokenData(account, tokenData) {
  const metadata = account.metadata && typeof account.metadata === 'object' ? account.metadata : {};
  metadata.linkedinComments = tokenData;
  account.metadata = metadata;
  // Required for Schema.Types.Mixed — otherwise nested changes are not written on save()
  account.markModified('metadata');
}

/**
 * Remove nested OAuth blobs from metadata before JSON (GET /status must not leak comment tokens).
 * @param {Record<string, unknown>|undefined} metadata
 */
function sanitizeLinkedInMetadataForClient(metadata) {
  if (!metadata || typeof metadata !== 'object') return metadata;
  const { linkedinComments: _omit, ...rest } = metadata;
  return rest;
}

/**
 * Check if token needs refresh and refresh if necessary
 * @param {Object} account - Social account object
 * @returns {Promise<string>} Valid access token
 */
async function getValidAccessToken(account, { forComments = false } = {}) {
  let accessToken = account.accessToken;
  let refreshToken = account.refreshToken;
  let expiresAt = account.expiresAt;

  if (forComments) {
    const commentsData = getCommentsTokenData(account);
    if (!commentsData?.accessToken || !commentsData?.expiresAt) {
      throw new Error('COMMENTS_NOT_CONNECTED');
    }
    accessToken = commentsData.accessToken;
    refreshToken = commentsData.refreshToken;
    expiresAt = commentsData.expiresAt;
  }

  // Check if token is expired or will expire in next 5 minutes
  const expiresAtDate = new Date(expiresAt);
  const now = new Date();
  const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

  if (expiresAtDate <= fiveMinutesFromNow && refreshToken) {
    try {
      logger.info(
        `[LinkedIn] Refreshing ${forComments ? 'comments' : 'posting'} access token for user`,
        account.userId,
      );
      
      const { accessToken, expiresIn, refreshToken } = await LinkedInService.refreshAccessToken(
        refreshToken,
        forComments ? 'comments' : 'posting',
      );

      if (forComments) {
        setCommentsTokenData(account, {
          accessToken,
          refreshToken,
          expiresAt: new Date(Date.now() + expiresIn * 1000),
          isConnected: true,
          connectedAt: getCommentsTokenData(account)?.connectedAt ?? new Date(),
        });
      } else {
        account.accessToken = accessToken;
        account.refreshToken = refreshToken;
        account.expiresAt = new Date(Date.now() + expiresIn * 1000);
      }
      await account.save();

      return accessToken;
    } catch (error) {
      logger.error(`[LinkedIn] ${forComments ? 'Comments' : 'Posting'} token refresh failed:`, error.message);
      throw new Error(
        forComments
          ? 'COMMENTS_TOKEN_EXPIRED_RECONNECT_REQUIRED'
          : 'LinkedIn token expired. Please reconnect your account.',
      );
    }
  }

  return accessToken;
}

/**
 * GET /api/linkedin/connect
 * Initiate LinkedIn OAuth flow
 * Supports both token query parameter (dev mode) and standard JWT auth (production)
 */
router.get('/connect', async (req, res) => {
  // Use LIBRECHAT_URL for OAuth redirects (public URL), fallback to DOMAIN_CLIENT for dev
  const clientUrl = process.env.LIBRECHAT_URL || process.env.DOMAIN_CLIENT;
  
  try {
    let userId;
    
    // Check for token in query parameter (for cross-origin dev mode)
    const tokenFromQuery = req.query.token;
    
    if (tokenFromQuery) {
      // Dev mode: token passed as query parameter
      try {
        const decoded = jwt.verify(tokenFromQuery, process.env.JWT_SECRET);
        userId = decoded.id;
        logger.info(`[LinkedIn] Dev mode - Using token from query parameter for user ${userId}`);
        
        // Generate state and redirect to LinkedIn
        const state = generateState(userId);
        const authUrl = LinkedInService.getAuthUrl(state);
        
        logger.info(`[LinkedIn] Redirecting to LinkedIn OAuth for user ${userId}`);
        return res.redirect(authUrl);
      } catch (error) {
        logger.error('[LinkedIn] Invalid token in query parameter:', error.message);
        return res.redirect(`${clientUrl}/?settings=true&tab=social&error=invalid_token&platform=linkedin`);
      }
    }
    
    // Production mode: Try to get JWT from cookie first, then use passport
    // Log all cookies for debugging
    logger.info('[LinkedIn] Available cookies:', Object.keys(req.cookies || {}));
    logger.info('[LinkedIn] Cookie values:', req.cookies);
    
    const jwtCookie = req.cookies?.token || req.cookies?.jwt || req.cookies?.refreshToken;
    
    if (jwtCookie) {
      // Try to verify JWT from cookie
      try {
        const decoded = jwt.verify(jwtCookie, process.env.JWT_SECRET);
        userId = decoded.id;
        logger.info(`[LinkedIn] Production mode - Using JWT from cookie for user ${userId}`);
        
        // Generate state and redirect to LinkedIn
        const state = generateState(userId);
        const authUrl = LinkedInService.getAuthUrl(state);
        
        logger.info(`[LinkedIn] Redirecting to LinkedIn OAuth for user ${userId}`);
        return res.redirect(authUrl);
      } catch (error) {
        logger.error('[LinkedIn] Invalid JWT in cookie:', error.message);
        // Fall through to passport authentication
      }
    } else {
      logger.warn('[LinkedIn] No JWT cookie found, trying passport authentication');
    }
    
    // Fallback: use standard JWT auth from header via passport
    passport.authenticate('jwt', { session: false }, (err, user, info) => {
      if (err) {
        logger.error('[LinkedIn] Authentication error:', err);
        return res.redirect(`${clientUrl}/?settings=true&tab=social&error=auth_error&platform=linkedin`);
      }
      
      if (!user) {
        logger.error('[LinkedIn] No user found in JWT, info:', info);
        return res.redirect(`${clientUrl}/?settings=true&tab=social&error=unauthorized&platform=linkedin`);
      }
      
      try {
        userId = user.id;
        const state = generateState(userId);
        const authUrl = LinkedInService.getAuthUrl(state);
        
        logger.info(`[LinkedIn] Production mode - Redirecting to LinkedIn OAuth for user ${userId}`);
        res.redirect(authUrl);
      } catch (error) {
        logger.error('[LinkedIn] Failed to generate auth URL:', error);
        res.redirect(`${clientUrl}/?settings=true&tab=social&error=connect_failed&platform=linkedin`);
      }
    })(req, res);
  } catch (error) {
    logger.error('[LinkedIn] Connect initiation failed:', error);
    res.redirect(`${clientUrl}/?settings=true&tab=social&error=connect_failed&platform=linkedin`);
  }
});

/**
 * GET /api/linkedin/comments/connect
 * Initiate LinkedIn OAuth flow for comments app
 */
router.get('/comments/connect', async (req, res) => {
  const clientUrl = process.env.LIBRECHAT_URL || process.env.DOMAIN_CLIENT;

  try {
    let userId;
    const tokenFromQuery = req.query.token;

    if (tokenFromQuery) {
      try {
        const decoded = jwt.verify(tokenFromQuery, process.env.JWT_SECRET);
        userId = decoded.id;
        const state = generateCommentsState(userId);
        const authUrl = LinkedInService.getAuthUrl(state, 'comments');
        return res.redirect(authUrl);
      } catch (error) {
        logger.error('[LinkedIn/Comments] Invalid token in query parameter:', error.message);
        return res.redirect(
          `${clientUrl}/?settings=true&tab=social&error=invalid_token&platform=linkedin_comments`,
        );
      }
    }

    const jwtCookie = req.cookies?.token || req.cookies?.jwt || req.cookies?.refreshToken;
    if (jwtCookie) {
      try {
        const decoded = jwt.verify(jwtCookie, process.env.JWT_SECRET);
        userId = decoded.id;
        const state = generateCommentsState(userId);
        const authUrl = LinkedInService.getAuthUrl(state, 'comments');
        return res.redirect(authUrl);
      } catch (error) {
        logger.error('[LinkedIn/Comments] Invalid JWT in cookie:', error.message);
      }
    }

    passport.authenticate('jwt', { session: false }, (err, user, info) => {
      if (err || !user) {
        logger.error('[LinkedIn/Comments] Auth error:', err || info);
        return res.redirect(
          `${clientUrl}/?settings=true&tab=social&error=unauthorized&platform=linkedin_comments`,
        );
      }

      try {
        const state = generateCommentsState(user.id);
        const authUrl = LinkedInService.getAuthUrl(state, 'comments');
        res.redirect(authUrl);
      } catch (error) {
        logger.error('[LinkedIn/Comments] Failed to generate auth URL:', error);
        res.redirect(
          `${clientUrl}/?settings=true&tab=social&error=connect_failed&platform=linkedin_comments`,
        );
      }
    })(req, res);
  } catch (error) {
    logger.error('[LinkedIn/Comments] Connect initiation failed:', error);
    res.redirect(`${clientUrl}/?settings=true&tab=social&error=connect_failed&platform=linkedin_comments`);
  }
});

/**
 * GET /api/linkedin/callback
 * LinkedIn OAuth callback handler
 * Note: This route does NOT use requireJwtAuth because the state parameter contains the userId
 */
router.get('/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  // Use LIBRECHAT_URL for OAuth redirects (public URL), fallback to DOMAIN_CLIENT for dev
  const clientUrl = process.env.LIBRECHAT_URL || process.env.DOMAIN_CLIENT;

  // Handle OAuth errors
  if (oauthError) {
    logger.error(`[LinkedIn] OAuth error: ${oauthError}`);
    return res.redirect(`${clientUrl}/?settings=true&tab=social&error=oauth_${oauthError}&platform=linkedin`);
  }

  if (!code || !state) {
    logger.error('[LinkedIn] Missing code or state in callback');
    return res.redirect(`${clientUrl}/?settings=true&tab=social&error=invalid_callback&platform=linkedin`);
  }

  try {
    // Verify state parameter (contains userId)
    const { userId } = verifyState(state);

    logger.info(`[LinkedIn] Processing OAuth callback for user ${userId}`);

    // Exchange code for access token
    const { accessToken, refreshToken, expiresIn } = await LinkedInService.exchangeCodeForToken(code);

    // Get user profile
    const profile = await LinkedInService.getUserProfile(accessToken);

    // Save posting tokens; merge profile fields into metadata without wiping metadata.linkedinComments
    await SocialAccount.findOneAndUpdate(
      { userId: String(userId), platform: 'linkedin' },
      {
        $set: {
          userId: String(userId),
          platform: 'linkedin',
          accessToken,
          refreshToken,
          expiresAt: new Date(Date.now() + expiresIn * 1000),
          accountName: profile.name || profile.email,
          accountId: profile.sub,
          isActive: true,
          'metadata.email': profile.email,
          'metadata.picture': profile.picture,
          'metadata.givenName': profile.given_name,
          'metadata.familyName': profile.family_name,
        },
      },
      { upsert: true, new: true }
    );

    logger.info(`[LinkedIn] Successfully connected account for user ${userId}`);
    res.redirect(`${clientUrl}/?settings=true&tab=social&success=connected&platform=linkedin`);
  } catch (error) {
    logger.error('[LinkedIn] OAuth callback failed:', error);
    res.redirect(`${clientUrl}/?settings=true&tab=social&error=connection_failed&platform=linkedin&message=${encodeURIComponent(error.message)}`);
  }
});

/**
 * GET /api/linkedin/comments/callback
 * LinkedIn comments app OAuth callback handler
 */
router.get('/comments/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const clientUrl = process.env.LIBRECHAT_URL || process.env.DOMAIN_CLIENT;

  if (oauthError) {
    logger.error(`[LinkedIn/Comments] OAuth error: ${oauthError}`);
    return res.redirect(
      `${clientUrl}/?settings=true&tab=social&error=oauth_${oauthError}&platform=linkedin_comments`,
    );
  }

  if (!code || !state) {
    logger.error('[LinkedIn/Comments] Missing code or state in callback');
    return res.redirect(`${clientUrl}/?settings=true&tab=social&error=invalid_callback&platform=linkedin_comments`);
  }

  try {
    const decoded = verifyState(state);
    if (decoded.mode !== 'comments') {
      throw new Error('Invalid OAuth mode for comments callback');
    }

    const { accessToken, refreshToken, expiresIn } = await LinkedInService.exchangeCodeForToken(
      code,
      'comments',
    );

    const profile = await LinkedInService.getUserProfile(accessToken);

    const account = await SocialAccount.findOne({
      userId: String(decoded.userId),
      platform: 'linkedin',
      isActive: true,
    });

    if (!account) {
      return res.redirect(
        `${clientUrl}/?settings=true&tab=social&error=posting_not_connected&platform=linkedin_comments`,
      );
    }

    setCommentsTokenData(account, {
      accessToken,
      refreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
      isConnected: true,
      connectedAt: new Date(),
      accountName: profile.name || profile.email,
      accountId: profile.sub,
    });
    await account.save();

    logger.info('[LinkedIn/Comments] Comments OAuth saved', {
      userId: String(decoded.userId),
      hasLinkedinCommentsAfterSave: !!account.metadata?.linkedinComments,
    });
    return res.redirect(`${clientUrl}/?settings=true&tab=social&success=comments_connected&platform=linkedin`);
  } catch (error) {
    logger.error('[LinkedIn/Comments] OAuth callback failed:', error);
    return res.redirect(
      `${clientUrl}/?settings=true&tab=social&error=connection_failed&platform=linkedin_comments&message=${encodeURIComponent(error.message)}`,
    );
  }
});

/**
 * GET /api/linkedin/status
 * Get LinkedIn connection status for current user
 */
router.get('/status', requireJwtAuth, async (req, res) => {
  try {
    // Do not use .select('-accessToken') — in Mongoose, that can strip nested paths like
    // metadata.linkedinComments.accessToken and break the comments integration.
    const account = await SocialAccount.findOne({
      userId: String(req.user.id),
      platform: 'linkedin',
      isActive: true,
    }).select('userId platform isActive accountName accountId metadata createdAt');

    if (!account) {
      return res.json({
        connected: false,
        account: null,
      });
    }

    res.json({
      connected: true,
      account: {
        accountName: account.accountName,
        accountId: account.accountId,
        connectedAt: account.createdAt,
        metadata: sanitizeLinkedInMetadataForClient(account.metadata),
      },
    });
  } catch (error) {
    logger.error('[LinkedIn] Failed to get status:', error);
    res.status(500).json({ error: 'Failed to get LinkedIn status' });
  }
});

/**
 * GET /api/linkedin/comments/status
 * Get LinkedIn comments-app connection status for current user
 */
router.get('/comments/status', requireJwtAuth, async (req, res) => {
  try {
    const account = await SocialAccount.findOne({
      userId: String(req.user.id),
      platform: 'linkedin',
      isActive: true,
    }).select('userId platform isActive accountName accountId metadata updatedAt');

    const commentsData = getCommentsTokenData(account);

    if (!account || !commentsData?.isConnected || !commentsData?.accessToken) {
      // Safe diagnostics (no token values) — search logs for this when UI still asks to connect after OAuth
      if (account) {
        logger.warn('[LinkedIn/Comments] Status: not connected', {
          userId: String(req.user.id),
          hasLinkedinCommentsKey: !!account.metadata?.linkedinComments,
          commentsIsConnected: !!commentsData?.isConnected,
          hasAccessToken: !!(commentsData?.accessToken && String(commentsData.accessToken).length > 0),
        });
      } else {
        logger.warn('[LinkedIn/Comments] Status: no linkedin SocialAccount', {
          userId: String(req.user.id),
        });
      }
      return res.json({
        connected: false,
        account: null,
      });
    }

    return res.json({
      connected: true,
      account: {
        accountName: commentsData.accountName || account.accountName,
        accountId: commentsData.accountId || account.accountId,
        connectedAt: commentsData.connectedAt || account.updatedAt,
      },
    });
  } catch (error) {
    logger.error('[LinkedIn/Comments] Failed to get status:', error);
    return res.status(500).json({ error: 'Failed to get LinkedIn comments status' });
  }
});

/**
 * GET /api/linkedin/member/posts
 * Recent posts authored by the member (LinkedIn REST Posts API, q=author).
 * Uses the comments-app token; requires r_member_social (Community Management) on that app.
 */
router.get('/member/posts', requireJwtAuth, async (req, res) => {
  try {
    const account = await SocialAccount.findOne({
      userId: String(req.user.id),
      platform: 'linkedin',
      isActive: true,
    });

    if (!account?.accountId) {
      return res.status(400).json({
        error: 'linkedin_not_configured',
        message: 'Connect LinkedIn (posting) first so we know your member id.',
      });
    }

    const accessToken = await getValidAccessToken(account, { forComments: true });
    const personUrn = `urn:li:person:${account.accountId}`;
    const count = Math.min(Math.max(Number(req.query.count) || 20, 1), 100);

    const posts = await LinkedInService.listMemberPosts(accessToken, personUrn, { count });

    res.json({ success: true, posts });
  } catch (error) {
    logger.error('[LinkedIn] Failed to list member posts:', error);
    res.status(500).json({
      error: error.message || 'Failed to list posts',
      message: error.message,
    });
  }
});

/**
 * POST /api/linkedin/posts
 * Create a post on LinkedIn
 */
router.post('/posts', requireJwtAuth, async (req, res) => {
  try {
    const { content, visibility } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Post content is required' });
    }

    const account = await SocialAccount.findOne({
      userId: req.user.id,
      platform: 'linkedin',
      isActive: true,
    });

    if (!account) {
      return res.status(400).json({
        error: 'LinkedIn account not connected',
        message: 'Please connect your LinkedIn account first',
      });
    }

    // Get valid access token (refreshes if needed)
    // Posting should use the *posting* token (LinkedIn posting app), not the comments token.
    const accessToken = await getValidAccessToken(account);

    // Create post
    const personUrn = `urn:li:person:${account.accountId}`;
    const result = await LinkedInService.createPost(
      accessToken,
      personUrn,
      content.trim(),
      visibility || 'PUBLIC'
    );

    logger.info(`[LinkedIn] Post created for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Post published to LinkedIn',
      post: {
        id: result.id,
        urn: result.id,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('[LinkedIn] Failed to create post:', error);
    res.status(500).json({
      error: 'Failed to create post',
      message: error.message,
    });
  }
});

/**
 * POST /api/linkedin/comments
 * Post a comment on a LinkedIn post
 */
router.post('/comments', requireJwtAuth, async (req, res) => {
  try {
    const { postUrn: rawPostUrn, comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ error: 'Comment text is required' });
    }

    const postUrn =
      rawPostUrn &&
      (parseLinkedInPostUrn(String(rawPostUrn)) ||
        parseLinkedInPostUrn(tryDecodeURIComponent(String(rawPostUrn))));

    if (!postUrn) {
      return res.status(400).json({ error: 'Post URN is required' });
    }

    const account = await SocialAccount.findOne({
      userId: req.user.id,
      platform: 'linkedin',
      isActive: true,
    });

    if (!account) {
      return res.status(400).json({
        error: 'LinkedIn account not connected',
      });
    }

    const accessToken = await getValidAccessToken(account, { forComments: true });

    const result = await LinkedInService.postComment(
      accessToken,
      postUrn,
      comment.trim()
    );

    logger.info(`[LinkedIn] Comment posted for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Comment posted to LinkedIn',
      comment: {
        id: result.id,
        urn: result.id,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('[LinkedIn] Failed to post comment:', error);
    res.status(500).json({
      error: error.message || 'Failed to post comment',
      message:
        error.message === 'COMMENTS_NOT_CONNECTED'
          ? 'Comments access is not connected. Please connect comments access in Settings.'
          : error.message === 'COMMENTS_TOKEN_EXPIRED_RECONNECT_REQUIRED'
            ? 'LinkedIn comments token expired. Please reconnect comments access.'
            : error.message,
    });
  }
});

/**
 * POST /api/linkedin/comments/:commentUrn/reply
 * Reply to a comment on LinkedIn
 */
router.post('/comments/:commentUrn/reply', requireJwtAuth, async (req, res) => {
  try {
    const { commentUrn } = req.params;
    const { reply } = req.body;

    if (!reply || !reply.trim()) {
      return res.status(400).json({ error: 'Reply text is required' });
    }

    const account = await SocialAccount.findOne({
      userId: req.user.id,
      platform: 'linkedin',
      isActive: true,
    });

    if (!account) {
      return res.status(400).json({
        error: 'LinkedIn account not connected',
      });
    }

    const accessToken = await getValidAccessToken(account, { forComments: true });

    const result = await LinkedInService.replyToComment(
      accessToken,
      commentUrn,
      reply.trim()
    );

    logger.info(`[LinkedIn] Reply posted for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Reply posted to LinkedIn',
      reply: {
        id: result.id,
        urn: result.id,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    logger.error('[LinkedIn] Failed to reply to comment:', error);
    res.status(500).json({
      error: error.message || 'Failed to reply to comment',
      message:
        error.message === 'COMMENTS_NOT_CONNECTED'
          ? 'Comments access is not connected. Please connect comments access in Settings.'
          : error.message === 'COMMENTS_TOKEN_EXPIRED_RECONNECT_REQUIRED'
            ? 'LinkedIn comments token expired. Please reconnect comments access.'
            : error.message,
    });
  }
});

/**
 * GET /api/linkedin/comments/:postUrn
 * Get comments on a LinkedIn post
 */
router.get('/comments/:postUrn', requireJwtAuth, async (req, res) => {
  try {
    const rawParam = req.params.postUrn ? String(req.params.postUrn) : '';
    const postUrn =
      parseLinkedInPostUrn(rawParam) || parseLinkedInPostUrn(tryDecodeURIComponent(rawParam));

    if (!postUrn) {
      return res.status(400).json({
        error: 'invalid_post_urn',
        message:
          'Could not find a post URN. Paste the post’s “Copy link”, or urn:li:activity:… / urn:li:ugcPost:…. For a comment link, we use the parent post’s activity/ugc URN.',
      });
    }

    const account = await SocialAccount.findOne({
      userId: req.user.id,
      platform: 'linkedin',
      isActive: true,
    });

    if (!account) {
      return res.status(400).json({
        error: 'LinkedIn account not connected',
      });
    }

    const accessToken = await getValidAccessToken(account, { forComments: true });

    const comments = await LinkedInService.getComments(accessToken, postUrn);

    res.json({
      success: true,
      comments: comments.map(comment => ({
        id: comment.id,
        urn: comment.id,
        text: comment.message?.text || '',
        author: comment.actor,
        createdAt: comment.created?.time || new Date(),
        likeCount: comment.likesSummary?.totalLikes || 0,
      })),
    });
  } catch (error) {
    logger.error('[LinkedIn] Failed to get comments:', error);
    res.status(500).json({
      error: error.message || 'Failed to get comments',
      message:
        error.message === 'COMMENTS_NOT_CONNECTED'
          ? 'Comments access is not connected. Please connect comments access in Settings.'
          : error.message === 'COMMENTS_TOKEN_EXPIRED_RECONNECT_REQUIRED'
            ? 'LinkedIn comments token expired. Please reconnect comments access.'
            : error.message,
    });
  }
});

/**
 * DELETE /api/linkedin/comments/disconnect
 * Disconnect LinkedIn comments access while keeping posting connected
 */
router.delete('/comments/disconnect', requireJwtAuth, async (req, res) => {
  try {
    const account = await SocialAccount.findOne({
      userId: req.user.id,
      platform: 'linkedin',
      isActive: true,
    });

    if (!account) {
      return res.status(404).json({ error: 'LinkedIn account not found' });
    }

    const metadata = account.metadata && typeof account.metadata === 'object' ? account.metadata : {};
    delete metadata.linkedinComments;
    account.metadata = metadata;
    account.markModified('metadata');
    await account.save();

    logger.info(`[LinkedIn/Comments] Comments access disconnected for user ${req.user.id}`);
    return res.json({
      success: true,
      message: 'LinkedIn comments access disconnected successfully',
    });
  } catch (error) {
    logger.error('[LinkedIn/Comments] Failed to disconnect comments access:', error);
    return res.status(500).json({
      error: 'Failed to disconnect LinkedIn comments access',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/linkedin/disconnect
 * Disconnect LinkedIn account
 */
router.delete('/disconnect', requireJwtAuth, async (req, res) => {
  try {
    const result = await SocialAccount.findOneAndUpdate(
      { userId: req.user.id, platform: 'linkedin' },
      { isActive: false },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ error: 'LinkedIn account not found' });
    }

    logger.info(`[LinkedIn] Account disconnected for user ${req.user.id}`);

    res.json({
      success: true,
      message: 'LinkedIn account disconnected successfully',
    });
  } catch (error) {
    logger.error('[LinkedIn] Failed to disconnect:', error);
    res.status(500).json({
      error: 'Failed to disconnect LinkedIn account',
      message: error.message,
    });
  }
});

module.exports = router;
