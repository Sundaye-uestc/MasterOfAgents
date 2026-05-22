"""
AgentHub Development Server Launcher
Starts backend (port 3001) + frontend (port 5173) concurrently.
Access the platform at http://localhost:5173

Usage: python start_dev.py
"""

import subprocess
import threading
import os
import sys
import signal
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "AgentHub"
ENV_FILE = Path(__file__).resolve().parent / ".env"
SERVER_DIR = ROOT / "apps" / "server"
WEB_DIR = ROOT / "apps" / "web"

processes: list[subprocess.Popen] = []


def load_dotenv(path: Path) -> dict[str, str]:
    """Parse a .env file, returning only keys with non-empty values."""
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
            if value and not value.startswith("sk-ant-...") and not value.startswith("your-"):
                env[key] = value
    return env


def prefix_lines(stream, prefix: str, out=sys.stdout):
    """Read lines from `stream`, prefix each with `prefix`, write to `out`."""
    try:
        for line in iter(stream.readline, ""):
            if line:
                out.write(f"{prefix}{line}")
                out.flush()
    except (ValueError, OSError):
        pass
    finally:
        try:
            stream.close()
        except OSError:
            pass


def start_process(cmd: list[str], cwd: Path, prefix: str, env_vars: dict[str, str] | None = None) -> subprocess.Popen:
    env = os.environ.copy()
    if env_vars:
        env.update(env_vars)
    proc = subprocess.Popen(
        cmd,
        cwd=str(cwd),
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        encoding="utf-8",
        errors="replace",
        creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
    )
    t = threading.Thread(target=prefix_lines, args=(proc.stdout, prefix), daemon=True)
    t.start()
    return proc


def cleanup():
    print("\nShutting down...")
    for p in processes:
        if p.poll() is None:
            try:
                p.terminate()
            except OSError:
                pass
    # Give processes a moment to terminate
    time.sleep(1)
    for p in processes:
        if p.poll() is None:
            try:
                p.kill()
            except OSError:
                pass
    print("All servers stopped.")


def _find_pnpm() -> str:
    """Locate pnpm executable, preferring .cmd on Windows."""
    if sys.platform == "win32":
        npm_bin = os.path.join(os.environ.get("APPDATA", ""), "npm")
        for name in ["pnpm.cmd", "pnpm.exe", "pnpm"]:
            path = os.path.join(npm_bin, name)
            if os.path.isfile(path):
                return path
        # Fallback: try PATH
        for name in ["pnpm.cmd", "pnpm.exe", "pnpm"]:
            path = __import__("shutil").which(name)
            if path:
                return path
    return "pnpm"


def main():
    # Validate prerequisites
    if not SERVER_DIR.is_dir():
        print(f"ERROR: Server directory not found: {SERVER_DIR}")
        sys.exit(1)
    if not WEB_DIR.is_dir():
        print(f"ERROR: Web directory not found: {WEB_DIR}")
        sys.exit(1)

    pnpm = _find_pnpm()
    dotenv = load_dotenv(ENV_FILE)
    if dotenv:
        print(f"[launcher] Loaded {len(dotenv)} env vars from .env")

    # Check pnpm is available
    try:
        subprocess.run([pnpm, "--version"], capture_output=True, check=True,
                       creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("ERROR: pnpm not found. Install pnpm first: npm install -g pnpm")
        sys.exit(1)

    # Register cleanup on exit
    signal.signal(signal.SIGINT, lambda sig, frame: (cleanup(), sys.exit(0)))

    print("=" * 50)
    print("  AgentHub — Starting Development Servers")
    print("  Backend:  http://localhost:3001")
    print("  Frontend: http://localhost:5173")
    print("=" * 50)
    print()

    if not (ROOT / "node_modules").exists():
        print("Installing dependencies (pnpm install)...")
        subprocess.run([pnpm, "install"], cwd=str(ROOT), check=True)
        print()

    # Start backend server
    print("[launcher] Starting backend server (port 3001)...")
    try:
        p_server = start_process(
            [pnpm, "--filter", "@agenthub/server", "dev"],
            cwd=ROOT,
            prefix="[server]  ",
            env_vars=dotenv,
        )
        processes.append(p_server)
    except OSError as e:
        print(f"ERROR: Failed to start backend: {e}")
        cleanup()
        sys.exit(1)

    # Short delay to let server start initializing
    time.sleep(2)

    # Start frontend dev server
    print("[launcher] Starting frontend dev server (port 5173)...")
    try:
        p_web = start_process(
            [pnpm, "--filter", "@agenthub/web", "dev"],
            cwd=ROOT,
            prefix="[web]    ",
            env_vars=dotenv,
        )
        processes.append(p_web)
    except OSError as e:
        print(f"ERROR: Failed to start frontend: {e}")
        cleanup()
        sys.exit(1)

    print()
    print("-" * 50)
    print("  Both servers starting. Open http://localhost:5173")
    print("  Press Ctrl+C to stop all servers.")
    print("-" * 50)
    print()

    # Wait until user interrupts
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        cleanup()


if __name__ == "__main__":
    main()
