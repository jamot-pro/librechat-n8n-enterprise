import React, { useState, useEffect } from 'react';
import MDEditor from '@uiw/react-md-editor';
import {
  Plus,
  Edit3,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronRight,
  History,
  X,
  Save,
  Tag,
  Settings2,
} from 'lucide-react';
import {
  useAuditPromptList,
  useAuditPromptVersions,
  useCreateAuditPrompt,
  useUpdateAuditPrompt,
  useToggleAuditPrompt,
  useDeleteAuditPrompt,
  useCapabilities,
  useUpdateCapabilities,
} from '~/data-provider/audit-prompt-queries';
import type { AuditPrompt } from '~/data-provider/audit-prompts';

// ─── Create / Edit Form ─────────────────────────────────────────────────────

interface PromptFormProps {
  initial?: AuditPrompt | null;
  categories: string[];
  onClose: () => void;
}

function PromptForm({ initial, categories, onClose }: PromptFormProps) {
  const isEditing = !!initial;
  const [key, setKey] = useState(initial?.key || 'prompt_');
  const [name, setName] = useState(initial?.name || '');
  const [content, setContent] = useState(initial?.content || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [category, setCategory] = useState(initial?.category || 'general');
  const [newCategory, setNewCategory] = useState('');
  const [error, setError] = useState('');

  const createMutation = useCreateAuditPrompt();
  const updateMutation = useUpdateAuditPrompt();
  const isLoading = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!key || !name || !content) {
      setError('Key, name, and content are required.');
      return;
    }

    const finalCategory = newCategory.trim() || category;

    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ key, name, content, description, category: finalCategory });
      } else {
        await createMutation.mutateAsync({ key, name, content, description, category: finalCategory });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save prompt');
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {isEditing ? `Edit: ${initial.name}` : 'New Prompt'}
          {isEditing && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              (will create v{(initial?.version || 0) + 1})
            </span>
          )}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X className="h-5 w-5" />
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Key */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Key
            </label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 px-3 text-sm font-mono text-gray-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400">
                prompt_
              </span>
              <input
                value={key.replace(/^prompt_/, '')}
                onChange={(e) => {
                  const suffix = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                  setKey(`prompt_${suffix}`);
                }}
                disabled={isEditing}
                placeholder="safety_checklist"
                className="w-full rounded-r-lg border border-gray-300 px-3 py-2 text-sm font-mono disabled:bg-gray-100 disabled:text-gray-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:disabled:bg-gray-800"
              />
            </div>
            {!isEditing && (
              <p className="mt-1 text-xs text-gray-400">Only lowercase letters, numbers, and underscores</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Safety Checklist"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Category */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Category
            </label>
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => { setCategory(e.target.value); setNewCategory(''); }}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__new">+ New category</option>
              </select>
              {category === '__new' && (
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="category name"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary of this prompt..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>
        </div>

        {/* Markdown Editor */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Prompt Content (Markdown)
          </label>
          <div data-color-mode="auto">
            <MDEditor
              value={content}
              onChange={(val) => setContent(val || '')}
              height={400}
              style={{ minHeight: '300px' }}
              preview="live"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isLoading ? 'Saving...' : isEditing ? 'Save New Version' : 'Create Prompt'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Version History Panel ───────────────────────────────────────────────────

function VersionHistory({ promptKey, onClose }: { promptKey: string; onClose: () => void }) {
  const { data, isLoading } = useAuditPromptVersions(promptKey);
  const versions = data?.versions || [];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Version History: {promptKey}
        </h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-4 w-4" /></button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {versions.map((v) => (
            <div
              key={v._id}
              className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                v.isLatest
                  ? 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div>
                <span className="font-medium text-gray-800 dark:text-gray-200">v{v.version}</span>
                {v.isLatest && (
                  <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    current
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400">
                {new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Prompt Card ─────────────────────────────────────────────────────────────

function PromptCard({
  prompt,
  onEdit,
  onViewVersions,
}: {
  prompt: AuditPrompt;
  onEdit: (p: AuditPrompt) => void;
  onViewVersions: (key: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const toggleMutation = useToggleAuditPrompt();
  const deleteMutation = useDeleteAuditPrompt();

  return (
    <div
      className={`rounded-lg border bg-white transition-colors dark:bg-gray-800 ${
        prompt.isActive
          ? 'border-gray-200 dark:border-gray-700'
          : 'border-gray-200 opacity-60 dark:border-gray-700'
      }`}
    >
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 dark:text-gray-100">{prompt.name}</span>
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                {prompt.key}
              </code>
              <span className="rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                v{prompt.version}
              </span>
            </div>
            {prompt.description && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 truncate">
                {prompt.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="mr-2 flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-700 dark:text-gray-400">
            <Tag className="h-3 w-3" />
            {prompt.category}
          </span>

          <button
            onClick={() => onViewVersions(prompt.key)}
            title="Version history"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
          >
            <History className="h-4 w-4" />
          </button>
          <button
            onClick={() => onEdit(prompt)}
            title="Edit (new version)"
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 dark:hover:bg-gray-700"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => toggleMutation.mutate(prompt.key)}
            title={prompt.isActive ? 'Deactivate' : 'Activate'}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {prompt.isActive ? (
              <ToggleRight className="h-4 w-4 text-green-500" />
            ) : (
              <ToggleLeft className="h-4 w-4 text-gray-400" />
            )}
          </button>
          <button
            onClick={() => {
              if (window.confirm(`Delete "${prompt.name}" and all its versions?`)) {
                deleteMutation.mutate(prompt.key);
              }
            }}
            title="Delete"
            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Expanded: show content preview */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 dark:border-gray-700">
          <div data-color-mode="auto">
            <MDEditor.Markdown source={prompt.content} style={{ background: 'transparent' }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Capabilities Modal ──────────────────────────────────────────────────────

function CapabilitiesModal({ onClose }: { onClose: () => void }) {
  const { data: cap, isLoading } = useCapabilities();
  const updateMutation = useUpdateCapabilities();
  const [jsonText, setJsonText] = useState('{}');
  const [error, setError] = useState('');

  useEffect(() => {
    if (cap?.data) {
      setJsonText(JSON.stringify(cap.data, null, 2));
    }
  }, [cap]);

  const handleSave = async () => {
    setError('');
    try {
      const parsed = JSON.parse(jsonText);
      await updateMutation.mutateAsync(parsed);
      onClose();
    } catch (err: any) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON: ' + err.message);
      } else {
        setError(err.message || 'Failed to save');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 mx-4 flex max-h-[85vh] w-full max-w-3xl flex-col rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Jamot Capabilities</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Edit platform capabilities as JSON</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              spellCheck={false}
              className="h-96 w-full rounded-lg border border-gray-300 bg-gray-50 p-4 font-mono text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Tab ────────────────────────────────────────────────────────────────

export default function AuditPromptsTab() {
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editingPrompt, setEditingPrompt] = useState<AuditPrompt | null>(null);
  const [viewingVersions, setViewingVersions] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [showCapabilities, setShowCapabilities] = useState(false);

  const { data, isLoading } = useAuditPromptList({
    category: filterCategory || undefined,
    includeInactive: true,
  });
  const prompts = data?.prompts || [];
  const categories = data?.categories || ['general'];

  const handleEdit = (prompt: AuditPrompt) => {
    setEditingPrompt(prompt);
    setMode('edit');
    setViewingVersions(null);
  };

  const handleClose = () => {
    setMode('list');
    setEditingPrompt(null);
  };

  if (mode === 'create') {
    return <PromptForm categories={categories} onClose={handleClose} />;
  }

  if (mode === 'edit' && editingPrompt) {
    return <PromptForm initial={editingPrompt} categories={categories} onClose={handleClose} />;
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Audit Prompts</h2>
          <span className="text-sm text-gray-500">({prompts.length})</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button
            onClick={() => setShowCapabilities(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <Settings2 className="h-4 w-4" />
            Capabilities
          </button>

          <button
            onClick={() => { setMode('create'); setViewingVersions(null); }}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            New Prompt
          </button>
        </div>
      </div>

      {/* Capabilities Modal */}
      {showCapabilities && <CapabilitiesModal onClose={() => setShowCapabilities(false)} />}

      {/* Version history panel */}
      {viewingVersions && (
        <VersionHistory promptKey={viewingVersions} onClose={() => setViewingVersions(null)} />
      )}

      {/* Prompt list */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : prompts.length === 0 ? (
        <div className="flex h-64 flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <p className="text-lg">No prompts yet</p>
          <p className="text-sm mt-1">Create your first audit prompt to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {prompts.map((prompt) => (
            <PromptCard
              key={prompt._id}
              prompt={prompt}
              onEdit={handleEdit}
              onViewVersions={(key) => setViewingVersions(viewingVersions === key ? null : key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
