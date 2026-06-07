"""启动 AgentHub 桌面端 (Electron, 开发模式)"""
import subprocess, os

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT, "AgentHub", "apps", "desktop")

if __name__ == "__main__":
    print("[start-desktop] AgentHub 桌面端 (Electron dev mode)")

    # 清除 ELECTRON_RUN_AS_NODE，防止 Electron 误以 Node 模式运行
    env = os.environ.copy()
    env.pop("ELECTRON_RUN_AS_NODE", None)

    # Step 1: TypeScript 编译
    print("[start-desktop] Step 1/2: tsc...")
    subprocess.run("npx tsc", cwd=APP_DIR, env=env, shell=True)

    # Step 2: 启动 Electron
    print("[start-desktop] Step 2/2: electron .")
    subprocess.run("npx electron .", cwd=APP_DIR, env=env, shell=True)
