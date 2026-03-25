import { useState, useEffect } from 'react';
import DashboardHeader from '~/components/Dashboard/DashboardHeader';
import { useDashboardContext } from '~/layouts/DashboardLayout';
import EmployeeSupportTab from '~/components/Profile/Employee/EmployeeSupportTab';
import CustomerTicketsTab from '~/components/Profile/Customer/CustomerTicketsTab';
import { useTickets } from '~/hooks/useTickets';

const n8nBaseUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://nadyaputriast-n8n.hf.space';

function CEOTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${n8nBaseUrl}/webhook/librechat/support-ticket-list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'admin' }),
    })
      .then((r) => r.json())
      .then((d) => setTickets(d?.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
      </div>
    );
  }

  if (!tickets.length) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-text-secondary">
        <p>No tickets found</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border-light bg-surface-primary-alt shadow-sm">
      <table className="min-w-full divide-y divide-border-light">
        <thead className="bg-surface-tertiary">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Ticket</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Priority</th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-text-secondary">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {tickets.map((ticket: any, idx: number) => (
            <tr key={ticket._id || ticket.id || idx} className="hover:bg-surface-hover">
              <td className="px-6 py-4">
                <div className="text-sm font-medium text-text-primary">{ticket.subject}</div>
                {ticket.description && <div className="text-sm text-text-secondary">{ticket.description}</div>}
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex rounded-full px-2 text-xs font-semibold capitalize leading-5">
                  {ticket.status}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-text-secondary capitalize">{ticket.priority || '-'}</td>
              <td className="px-6 py-4 text-sm text-text-secondary">
                {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TicketsPage() {
  const { profile } = useDashboardContext();
  const ticketData = useTickets(profile.userId, profile.profileType);

  useEffect(() => {
    if (profile.profileType !== 'ceo') {
      ticketData.fetchTickets();
    }
  }, []);

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Tickets" />
      <div className="flex-1 overflow-y-auto p-6">
        {profile.profileType === 'ceo' && <CEOTickets />}
        {profile.profileType === 'employee' && (
          <EmployeeSupportTab
            tickets={ticketData.tickets}
            fetchTickets={ticketData.fetchTickets}
            replyTicket={ticketData.replyTicket}
            updateTicket={ticketData.updateTicket}
            loading={ticketData.loading}
          />
        )}
        {profile.profileType === 'customer' && (
          <CustomerTicketsTab
            tickets={ticketData.tickets}
            fetchTickets={ticketData.fetchTickets}
            createTicket={ticketData.createTicket}
            replyTicket={ticketData.replyTicket}
            updateTicket={ticketData.updateTicket}
            loading={ticketData.loading}
          />
        )}
      </div>
    </div>
  );
}
