"""启动 AgentHub Web 前端 (端口 5173)"""
import subprocess, os

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT, "AgentHub", "apps", "web")

if __name__ == "__main__":
    print("[start-web] AgentHub Web 前端 http://0.0.0.0:5173")
    subprocess.run("npx vite --host 0.0.0.0 --port 5173", cwd=APP_DIR, shell=True)
