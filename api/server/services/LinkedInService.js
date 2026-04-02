const axios = require('axios');
const logger = require('~/config/winston');

class LinkedInService {
  constructor() {
    this.clientId = process.env.LINKEDIN_CLIENT_ID;
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    this.redirectUri = process.env.LINKEDIN_REDIRECT_URI;
    this.commentsClientId = process.env.LINKEDIN_COMMENTS_CLIENT_ID;
    this.commentsClientSecret = process.env.LINKEDIN_COMMENTS_CLIENT_SECRET;
    this.commentsRedirectUri = process.env.LINKEDIN_COMMENTS_REDIRECT_URI;
    this.apiBaseUrl = 'https://api.linkedin.com/v2';
    /** REST Posts API (Community Management) — requires Linkedin-Version header */
    this.restBaseUrl = 'https://api.linkedin.com/rest';
    this.restApiVersion = process.env.LINKEDIN_REST_API_VERSION || '202502';
    
    if (!this.clientId || !this.clientSecret) {
      logger.warn('[LinkedInService] LinkedIn credentials not configured');
    }
  }

  /**
   * Generate OAuth authorization URL
   * @param {string} state - Secure state parameter
   * @returns {string} Authorization URL
   */
  getAuthUrl(state, mode = 'posting') {
    const isCommentsMode = mode === 'comments';
    const clientId = isCommentsMode ? this.commentsClientId : this.clientId;
    const redirectUri = isCommentsMode ? this.commentsRedirectUri : this.redirectUri;

    const scopes = isCommentsMode
      ? [
          'openid',
          'profile',
          'email',
          'w_member_social',
          'r_member_social', // Read posts + comments (Community Management API)
        ]
      : ['openid', 'profile', 'email', 'w_member_social'];

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      state: state,
      scope: scopes.join(' '),
    });

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * @param {string} code - Authorization code from callback
   * @returns {Promise<Object>} Token data
   */
  async exchangeCodeForToken(code, mode = 'posting') {
    const isCommentsMode = mode === 'comments';
    const clientId = isCommentsMode ? this.commentsClientId : this.clientId;
    const clientSecret = isCommentsMode ? this.commentsClientSecret : this.clientSecret;
    const redirectUri = isCommentsMode ? this.commentsRedirectUri : this.redirectUri;

    try {
      const response = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
        refreshToken: response.data.refresh_token,
      };
    } catch (error) {
      logger.error('[LinkedIn] Token exchange failed:', error.response?.data || error.message);
      throw new Error('Failed to exchange code for token');
    }
  }

  /**
   * Get user profile information
   * @param {string} accessToken - User's access token
   * @returns {Promise<Object>} User profile data
   */
  async getUserProfile(accessToken) {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/userinfo`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.data;
    } catch (error) {
      logger.error('[LinkedIn] Get profile failed:', error.message);
      throw new Error('Failed to get user profile');
    }
  }

  /**
   * Create a post on LinkedIn
   * @param {string} accessToken - User's access token
   * @param {string} personUrn - User's LinkedIn URN
   * @param {string} content - Post content
   * @param {string} visibility - Post visibility (PUBLIC, CONNECTIONS, LOGGED_IN)
   * @returns {Promise<Object>} Created post data
   */
  async createPost(accessToken, personUrn, content, visibility = 'PUBLIC') {
    try {
      const postData = {
        author: personUrn,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: {
              text: content,
            },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: {
          'com.linkedin.ugc.MemberNetworkVisibility': visibility,
        },
      };

      const response = await axios.post(
        `${this.apiBaseUrl}/ugcPosts`,
        postData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      logger.info('[LinkedIn] Post created successfully');
      return response.data;
    } catch (error) {
      logger.error('[LinkedIn] Create post failed:', error.response?.data || error.message);
      throw new Error('Failed to create post on LinkedIn');
    }
  }

  /**
   * Post a comment on a LinkedIn post
   * @param {string} accessToken - User's access token
   * @param {string} postUrn - URN of the post to comment on
   * @param {string} commentText - Comment text
   * @returns {Promise<Object>} Created comment data
   */
  async postComment(accessToken, postUrn, commentText) {
    try {
      const commentData = {
        actor: 'urn:li:person:CURRENT_USER', // LinkedIn resolves this to current user
        message: {
          text: commentText,
        },
        object: postUrn,
      };

      const response = await axios.post(
        `${this.apiBaseUrl}/socialActions/${encodeURIComponent(postUrn)}/comments`,
        commentData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      logger.info('[LinkedIn] Comment posted successfully');
      return response.data;
    } catch (error) {
      logger.error('[LinkedIn] Post comment failed:', error.response?.data || error.message);
      throw new Error('Failed to post comment on LinkedIn');
    }
  }

  /**
   * Reply to a comment on LinkedIn
   * @param {string} accessToken - User's access token
   * @param {string} commentUrn - URN of the comment to reply to
   * @param {string} replyText - Reply text
   * @returns {Promise<Object>} Created reply data
   */
  async replyToComment(accessToken, commentUrn, replyText) {
    try {
      const replyData = {
        actor: 'urn:li:person:CURRENT_USER',
        message: {
          text: replyText,
        },
        parentComment: commentUrn,
      };

      const response = await axios.post(
        `${this.apiBaseUrl}/socialActions/${encodeURIComponent(commentUrn)}/comments`,
        replyData,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      logger.info('[LinkedIn] Reply posted successfully');
      return response.data;
    } catch (error) {
      logger.error('[LinkedIn] Reply to comment failed:', error.response?.data || error.message);
      throw new Error('Failed to reply to comment on LinkedIn');
    }
  }

  /**
   * List recent posts authored by a member (REST Posts API finder q=author).
   * Requires r_member_social on the token (Community Management product).
   * @see https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
   */
  async listMemberPosts(accessToken, personUrn, { count = 20 } = {}) {
    try {
      const response = await axios.get(`${this.restBaseUrl}/posts`, {
        params: {
          q: 'author',
          author: personUrn,
          count: Math.min(Math.max(Number(count) || 20, 1), 100),
          sortBy: 'LAST_MODIFIED',
          viewContext: 'AUTHOR',
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Restli-Protocol-Version': '2.0.0',
          'Linkedin-Version': this.restApiVersion,
        },
      });

      const d = response.data;
      const raw =
        d?.elements ??
        d?.data ??
        (Array.isArray(d) ? d : []);
      const elements = Array.isArray(raw) ? raw : [];

      return elements.map((p) => ({
        id: p.id,
        urn: p.id,
        preview: LinkedInService._extractCommentaryPreview(p.commentary),
        lifecycleState: p.lifecycleState,
        createdAt: p.createdAt != null ? new Date(p.createdAt) : null,
        lastModifiedAt: p.lastModifiedAt != null ? new Date(p.lastModifiedAt) : null,
      }));
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;
      logger.error('[LinkedIn] listMemberPosts failed:', { status, body: data || error.message, personUrn });
      const msg =
        (typeof data?.message === 'string' && data.message) ||
        data?.errorDetails?.[0]?.message ||
        '';
      if (status === 403) {
        throw new Error(
          'LinkedIn denied listing your posts. Reconnect Comments Access after enabling r_member_social (Community Management).',
        );
      }
      throw new Error(
        msg ? `LinkedIn: ${msg}` : `Failed to list posts${status ? ` (HTTP ${status})` : ''}`,
      );
    }
  }

  /** @param {unknown} commentary — little-text or string */
  static _extractCommentaryPreview(commentary) {
    if (commentary == null) return '';
    if (typeof commentary === 'string') return commentary.slice(0, 400);
    if (typeof commentary === 'object' && commentary !== null) {
      const t = /** @type {{ text?: unknown }} */ (commentary).text;
      if (typeof t === 'string') return t.slice(0, 400);
      if (t && typeof t === 'object' && 'text' in t && typeof /** @type {{ text: string }} */ (t).text === 'string') {
        return /** @type {{ text: string }} */ (t).text.slice(0, 400);
      }
    }
    return '';
  }

  async getComments(accessToken, postUrn) {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/socialActions/${encodeURIComponent(postUrn)}/comments`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0',
          },
          params: {
            count: 100, // Get up to 100 comments
          },
        }
      );

      return response.data.elements || [];
    } catch (error) {
      const status = error.response?.status;
      const data = error.response?.data;
      logger.error('[LinkedIn] Get comments failed:', {
        status,
        postUrn,
        body: data || error.message,
      });

      const linkedInMsg =
        (typeof data?.message === 'string' && data.message) ||
        data?.errorDetails?.[0]?.message ||
        data?.serviceErrorCode ||
        '';

      if (status === 403) {
        throw new Error(
          'LinkedIn refused to load comments. Your app may need permission to read social data (e.g. r_member_social), or the post may be private.',
        );
      }
      if (status === 404) {
        throw new Error(
          `No comments thread found for this URN. Try the feed URL, or an urn:li:activity:… / urn:li:ugcPost:… from “Copy link to post”. ${linkedInMsg}`.trim(),
        );
      }

      throw new Error(
        linkedInMsg
          ? `LinkedIn: ${linkedInMsg}`
          : `Failed to get comments from LinkedIn${status ? ` (HTTP ${status})` : ''}`,
      );
    }
  }

  /**
   * Refresh access token using refresh token
   * @param {string} refreshToken - User's refresh token
   * @returns {Promise<Object>} New token data
   */
  async refreshAccessToken(refreshToken, mode = 'posting') {
    const isCommentsMode = mode === 'comments';
    const clientId = isCommentsMode ? this.commentsClientId : this.clientId;
    const clientSecret = isCommentsMode ? this.commentsClientSecret : this.clientSecret;

    try {
      const response = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
        refreshToken: response.data.refresh_token || refreshToken,
      };
    } catch (error) {
      logger.error('[LinkedIn] Token refresh failed:', error.response?.data || error.message);
      throw new Error('Failed to refresh LinkedIn token');
    }
  }
}

module.exports = new LinkedInService();
