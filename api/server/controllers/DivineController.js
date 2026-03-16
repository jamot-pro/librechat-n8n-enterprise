const Profile = require('../models/Profile');
const { runDivineAgent } = require('../services/divine/runner');
const { getRecentHistory, appendHistory, clearHistory } = require('../services/divine/history');
const DivineConversation = require('../../models/DivineConversation');
const DivinEvent = require('../../models/DivinEvent');
const DivineNotification = require('../../models/DivineNotification');
const { logger } = require('@librechat/data-schemas');

const DivineController = {
  /**
   * POST /api/divine/chat
   * Body: { message: string }
   * Response: SSE stream — chunks then a final [DONE] event
   */
  chat: async (req, res) => {
    const { message } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'message is required' });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
    }

    const profile = await Profile.findOne({ userId: req.user._id }).lean();
    if (!profile) {
      return res.status(403).json({ error: 'Profile not configured. Contact your administrator.' });
    }

    const history = await getRecentHistory(req.user._id.toString(), 20);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

    let fullResponse = '';
    try {
      fullResponse = await runDivineAgent({
        userId: req.user._id.toString(),
        profileType: profile.profileType,
        userMessage: message.trim(),
        history,
        onChunk: (chunk) => send({ type: 'chunk', content: chunk }),
      });

      send({ type: 'done', content: fullResponse });
      res.end();

      // Persist history in background
      appendHistory(req.user._id.toString(), message.trim(), fullResponse).catch((err) =>
        logger.error('[DivineController] Failed to save history:', err),
      );
    } catch (err) {
      logger.error('[DivineController] Agent error:', err);
      send({ type: 'error', content: 'Something went wrong. Please try again.' });
      res.end();
    }
  },

  /**
   * GET /api/divine/history
   */
  getHistory: async (req, res) => {
    try {
      const history = await getRecentHistory(req.user._id.toString(), 50);
      res.json({ history });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load history' });
    }
  },

  /**
   * DELETE /api/divine/history
   */
  clearHistory: async (req, res) => {
    try {
      await clearHistory(req.user._id.toString());
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to clear history' });
    }
  },

  /**
   * GET /api/divine/events
   * CEO only — returns autonomous action log (DivinEvent)
   * Query: ?limit=50&page=1&success=true|false
   */
  getEvents: async (req, res) => {
    try {
      const profile = await Profile.findOne({ userId: req.user._id }).lean();
      if (profile?.profileType !== 'ceo') {
        return res.status(403).json({ error: 'CEO access required' });
      }

      const limit = Math.min(parseInt(req.query.limit) || 50, 100);
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const skip = (page - 1) * limit;

      const filter = {};
      if (req.query.success === 'true') filter.success = true;
      if (req.query.success === 'false') filter.success = false;

      const [events, total] = await Promise.all([
        DivinEvent.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        DivinEvent.countDocuments(filter),
      ]);

      res.json({ events, total, page, limit });
    } catch (err) {
      logger.error('[DivineController] getEvents error:', err);
      res.status(500).json({ error: 'Failed to load events' });
    }
  },

  /**
   * GET /api/divine/events/stats
   * CEO only — summary stats for activity log dashboard widget
   */
  getEventStats: async (req, res) => {
    try {
      const profile = await Profile.findOne({ userId: req.user._id }).lean();
      if (profile?.profileType !== 'ceo') {
        return res.status(403).json({ error: 'CEO access required' });
      }

      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [total, last24h, failures] = await Promise.all([
        DivinEvent.countDocuments(),
        DivinEvent.countDocuments({ createdAt: { $gte: since24h } }),
        DivinEvent.countDocuments({ success: false, createdAt: { $gte: since24h } }),
      ]);

      // Most recent event
      const latest = await DivinEvent.findOne().sort({ createdAt: -1 }).select('trigger createdAt success').lean();

      res.json({ total, last24h, failures, latest });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load event stats' });
    }
  },

  /**
   * GET /api/divine/notifications
   * Returns in-app notifications for the current user
   * Query: ?unreadOnly=true
   */
  getNotifications: async (req, res) => {
    try {
      const filter = { userId: req.user._id };
      if (req.query.unreadOnly === 'true') filter.read = false;

      const notifications = await DivineNotification.find(filter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      const unreadCount = await DivineNotification.countDocuments({ userId: req.user._id, read: false });

      res.json({ notifications, unreadCount });
    } catch (err) {
      res.status(500).json({ error: 'Failed to load notifications' });
    }
  },

  /**
   * PATCH /api/divine/notifications/:id/read
   * Mark a notification as read
   */
  markNotificationRead: async (req, res) => {
    try {
      await DivineNotification.findOneAndUpdate(
        { _id: req.params.id, userId: req.user._id },
        { read: true },
      );
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to mark notification read' });
    }
  },

  /**
   * PATCH /api/divine/notifications/read-all
   * Mark all notifications as read
   */
  markAllNotificationsRead: async (req, res) => {
    try {
      await DivineNotification.updateMany({ userId: req.user._id, read: false }, { read: true });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to mark all notifications read' });
    }
  },
};

module.exports = DivineController;
