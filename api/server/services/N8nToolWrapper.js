const { DynamicStructuredTool } = require('@langchain/core/tools');
const { z } = require('zod');
const { logger } = require('@librechat/data-schemas');
const n8nToolService = require('./N8nToolService');
const Profile = require('~/server/models/Profile');

/**
 * N8nToolWrapper - Converts n8n workflow tools into LangChain StructuredTool instances
 *
 * This wrapper enables n8n workflows to be executed as native LangChain tools
 * within LibreChat's agent system.
 */

/**
 * Convert OpenAI function parameters to Zod schema
 * @param {Object} parameters - OpenAI function parameters
 * @returns {Object} Zod schema
 */
function convertParametersToZod(parameters) {
  if (!parameters || !parameters.properties) {
    return z.object({});
  }

  const zodSchema = {};
  const required = parameters.required || [];

  for (const [key, value] of Object.entries(parameters.properties)) {
    let fieldSchema;

    switch (value.type) {
      case 'string':
        fieldSchema = z.string();
        if (value.description) {
          fieldSchema = fieldSchema.describe(value.description);
        }
        if (value.enum) {
          fieldSchema = z.enum(value.enum);
        }
        break;

      case 'number':
      case 'integer':
        fieldSchema = z.number();
        if (value.description) {
          fieldSchema = fieldSchema.describe(value.description);
        }
        break;

      case 'boolean':
        fieldSchema = z.boolean();
        if (value.description) {
          fieldSchema = fieldSchema.describe(value.description);
        }
        break;

      case 'array':
        fieldSchema = z.array(z.string());
        if (value.description) {
          fieldSchema = fieldSchema.describe(value.description);
        }
        break;

      case 'object':
        fieldSchema = z.object({});
        if (value.description) {
          fieldSchema = fieldSchema.describe(value.description);
        }
        break;

      default:
        fieldSchema = z.string();
    }

    // Make optional if not required
    if (!required.includes(key)) {
      fieldSchema = fieldSchema.optional();
    }

    zodSchema[key] = fieldSchema;
  }

  return z.object(zodSchema);
}

/**
 * Create a LangChain StructuredTool from an n8n workflow tool
 * @param {Object} n8nTool - n8n tool with function and _metadata
 * @param {Object} user - User object with authentication info
 * @returns {DynamicStructuredTool} LangChain tool instance
 */
function createN8nStructuredTool(n8nTool, user) {
  const { function: func, _metadata } = n8nTool;

  // Convert OpenAI parameters to Zod schema
  const schema = convertParametersToZod(func.parameters);

  // Create the LangChain tool
  const tool = new DynamicStructuredTool({
    name: func.name,
    description: func.description,
    schema: schema,
    func: async (input) => {
      try {
        logger.info(`[N8nToolWrapper] Executing n8n workflow: ${func.name}`, {
          input,
          userId: user?._id || user?.id,
        });

        // Load user's profile from database to get complete profile info
        const userId = user?._id || user?.id;
        const profile = await Profile.findOne({ userId });

        if (!profile) {
          logger.error(`[N8nToolWrapper] No profile found for user ${userId}`);
          return JSON.stringify({
            success: false,
            error: 'User profile not found. Please contact administrator.',
          });
        }

        logger.info(`[N8nToolWrapper] User profile loaded:`, {
          userId,
          profileType: profile.profileType,
          department: profile.metadata?.department,
        });

        // Prepare context with complete profile info
        const context = {
          profileType: profile.profileType,
          userId: userId.toString(),
          username: user?.username || user?.email,
          profile: {
            profileType: profile.profileType,
            department: profile.metadata?.department,
            companyId: profile.metadata?.companyId,
            permissions: profile.permissions,
          },
        };

        logger.info(`[N8nToolWrapper] Executing with context:`, {
          profileType: context.profileType,
          department: context.profile.department,
        });

        // Execute the n8n workflow
        const result = await n8nToolService.executeWorkflow(func.name, input, context);

        logger.info(`[N8nToolWrapper] ✅ Workflow executed successfully: ${func.name}`);

        // Return formatted result
        if (result.success) {
          return JSON.stringify(result.data);
        } else {
          logger.error(`[N8nToolWrapper] Workflow execution failed: ${func.name}`, result.error);
          return JSON.stringify({
            error: result.error || 'Workflow execution failed',
          });
        }
      } catch (error) {
        logger.error(`[N8nToolWrapper] Error executing workflow: ${func.name}`, error);
        return JSON.stringify({
          error: error.message || 'Failed to execute workflow',
        });
      }
    },
  });

  return tool;
}

/**
 * Convert all n8n tools for a user into LangChain StructuredTool instances
 * @param {Object} user - User object with authentication info
 * @returns {Promise<Array<DynamicStructuredTool>>} Array of LangChain tools
 */
async function loadN8nStructuredTools(user) {
  try {
    const n8nToolExecutor = require('./N8nToolExecutor');
    const n8nTools = await n8nToolExecutor.loadUserTools(user);

    if (!n8nTools || n8nTools.length === 0) {
      logger.info('[N8nToolWrapper] No n8n tools available for user', {
        userId: user?._id || user?.id,
      });
      return [];
    }

    // Convert each n8n tool to a LangChain StructuredTool
    const structuredTools = n8nTools.map((n8nTool) => createN8nStructuredTool(n8nTool, user));

    logger.info(`[N8nToolWrapper] Created ${structuredTools.length} LangChain tools`, {
      userId: user?._id || user?.id,
      toolNames: structuredTools.map((t) => t.name),
    });

    return structuredTools;
  } catch (error) {
    logger.error('[N8nToolWrapper] Error loading n8n structured tools:', error);
    return [];
  }
}

module.exports = {
  createN8nStructuredTool,
  loadN8nStructuredTools,
  convertParametersToZod,
};
