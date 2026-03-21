import { useHiringTasks } from '~/hooks/useHiringTasks';
import { useHiringColumns } from '~/hooks/useHiringColumns';
import { useHiringAssignableUsers } from '~/hooks/useHiringAssignableUsers';
import TaskBoard from '~/components/HiringPanel/TaskBoard';
import { useNavigate } from 'react-router-dom';

export default function TasksPage() {
  const { tasks, loading, createTask, updateTask, deleteTask, uploadTaskImage } = useHiringTasks();
  const { columns, loading: columnsLoading, createColumn, updateColumn, deleteColumn } =
    useHiringColumns();
  const { assignableUsers } = useHiringAssignableUsers();
  const navigate = useNavigate();

  return (
    <div className="h-full overflow-hidden">
      <TaskBoard
        tasks={tasks}
        loading={loading || columnsLoading}
        columns={columns}
        onCreateTask={createTask}
        onUpdateTask={updateTask}
        onDeleteTask={deleteTask}
        onCreateColumn={createColumn}
        onUpdateColumn={(id, label) => updateColumn(id, { label })}
        onDeleteColumn={deleteColumn}
        onUploadTaskImage={uploadTaskImage}
        assignableUsers={assignableUsers}
        onSwitchToTeam={() => navigate('/hiring/team')}
      />
    </div>
  );
}
