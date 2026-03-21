const fs = require('fs').promises;
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { User } = require('@librechat/data-schemas').createModels(mongoose);
const { FileContext } = require('librechat-data-provider');
const { requireJwtAuth, configMiddleware } = require('../middleware');
const { createFileLimiters } = require('../middleware/limiters/uploadLimiters');
const { createFile, getFiles } = require('~/models/File');
const { processDeleteRequest } = require('~/server/services/Files/process');
const Candidate = require('~/models/Candidate');
const HiringTask = require('~/models/HiringTask');
const HiringColumn = require('~/models/HiringColumn');
const onboardingAgent = require('../services/OnboardingAgent');
const logger = require('~/config/winston');
const { getFileStrategy } = require('~/server/utils/getFileStrategy');
const { getStrategyFunctions } = require('~/server/services/Files/strategies');
const { createMulterInstance } = require('./files/multer');

const { fileUploadIpLimiter, fileUploadUserLimiter } = createFileLimiters();
const hiringTaskImageUpload = createMulterInstance().then((m) => m.single('file'));

/**
 * Remove files from storage (S3/local/etc.) and File collection for hiring task attachments.
 * Only deletes rows owned by the current user.
 * @param {import('express').Request} req
 * @param {string[]} removedFileIds
 */
async function deleteHiringTaskAttachmentFiles(req, removedFileIds) {
  if (!removedFileIds?.length) {
    return;
  }
  const dbFiles = await getFiles({ file_id: { $in: removedFileIds } }, null, { text: 0 });
  const ownedFiles = dbFiles.filter(
    (f) => f.user && f.user.toString() === req.user.id.toString(),
  );
  if (ownedFiles.length === 0) {
    return;
  }
  const previousBody = req.body;
  req.body = {};
  try {
    await processDeleteRequest({ req, files: ownedFiles });
  } finally {
    req.body = previousBody;
  }
}

// Default columns seeded if none exist
const DEFAULT_COLUMNS = [
  { label: 'To Do', order: 0 },
  { label: 'In Progress', order: 1 },
  { label: 'Review', order: 2 },
  { label: 'Done', order: 3 },
];

// ── WhatsApp Webhook ──────────────────────────────────────────────────────────

/**
 * GET /api/hiring/whatsapp/webhook
 * Meta webhook verification handshake.
 */
router.get('/whatsapp/webhook', (req, res) => {
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  const rawUrl = req.url || '';
  const qIndex = rawUrl.indexOf('?');
  const queryString = qIndex !== -1 ? rawUrl.slice(qIndex + 1) : '';
  const params = new URLSearchParams(queryString);

  const mode = req.query['hub.mode'] || params.get('hub.mode');
  const token = req.query['hub.verify_token'] || params.get('hub.verify_token');
  const challenge = req.query['hub.challenge'] || params.get('hub.challenge');

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('[WhatsApp] Webhook verified');
    return res.status(200).send(challenge);
  }
  return res.status(403).json({ error: 'Forbidden' });
});

/**
 * POST /api/hiring/whatsapp/webhook
 * Receive incoming WhatsApp messages and route to OnboardingAgent.
 */
router.post('/whatsapp/webhook', async (req, res) => {
  // Acknowledge immediately — Meta requires a 200 within 20s
  res.status(200).send('OK');

  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value || !value.messages) continue;

        for (const message of value.messages) {
          if (message.type !== 'text') continue;

          const from = `+${message.from}`; // Meta sends without leading +
          const text = message.text?.body?.trim();
          if (!text) continue;

          // Find candidate by WhatsApp number (any active onboarding status)
          const candidate = await Candidate.findOne({
            whatsapp: from,
            status: { $in: ['onboarding', 'pending'] },
          });
          if (!candidate) {
            logger.warn(`[WhatsApp] Received message from unknown/inactive number: ${from}`);
            continue;
          }

          // If stuck in pending, resume onboarding
          if (candidate.status === 'pending' && candidate.onboardingStep > 0) {
            await Candidate.findByIdAndUpdate(candidate._id, { status: 'onboarding' });
          }

          logger.info(`[WhatsApp] Processing response from ${from} at step: ${candidate.onboardingStep}`);
          await onboardingAgent.processResponse(candidate._id.toString(), text);
        }
      }
    }
  } catch (err) {
    logger.error('[WhatsApp] Webhook processing error:', err.message);
  }
});

// ── Candidates ────────────────────────────────────────────────────────────────

/**
 * POST /api/hiring/candidates
 * Create a candidate and trigger the OnboardingAgent.
 */
router.post('/candidates', requireJwtAuth, async (req, res) => {
  const { name, whatsapp, role } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!whatsapp || !whatsapp.trim()) {
    return res.status(400).json({ error: 'whatsapp is required' });
  }

  try {
    const candidate = await Candidate.create({ name: name.trim(), whatsapp: whatsapp.trim(), role: role?.trim() ?? '' });
    // Fire-and-forget — errors are handled inside the agent
    onboardingAgent.initiateConversation(candidate).catch((err) =>
      logger.error('[hiring] OnboardingAgent error:', err.message),
    );
    return res.status(201).json(candidate);
  } catch (err) {
    logger.error('[hiring] POST /candidates error:', err.message);
    return res.status(500).json({ error: 'Failed to create candidate' });
  }
});

/**
 * GET /api/hiring/candidates
 * Return all candidates.
 */
router.get('/candidates', requireJwtAuth, async (req, res) => {
  try {
    const candidates = await Candidate.find().sort({ createdAt: -1 });
    return res.json(candidates);
  } catch (err) {
    logger.error('[hiring] GET /candidates error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch candidates' });
  }
});

/**
 * GET /api/hiring/candidates/:id
 * Return a single candidate by ID.
 */
router.get('/candidates/:id', requireJwtAuth, async (req, res) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    return res.json(candidate);
  } catch (err) {
    logger.error('[hiring] GET /candidates/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch candidate' });
  }
});

/**
 * DELETE /api/hiring/candidates/:id
 * Delete a candidate.
 */
router.delete('/candidates/:id', requireJwtAuth, async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndDelete(req.params.id);
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    logger.error('[hiring] DELETE /candidates/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to delete candidate' });
  }
});

/**
 * PATCH /api/hiring/candidates/:id
 * Partial update of a candidate.
 */
router.patch('/candidates/:id', requireJwtAuth, async (req, res) => {
  try {
    const candidate = await Candidate.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    return res.json(candidate);
  } catch (err) {
    logger.error('[hiring] PATCH /candidates/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to update candidate' });
  }
});

// ── Columns ───────────────────────────────────────────────────────────────────

/**
 * GET /api/hiring/columns
 * Return all columns ordered by `order`. Seeds defaults if none exist.
 */
router.get('/columns', requireJwtAuth, async (req, res) => {
  try {
    let columns = await HiringColumn.find().sort({ order: 1 });
    if (columns.length === 0) {
      columns = await HiringColumn.insertMany(DEFAULT_COLUMNS);
    }
    return res.json(columns);
  } catch (err) {
    logger.error('[hiring] GET /columns error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch columns' });
  }
});

/**
 * POST /api/hiring/columns
 * Create a new column.
 */
router.post('/columns', requireJwtAuth, async (req, res) => {
  const { label } = req.body;
  if (!label || !label.trim()) {
    return res.status(400).json({ error: 'label is required' });
  }
  try {
    const count = await HiringColumn.countDocuments();
    const column = await HiringColumn.create({ label: label.trim(), order: count });
    return res.status(201).json(column);
  } catch (err) {
    logger.error('[hiring] POST /columns error:', err.message);
    return res.status(500).json({ error: 'Failed to create column' });
  }
});

/**
 * PATCH /api/hiring/columns/:id
 * Update a column (label or order).
 */
router.patch('/columns/:id', requireJwtAuth, async (req, res) => {
  try {
    const column = await HiringColumn.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!column) return res.status(404).json({ error: 'Column not found' });
    return res.json(column);
  } catch (err) {
    logger.error('[hiring] PATCH /columns/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to update column' });
  }
});

/**
 * DELETE /api/hiring/columns/:id
 * Delete a column.
 */
router.delete('/columns/:id', requireJwtAuth, async (req, res) => {
  try {
    const column = await HiringColumn.findByIdAndDelete(req.params.id);
    if (!column) return res.status(404).json({ error: 'Column not found' });
    return res.json({ success: true });
  } catch (err) {
    logger.error('[hiring] DELETE /columns/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to delete column' });
  }
});

// ── Task assignees ────────────────────────────────────────────────────────────

/**
 * GET /api/hiring/assignable-users
 * List users that can be assigned to hiring tasks (minimal fields; any authenticated user).
 */
router.get('/assignable-users', requireJwtAuth, async (req, res) => {
  try {
    const users = await User.find({})
      .select('_id email name username')
      .sort({ name: 1, email: 1 })
      .limit(500)
      .lean();

    return res.json(
      users.map((u) => {
        const name = (u.name && String(u.name).trim()) || '';
        const email = u.email || '';
        const username = u.username || '';
        const label = name || username || email || String(u._id);
        return {
          id: String(u._id),
          email,
          name,
          label,
        };
      }),
    );
  } catch (err) {
    logger.error('[hiring] GET /assignable-users error:', err.message);
    return res.status(500).json({ error: 'Failed to list users' });
  }
});

// ── Tasks ─────────────────────────────────────────────────────────────────────

/**
 * POST /api/hiring/tasks
 * Create a hiring task.
 */
router.post('/tasks', requireJwtAuth, async (req, res) => {
  const { title, description } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const task = await HiringTask.create({ title: title.trim(), description: description?.trim() ?? '' });
    return res.status(201).json(task);
  } catch (err) {
    logger.error('[hiring] POST /tasks error:', err.message);
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

/**
 * GET /api/hiring/tasks
 * Return all tasks.
 */
router.get('/tasks', requireJwtAuth, async (req, res) => {
  try {
    const tasks = await HiringTask.find().sort({ createdAt: -1 });
    return res.json(tasks);
  } catch (err) {
    logger.error('[hiring] GET /tasks error:', err.message);
    return res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

/**
 * POST /api/hiring/tasks/:id/image
 * Upload an image using the same S3/local pipeline as chat image uploads; stores URL + fileId on the task.
 */
router.post(
  '/tasks/:id/image',
  requireJwtAuth,
  configMiddleware,
  fileUploadIpLimiter,
  fileUploadUserLimiter,
  async (req, res, next) => {
    try {
      const upload = await hiringTaskImageUpload;
      upload(req, res, (err) => {
        if (err) {
          return next(err);
        }
        next();
      });
    } catch (err) {
      next(err);
    }
  },
  async (req, res) => {
    const tempPath = req.file?.path;
    try {
      if (!req.file?.mimetype?.startsWith('image/')) {
        return res.status(400).json({ error: 'An image file is required' });
      }

      const task = await HiringTask.findById(req.params.id);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const maxAttachments = 10;
      if ((task.attachments?.length || 0) >= maxAttachments) {
        return res.status(400).json({ error: `At most ${maxAttachments} images per task` });
      }

      const file_id = req.file_id;
      const appConfig = req.config;
      const source = getFileStrategy(appConfig, { isImage: true });
      const { handleImageUpload } = getStrategyFunctions(source);

      if (typeof handleImageUpload !== 'function') {
        return res.status(503).json({ error: 'Image upload is not configured for this deployment' });
      }

      const { filepath, bytes, width, height } = await handleImageUpload({
        req,
        file: req.file,
        file_id,
        endpoint: 'openAI',
      });

      await createFile(
        {
          user: req.user.id,
          file_id,
          temp_file_id: null,
          bytes,
          filepath,
          filename: req.file.originalname,
          context: FileContext.message_attachment,
          source,
          type: `image/${appConfig.imageOutputType}`,
          width,
          height,
        },
        true,
      );

      const attachment = {
        fileId: file_id,
        url: filepath,
        filename: req.file.originalname || '',
      };

      const updated = await HiringTask.findByIdAndUpdate(
        req.params.id,
        { $push: { attachments: attachment } },
        { new: true, runValidators: true },
      );

      return res.status(200).json(updated);
    } catch (err) {
      logger.error('[hiring] POST /tasks/:id/image error:', err.message);
      return res.status(500).json({ error: 'Failed to upload image' });
    } finally {
      if (tempPath) {
        try {
          await fs.unlink(tempPath);
        } catch {
          /* temp file may already be removed by storage strategy */
        }
      }
    }
  },
);

/**
 * DELETE /api/hiring/tasks/:id
 * Delete a task and remove its attachment files from storage.
 */
router.delete('/tasks/:id', requireJwtAuth, configMiddleware, async (req, res) => {
  try {
    const task = await HiringTask.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const attachmentFileIds = (task.attachments || []).map((a) => a.fileId).filter(Boolean);
    if (attachmentFileIds.length) {
      try {
        await deleteHiringTaskAttachmentFiles(req, attachmentFileIds);
      } catch (delErr) {
        logger.error('[hiring] DELETE /tasks/:id attachment cleanup error:', delErr.message);
        return res.status(500).json({ error: 'Failed to delete task attachments from storage' });
      }
    }
    await HiringTask.findByIdAndDelete(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    logger.error('[hiring] DELETE /tasks/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to delete task' });
  }
});

/**
 * PATCH /api/hiring/tasks/:id
 * Update a task. When `attachments` is sent, removed entries are deleted from storage (S3/local) and File DB.
 */
router.patch('/tasks/:id', requireJwtAuth, configMiddleware, async (req, res) => {
  try {
    const existing = await HiringTask.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (Array.isArray(req.body.attachments)) {
      const oldIds = new Set((existing.attachments || []).map((a) => a.fileId).filter(Boolean));
      const newIds = new Set(req.body.attachments.map((a) => a.fileId).filter(Boolean));
      const removed = [...oldIds].filter((id) => !newIds.has(id));
      if (removed.length) {
        try {
          await deleteHiringTaskAttachmentFiles(req, removed);
        } catch (delErr) {
          logger.error('[hiring] PATCH /tasks/:id attachment cleanup error:', delErr.message);
          return res.status(500).json({ error: 'Failed to delete removed attachments from storage' });
        }
      }
    }

    const task = await HiringTask.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    return res.json(task);
  } catch (err) {
    logger.error('[hiring] PATCH /tasks/:id error:', err.message);
    return res.status(500).json({ error: 'Failed to update task' });
  }
});

module.exports = router;
