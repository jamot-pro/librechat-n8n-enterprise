const { logger } = require('@librechat/data-schemas');
const { GLOBAL_PROJECT_NAME } = require('librechat-data-provider').Constants;
const { getAgent, createAgent, updateAgent } = require('~/models/Agent');
const { getProjectByName, addAgentIdsToProject } = require('~/models/Project');
const { User } = require('~/db/models');

const DIVINE_AGENT_ID = 'agent_divine_intelligence';

const DIVINE_INSTRUCTIONS = `You are Divine Intelligence — an AI assistant with real-time access to the Jamot platform's task management system.

You have the following tools available and MUST use them for relevant requests:
- list_tasks: Retrieve tasks (filter by status, assignee, overdue, etc.)
- create_task: Create a new task and optionally assign it to a team member
- update_task_status: Move a task through statuses (todo → in_progress → review → done)
- assign_task: Assign or reassign a task to a team member
- get_task_stats: Get a summary of task counts by status
- search_users: Find team members by name
- get_my_profile: Get the current user's profile

Rules:
- When asked about tasks, ALWAYS call list_tasks or get_task_stats — never say you don't have access.
- When asked to create a task for someone (e.g. "create a task for Andrea to review the report"), call create_task immediately using search_users first if needed to resolve the name.
- After any action, confirm in one sentence what was done.
- Keep responses concise. Use bullet points for lists.
- Today's date: {{current_date}}`;

/**
 * Ensure the Divine Intelligence agent exists in MongoDB and is in the Global project.
 * Updates instructions on every startup to keep them current.
 */
async function seedDivineAgent() {
  const existing = await getAgent({ id: DIVINE_AGENT_ID });

  const instructions = DIVINE_INSTRUCTIONS.replace(
    '{{current_date}}',
    new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
  );

  if (!existing) {
    const author = await User.findOne({}).sort({ createdAt: 1 }).select('_id').lean();
    if (!author) {
      logger.warn('[seedDivineAgent] No users found — skipping agent seed');
      return;
    }

    await createAgent({
      id: DIVINE_AGENT_ID,
      name: 'Divine Intelligence',
      description: "AI-powered task management and team assistant. Ask it to create tasks, check what's overdue, or get a team summary.",
      instructions,
      provider: 'openAI',
      model: 'gpt-4o-mini',
      model_parameters: { temperature: 0 },
      tools: [],
      category: 'divine',
      author: author._id,
      conversation_starters: [
        'What tasks are assigned to me?',
        'Create a task for me to review documents',
        'Show overdue tasks',
        'Who is on the team?',
      ],
    });

    logger.info('[seedDivineAgent] Created Divine Intelligence agent');
  } else {
    // Keep instructions up to date (date changes daily)
    await updateAgent(
      { id: DIVINE_AGENT_ID },
      { instructions },
      { skipVersioning: true },
    );
  }

  // Ensure the agent is in the Global project so all users can see it
  try {
    const globalProject = await getProjectByName(GLOBAL_PROJECT_NAME, ['_id', 'agentIds']);
    if (globalProject) {
      const alreadyGlobal = globalProject.agentIds?.some((id) => id?.toString() === DIVINE_AGENT_ID);
      if (!alreadyGlobal) {
        await addAgentIdsToProject(globalProject._id.toString(), [DIVINE_AGENT_ID]);
        logger.info('[seedDivineAgent] Added Divine Intelligence to Global project');
      }
    }
  } catch (err) {
    logger.warn('[seedDivineAgent] Could not add to global project:', err.message);
  }
}

module.exports = { seedDivineAgent, DIVINE_AGENT_ID };
