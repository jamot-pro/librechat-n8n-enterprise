/**
 * LibreChat Integration Routes
 * Direct endpoints for n8n webhook integration with profile validation
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const profileAuth = require('../middleware/profileAuth');
const validateProfileType = require('../middleware/validateProfileType');

// N8n base URL configuration
const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL || 'https://nadyaputriast-n8n.hf.space';

/**
 * Helper function to call n8n webhook
 */
async function callN8nWebhook(endpoint, payload, profileType) {
  const url = `${N8N_BASE_URL}${endpoint}`;

  console.log(`[LibreChat Integration] Calling n8n: ${url}`);
  console.log(`[LibreChat Integration] Profile: ${profileType}`);

  try {
    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Profile-Type': profileType,
        'X-Request-Source': 'librechat',
      },
      timeout: 30000, // 30 seconds
    });

    console.log(`[LibreChat Integration] Response status: ${response.status}`);
    return response.data;
  } catch (error) {
    console.error(`[LibreChat Integration] Error calling n8n:`, error.message);

    if (error.response) {
      // n8n returned an error response
      throw {
        status: error.response.status,
        data: error.response.data,
        message: 'n8n workflow execution failed',
      };
    } else if (error.code === 'ECONNABORTED') {
      // Timeout
      throw {
        status: 504,
        message: 'Request timeout',
        details: 'n8n took too long to respond',
      };
    } else {
      // Network error
      throw {
        status: 503,
        message: 'Cannot connect to n8n',
        details: error.message,
      };
    }
  }
}

// ============================================
// EXECUTIVE MODULE (CEO Profile Required)
// ============================================

/**
 * POST /api/librechat/financial-analytics
 * Get financial analytics data
 */
router.post('/financial-analytics', profileAuth, validateProfileType('ceo'), async (req, res) => {
  try {
    const payload = {
      ...req.body,
      _context: {
        profileType: req.userProfile.profileType,
        userId: req.userProfile.userId.toString(),
        username: req.userProfile.username,
        timestamp: new Date().toISOString(),
      },
    };

    const result = await callN8nWebhook(
      '/webhook/librechat/financial-analytics',
      payload,
      req.userProfile.profileType,
    );

    res.json(result);
  } catch (error) {
    console.error('[LibreChat Integration] Financial analytics error:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to get financial analytics',
      details: error.details || error.data,
    });
  }
});

/**
 * POST /api/librechat/company-metrics
 * Get company-wide metrics
 */
router.post('/company-metrics', profileAuth, validateProfileType('ceo'), async (req, res) => {
  try {
    const payload = {
      ...req.body,
      _context: {
        profileType: req.userProfile.profileType,
        userId: req.userProfile.userId.toString(),
        username: req.userProfile.username,
        timestamp: new Date().toISOString(),
      },
    };

    const result = await callN8nWebhook(
      '/webhook/librechat/company-metrics',
      payload,
      req.userProfile.profileType,
    );

    res.json(result);
  } catch (error) {
    console.error('[LibreChat Integration] Company metrics error:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to get company metrics',
      details: error.details || error.data,
    });
  }
});

// ============================================
// OPERATIONAL MODULE
// ============================================

/**
 * POST /api/librechat/task-management
 * Manage tasks (Employee profile)
 */
router.post('/task-management', profileAuth, validateProfileType('employee'), async (req, res) => {
  try {
    const payload = {
      ...req.body,
      _context: {
        profileType: req.userProfile.profileType,
        userId: req.userProfile.userId.toString(),
        username: req.userProfile.username,
        timestamp: new Date().toISOString(),
      },
    };

    const result = await callN8nWebhook(
      '/webhook/librechat/task-management',
      payload,
      req.userProfile.profileType,
    );

    res.json(result);
  } catch (error) {
    console.error('[LibreChat Integration] Task management error:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to manage tasks',
      details: error.details || error.data,
    });
  }
});

/**
 * POST /api/librechat/support-ticket
 * Handle support tickets (Customer profile)
 */
router.post('/support-ticket', profileAuth, validateProfileType('customer'), async (req, res) => {
  try {
    const payload = {
      ...req.body,
      _context: {
        profileType: req.userProfile.profileType,
        userId: req.userProfile.userId.toString(),
        username: req.userProfile.username,
        timestamp: new Date().toISOString(),
      },
    };

    const result = await callN8nWebhook(
      '/webhook/librechat/support-ticket',
      payload,
      req.userProfile.profileType,
    );

    res.json(result);
  } catch (error) {
    console.error('[LibreChat Integration] Support ticket error:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to handle support ticket',
      details: error.details || error.data,
    });
  }
});

/**
 * POST /api/librechat/project-status
 * Get project status (Customer profile)
 */
router.post('/project-status', profileAuth, validateProfileType('customer'), async (req, res) => {
  try {
    const payload = {
      ...req.body,
      _context: {
        profileType: req.userProfile.profileType,
        userId: req.userProfile.userId.toString(),
        username: req.userProfile.username,
        timestamp: new Date().toISOString(),
      },
    };

    const result = await callN8nWebhook(
      '/webhook/librechat/project-status',
      payload,
      req.userProfile.profileType,
    );

    res.json(result);
  } catch (error) {
    console.error('[LibreChat Integration] Project status error:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to get project status',
      details: error.details || error.data,
    });
  }
});

/**
 * POST /api/librechat/document-search
 * Search documents (All authenticated users)
 */
router.post('/document-search', profileAuth, async (req, res) => {
  try {
    const payload = {
      ...req.body,
      _context: {
        profileType: req.userProfile.profileType,
        userId: req.userProfile.userId.toString(),
        username: req.userProfile.username,
        timestamp: new Date().toISOString(),
      },
    };

    const result = await callN8nWebhook(
      '/webhook/librechat/document-search',
      payload,
      req.userProfile.profileType,
    );

    res.json(result);
  } catch (error) {
    console.error('[LibreChat Integration] Document search error:', error);
    res.status(error.status || 500).json({
      success: false,
      error: error.message || 'Failed to search documents',
      details: error.details || error.data,
    });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

/**
 * GET /api/librechat/health
 * Check n8n integration health
 */
router.get('/health', async (req, res) => {
  try {
    const healthCheck = await axios
      .get(`${N8N_BASE_URL}/healthz`, {
        timeout: 5000,
      })
      .catch(() => null);

    res.json({
      success: true,
      status: healthCheck ? 'connected' : 'disconnected',
      n8nBaseUrl: N8N_BASE_URL,
      timestamp: new Date().toISOString(),
      endpoints: {
        executive: [
          'POST /api/librechat/financial-analytics (CEO)',
          'POST /api/librechat/company-metrics (CEO)',
        ],
        operational: [
          'POST /api/librechat/task-management (Employee)',
          'POST /api/librechat/support-ticket (Customer)',
          'POST /api/librechat/project-status (Customer)',
        ],
        general: ['POST /api/librechat/document-search (All)'],
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      message: error.message,
    });
  }
});

module.exports = router;
