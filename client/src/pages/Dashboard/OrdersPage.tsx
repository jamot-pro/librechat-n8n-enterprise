import { useState, useEffect, useMemo } from 'react';
import { useToastContext } from '@librechat/client';
import { useAuthContext } from '~/hooks/AuthContext';
import DashboardHeader from '~/components/Dashboard/DashboardHeader';
import { useDashboardContext } from '~/layouts/DashboardLayout';
import ConfirmActionModal from '~/components/Profile/Modals/ConfirmActionModal';

interface SignageOrder {
  orderId: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  type: 'print' | 'buy' | string;
  copies?: number;
  totalAmount?: number;
  amountPaid?: number;
  paid?: boolean;
  status: string;
  assignedTo?: string;
  assignedToName?: string;
  createdAt?: string;
}

function CEOOrders() {
  const { showToast } = useToastContext();
  const { token } = useAuthContext();
  const [orders, setOrders] = useState<SignageOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | 'all'>('all');
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'reject' | null; orderId: string | null }>({
    type: null,
    orderId: null,
  });

  const fetchOrders = async (customerId: string | 'all' = 'all') => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (customerId !== 'all') params.set('customerId', customerId);
      const query = params.toString() ? `?${params}` : '';
      const res = await fetch(`/api/signage/orders${query}`, {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text() || `Failed (${res.status})`);
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : data.orders || data.data || []);
    } catch (e: any) {
      setError(e.message);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [token]);

  const handleApproveOrder = async (orderId: string, approved: boolean) => {
    try {
      setActionId(orderId);
      const res = await fetch(`/api/signage/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'include',
        body: JSON.stringify({ approved }),
      });
      if (!res.ok) throw new Error(await res.text() || 'Failed');
      await fetchOrders(selectedCustomerId);
      showToast({ message: approved ? 'Order approved' : 'Order rejected', status: 'success' });
      setConfirmAction({ type: null, orderId: null });
    } catch (e: any) {
      showToast({ message: e.message, status: 'error' });
    } finally {
      setActionId(null);
    }
  };

  const uniqueCustomers = useMemo(() => {
    const map = new Map<string, string>();
    orders.forEach((o) => {
      if (o.customerId && !map.has(o.customerId)) {
        map.set(o.customerId, o.customerName || o.customerEmail || o.customerId);
      }
    });
    return Array.from(map.entries());
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (selectedCustomerId === 'all') return orders;
    return orders.filter((o) => o.customerId === selectedCustomerId);
  }, [orders, selectedCustomerId]);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>;
  }
  if (error) {
    return <div className="flex h-64 items-center justify-center text-red-500">{error}</div>;
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <select
          value={selectedCustomerId}
          onChange={(e) => { setSelectedCustomerId(e.target.value); fetchOrders(e.target.value); }}
          className="rounded-lg border border-border-light bg-surface-primary-alt px-3 py-2 text-sm text-text-primary"
        >
          <option value="all">All Customers</option>
          {uniqueCustomers.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
        </select>
        <span className="text-sm text-text-secondary">{filteredOrders.length} orders</span>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border-light bg-surface-primary-alt shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border-light">
            <thead className="bg-surface-tertiary">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Order</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {filteredOrders.map((order) => (
                <tr key={order.orderId} className="hover:bg-surface-hover">
                  <td className="px-4 py-3 text-sm font-medium text-text-primary">{order.orderId?.slice(-8) || '-'}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{order.customerName || order.customerEmail || '-'}</td>
                  <td className="px-4 py-3 text-sm capitalize text-text-secondary">{order.type}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    ${order.totalAmount?.toFixed(2) || '0.00'}
                    {order.paid ? <span className="ml-1 text-green-600">Paid</span> : <span className="ml-1 text-orange-500">Unpaid</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize">{order.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    {(order.status === 'pending' || order.status === 'pending_approval') && (
                      <div className="flex gap-1">
                        <button
                          onClick={() => setConfirmAction({ type: 'approve', orderId: order.orderId })}
                          disabled={actionId === order.orderId}
                          className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setConfirmAction({ type: 'reject', orderId: order.orderId })}
                          disabled={actionId === order.orderId}
                          className="rounded bg-red-600 px-2 py-1 text-xs text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmAction.type && confirmAction.orderId && (
        <ConfirmActionModal
          type={confirmAction.type}
          onConfirm={() => handleApproveOrder(confirmAction.orderId!, confirmAction.type === 'approve')}
          onCancel={() => setConfirmAction({ type: null, orderId: null })}
        />
      )}
    </>
  );
}

function EmployeeOrders() {
  const { token } = useAuthContext();
  const [orders, setOrders] = useState<SignageOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    fetch('/api/signage/orders', {
      credentials: 'include',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setOrders(Array.isArray(d) ? d : d.orders || d.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" /></div>;
  if (!orders.length) return <div className="flex h-64 items-center justify-center text-text-secondary">No orders assigned to you.</div>;

  return (
    <div className="overflow-hidden rounded-lg border border-border-light bg-surface-primary-alt shadow-sm">
      <table className="min-w-full divide-y divide-border-light">
        <thead className="bg-surface-tertiary">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Order</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Type</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-text-secondary">Due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {orders.map((o) => (
            <tr key={o.orderId} className="hover:bg-surface-hover">
              <td className="px-4 py-3 text-sm font-medium text-text-primary">{o.orderId?.slice(-8)}</td>
              <td className="px-4 py-3 text-sm capitalize text-text-secondary">{o.type}</td>
              <td className="px-4 py-3 text-sm capitalize text-text-secondary">{o.status}</td>
              <td className="px-4 py-3 text-sm text-text-secondary">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function OrdersPage() {
  const { profile } = useDashboardContext();

  return (
    <div className="flex h-full flex-col">
      <DashboardHeader title="Signage Orders" />
      <div className="flex-1 overflow-y-auto p-6">
        {profile.profileType === 'ceo' && <CEOOrders />}
        {profile.profileType === 'employee' && <EmployeeOrders />}
      </div>
    </div>
  );
}
