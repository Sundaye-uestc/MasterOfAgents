import { useState } from "react";

interface SnapshotItem {
  id: string;
  label: string | null;
  createdAt: string;
  runId: string | null;
}

interface Props {
  snapshots: SnapshotItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRollback?: (snapshotId: string) => void;
}

export function SnapshotList({ snapshots, selectedId, onSelect, onRollback }: Props) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);

  if (snapshots.length === 0) {
    return (
      <div className="px-3 py-4 text-xs text-gray-600 text-center">暂无快照</div>
    );
  }

  return (
    <div className="py-1 space-y-0.5">
      {snapshots.map((snap) => {
        const time = new Date(snap.createdAt).toLocaleTimeString();
        const isSelected = selectedId === snap.id;
        const isConfirming = confirmId === snap.id;

        return (
          <div key={snap.id} className="group">
            <button
              onClick={() => onSelect(snap.id)}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2 hover:bg-gray-800/50 text-xs rounded mx-1 ${
                isSelected ? "bg-blue-600/20 text-blue-300" : "text-gray-400"
              }`}
            >
              <span className="text-gray-500 flex-shrink-0">📸</span>
              <div className="flex-1 min-w-0">
                <div className="text-gray-300 truncate">{snap.label ?? "快照"}</div>
                <div className="text-gray-600 text-[10px]">{time}</div>
              </div>
              {onRollback && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmId(isConfirming ? null : snap.id);
                  }}
                  disabled={rolling}
                  className={`text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                    isConfirming
                      ? "bg-orange-600/30 text-orange-400"
                      : "bg-gray-700 text-gray-400 hover:text-yellow-400 hover:bg-gray-600"
                  }`}
                >
                  {isConfirming ? "取消" : "↩ 回滚"}
                </button>
              )}
            </button>
            {isConfirming && onRollback && (
              <div className="px-3 py-1.5 mx-1 flex items-center gap-2 bg-orange-900/10 rounded border border-orange-900/30">
                <span className="text-[10px] text-orange-400 flex-1">
                  确认回滚到此快照？将覆盖当前所有文件。
                </span>
                <button
                  onClick={async () => {
                    setRolling(true);
                    try {
                      await navigator.clipboard.writeText(""); // just for fresh interaction
                    } catch {}
                    onRollback(snap.id);
                    setConfirmId(null);
                    setRolling(false);
                  }}
                  className="text-[10px] px-2 py-0.5 rounded bg-orange-600/30 text-orange-400 hover:bg-orange-600/50 flex-shrink-0"
                >
                  确认回滚
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
