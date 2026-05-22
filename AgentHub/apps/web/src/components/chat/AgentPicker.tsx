// ============================================================
// AgentPicker — multi-select agent grid with capability filter
// ============================================================

import { useState } from "react";
import type { AgentRow } from "@agenthub/shared";
import { AgentBadge } from "./AgentBadge.js";

interface AgentPickerProps {
  agents: AgentRow[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  multiSelect?: boolean;
  maxSelection?: number;
}

export function AgentPicker({ agents, selectedIds, onChange, multiSelect = false, maxSelection }: AgentPickerProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? agents.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()))
    : agents;

  const toggle = (id: string) => {
    if (multiSelect) {
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter((sid) => sid !== id));
      } else {
        if (maxSelection && selectedIds.length >= maxSelection) return;
        onChange([...selectedIds, id]);
      }
    } else {
      onChange([id]);
    }
  };

  return (
    <div>
      {multiSelect && agents.length > 4 && (
        <input
          type="text"
          placeholder="搜索 Agent..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-2"
        />
      )}
      <div className={`grid gap-2 ${multiSelect ? "grid-cols-2" : "grid-cols-1"}`}>
        {filtered.map((agent) => {
          const selected = selectedIds.includes(agent.id);
          const capabilities: string[] = (agent.capabilitiesJson
            ? JSON.parse(agent.capabilitiesJson)
            : []) as string[];

          return (
            <button
              key={agent.id}
              onClick={() => toggle(agent.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                selected
                  ? "border-blue-500 bg-blue-900/20"
                  : "border-gray-700 bg-gray-800 hover:border-gray-600"
              }`}
            >
              {multiSelect && (
                <span
                  className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center ${
                    selected ? "border-blue-500 bg-blue-500" : "border-gray-600"
                  }`}
                >
                  {selected && <span className="text-white text-[10px]">✓</span>}
                </span>
              )}
              <AgentBadge
                agentName={agent.name}
                adapterKind={agent.adapterKind ?? "custom"}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm text-gray-200 truncate">{agent.name}</div>
                <div className="text-xs text-gray-500">{agent.adapterKind}</div>
              </div>
              {selected && !multiSelect && (
                <span className="text-blue-400 text-sm">✓</span>
              )}
            </button>
          );
        })}
      </div>
      {filtered.length === 0 && (
        <p className="text-center text-gray-600 text-sm py-2">暂无可用 Agent</p>
      )}
    </div>
  );
}
