const { tool } = require('@langchain/core/tools');
const { z } = require('zod');
const axios = require('axios');

function getSignageApiBase() {
  return (process.env.SIGNAGE_ORDERS_API_BASE || 'http://localhost:4000/api').replace(/\/$/, '');
}

async function callSignageApi(method, path, { userId, role, params, data } = {}) {
  const url = `${getSignageApiBase()}${path}`;
  const response = await axios({
    method,
    url,
    headers: {
      'X-User-Id': userId,
      'X-User-Role': role || 'employee',
    },
    params,
    data,
    timeout: 10000,
  });
  return response.data;
}

function getOrderTools(userId, profileType) {
  const listOrders = tool(
    async ({ status, limit }) => {
      try {
        const path = profileType === 'ceo' ? '/orders' : '/orders';
        const params = { limit: limit || 10 };
        if (status) params.status = status;
        if (profileType !== 'ceo') params.assignedTo = 'me';

        const result = await callSignageApi('get', path, { userId, role: profileType, params });
        const orders = result.orders || result.data || result;

        if (!Array.isArray(orders) || orders.length === 0) {
          return 'No signage orders found.';
        }

        const lines = orders.map((o) => {
          const id = o._id || o.id || o.orderId;
          const customer = o.customerName || o.customerId || 'Unknown';
          const st = o.status || 'unknown';
          const assignee = o.assignedTo ? ` → ${o.assignedTo}` : '';
          return `• [${id}] ${customer} — ${st}${assignee}`;
        });
        return `Found ${orders.length} order(s):\n${lines.join('\n')}`;
      } catch (err) {
        return `Failed to list orders: ${err.message}`;
      }
    },
    {
      name: 'list_signage_orders',
      description:
        'List signage/print orders. CEO sees all orders, employees see their assigned orders. ' +
        'Use when asked "show me pending orders" or "what signage orders do I have?".',
      schema: z.object({
        status: z
          .string()
          .optional()
          .describe('Filter by status (pending, printing, printed, delivered, cancelled)'),
        limit: z.number().optional().describe('Max results (default 10)'),
      }),
    },
  );

  const updateOrderStatus = tool(
    async ({ orderId, status, notes }) => {
      try {
        await callSignageApi('patch', `/orders/${orderId}`, {
          userId,
          role: profileType,
          data: { status, notes },
        });
        return `Order ${orderId} updated to "${status}".`;
      } catch (err) {
        return `Failed to update order: ${err.message}`;
      }
    },
    {
      name: 'update_order_status',
      description:
        'Update the status of a signage order. ' +
        'Use when asked to "mark order X as printed" or "set order Y to delivered".',
      schema: z.object({
        orderId: z.string().describe('The order ID to update'),
        status: z
          .enum(['pending', 'printing', 'printed', 'delivered', 'cancelled'])
          .describe('New status for the order'),
        notes: z.string().optional().describe('Optional notes about the status change'),
      }),
    },
  );

  const assignOrder = tool(
    async ({ orderId, assignToName }) => {
      try {
        const { User } = require('~/db/models');
        const user = await User.findOne({
          $or: [
            { name: new RegExp(assignToName.trim(), 'i') },
            { username: new RegExp(assignToName.trim(), 'i') },
          ],
        }).lean();
        if (!user) return `User "${assignToName}" not found.`;

        await callSignageApi('patch', `/orders/${orderId}`, {
          userId,
          role: 'ceo',
          data: { assignedTo: user._id.toString(), assignedToName: user.name || user.username },
        });
        return `Order ${orderId} assigned to ${user.name || user.username}.`;
      } catch (err) {
        return `Failed to assign order: ${err.message}`;
      }
    },
    {
      name: 'assign_signage_order',
      description:
        'Assign a signage order to an employee by name. CEO only. ' +
        'Use when asked to "assign order X to John".',
      schema: z.object({
        orderId: z.string().describe('The order ID to assign'),
        assignToName: z.string().describe('Name of the employee to assign the order to'),
      }),
    },
  );

  const tools = [listOrders, updateOrderStatus];
  if (profileType === 'ceo') {
    tools.push(assignOrder);
  }
  return tools;
}

module.exports = { getOrderTools };
