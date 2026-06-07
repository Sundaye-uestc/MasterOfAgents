/**
 * Wrapper to launch Electron in dev mode without ELECTRON_RUN_AS_NODE.
 *
 * Claude Code's runtime sets ELECTRON_RUN_AS_NODE=1, which causes Electron
 * to run as plain Node.js (no `app`, `BrowserWindow`, etc.). This script
 * strips that variable before launching the real Electron process.
 */
delete process.env.ELECTRON_RUN_AS_NODE;

const electronPath = require("electron"); // npm electron package → path string
const { spawn } = require("child_process");

const args = process.argv.slice(2);

const child = spawn(electronPath, [".", ...args], {
  stdio: "inherit",
  env: process.env,
  windowsHide: false,
});

child.on("close", (code) => process.exit(code ?? 1));
