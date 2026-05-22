// ============================================================
// PermissionModal — approval dialog for agent permission requests
// ============================================================

import { useState, useEffect } from "react";

interface PermissionRequest {
  permissionId: string;
  toolName: string;
  description: string;
  command?: string;
}

interface PermissionModalProps {
  open: boolean;
  permission: PermissionRequest | null;
  onApprove: () => void;
  onDeny: () => void;
}

export function PermissionModal({ open, permission, onApprove, onDeny }: PermissionModalProps) {
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (!open) {
      setCountdown(60);
      return;
    }
    setCountdown(60);
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          onDeny();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [open, onDeny]);

  if (!open || !permission) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-96 shadow-xl">
        <p className="text-sm font-medium text-yellow-400 mb-3">Agent 请求权限</p>

        <div className="space-y-2 mb-4">
          <div>
            <span className="text-xs text-gray-500">工具名称</span>
            <p className="text-sm text-gray-200">{permission.toolName}</p>
          </div>
          <div>
            <span className="text-xs text-gray-500">描述</span>
            <p className="text-sm text-gray-200">{permission.description}</p>
          </div>
          {permission.command && (
            <div>
              <span className="text-xs text-gray-500">命令</span>
              <pre className="text-xs bg-gray-900 text-gray-300 p-2 rounded mt-0.5 overflow-x-auto">
                {permission.command}
              </pre>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 mb-3">
          {countdown > 0
            ? `${countdown} 秒后自动拒绝`
            : "已自动拒绝"}
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onDeny}
            className="px-4 py-1.5 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 rounded"
          >
            拒绝
          </button>
          <button
            onClick={onApprove}
            className="px-4 py-1.5 text-sm text-white bg-green-600 hover:bg-green-700 rounded"
          >
            批准
          </button>
        </div>
      </div>
    </div>
  );
}
