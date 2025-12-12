const express = require('express');
const { logger } = require('@librechat/data-schemas');
const n8nToolService = require('../services/N8nToolService');
const n8nToolExecutor = require('../services/N8nToolExecutor');
const profileAuth = require('../middleware/profileAuth');

const router = express.Router();

/**
 * GET /api/n8n-tools
 * Get available n8n tools for the authenticated user
 */
router.get('/', profileAuth, async (req, res) => {
  try {
    const tools = await n8nToolExecutor.loadUserTools(req.user);

    res.json({
      success: true,
      userId: req.user._id,
      profileType: req.profile?.profileType,
      toolCount: tools.length,
      tools: tools.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters,
        metadata: tool._metadata,
      })),
    });
  } catch (error) {
    logger.error('[N8nToolsRoutes] Error getting tools:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/n8n-tools/execute
 * Manually execute an n8n workflow tool (for testing/debugging)
 */
router.post('/execute', profileAuth, async (req, res) => {
  try {
    const { functionName, parameters } = req.body;

    if (!functionName) {
      return res.status(400).json({
        success: false,
        error: 'functionName is required',
      });
    }

    // Verify user has access to this tool
    if (!n8nToolService.isAuthorized(req.profile.profileType, functionName)) {
      return res.status(403).json({
        success: false,
        error: `Not authorized to execute ${functionName}`,
      });
    }

    // Prepare context
    const context = {
      profileType: req.profile.profileType,
      userId: req.user._id.toString(),
      username: req.user.username || req.user.email,
    };

    // Execute workflow
    const result = await n8nToolService.executeWorkflow(functionName, parameters || {}, context);

    res.json(result);
  } catch (error) {
    logger.error('[N8nToolsRoutes] Error executing tool:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/n8n-tools/workflows
 * Get all available workflow definitions (admin only)
 */
router.get('/workflows', profileAuth, async (req, res) => {
  try {
    // Only allow admin or ceo to see all workflows
    if (!['admin', 'ceo'].includes(req.profile?.profileType)) {
      return res.status(403).json({
        success: false,
        error: 'Admin or CEO access required',
      });
    }

    const workflows = n8nToolService.getAllWorkflows();

    res.json({
      success: true,
      workflows: Object.entries(workflows).map(([id, def]) => ({
        workflowId: id,
        functionName: def.name,
        description: def.description,
        endpoint: def.endpoint,
        profileTypes: def.profileTypes,
        parameters: def.parameters,
        examples: def.examples,
      })),
    });
  } catch (error) {
    logger.error('[N8nToolsRoutes] Error getting workflows:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/n8n-tools/clear-cache
 * Clear tool cache (admin only)
 */
router.post('/clear-cache', profileAuth, async (req, res) => {
  try {
    // Only allow admin
    if (req.profile?.profileType !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    n8nToolService.clearCache();

    res.json({
      success: true,
      message: 'Tool cache cleared successfully',
    });
  } catch (error) {
    logger.error('[N8nToolsRoutes] Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/n8n-tools/test
 * Test endpoint to verify n8n tools are working
 */
router.get('/test', profileAuth, async (req, res) => {
  try {
    const profile = req.profile;
    const tools = await n8nToolExecutor.loadUserTools(req.user);

    res.json({
      success: true,
      message: 'N8n tools system is working',
      user: {
        id: req.user._id,
        email: req.user.email,
        username: req.user.username,
      },
      profile: {
        profileType: profile.profileType,
        permissions: profile.permissions,
        workflowCount: profile.allowedWorkflows?.length || 0,
      },
      tools: {
        count: tools.length,
        names: tools.map((t) => t.function.name),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[N8nToolsRoutes] Test error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
