"""
AgentHub — Quick start all services (web + mobile).
For separate launches, use:  python start_web.py  /  python start_mobile.py
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main():
    print("AgentHub — Starting all services")
    print()

    # Start web (backend + web frontend)
    print(">>> python start_web.py")
    subprocess.run([sys.executable, str(HERE / "start_web.py")], check=False)

    # Start mobile (backend is reused if already running, + mobile frontend)
    print(">>> python start_mobile.py")
    subprocess.run([sys.executable, str(HERE / "start_mobile.py")], check=False)


if __name__ == "__main__":
    main()
