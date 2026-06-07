"""启动 AgentHub 移动端 PWA (端口 5174)"""
import subprocess, os

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(ROOT, "AgentHub", "apps", "mobile")

if __name__ == "__main__":
    print("[start-mobile] AgentHub 移动端 http://0.0.0.0:5174")
    subprocess.run("npx vite --host 0.0.0.0 --port 5174", cwd=APP_DIR, shell=True)
