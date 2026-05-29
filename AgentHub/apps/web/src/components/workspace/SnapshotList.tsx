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
}

export function SnapshotList({ snapshots, selectedId, onSelect }: Props) {
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

        return (
          <button
            key={snap.id}
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
            <div className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
          </button>
        );
      })}
    </div>
  );
}