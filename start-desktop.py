"""启动 AgentHub 桌面端 (Electron, 开发模式)"""
import subprocess, os

ROOT = os.path.dirname(os.path.abspath(__file__))
MONOREPO = os.path.join(ROOT, "AgentHub")

if __name__ == "__main__":
    print("[start-desktop] AgentHub 桌面端 (Electron dev mode)")

    # 清除 ELECTRON_RUN_AS_NODE，防止 Electron 误以 Node 模式运行
    env = os.environ.copy()
    env.pop("ELECTRON_RUN_AS_NODE", None)

    # 使用 pnpm --filter 确保 monorepo 上下文（types, hoisted deps 等）
    subprocess.run(
        "pnpm --filter @agenthub/desktop dev",
        cwd=MONOREPO, env=env, shell=True)
