/**
 * Profile Dashboard Quick Reference
 *
 * This file provides quick examples for common tasks with the Profile Dashboard components.
 */

// ========================================
// 1. IMPORTING COMPONENTS
// ========================================

// Import all Profile components
import {
  ProfileDashboard,
  WorkflowCard,
  ProfileStats,
  CEODashboard,
  EmployeeDashboard,
  CustomerDashboard,
} from '~/components/Profile';

// Import types
import type {
  ProfileData,
  ProfileDashboardProps,
  WorkflowCardProps,
  StatCardProps,
} from '~/components/Profile';

// Import hook
import useProfile from '~/hooks/useProfile';

// ========================================
// 2. USING THE PROFILE HOOK
// ========================================

function MyComponent() {
  const { profile, isLoading, error, refetch } = useProfile();

  // Manual refetch
  const handleRefresh = () => {
    refetch();
  };

  // Check profile type
  if (profile?.profileType === 'ceo') {
    // CEO-specific logic
  }

  return <ProfileDashboard profile={profile} isLoading={isLoading} error={error} />;
}

// ========================================
// 3. USING WORKFLOW CARD STANDALONE
// ========================================

function WorkflowExample() {
  const [executing, setExecuting] = useState<string | null>(null);

  const handleExecute = async (workflowId: string) => {
    setExecuting(workflowId);
    try {
      const response = await fetch(`/api/workflows/${workflowId}/execute`, {
        method: 'POST',
      });
      // Handle response
    } finally {
      setExecuting(null);
    }
  };

  return (
    <WorkflowCard
      workflowId="wf_123"
      workflowName="Financial Report"
      endpoint="/webhook/financial-report"
      description="Generate monthly financial reports"
      onExecute={handleExecute}
      isExecuting={executing === 'wf_123'}
    />
  );
}

// ========================================
// 4. USING PROFILE STATS STANDALONE
// ========================================

function StatsExample() {
  const stats = [
    {
      title: 'Total Users',
      value: '1,234',
      icon: <UserIcon />,
      trend: { value: 12, isPositive: true },
      subtitle: 'Active users',
    },
    {
      title: 'Revenue',
      value: '$45.2K',
      icon: <DollarIcon />,
      trend: { value: 5.2, isPositive: true },
    },
  ];

  return <ProfileStats stats={stats} />;
}

// ========================================
// 5. CREATING CUSTOM DASHBOARD
// ========================================

function CustomDashboard({ profile }: { profile: ProfileData }) {
  const [executingWorkflow, setExecutingWorkflow] = useState<string | null>(null);

  const handleExecuteWorkflow = async (workflowId: string) => {
    setExecutingWorkflow(workflowId);
    // Your execution logic
    setExecutingWorkflow(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-text-primary">Custom Dashboard</h1>

      {/* Your custom stats */}
      <ProfileStats
        stats={
          [
            /* your stats */
          ]
        }
      />

      {/* Workflows grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {profile.allowedWorkflows.map((workflow) => (
          <WorkflowCard
            key={workflow.workflowId}
            {...workflow}
            onExecute={handleExecuteWorkflow}
            isExecuting={executingWorkflow === workflow.workflowId}
          />
        ))}
      </div>
    </div>
  );
}

// ========================================
// 6. CONDITIONAL RENDERING BY PROFILE TYPE
// ========================================

function ConditionalExample() {
  const { profile } = useProfile();

  if (!profile) return null;

  return (
    <div>
      {profile.profileType === 'ceo' && <CEOOnlyFeature />}
      {profile.profileType === 'employee' && <EmployeeOnlyFeature />}
      {profile.profileType === 'customer' && <CustomerOnlyFeature />}
    </div>
  );
}

// ========================================
// 7. CHECKING PERMISSIONS
// ========================================

function PermissionExample() {
  const { profile } = useProfile();

  const hasPermission = (permission: string) => {
    return profile?.permissions.includes(permission);
  };

  return (
    <div>
      {hasPermission('full_analytics') && <AnalyticsSection />}
      {hasPermission('financial_data') && <FinancialData />}
    </div>
  );
}

// ========================================
// 8. ADDING NAVIGATION TO PROFILE
// ========================================

// In your Nav component:
function NavigationExample() {
  return (
    <nav>
      <Link to="/profile" className="nav-link">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        Profile
      </Link>
    </nav>
  );
}

// ========================================
// 9. CUSTOM WORKFLOW EXECUTION
// ========================================

async function executeWorkflow(workflowId: string, params?: any) {
  const response = await fetch('/api/workflows/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ workflowId, params }),
  });

  if (!response.ok) {
    throw new Error('Workflow execution failed');
  }

  return response.json();
}

// Usage in component:
function WorkflowExecutionExample() {
  const { showToast } = useToastContext();

  const handleExecute = async (workflowId: string) => {
    try {
      const result = await executeWorkflow(workflowId, {
        /* custom params */
      });
      showToast({ message: 'Success!', status: 'success' });
    } catch (error) {
      showToast({ message: 'Failed!', status: 'error' });
    }
  };

  return <WorkflowCard /* ... */ onExecute={handleExecute} />;
}

// ========================================
// 10. PROFILE DATA STRUCTURE
// ========================================

const exampleProfile: ProfileData = {
  userId: '507f1f77bcf86cd799439011',
  profileType: 'ceo',
  permissions: ['full_analytics', 'financial_data', 'all_departments'],
  allowedWorkflows: [
    {
      workflowId: 'wf_financial_analytics',
      workflowName: 'Financial Analytics Dashboard',
      endpoint: '/webhook/librechat/financial-analytics',
      description: 'Get comprehensive financial metrics and reports',
    },
  ],
  metadata: {
    securityLevel: 5,
    companyId: 'COMPANY_001',
  },
};

// ========================================
// 11. ERROR HANDLING PATTERNS
// ========================================

function ErrorHandlingExample() {
  const { profile, isLoading, error, refetch } = useProfile();

  // Loading state
  if (isLoading) {
    return <LoadingSpinner />;
  }

  // Error state with retry
  if (error) {
    return (
      <div className="error-container">
        <p>{error}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  // No profile state
  if (!profile) {
    return <NoProfileMessage />;
  }

  // Success state
  return <ProfileDashboard profile={profile} />;
}

// ========================================
// 12. TESTING EXAMPLES
// ========================================

// Mock profile for testing
export const mockCEOProfile: ProfileData = {
  userId: 'test-user-id',
  profileType: 'ceo',
  permissions: ['full_analytics'],
  allowedWorkflows: [
    {
      workflowId: 'test-wf-1',
      workflowName: 'Test Workflow',
      endpoint: '/test/webhook',
      description: 'Test description',
    },
  ],
};

// Component test
describe('ProfileDashboard', () => {
  it('renders CEO dashboard for CEO profile', () => {
    render(<ProfileDashboard profile={mockCEOProfile} />);
    expect(screen.getByText('CEO Dashboard')).toBeInTheDocument();
  });
});

// ========================================
// 13. RESPONSIVE DESIGN UTILITIES
// ========================================

// Grid classes for different screen sizes:
const gridClasses = {
  mobile: 'grid-cols-1', // 1 column on mobile
  tablet: 'sm:grid-cols-2', // 2 columns on tablet
  desktop: 'lg:grid-cols-3', // 3 columns on desktop
  wide: 'xl:grid-cols-4', // 4 columns on wide screens
};

// Usage:
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {/* Your content */}
</div>;

// ========================================
// 14. COMMON TAILWIND PATTERNS
// ========================================

const commonClasses = {
  // Cards
  card: 'rounded-lg border border-border-light bg-surface-primary-alt p-6 hover:border-border-medium transition-all',

  // Buttons
  button:
    'rounded-lg px-4 py-2.5 text-sm font-medium bg-surface-tertiary text-text-primary hover:bg-surface-hover transition-colors',

  // Text
  heading: 'text-3xl font-bold text-text-primary',
  subheading: 'text-xl font-semibold text-text-primary',
  body: 'text-sm text-text-secondary',

  // Status badges
  badge: 'rounded-full px-2.5 py-1 text-xs font-medium',
  badgeGreen: 'bg-green-500/10 text-green-600',
  badgeBlue: 'bg-blue-500/10 text-blue-600',
  badgePurple: 'bg-purple-500/10 text-purple-600',
};

// ========================================
// END OF QUICK REFERENCE
// ========================================
