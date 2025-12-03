const axios = require('axios');

class N8nProxy {
  constructor() {
    this.n8nBaseUrl = process.env.N8N_WEBHOOK_URL || 'https://nadyaputriast-n8n.hf.space/';
    this.n8nApiKey = process.env.N8N_API_KEY || '';
    console.log('[N8nProxy] Initialized with base URL:', this.n8nBaseUrl);
  }

  // Check if user has permission to access workflow
  checkWorkflowPermission(profile, workflowId) {
    const hasPermission = profile.allowedWorkflows.some((wf) => wf.workflowId === workflowId);
    console.log(`[N8nProxy] Permission check for workflow ${workflowId}:`, hasPermission);
    return hasPermission;
  }

  // Execute n8n workflow
  async executeWorkflow(workflowId, payload, profile) {
    try {
      console.log(`[N8nProxy] Executing workflow: ${workflowId}`);
      // Security check
      if (!this.checkWorkflowPermission(profile, workflowId)) {
        throw new Error('Workflow access denied for this profile type');
      }

      // Find workflow endpoint
      const workflow = profile.allowedWorkflows.find((wf) => wf.workflowId === workflowId);

      if (!workflow) {
        throw new Error('Workflow configuration not found');
      }

      // Add user context to payload
      const enrichedPayload = {
        ...payload,
        _context: {
          userId: profile.userId.toString(),
          profileType: profile.profileType,
          permissions: profile.permissions,
          timestamp: new Date().toISOString(),
        },
      };

      console.log(`[N8nProxy] Calling endpoint: ${workflow.endpoint}`);

      // Call n8n webhook
      const response = await axios.post(`${this.n8nBaseUrl}${workflow.endpoint}`, enrichedPayload, {
        headers: {
          'Content-Type': 'application/json',
          ...(this.n8nApiKey && { 'X-N8N-API-KEY': this.n8nApiKey }),
        },
        timeout: 30000, // 30 seconds timeout
      });

      console.log(`[N8nProxy] Workflow ${workflowId} executed successfully`);

      return {
        success: true,
        data: response.data,
        workflowId: workflowId,
        workflowName: workflow.workflowName,
      };
    } catch (error) {
      console.error(`[N8nProxy] Execution error for workflow ${workflowId}:`, error.message);
      // Handle specific error types
      if (error.response) {
        // n8n returned an error
        return {
          success: false,
          error: error.response.data?.message || 'Workflow execution failed',
          statusCode: error.response.status,
          workflowId: workflowId,
        };
      } else if (error.request) {
        // Request made but no response
        return {
          success: false,
          error: 'n8n server not responding. Please check connection.',
          workflowId: workflowId,
        };
      } else {
        // Other errors
        return {
          success: false,
          error: error.message,
          workflowId: workflowId,
        };
      }
    }
  }

  // Middleware function
  middleware() {
    return (req, res, next) => {
      req.n8nProxy = this;
      next();
    };
  }
}

// Export singleton instance
module.exports = new N8nProxy();
