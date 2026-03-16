import { memo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { CheckSquare } from 'lucide-react';
import { useTaskStats } from '~/data-provider/task-queries';

const TasksNav = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const isActive = location.pathname === '/tasks';

  const { data: stats } = useTaskStats();
  const overdueCount = stats?.overdue ?? 0;

  return (
    <div className="px-2 py-1">
      <button
        onClick={() => navigate('/tasks')}
        className={`
          w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors
          ${
            isActive
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }
        `}
      >
        <CheckSquare size={16} className="shrink-0" />
        <span className="font-medium">Tasks</span>
        {overdueCount > 0 && !isActive && (
          <span className="ml-auto text-[10px] font-bold bg-red-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
            {overdueCount > 9 ? '9+' : overdueCount}
          </span>
        )}
      </button>
    </div>
  );
});

TasksNav.displayName = 'TasksNav';

export default TasksNav;
