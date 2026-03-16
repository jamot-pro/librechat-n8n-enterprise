import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, Send, StopCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { sendDivineMessage } from '~/data-provider/divine';
import { useDivineHistory, useClearDivineHistory } from '~/data-provider/divine-queries';
import type { DivineMessage } from '~/data-provider/divine';

interface LocalMessage {
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

const SUGGESTIONS = [
  'What tasks are overdue?',
  'Create a task for me to review documents',
  'Show my task summary',
  'Who is on the team?',
];

export default function DivineChat() {
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<ReturnType<typeof sendDivineMessage> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const historyLoaded = useRef(false);

  const { data: history } = useDivineHistory();
  const clearHistory = useClearDivineHistory();

  // Load history once on mount
  useEffect(() => {
    if (!historyLoaded.current && history?.length) {
      setMessages(history.map((m: DivineMessage) => ({ role: m.role, content: m.content })));
      historyLoaded.current = true;
    }
  }, [history]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;

    setInput('');
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', streaming: true },
    ]);

    abortRef.current = sendDivineMessage(
      text,
      // onChunk — stream tokens into the last message
      (chunk) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.streaming) {
            updated[updated.length - 1] = { ...last, content: last.content + chunk };
          }
          return updated;
        });
      },
      // onDone
      (fullResponse) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.streaming) {
            updated[updated.length - 1] = { role: 'assistant', content: fullResponse };
          }
          return updated;
        });
        setIsLoading(false);
        abortRef.current = null;
        inputRef.current?.focus();
      },
      // onError
      (err) => {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.streaming) {
            updated[updated.length - 1] = {
              role: 'assistant',
              content: `Sorry, something went wrong: ${err}`,
            };
          }
          return updated;
        });
        setIsLoading(false);
        abortRef.current = null;
      },
    );
  }, [input, isLoading]);

  const stop = () => {
    abortRef.current?.abort();
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last?.streaming) {
        updated[updated.length - 1] = { ...last, streaming: false };
      }
      return updated;
    });
    setIsLoading(false);
    abortRef.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleClear = () => {
    clearHistory.mutate(undefined, {
      onSuccess: () => {
        setMessages([]);
        historyLoaded.current = false;
      },
    });
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
              ✦
            </div>
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white dark:border-gray-900" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Divine Intelligence</p>
            <p className="text-[10px] text-green-500 font-medium">Active</p>
          </div>
        </div>
        <button
          onClick={handleClear}
          disabled={messages.length === 0}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Clear conversation"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 pb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl mb-4 shadow-lg">
              ✦
            </div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
              What can I help with?
            </h3>
            <p className="text-xs text-gray-400 mb-5">
              Ask me anything or tell me what to do.
            </p>
            <div className="flex flex-col gap-2 w-full">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="text-left text-xs px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5 mr-2">
                ✦
              </div>
            )}
            <div
              className={`
                max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm
                ${msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                }
              `}
            >
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1">
                  {msg.content ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 text-xs">Thinking...</span>
                  )}
                  {msg.streaming && (
                    <span className="inline-block w-0.5 h-3.5 bg-gray-400 dark:bg-gray-500 animate-pulse ml-0.5 align-middle" />
                  )}
                </div>
              ) : (
                <p className="leading-relaxed">{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 pb-3 pt-2 border-t border-gray-100 dark:border-gray-800 shrink-0">
        <div className="flex gap-2 items-end bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 px-3 py-2 focus-within:border-blue-400 dark:focus-within:border-blue-600 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            rows={1}
            placeholder="Ask or instruct..."
            className="flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 outline-none resize-none max-h-32 overflow-y-auto"
            style={{ minHeight: '22px' }}
          />
          {isLoading ? (
            <button
              onClick={stop}
              className="p-1.5 text-red-500 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors shrink-0"
              title="Stop"
            >
              <StopCircle size={18} />
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!input.trim()}
              className="p-1.5 text-blue-600 hover:text-blue-700 disabled:text-gray-300 dark:disabled:text-gray-600 rounded-lg transition-colors shrink-0"
            >
              <Send size={16} />
            </button>
          )}
        </div>
        <p className="text-[10px] text-gray-300 dark:text-gray-600 text-center mt-1.5">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
