const { logger } = require('@librechat/data-schemas');
const n8nToolService = require('./N8nToolService');
const Profile = require('../models/Profile');

/**
 * N8nToolExecutor - Handles execution of n8n workflows as OpenAI function tools
 *
 * This class provides the execution layer that processes OpenAI function calls
 * and routes them to the appropriate n8n workflows.
 */
class N8nToolExecutor {
  /**
   * Process tool calls from OpenAI response
   * @param {Array} toolCalls - Array of tool calls from OpenAI
   * @param {Object} user - User object with authentication info
   * @returns {Promise<Array>} Array of tool execution results
   */
  async processToolCalls(toolCalls, user) {
    if (!toolCalls || !Array.isArray(toolCalls) || toolCalls.length === 0) {
      return [];
    }

    try {
      logger.info(
        `[N8nToolExecutor] Processing ${toolCalls.length} tool calls for user ${user._id}`,
      );

      // Get user's profile
      const profile = await Profile.findOne({ userId: user._id });
      if (!profile) {
        throw new Error('User profile not found');
      }

      const results = [];

      // Process each tool call
      for (const toolCall of toolCalls) {
        try {
          const result = await this.executeSingleTool(toolCall, profile, user);
          results.push(result);
        } catch (error) {
          logger.error(`[N8nToolExecutor] Error executing tool ${toolCall.function?.name}:`, error);

          // Add error result
          results.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            name: toolCall.function?.name || 'unknown',
            content: JSON.stringify({
              success: false,
              error: error.message,
            }),
          });
        }
      }

      logger.info(`[N8nToolExecutor] Completed processing ${results.length} tool calls`);
      return results;
    } catch (error) {
      logger.error('[N8nToolExecutor] Error processing tool calls:', error);
      throw error;
    }
  }

  /**
   * Execute a single tool call
   * @param {Object} toolCall - Single tool call object
   * @param {Object} profile - User profile
   * @param {Object} user - User object
   * @returns {Promise<Object>} Tool execution result formatted for OpenAI
   */
  async executeSingleTool(toolCall, profile, user) {
    const functionName = toolCall.function.name;
    const functionArgs = JSON.parse(toolCall.function.arguments || '{}');

    logger.info(`[N8nToolExecutor] Executing tool: ${functionName}`, {
      args: functionArgs,
      userId: user._id,
    });

    // Verify authorization
    if (!n8nToolService.isAuthorized(profile.profileType, functionName)) {
      throw new Error(`Not authorized to use function: ${functionName}`);
    }

    // Prepare context
    const context = {
      profileType: profile.profileType,
      userId: user._id.toString(),
      username: user.username || user.email,
    };

    // Execute workflow
    const executionResult = await n8nToolService.executeWorkflow(
      functionName,
      functionArgs,
      context,
    );

    // Format result for OpenAI
    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      name: functionName,
      content: JSON.stringify(executionResult),
    };
  }

  /**
   * Load available tools for a user
   * @param {Object} user - User object
   * @returns {Promise<Array>} Array of available tool definitions
   */
  async loadUserTools(user) {
    try {
      // Get user's profile
      const profile = await Profile.findOne({ userId: user._id });
      if (!profile) {
        logger.warn(`[N8nToolExecutor] No profile found for user ${user._id}`);
        return [];
      }

      // Get tools for this profile
      const tools = await n8nToolService.getToolsForProfile(profile.profileType);

      logger.info(
        `[N8nToolExecutor] Loaded ${tools.length} tools for user ${user._id} (${profile.profileType})`,
      );
      return tools;
    } catch (error) {
      logger.error('[N8nToolExecutor] Error loading user tools:', error);
      return [];
    }
  }

  /**
   * Format workflow result for chat display
   * @param {Object} result - Raw workflow execution result
   * @param {string} functionName - Function that was called
   * @returns {string} Formatted message for display
   */
  formatResultForChat(result, functionName) {
    if (!result.success) {
      return `❌ Error executing ${functionName}: ${result.error?.message || 'Unknown error'}`;
    }

    const data = result.data;

    // Format based on function type
    switch (functionName) {
      case 'get_financial_analytics':
        return this.formatFinancialAnalytics(data);

      case 'get_company_metrics':
        return this.formatCompanyMetrics(data);

      case 'manage_tasks':
        return this.formatTaskManagement(data);

      case 'manage_support_tickets':
        return this.formatSupportTickets(data);

      case 'get_project_status':
        return this.formatProjectStatus(data);

      case 'search_documents':
        return this.formatDocumentSearch(data);

      default:
        return `✅ ${functionName} executed successfully.\n\n${JSON.stringify(data, null, 2)}`;
    }
  }

  formatFinancialAnalytics(data) {
    if (!data || !data.data) return 'No financial data available';

    const { revenue, expenses, profit, departments, trends, insights } = data.data;

    let message = '📊 **Financial Analytics**\n\n';

    if (revenue) {
      message += `💰 **Revenue:** $${revenue.total?.toLocaleString() || 0}\n`;
      message += `   - Target: $${revenue.target?.toLocaleString() || 0}\n`;
      message += `   - Achievement: ${revenue.achievement || 0}%\n\n`;
    }

    if (profit) {
      message += `📈 **Profit:** $${profit.amount?.toLocaleString() || 0}\n`;
      message += `   - Margin: ${profit.margin || 0}%\n\n`;
    }

    if (departments && Array.isArray(departments)) {
      message += '🏢 **Department Performance:**\n';
      departments.slice(0, 3).forEach((dept) => {
        message += `   - ${dept.name}: $${dept.revenue?.toLocaleString() || 0} revenue\n`;
      });
    }

    return message;
  }

  formatCompanyMetrics(data) {
    if (!data || !data.data) return 'No company metrics available';

    const { employees, customers, projects, departments } = data.data;

    let message = '📊 **Company Metrics**\n\n';

    if (employees) {
      message += `👥 **Employees:** ${employees.total || 0}\n`;
      message += `   - Productivity: ${employees.avgProductivity || 0}%\n\n`;
    }

    if (customers) {
      message += `😊 **Customer Satisfaction:** ${customers.satisfaction || 0}%\n`;
      message += `   - Total Customers: ${customers.total || 0}\n\n`;
    }

    if (projects) {
      message += `📁 **Projects:** ${projects.active || 0} active\n`;
      message += `   - Completion Rate: ${projects.completionRate || 0}%\n\n`;
    }

    return message;
  }

  formatTaskManagement(data) {
    if (!data || !data.data) return 'No task data available';

    const { action, tasks, summary, task } = data.data;

    if (action === 'create' && task) {
      return `✅ Task created successfully!\n\n**${task.title}**\nID: ${task.id}\nPriority: ${task.priority}`;
    }

    if (action === 'list' && tasks) {
      let message = `📋 **Your Tasks** (${tasks.length} total)\n\n`;

      tasks.slice(0, 5).forEach((t) => {
        const statusEmoji =
          t.status === 'completed' ? '✅' : t.status === 'in-progress' ? '🔄' : '⏳';
        message += `${statusEmoji} **${t.title}**\n`;
        message += `   Priority: ${t.priority} | Due: ${t.dueDate || 'No deadline'}\n\n`;
      });

      if (summary) {
        message += `\n📊 Summary: ${summary.pending} pending, ${summary.inProgress} in progress, ${summary.completed} completed`;
      }

      return message;
    }

    return 'Task operation completed';
  }

  formatSupportTickets(data) {
    if (!data || !data.data) return 'No ticket data available';

    const { action, tickets, ticket } = data.data;

    if (action === 'create' && ticket) {
      return `✅ Support ticket created!\n\n**${ticket.subject}**\nTicket ID: ${ticket.ticketId}\nStatus: ${ticket.status}\nPriority: ${ticket.priority}`;
    }

    if (action === 'list' && tickets) {
      let message = `🎫 **Your Support Tickets** (${tickets.length} total)\n\n`;

      tickets.slice(0, 5).forEach((t) => {
        const statusEmojiMap = { resolved: '✅', 'in-progress': '🔄' };
        const statusEmoji = statusEmojiMap[t.status] || '🆕';
        message += `${statusEmoji} **${t.subject}**\n`;
        message += `   ID: ${t.ticketId} | Priority: ${t.priority}\n`;
        message += `   Status: ${t.status}\n\n`;
      });

      return message;
    }

    return 'Ticket operation completed';
  }

  formatProjectStatus(data) {
    if (!data || !data.data) return 'No project data available';

    const { action, projects, project } = data.data;

    if (action === 'get' && project) {
      let message = `📁 **Project: ${project.name}**\n\n`;
      message += `ID: ${project.projectId}\n`;
      message += `Status: ${project.status}\n`;
      message += `Progress: ${project.progress}%\n\n`;

      if (project.budget) {
        message += `💰 Budget: $${project.budget.total?.toLocaleString()} (${project.budget.spent}% spent)\n\n`;
      }

      if (project.team && project.team.length > 0) {
        message += `👥 Team:\n`;
        project.team.forEach((member) => {
          message += `   - ${member.name} (${member.role})\n`;
        });
      }

      return message;
    }

    if (action === 'list' && projects) {
      let message = `📁 **Your Projects** (${projects.length} total)\n\n`;

      projects.forEach((p) => {
        message += `**${p.name}**\n`;
        message += `   ID: ${p.projectId} | Progress: ${p.progress}%\n\n`;
      });

      return message;
    }

    return 'Project data retrieved';
  }

  formatDocumentSearch(data) {
    if (!data || !data.data) return 'No documents found';

    const { results, totalResults, query } = data.data;

    let message = `🔍 **Search Results for "${query}"**\n\n`;
    message += `Found ${totalResults} document(s)\n\n`;

    if (results && results.length > 0) {
      results.slice(0, 5).forEach((doc, index) => {
        message += `${index + 1}. **${doc.title}**\n`;
        message += `   Type: ${doc.type} | Category: ${doc.category}\n`;
        message += `   📄 ${doc.excerpt}\n\n`;
      });
    }

    return message;
  }
}

// Singleton instance
const n8nToolExecutor = new N8nToolExecutor();

module.exports = n8nToolExecutor;
