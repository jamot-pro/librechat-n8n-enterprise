const axios = require('axios');
const { z } = require('zod');
const { logger } = require('@librechat/data-schemas');
const { Tools } = require('librechat-data-provider');
const Profile = require('../models/Profile');

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://nadyaputriast-n8n.hf.space';
const N8N_TIMEOUT = parseInt(process.env.N8N_TIMEOUT) || 30000;

/**
 * N8nToolService - Converts n8n workflows into OpenAI function tools
 *
 * This service is the bridge between LibreChat's AI capabilities and n8n workflows.
 * It transforms workflow definitions into OpenAI-compatible function tools that
 * can be called naturally through conversation.
 */
class N8nToolService {
  constructor() {
    this.toolCache = new Map();
    this.workflowDefinitions = this.defineWorkflows();
  }

  /**
   * Define all n8n workflows with their metadata
   * This maps workflow information to OpenAI function tool format
   */
  defineWorkflows() {
    return {
      // ===== EXECUTIVE MODULE =====
      wf_financial_analytics: {
        name: 'get_financial_analytics',
        description:
          'Get comprehensive financial analytics including revenue, expenses, profit, department performance, and trends. Use this when user asks about financial data, revenue, profit, expenses, or financial metrics.',
        endpoint: '/webhook/librechat/financial-analytics',
        profileTypes: ['ceo'],
        parameters: {
          type: 'object',
          properties: {
            period: {
              type: 'string',
              description:
                'Time period for analytics (e.g., "Q4 2024", "2024", "Last Quarter", "This Year")',
              default: 'Q4 2024',
            },
            includeComparison: {
              type: 'boolean',
              description: 'Include comparison with previous period',
              default: true,
            },
            department: {
              type: 'string',
              description:
                'Specific department to analyze (optional). Leave empty for all departments.',
              enum: ['Sales', 'Marketing', 'Engineering', 'Operations', 'all'],
            },
          },
          required: ['period'],
        },
        examples: [
          'Show me Q4 2024 financials',
          'What is our revenue this quarter?',
          'How much profit did we make?',
          'Compare sales performance',
        ],
      },

      wf_company_metrics: {
        name: 'get_company_metrics',
        description:
          'Get company-wide KPIs and metrics including employee count, customer satisfaction, active projects, department performance, and goal progress. Use this when user asks about company performance, KPIs, metrics, or overall company status.',
        endpoint: '/webhook/librechat/company-metrics',
        profileTypes: ['ceo'],
        parameters: {
          type: 'object',
          properties: {
            metricType: {
              type: 'string',
              description: 'Type of metrics to retrieve',
              enum: ['all', 'employees', 'customers', 'projects', 'departments', 'goals'],
              default: 'all',
            },
            includeHistory: {
              type: 'boolean',
              description: 'Include historical trend data',
              default: false,
            },
          },
          required: [],
        },
        examples: [
          'Show me company metrics',
          'How many employees do we have?',
          'What is our customer satisfaction score?',
          'How many active projects?',
        ],
      },

      // ===== OPERATIONAL MODULE (Employee) =====
      wf_task_management: {
        name: 'manage_tasks',
        description:
          'Manage tasks including listing, creating, updating, and completing tasks. Use this when user wants to view tasks, create new tasks, update task status, or mark tasks as complete.',
        endpoint: '/webhook/librechat/task-management',
        profileTypes: ['employee'],
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: 'Action to perform on tasks',
              enum: ['list', 'create', 'update', 'complete'],
              default: 'list',
            },
            status: {
              type: 'string',
              description: 'Filter tasks by status (for list action)',
              enum: ['pending', 'in-progress', 'completed', 'all'],
            },
            taskTitle: {
              type: 'string',
              description: 'Task title (for create/update actions)',
            },
            taskDescription: {
              type: 'string',
              description: 'Task description (for create action)',
            },
            priority: {
              type: 'string',
              description: 'Task priority (for create action)',
              enum: ['low', 'medium', 'high', 'urgent'],
              default: 'medium',
            },
            taskId: {
              type: 'string',
              description: 'Task ID (for update/complete actions)',
            },
          },
          required: ['action'],
        },
        examples: [
          'Show me my tasks',
          'Create a task to review Q4 reports',
          'Mark task as complete',
          'List pending tasks',
        ],
      },

      // ===== OPERATIONAL MODULE (Customer) =====
      wf_support_ticket: {
        name: 'manage_support_tickets',
        description:
          'Manage support tickets including creating new tickets, viewing ticket status, and listing all tickets. Use this when customer wants to report an issue, check ticket status, or view their support history.',
        endpoint: '/webhook/librechat/support-ticket',
        profileTypes: ['customer'],
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: 'Action to perform',
              enum: ['create', 'list', 'get_status'],
              default: 'list',
            },
            subject: {
              type: 'string',
              description: 'Ticket subject (for create action)',
            },
            description: {
              type: 'string',
              description:
                'Detailed description of the issue (for create action). Minimum 10 characters.',
            },
            priority: {
              type: 'string',
              description: 'Issue priority (for create action)',
              enum: ['low', 'medium', 'high', 'urgent'],
              default: 'medium',
            },
            ticketId: {
              type: 'string',
              description: 'Ticket ID (for get_status action)',
            },
          },
          required: ['action'],
        },
        examples: [
          'I need help with login issues',
          'Create a support ticket for billing',
          'Check my ticket status',
          'List my support tickets',
        ],
      },

      wf_project_status: {
        name: 'get_project_status',
        description:
          'Get project status, progress, budget, timeline, and team information. Use this when customer asks about their project progress, budget status, milestones, or team members.',
        endpoint: '/webhook/librechat/project-status',
        profileTypes: ['customer'],
        parameters: {
          type: 'object',
          properties: {
            action: {
              type: 'string',
              description: 'Action to perform',
              enum: ['get', 'list'],
              default: 'list',
            },
            projectId: {
              type: 'string',
              description: 'Project ID (for get action). Examples: PRJ-001, PRJ-002',
            },
          },
          required: ['action'],
        },
        examples: [
          'Show me my project status',
          'What is the progress of PRJ-001?',
          'List all my projects',
          'How is my project doing?',
        ],
      },

      // ===== GENERAL MODULE =====
      wf_doc_search: {
        name: 'search_documents',
        description:
          'Search company documents and knowledge base. Use this when user wants to find documents, search for information, or access company resources.',
        endpoint: '/webhook/librechat/document-search',
        profileTypes: ['ceo', 'employee', 'customer'],
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query or keywords',
            },
            documentType: {
              type: 'string',
              description: 'Filter by document type',
              enum: ['all', 'pdf', 'doc', 'txt', 'xlsx'],
              default: 'all',
            },
            category: {
              type: 'string',
              description: 'Document category',
              enum: ['all', 'policies', 'procedures', 'reports', 'templates', 'guides'],
              default: 'all',
            },
            limit: {
              type: 'number',
              description: 'Maximum number of results',
              default: 10,
            },
          },
          required: ['query'],
        },
        examples: [
          'Search for employee handbook',
          'Find Q4 reports',
          'Look for onboarding documents',
          'Search policies',
        ],
      },
    };
  }

  /**
   * Get all available tools for a specific user profile
   * @param {string} profileType - User's profile type (ceo, employee, customer)
   * @returns {Array} Array of OpenAI function tool definitions
   */
  async getToolsForProfile(profileType) {
    try {
      // Check cache first
      const cacheKey = `tools_${profileType}`;
      if (this.toolCache.has(cacheKey)) {
        logger.info(`[N8nToolService] Returning cached tools for profile: ${profileType}`);
        return this.toolCache.get(cacheKey);
      }

      // Get profile from database to verify allowed workflows
      const profile = await Profile.findOne({ profileType });
      if (!profile) {
        logger.warn(`[N8nToolService] Profile not found: ${profileType}`);
        return [];
      }

      const tools = [];

      // Convert each allowed workflow to OpenAI function tool
      for (const workflow of profile.allowedWorkflows) {
        const workflowDef = this.workflowDefinitions[workflow.workflowId];

        if (!workflowDef) {
          logger.warn(`[N8nToolService] Workflow definition not found: ${workflow.workflowId}`);
          continue;
        }

        // Check if profile is allowed to use this workflow
        if (!workflowDef.profileTypes.includes(profileType)) {
          logger.warn(
            `[N8nToolService] Profile ${profileType} not allowed for workflow ${workflow.workflowId}`,
          );
          continue;
        }

        // Create OpenAI function tool definition
        const tool = {
          type: Tools.function,
          function: {
            name: workflowDef.name,
            description: workflowDef.description,
            parameters: workflowDef.parameters,
          },
          // Store metadata for execution
          _metadata: {
            workflowId: workflow.workflowId,
            endpoint: workflowDef.endpoint,
            workflowName: workflow.workflowName,
            profileTypes: workflowDef.profileTypes,
          },
        };

        tools.push(tool);
        logger.info(`[N8nToolService] Added tool: ${workflowDef.name} for profile ${profileType}`);
      }

      // Cache the tools
      this.toolCache.set(cacheKey, tools);

      logger.info(`[N8nToolService] Loaded ${tools.length} tools for profile: ${profileType}`);
      return tools;
    } catch (error) {
      logger.error('[N8nToolService] Error getting tools for profile:', error);
      throw error;
    }
  }

  /**
   * Get a specific tool by function name
   * @param {string} functionName - OpenAI function name
   * @returns {Object|null} Tool definition with metadata
   */
  getToolByName(functionName) {
    for (const [workflowId, definition] of Object.entries(this.workflowDefinitions)) {
      if (definition.name === functionName) {
        return {
          ...definition,
          workflowId,
        };
      }
    }
    return null;
  }

  /**
   * Execute an n8n workflow via function call
   * @param {string} functionName - OpenAI function name
   * @param {Object} parameters - Function parameters
   * @param {Object} context - User context (profileType, userId, username)
   * @returns {Promise<Object>} Workflow execution result
   */
  async executeWorkflow(functionName, parameters, context) {
    try {
      logger.info(`[N8nToolService] Executing workflow: ${functionName}`, {
        parameters,
        context,
      });

      // Get tool definition
      const tool = this.getToolByName(functionName);
      if (!tool) {
        throw new Error(`Function not found: ${functionName}`);
      }

      // Verify profile has access
      if (!tool.profileTypes.includes(context.profileType)) {
        throw new Error(`Profile ${context.profileType} not authorized for ${functionName}`);
      }

      // Prepare request payload
      const payload = {
        ...parameters,
        _context: {
          profileType: context.profileType,
          userId: context.userId,
          username: context.username,
          timestamp: new Date().toISOString(),
          functionName: functionName,
          // Include full profile info if available
          profile: context.profile || {
            profileType: context.profileType,
          },
        },
      };

      // Call n8n webhook
      const url = `${N8N_WEBHOOK_URL}${tool.endpoint}`;
      logger.info(`[N8nToolService] Calling n8n: ${url}`, {
        profileType: context.profileType,
        hasFullProfile: !!context.profile,
      });

      const response = await axios.post(url, payload, {
        timeout: N8N_TIMEOUT,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      logger.info(`[N8nToolService] Workflow executed successfully: ${functionName}`, {
        status: response.status,
        dataKeys: Object.keys(response.data || {}),
      });

      return {
        success: true,
        functionName,
        data: response.data,
        executedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error(`[N8nToolService] Error executing workflow ${functionName}:`, {
        message: error.message,
        response: error.response?.data,
      });

      // Return error in structured format
      return {
        success: false,
        functionName,
        error: {
          message: error.message,
          details: error.response?.data || null,
          code: error.response?.status || 500,
        },
        executedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Clear tool cache (useful after profile/workflow changes)
   */
  clearCache() {
    this.toolCache.clear();
    logger.info('[N8nToolService] Tool cache cleared');
  }

  /**
   * Get all available workflow definitions
   * @returns {Object} All workflow definitions
   */
  getAllWorkflows() {
    return this.workflowDefinitions;
  }

  /**
   * Validate if a profile can use a specific function
   * @param {string} profileType - User's profile type
   * @param {string} functionName - Function name to check
   * @returns {boolean} True if authorized
   */
  isAuthorized(profileType, functionName) {
    const tool = this.getToolByName(functionName);
    if (!tool) {
      return false;
    }
    return tool.profileTypes.includes(profileType);
  }
}

// Singleton instance
const n8nToolService = new N8nToolService();

module.exports = n8nToolService;
