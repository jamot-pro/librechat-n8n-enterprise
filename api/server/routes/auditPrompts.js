const express = require('express');
const router = express.Router();
const AuditPrompt = require('~/models/AuditPrompt');
const JamotCapability = require('~/models/JamotCapability');
const { requireJwtAuth } = require('~/server/middleware');
const requireCEORole = require('~/server/middleware/requireCEORole');
const { logger } = require('@librechat/data-schemas');

// ═══════════════════════════════════════════════════════════════
// PUBLIC API — secured by ADMIN_API_SECRET (for external services)
// ═══════════════════════════════════════════════════════════════

function requireApiSecret(req, res, next) {
  const secret = process.env.ADMIN_API_SECRET;
  if (!secret) {
    return res.status(503).json({ error: 'API secret not configured' });
  }
  const auth = req.headers.authorization;
  if (!auth || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Invalid or missing API secret' });
  }
  next();
}

/**
 * GET /api/audit-prompts/public
 * Fetch all latest active prompts, or filter by key/category/version
 *
 * Query params:
 *   key       — fetch specific prompt by key
 *   version   — fetch specific version (requires key). "latest" or integer.
 *   category  — filter by category
 *   active    — "true" (default) or "false" to include inactive
 */
router.get('/public', requireApiSecret, async (req, res) => {
  try {
    const { key, version, category, active } = req.query;

    // Single prompt by key
    if (key) {
      if (version && version !== 'latest') {
        const prompt = await AuditPrompt.findOne({ key, version: parseInt(version) }).lean();
        if (!prompt) return res.status(404).json({ error: 'Prompt version not found' });
        return res.json(prompt);
      }
      // Latest version
      const prompt = await AuditPrompt.findOne({ key, isLatest: true }).lean();
      if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
      return res.json(prompt);
    }

    // List prompts
    const filter = { isLatest: true };
    if (active !== 'false') filter.isActive = true;
    if (category) filter.category = category;

    const prompts = await AuditPrompt.find(filter)
      .select('-__v')
      .sort({ category: 1, name: 1 })
      .lean();

    res.json({ prompts, total: prompts.length });
  } catch (err) {
    logger.error('[AuditPrompts] public GET error:', err);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

/**
 * GET /api/audit-prompts/public/:key/versions
 * List all versions of a specific prompt
 */
router.get('/public/:key/versions', requireApiSecret, async (req, res) => {
  try {
    const versions = await AuditPrompt.find({ key: req.params.key })
      .select('key version name isLatest isActive createdAt')
      .sort({ version: -1 })
      .lean();

    if (!versions.length) return res.status(404).json({ error: 'Prompt not found' });
    res.json({ versions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

/**
 * GET /api/audit-prompts/public/capabilities
 * Fetch the capabilities JSON (external services)
 */
router.get('/public/capabilities', requireApiSecret, async (req, res) => {
  try {
    const doc = await JamotCapability.findOne().lean();
    res.json(doc || { data: {} });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch capabilities' });
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN API — CEO only (for dashboard management)
// ═══════════════════════════════════════════════════════════════

router.use(requireJwtAuth);
router.use(requireCEORole);

// ═══════════════════════════════════════════════════════════════
// CAPABILITIES — singleton JSON document (must be before /:key)
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/audit-prompts/capabilities
 * Fetch the capabilities JSON
 */
router.get('/capabilities', async (req, res) => {
  try {
    const doc = await JamotCapability.findOne().lean();
    res.json(doc || { data: {} });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch capabilities' });
  }
});

/**
 * PUT /api/audit-prompts/capabilities
 * Upsert the capabilities JSON
 */
router.put('/capabilities', async (req, res) => {
  try {
    const { data } = req.body;
    if (data === undefined) {
      return res.status(400).json({ error: 'data field is required' });
    }

    const doc = await JamotCapability.findOneAndUpdate(
      {},
      { data, updatedBy: req.user._id },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    res.json(doc);
  } catch (err) {
    logger.error('[Capabilities] update error:', err);
    res.status(500).json({ error: 'Failed to update capabilities' });
  }
});

// ═══════════════════════════════════════════════════════════════
// PROMPTS ADMIN CRUD
// ═══════════════════════════════════════════════════════════════

/**
 * GET /api/audit-prompts
 * List all latest prompts for management UI
 */
router.get('/', async (req, res) => {
  try {
    const { category, includeInactive } = req.query;
    const filter = { isLatest: true };
    if (!includeInactive) filter.isActive = true;
    if (category) filter.category = category;

    const prompts = await AuditPrompt.find(filter)
      .sort({ category: 1, name: 1 })
      .lean();

    // Get unique categories
    const categories = await AuditPrompt.distinct('category', { isLatest: true });

    res.json({ prompts, categories, total: prompts.length });
  } catch (err) {
    logger.error('[AuditPrompts] list error:', err);
    res.status(500).json({ error: 'Failed to fetch prompts' });
  }
});

/**
 * GET /api/audit-prompts/:key
 * Get a single prompt (latest version)
 */
router.get('/:key', async (req, res) => {
  try {
    const prompt = await AuditPrompt.findOne({ key: req.params.key, isLatest: true }).lean();
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });
    res.json(prompt);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch prompt' });
  }
});

/**
 * GET /api/audit-prompts/:key/versions
 * List all versions of a prompt
 */
router.get('/:key/versions', async (req, res) => {
  try {
    const versions = await AuditPrompt.find({ key: req.params.key })
      .sort({ version: -1 })
      .lean();

    if (!versions.length) return res.status(404).json({ error: 'Prompt not found' });
    res.json({ versions });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

/**
 * POST /api/audit-prompts
 * Create a new prompt (version 1)
 */
router.post('/', async (req, res) => {
  try {
    const { key, name, content, description, category } = req.body;

    if (!key || !name || !content) {
      return res.status(400).json({ error: 'key, name, and content are required' });
    }

    // Validate key format
    if (!/^prompt_[a-z0-9_]+$/.test(key)) {
      return res.status(400).json({
        error: 'Key must match: prompt_<lowercase_underscored_name> (e.g. prompt_safety_checklist)',
      });
    }

    // Check if key already exists
    const existing = await AuditPrompt.findOne({ key, isLatest: true });
    if (existing) {
      return res.status(409).json({ error: `Prompt with key "${key}" already exists` });
    }

    const prompt = await AuditPrompt.create({
      key,
      version: 1,
      name,
      content,
      description: description || '',
      category: category || 'general',
      isLatest: true,
      isActive: true,
      createdBy: req.user._id,
    });

    res.status(201).json(prompt);
  } catch (err) {
    logger.error('[AuditPrompts] create error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Prompt with this key and version already exists' });
    }
    res.status(500).json({ error: 'Failed to create prompt' });
  }
});

/**
 * PUT /api/audit-prompts/:key
 * Update a prompt — creates a new version, marks old as not latest
 */
router.put('/:key', async (req, res) => {
  try {
    const { name, content, description, category } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    // Find current latest
    const current = await AuditPrompt.findOne({ key: req.params.key, isLatest: true });
    if (!current) {
      return res.status(404).json({ error: 'Prompt not found' });
    }

    // Mark current as no longer latest
    await AuditPrompt.updateOne({ _id: current._id }, { isLatest: false });

    // Create new version
    const newVersion = await AuditPrompt.create({
      key: current.key,
      version: current.version + 1,
      name: name || current.name,
      content,
      description: description !== undefined ? description : current.description,
      category: category || current.category,
      isLatest: true,
      isActive: current.isActive,
      createdBy: req.user._id,
    });

    res.json(newVersion);
  } catch (err) {
    logger.error('[AuditPrompts] update error:', err);
    res.status(500).json({ error: 'Failed to update prompt' });
  }
});

/**
 * PATCH /api/audit-prompts/:key/toggle
 * Toggle active/inactive status
 */
router.patch('/:key/toggle', async (req, res) => {
  try {
    const prompt = await AuditPrompt.findOne({ key: req.params.key, isLatest: true });
    if (!prompt) return res.status(404).json({ error: 'Prompt not found' });

    prompt.isActive = !prompt.isActive;
    await prompt.save();

    res.json({ key: prompt.key, isActive: prompt.isActive });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle prompt' });
  }
});

/**
 * DELETE /api/audit-prompts/:key
 * Delete all versions of a prompt
 */
router.delete('/:key', async (req, res) => {
  try {
    const result = await AuditPrompt.deleteMany({ key: req.params.key });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Prompt not found' });
    }
    res.json({ deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

module.exports = router;
