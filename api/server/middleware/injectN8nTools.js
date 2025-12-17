const { logger } = require('@librechat/data-schemas');
const n8nToolExecutor = require('~/server/services/N8nToolExecutor');

/**
 * Middleware to inject n8n tools into endpointOption
 * This runs AFTER buildEndpointOption but BEFORE the controller
 *
 * It modifies req.body.endpointOption.tools to include user's n8n workflows
 */
const injectN8nTools = async (req, res, next) => {
  try {
    // DEBUG MODE: Log EVERY request to see if middleware is called at all
    if (req.method === 'POST') {
      console.log('[InjectN8nTools] POST request:', {
        path: req.path,
        url: req.url,
        hasBody: !!req.body,
        bodyKeys: req.body ? Object.keys(req.body) : [],
        endpoint: req.body?.endpoint,
        hasUser: !!req.user,
      });
    }

    // NOTE: For agents route, tools are injected in custom/initialize.js
    // This middleware is kept for logging/debugging only

    next();
  } catch (error) {
    logger.error('[InjectN8nTools] ❌ Error injecting n8n tools:', error);
    logger.error('[InjectN8nTools] Error stack:', error.stack);
    // Don't block the request if tool injection fails
    next();
  }
};

module.exports = injectN8nTools;
