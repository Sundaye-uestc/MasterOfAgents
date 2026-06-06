"""Stop all AgentHub development servers by killing processes on their ports."""
import subprocess
import sys

PORTS = [3001, 5173, 5174]

def main():
    if sys.platform != "win32":
        print("stop_dev.py currently only supports Windows.")
        return

    for port in PORTS:
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

    print("AgentHub servers stopped.")

if __name__ == "__main__":
    main()
