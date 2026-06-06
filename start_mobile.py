"""
AgentHub Mobile Launcher
Starts backend (port 3001, if not already running) + mobile frontend (port 5174).
Usage: python start_mobile.py
"""

import subprocess
import sys
import time
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "AgentHub"
ENV_FILE = Path(__file__).resolve().parent / ".env"
LOG_DIR = Path(__file__).resolve().parent / ".logs"

PORTS = [3001, 5174]


def kill_ports(ports: list[int]) -> None:
    if sys.platform != "win32":
        return
    for port in ports:
        try:
            subprocess.run(
                [
                    "powershell", "-NoProfile", "-Command",
                    f"Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue "
                    f"| ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}"
                ],
                capture_output=True, timeout=15,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        except (subprocess.TimeoutExpired, OSError):
            pass


def _port_in_use(port: int) -> bool:
    """Check if a port is already listening."""
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command",
             f"(Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue).Count"],
            capture_output=True, timeout=10,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        return result.stdout.strip().decode("utf-8", errors="replace").strip() != "0"
    except (subprocess.TimeoutExpired, OSError):
        return False


def load_dotenv(path: Path) -> dict[str, str]:
    env = {}
    if not path.is_file():
        return env
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if value and not value.startswith("sk-ant-") and not value.startswith("your-"):
                env[key] = value
    return env


def _find_pnpm() -> str:
    if sys.platform == "win32":
        search_dirs = [
            os.path.join(os.environ.get("APPDATA", ""), "npm"),
            os.path.join(os.environ.get("LOCALAPPDATA", ""), "pnpm"),
            os.path.join(os.environ.get("ProgramFiles", ""), "pnpm"),
            os.environ.get("PNPM_HOME", ""),
        ]
        for name in ["pnpm.cmd", "pnpm.exe", "pnpm"]:
            for d in search_dirs:
                if not d:
                    continue
                path = os.path.join(d, name)
                if os.path.isfile(path):
                    return path
        for name in ["pnpm.cmd", "pnpm.exe", "pnpm"]:
            path = __import__("shutil").which(name)
            if path and os.path.isfile(path):
                return path
    return "pnpm"


def start_detached(cmd: list[str], cwd: Path, log_path: Path, env_vars: dict[str, str] | None = None) -> subprocess.Popen:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    log_fh = open(str(log_path), "w", encoding="utf-8", errors="replace")

    env = os.environ.copy()
    if env_vars:
        env.update({k: v for k, v in env_vars.items() if v})

    flags = 0
    if sys.platform == "win32":
        flags = 8 | 0x200  # DETACHED_PROCESS | CREATENEW_PROCESS_GROUP

    proc = subprocess.Popen(
        cmd, cwd=str(cwd), env=env,
        stdout=log_fh, stderr=log_fh,
        text=True, encoding="utf-8", errors="replace",
        creationflags=flags if sys.platform == "win32" else 0,
        start_new_session=True if sys.platform != "win32" else False,
    )
    return proc


def main():
    if not (ROOT / "apps" / "mobile").is_dir():
        print(f"ERROR: Mobile directory not found")
        sys.exit(1)

    pnpm = _find_pnpm()
    dotenv = load_dotenv(ENV_FILE)
    if dotenv:
        print(f"[mobile] Loaded {len(dotenv)} env vars from .env")

    try:
        subprocess.run([pnpm, "--version"], capture_output=True, check=True,
                       creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("ERROR: pnpm not found. Install pnpm first: npm install -g pnpm")
        sys.exit(1)

    print(f"  AgentHub Mobile — http://localhost:5174")
    print()

    print("[mobile] Cleaning up mobile port...")
    kill_ports([5174])
    time.sleep(1)

    # Only start backend if not already running
    backend_running = _port_in_use(3001)
    if not backend_running:
        print("[mobile] Starting backend (port 3001)...")
        start_detached(
            [pnpm, "--filter", "@agenthub/server", "dev"],
            cwd=ROOT, log_path=LOG_DIR / "server.log", env_vars=dotenv,
        )
        time.sleep(3)
    else:
        print("[mobile] Backend already running on port 3001, reusing.")

    print("[mobile] Starting mobile frontend (port 5174)...")
    start_detached(
        [pnpm, "--filter", "@agenthub/mobile", "dev"],
        cwd=ROOT, log_path=LOG_DIR / "mobile.log", env_vars=dotenv,
    )
    time.sleep(2)

    print()
    print("  Mobile ready: http://localhost:5174")
    print("  Logs: .logs/server.log  .logs/mobile.log")
    print("  Run 'python stop_dev.py' to stop all servers.")


if __name__ == "__main__":
    main()
