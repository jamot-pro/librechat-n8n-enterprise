const { logger } = require('@librechat/data-schemas');
const n8nToolExecutor = require('../services/N8nToolExecutor');

/**
 * Middleware to load n8n tools for authenticated users
 * This middleware injects user-specific n8n workflow tools into the request
 * so they can be used by AI models during conversation.
 */
async function loadN8nTools(req, res, next) {
  try {
    // Skip if no user authenticated
    if (!req.user || !req.user._id) {
      logger.debug('[loadN8nTools] No authenticated user, skipping');
      return next();
    }

    // Load n8n tools for this user based on their profile
    const n8nTools = await n8nToolExecutor.loadUserTools(req.user);

    // Inject tools into request for use by AI client
    if (!req.body) {
      req.body = {};
    }

    if (!req.body.tools) {
      req.body.tools = [];
    }

    // Append n8n tools to existing tools
    req.body.tools = [...req.body.tools, ...n8nTools];

    // Store n8n tools separately for reference
    req.n8nTools = n8nTools;

    logger.info(`[loadN8nTools] Loaded ${n8nTools.length} n8n tools for user ${req.user._id}`, {
      userId: req.user._id,
      toolCount: n8nTools.length,
      toolNames: n8nTools.map((t) => t.function?.name),
    });

    next();
  } catch (error) {
    logger.error('[loadN8nTools] Error loading n8n tools:', error);
    // Don't fail the request, just log error and continue
    next();
  }
}

/**
 * Process tool calls from AI response
 * This middleware intercepts AI responses that include tool calls
 * and executes the corresponding n8n workflows.
 */
async function processN8nToolCalls(req, res, next) {
  try {
    // This will be called after AI generates response with tool calls
    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);

    res.json = async function (data) {
      try {
        // Check if response contains tool calls
        if (data && data.choices && Array.isArray(data.choices)) {
          for (const choice of data.choices) {
            const message = choice.message;

            if (message && message.tool_calls && Array.isArray(message.tool_calls)) {
              logger.info(
                `[processN8nToolCalls] Processing ${message.tool_calls.length} tool calls`,
              );

              // Filter n8n tool calls
              const n8nToolCalls = message.tool_calls.filter((tc) => {
                const functionName = tc.function?.name;
                return req.n8nTools && req.n8nTools.some((t) => t.function?.name === functionName);
              });

              if (n8nToolCalls.length > 0) {
                logger.info(`[processN8nToolCalls] Found ${n8nToolCalls.length} n8n tool calls`);

                // Execute n8n tools
                const results = await n8nToolExecutor.processToolCalls(n8nToolCalls, req.user);

                // Store results in response metadata
                if (!data.metadata) {
                  data.metadata = {};
                }
                data.metadata.n8nToolResults = results;
              }
            }
          }
        }

        // Call original json method
        return originalJson(data);
      } catch (error) {
        logger.error('[processN8nToolCalls] Error processing tool calls:', error);
        // Still return original data even if processing fails
        return originalJson(data);
      }
    };

    next();
  } catch (error) {
    logger.error('[processN8nToolCalls] Middleware error:', error);
    next(error);
  }
}

module.exports = {
  loadN8nTools,
  processN8nToolCalls,
};
