"""一键启动 AgentHub 全部服务 — Server + Web + Mobile + Desktop (dev)"""
import subprocess, os, sys, time, urllib.request

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.abspath(__file__))
MONOREPO = os.path.join(ROOT, "AgentHub")
SERVER_DIR = os.path.join(MONOREPO, "apps", "server")
WEB_DIR = os.path.join(MONOREPO, "apps", "web")
MOBILE_DIR = os.path.join(MONOREPO, "apps", "mobile")

procs = []


def spawn(label, cmd, cwd):
    """Spawn a subprocess, inheriting stdio so errors are visible."""
    env = os.environ.copy()
    env.pop("ELECTRON_RUN_AS_NODE", None)
    print(f"  [{label}] Starting...")
    p = subprocess.Popen(cmd, cwd=cwd, env=env, shell=True)
    procs.append((label, p))
    return p


def wait_health(port, timeout=30):
    """Poll /health until 200 or timeout."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            r = urllib.request.urlopen(f"http://localhost:{port}/health", timeout=2)
            if r.status == 200:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def stop_all():
    print("\n[shutdown] Stopping all services...")
    for label, p in reversed(procs):
        if p.poll() is None:
            p.terminate()
    time.sleep(1.5)
    for label, p in procs:
        if p.poll() is None:
            p.kill()
    print("[shutdown] Done.")


def main():
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
