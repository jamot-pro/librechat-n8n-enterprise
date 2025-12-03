const express = require('express');
const router = express.Router();
const profileAuth = require('../middleware/profileAuth');
const n8nProxy = require('../middleware/n8nProxy');

// List available workflows for authenticated user
router.get('/workflows', profileAuth, async (req, res) => {
  try {
    const workflows = req.userProfile.allowedWorkflows;
    res.json({
      success: true,
      profileType: req.userProfile.profileType,
      workflows: workflows,
      count: workflows.length,
    });
  } catch (error) {
    console.error('[n8n Routes] Error listing workflows:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Execute specific workflow
router.post('/workflows/:workflowId/execute', profileAuth, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const payload = req.body;

    console.log(`[n8n Routes] Execute request for workflow: ${workflowId}`);

    const result = await n8nProxy.executeWorkflow(workflowId, payload, req.userProfile);

    if (result.success) {
      res.json(result);
    } else {
      res.status(result.statusCode || 400).json(result);
    }
  } catch (error) {
    console.error('[n8n Routes] Execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get workflow status/info
router.get('/workflows/:workflowId', profileAuth, async (req, res) => {
  try {
    const { workflowId } = req.params;
    // Check permission
    const hasPermission = n8nProxy.checkWorkflowPermission(req.userProfile, workflowId);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this workflow',
      });
    }

    const workflow = req.userProfile.allowedWorkflows.find((wf) => wf.workflowId === workflowId);

    res.json({
      success: true,
      available: true,
      workflow: workflow,
      profileType: req.userProfile.profileType,
    });
  } catch (error) {
    console.error('[n8n Routes] Error getting workflow info:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    n8nBaseUrl: process.env.N8N_WEBHOOK_URL || 'https://nadyaputriast-n8n.hf.space/',
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
