"""启动 AgentHub 后端服务 (端口 3001)"""
import subprocess, os

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT, "AgentHub", "apps", "server")

if __name__ == "__main__":
    print("[start-server] AgentHub 后端 http://0.0.0.0:3001")
    subprocess.run(
        "npx tsx watch --exclude data/** --exclude node_modules/** src/index.ts",
        cwd=APP_DIR, shell=True)
