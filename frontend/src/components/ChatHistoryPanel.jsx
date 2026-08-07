'use client';

import React from 'react';
import { MessageSquare, Plus, Trash2, Clock, Sparkles } from 'lucide-react';

export default function ChatHistoryPanel({
  sessions = [],
  activeSessionId = null,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onClearAllHistory
}) {
  return (
    <div className="glass-panel rounded-xl p-3 border border-gray-800 flex flex-col flex-1 h-full min-h-0 overflow-hidden">
      {/* Panel Header */}
      <div className="flex-none flex items-center justify-between pb-2 border-b border-gray-800 mb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-semibold uppercase text-gray-300 tracking-wider font-mono flex items-center gap-1.5">
            💬 <span>Chat History</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onNewChat}
            className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 transition-colors"
            title="Start a new chat session"
          >
            <Plus className="w-3 h-3" />
            <span>✨ New</span>
          </button>

          {sessions.length > 0 && (
            <button
              onClick={onClearAllHistory}
              className="text-[11px] text-gray-500 hover:text-red-400 font-mono transition-colors"
              title="Clear all saved history"
            >
              🗑️ Clear
            </button>
          )}
        </div>
      </div>

      {/* Sessions List Container */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-0">
        {sessions.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 space-y-1 text-gray-500">
            <MessageSquare className="w-6 h-6 text-gray-600 mb-1" />
            <p className="text-xs font-sans">💬 No saved chats yet</p>
            <p className="text-[10px] text-gray-600 font-mono">🚀 Send a prompt to start a chat session!</p>
          </div>
        ) : (
          sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const msgCount = session.messages ? session.messages.length : 0;
            const formattedDate = session.createdAt
              ? new Date(session.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : 'Recent';

            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group relative flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-sky-500/15 border-sky-500/40 text-sky-100 shadow-md shadow-sky-500/5'
                    : 'bg-dark-surface/40 hover:bg-dark-surface/80 border-gray-800/80 hover:border-gray-700 text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0 pr-2">
                  <MessageSquare
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? 'text-sky-400' : 'text-gray-500 group-hover:text-gray-400'
                    }`}
                  />
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-medium font-sans truncate text-gray-200 group-hover:text-white">
                      {session.title || 'Untitled Session'}
                    </span>
                    <span className="text-[10px] font-mono text-gray-500 flex items-center gap-2">
                      <span>{formattedDate}</span>
                      <span>•</span>
                      <span>{msgCount} msg(s)</span>
                    </span>
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all"
                  title="Delete chat session"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
