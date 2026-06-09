"""一键启动 AgentHub 全部服务 — Server + Web + Mobile + Desktop (dev)"""
import subprocess, os, sys, time, socket

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.abspath(__file__))
MONOREPO = os.path.join(ROOT, "AgentHub")
SERVER_DIR = os.path.join(MONOREPO, "apps", "server")
WEB_DIR = os.path.join(MONOREPO, "apps", "web")
MOBILE_DIR = os.path.join(MONOREPO, "apps", "mobile")

# Ports used by AgentHub
ALL_PORTS = [3001, 5173, 5174]

procs = []


# ── Port / health utilities ──

def kill_ports(ports: list[int]) -> None:
    """Kill any processes occupying the given ports (all TCP states)."""
    if sys.platform != "win32":
        return
    for port in ports:
        try:
            subprocess.run(
                [
                    "powershell", "-NoProfile", "-Command",
                    f"$pids = (Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue).OwningProcess | Select-Object -Unique | Where-Object {{ $_ -gt 0 }}; "
                    f"foreach ($pid in $pids) {{ Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue }}",
                ],
                capture_output=True, timeout=15,
                creationflags=subprocess.CREATE_NO_WINDOW,
            )
        except (subprocess.TimeoutExpired, OSError):
            pass


def port_listening(port: int) -> bool:
    """Return True if something accepts TCP connections on `port` (IPv4 + IPv6)."""
    for host, family in [("127.0.0.1", socket.AF_INET), ("::1", socket.AF_INET6)]:
        try:
            s = socket.socket(family, socket.SOCK_STREAM)
            s.settimeout(1)
            s.connect((host, port))
            s.close()
            return True
        except OSError:
            continue
    return False


def wait_health(port: int, timeout: float = 30) -> bool:
    """Poll until `port` is accepting TCP connections (works for any service)."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        if port_listening(port):
            return True
        time.sleep(0.5)
    return False


def spawn(label, cmd, cwd):
    """Spawn a subprocess, inheriting stdio so errors are visible."""
    env = os.environ.copy()
    env.pop("ELECTRON_RUN_AS_NODE", None)
    print(f"  [{label}] Starting...")
    p = subprocess.Popen(cmd, cwd=cwd, env=env, shell=True)
    procs.append((label, p))
    return p


def stop_all():
    print("\n[shutdown] Stopping all services...")
    for label, p in reversed(procs):
        if p.poll() is None:
            p.terminate()
    time.sleep(1.5)
    for label, p in procs:
        if p.poll() is None:
            p.kill()
    # Double-insurance: kill anything still on our ports
    kill_ports(ALL_PORTS)
    print("[shutdown] Done.")


def main():
    # Clean leftover processes from previous run
    print("[launcher] Cleaning up leftover processes...")
    kill_ports(ALL_PORTS)

    # ── 1. Server ──
    print("[1/4] Server  — backend API + WebSocket  (port 3001)")
    spawn("server",
          "npx tsx watch --exclude data/** --exclude node_modules/** src/index.ts",
          SERVER_DIR)

    if not wait_health(3001, timeout=30):
        print("  [FAIL] Server did not start.")
        stop_all()
        sys.exit(1)
    print("  [OK]   http://localhost:3001")

    # ── 2+3. Web + Mobile ──
    print("[2/4] Web     — React frontend  (port 5173)")
    spawn("web", "npx vite --host 0.0.0.0 --port 5173", WEB_DIR)

    print("[3/4] Mobile  — PWA mobile      (port 5174)")
    spawn("mobile", "npx vite --host 0.0.0.0 --port 5174", MOBILE_DIR)

    # Vite may re-optimize deps on first start — give it more time
    print("          Waiting for Vite to compile (up to 20s)...")
    for label, port in [("Web", 5173), ("Mobile", 5174)]:
        if wait_health(port, timeout=20):
            print(f"  [OK]   http://localhost:{port}")
        else:
            print(f"  [!]   Port {port} not responding (check terminal output above)")

    # ── 4. Desktop ──
    print("[4/4] Desktop — Electron dev mode")
    spawn("desktop", "pnpm --filter @agenthub/desktop dev", MONOREPO)

    print()
    print("=" * 56)
    print("  All services started!")
    print("  Server:  http://localhost:3001")
    print("  Web:     http://localhost:5173")
    print("  Mobile:  http://localhost:5174")
    print("  Desktop: Electron window")
    print("=" * 56)
    print("Press Ctrl+C to stop all services.")

    try:
        while True:
            if all(p.poll() is not None for _, p in procs):
                break
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        stop_all()


if __name__ == "__main__":
    main()
