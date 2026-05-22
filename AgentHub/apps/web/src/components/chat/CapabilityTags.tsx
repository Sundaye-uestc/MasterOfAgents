// ============================================================
// CapabilityTags — colored capability pills
// ============================================================

const capColors: Record<string, string> = {
  "code-generation": "bg-blue-900/40 text-blue-300 border-blue-700",
  debugging: "bg-amber-900/40 text-amber-300 border-amber-700",
  "file-management": "bg-green-900/40 text-green-300 border-green-700",
  "web-development": "bg-purple-900/40 text-purple-300 border-purple-700",
  testing: "bg-cyan-900/40 text-cyan-300 border-cyan-700",
  analysis: "bg-pink-900/40 text-pink-300 border-pink-700",
};

interface CapabilityTagsProps {
  capabilities: string[];
  max?: number;
}

export function CapabilityTags({ capabilities, max }: CapabilityTagsProps) {
  const shown = max ? capabilities.slice(0, max) : capabilities;
  const remaining = max ? capabilities.length - max : 0;

  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map((cap) => {
        const colors = capColors[cap] ?? "bg-gray-800 text-gray-400 border-gray-700";
        return (
          <span key={cap} className={`text-[10px] px-1.5 py-0.5 rounded-full border ${colors}`}>
            {cap}
          </span>
        );
      })}
      {remaining > 0 && (
        <span className="text-[10px] text-gray-600">+{remaining}</span>
      )}
    </span>
  );
}
