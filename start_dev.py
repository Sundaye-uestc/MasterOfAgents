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

# ports used by AgentHub
AGENTHUB_PORTS = [3001, 5173]


def kill_ports(ports: list[int]) -> None:
    """Kill any processes occupying the given ports so we get a clean start.
    Uses netstat + taskkill /T on Windows; lsof/fuser on POSIX."""
    if sys.platform == "win32":
        for port in ports:
            try:
                result = subprocess.run(
                    ["cmd", "/c", f"netstat -ano | findstr :{port}"],
                    capture_output=True, text=True, timeout=10,
                    creationflags=subprocess.CREATE_NO_WINDOW,
                )
                seen_pids = set()
                for line in result.stdout.strip().split("\n"):
                    parts = line.strip().split()
                    if parts and parts[-1].isdigit():
                        pid = int(parts[-1])
                        if pid > 0 and pid not in seen_pids:
                            seen_pids.add(pid)
                            try:
                                subprocess.run(
                                    ["taskkill", "/F", "/T", "/PID", str(pid)],
                                    capture_output=True, timeout=10,
                                    creationflags=subprocess.CREATE_NO_WINDOW,
                                )
                            except subprocess.TimeoutExpired:
                                pass
            except (subprocess.TimeoutExpired, OSError):
                pass
    else:
        for port in ports:
            try:
                subprocess.run(
                    ["lsof", "-ti", f":{port}", "|", "xargs", "-r", "kill", "-9"],
                    capture_output=True, timeout=10, shell=True,
                )
            except (subprocess.TimeoutExpired, OSError):
                try:
                    subprocess.run(
                        ["fuser", "-k", f"{port}/tcp"],
                        capture_output=True, timeout=10,
                    )
                except (subprocess.TimeoutExpired, OSError):
                    pass


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
        # Search in common locations first, then fall back to PATH
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
        # Fallback: try PATH via `where`
        for name in ["pnpm.cmd", "pnpm.exe", "pnpm"]:
            path = __import__("shutil").which(name)
            if path and os.path.isfile(path):
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

    # Kill any leftover processes from a previous run
    print("[launcher] Cleaning up leftover processes...")
    kill_ports(AGENTHUB_PORTS)
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

    # Give backend time to initialize
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
