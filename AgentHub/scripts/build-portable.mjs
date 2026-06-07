/**
 * build-portable.mjs — One-command build + package + deploy for AgentHub Desktop
 *
 * Run from the monorepo root:
 *   node scripts/build-portable.mjs
 *
 * Or add to package.json scripts:
 *   "build:portable": "node scripts/build-portable.mjs"
 *
 * What it does:
 *   1. Build workspace packages needed for desktop (shared / server / web / desktop)
 *   2. Copy server/package.json → server/dist/  (ESM type resolution fix)
 *   3. electron-builder --dir  (dir target avoids winCodeSign symlink issue)
 *   4. Inject @agenthub/shared into unpacked node_modules
 *   5. Create server/node_modules junction → unpacked node_modules
 *   6. Deploy to ../AgentHub-Desktop-Portable/
 */

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

// ── Paths ────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RELEASE_DIR = path.join(ROOT, "release", "win-unpacked");
const PORTABLE_DIR = path.join(ROOT, "..", "AgentHub-Desktop-Portable");
const SERVER_DIR = path.join(ROOT, "apps", "server");
const SERVER_DIST = path.join(SERVER_DIR, "dist");
const SHARED_DIR = path.join(ROOT, "packages", "shared");
const SHARED_DIST = path.join(SHARED_DIR, "dist");
const DESKTOP_DIR = path.join(ROOT, "apps", "desktop");

// ── Helpers ──────────────────────────────────────────────────────────

const isWindows = process.platform === "win32";
let stepCounter = 0;
let currentStep = "";

function step(title) {
  stepCounter++;
  currentStep = title;
  console.log(`\n${"=".repeat(60)}`);
  console.log(` [${stepCounter}] ${title}`);
  console.log(`${"=".repeat(60)}`);
}

function run(cmd, opts = {}) {
  const cwd = opts.cwd ?? ROOT;
  const { ignoreError, env: extraEnv, ...rest } = opts;
  console.log(`  > ${cmd}  (cwd: ${path.relative(ROOT, cwd) || "."})`);
  try {
    execSync(cmd, {
      cwd,
      stdio: "inherit",
      shell: isWindows,
      env: extraEnv ? { ...process.env, ...extraEnv } : process.env,
      ...rest,
    });
  } catch (err) {
    if (ignoreError) {
      console.warn(`  ⚠ Command failed (ignored): ${err.message}`);
      return;
    }
    console.error(`\n  ✗ FAILED at step ${stepCounter} "${currentStep}"`);
    process.exit(1);
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** Recursive copy of a directory (like cp -r). */
function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const ent of entries) {
    const srcPath = path.join(src, ent.name);
    const destPath = path.join(dest, ent.name);
    if (ent.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (ent.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
    // Skip symlinks/junctions — we re-create the junction manually
  }
}

/** Safe rm -rf for a path that may be a junction or a real directory. */
function rmRf(dir) {
  try {
    const stat = fs.lstatSync(dir);
    if (stat.isSymbolicLink() || stat.isDirectory()) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

/** Create a directory junction. Returns false if permission denied. */
function createJunction(target, linkPath) {
  try {
    // Remove existing junction/directory first
    rmRf(linkPath);
    fs.symlinkSync(target, linkPath, "junction");
    console.log(`  ✓ Junction: ${path.basename(linkPath)} → ${target}`);
    return true;
  } catch (err) {
    console.warn(`  ⚠ Cannot create junction (may need admin): ${err.message}`);
    return false;
  }
}

// ── Build Steps ──────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log("AgentHub Desktop — Build & Package");
  console.log(`Root:    ${ROOT}`);
  console.log(`Release: ${RELEASE_DIR}`);
  console.log(`Portable: ${PORTABLE_DIR}`);

  // ── Step 1: Build all workspace packages ───────────────────────────

  step("Build workspace packages (desktop app only)");
  // Build only the packages needed for desktop: shared → server → web → desktop.
  // Skip @agenthub/mobile — it's irrelevant for the desktop app and may have
  // pre-existing build issues (e.g. vite-plugin-pwa) that shouldn't block this.
  run("pnpm --filter @agenthub/shared --filter @agenthub/server --filter @agenthub/web --filter @agenthub/desktop build");

  // ── Step 2: Ensure server dist has package.json (ESM type detection) ──

  step("Copy server package.json → server/dist/");
  const serverPkg = path.join(SERVER_DIR, "package.json");
  const serverDistPkg = path.join(SERVER_DIST, "package.json");
  fs.copyFileSync(serverPkg, serverDistPkg);
  console.log("  ✓ Copied package.json (type: module)");

  // ── Step 3: Electron-builder (dir target) ──────────────────────────

  step("electron-builder --dir");

  // Clear corrupted winCodeSign cache to prevent 7za symlink errors.
  // On Windows without Developer Mode, 7za can't extract macOS .dylib
  // symlinks from the winCodeSign archive. A fresh download still hits
  // the same error, but electron-builder will fall through to a valid
  // --dir output anyway.
  const winCodeSignCache = path.join(
    process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? "C:\\Users", "AppData", "Local"),
    "electron-builder",
    "Cache",
    "winCodeSign",
  );
  try {
    rmRf(winCodeSignCache);
  } catch { /* ignore */ }

  // Run electron-builder. It may exit non-zero because of winCodeSign
  // extraction, but the --dir output (unpacked directory) is already
  // produced before that step.
  run("npx electron-builder --dir", {
    cwd: DESKTOP_DIR,
    ignoreError: true,
    env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
  });

  // ── Verify release output exists ───────────────────────────────────

  if (!fs.existsSync(RELEASE_DIR)) {
    console.error(`\n  ✗ Release directory not found: ${RELEASE_DIR}`);
    process.exit(1);
  }
  // Double-check it has the essential files
  const asarFile = path.join(RELEASE_DIR, "resources", "app.asar");
  if (!fs.existsSync(asarFile)) {
    console.error(`\n  ✗ app.asar not found — packaging may have failed`);
    process.exit(1);
  }
  console.log(`  ✓ Unpacked app ready: ${asarFile}`);

  // ── Step 4: Inject @agenthub/shared into unpacked node_modules ─────

  step("Inject @agenthub/shared into app.asar.unpacked/node_modules");
  const unpackedNodeModules = path.join(
    RELEASE_DIR,
    "resources",
    "app.asar.unpacked",
    "node_modules",
  );
  const sharedDest = path.join(unpackedNodeModules, "@agenthub", "shared");

  // Remove old shared if present (could be stale)
  rmRf(sharedDest);

  // Copy built shared/dist into the unpacked node_modules
  // We also need the shared's package.json so Node can resolve it
  ensureDir(path.dirname(sharedDest));
  copyDir(SHARED_DIST, path.join(sharedDest, "dist"));
  // Copy package.json and any other resolution-critical files
  ["package.json"].forEach((f) => {
    const src = path.join(SHARED_DIR, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(sharedDest, f));
    }
  });

  // Validate the copy
  const sharedIndex = path.join(sharedDest, "dist", "index.js");
  if (!fs.existsSync(sharedIndex)) {
    console.error(`  ✗ @agenthub/shared injection failed — missing: ${sharedIndex}`);
    process.exit(1);
  }
  console.log("  ✓ @agenthub/shared injected");

  // ── Step 5: Create server/node_modules junction ────────────────────

  step("Create server/node_modules junction → app.asar.unpacked/node_modules");
  const releaseServerDir = path.join(RELEASE_DIR, "resources", "server");
  createJunction(unpackedNodeModules, path.join(releaseServerDir, "node_modules"));

  // ── Step 6: Deploy to AgentHub-Desktop-Portable ────────────────────

  step("Deploy to AgentHub-Desktop-Portable");

  // Preserve the launcher batch file if it exists
  const portableBatch = path.join(PORTABLE_DIR, "启动AgentHub.bat");
  let batchContent = null;
  if (fs.existsSync(portableBatch)) {
    batchContent = fs.readFileSync(portableBatch, "utf-8");
  }

  // Remove old junction first — it locks the resources directory on Windows
  const oldJunction = path.join(PORTABLE_DIR, "resources", "server", "node_modules");
  rmRf(oldJunction);

  // Remove old portable directory contents (except data + batch file).
  // We use individual file/dir removal because junctions can cause EPERM
  // on the parent directory.
  const preservePaths = new Set(["data", "启动AgentHub.bat"]);
  if (fs.existsSync(PORTABLE_DIR)) {
    const topEntries = fs.readdirSync(PORTABLE_DIR, { withFileTypes: true });
    for (const ent of topEntries) {
      if (preservePaths.has(ent.name)) continue;
      const full = path.join(PORTABLE_DIR, ent.name);
      try {
        rmRf(full);
      } catch {
        // If a directory can't be removed (e.g. locked by junction), try
        // removing its children individually and then overwrite the rest.
        if (ent.isDirectory()) {
          try {
            const children = fs.readdirSync(full, { withFileTypes: true });
            for (const child of children) {
              try { rmRf(path.join(full, child.name)); } catch { /* best effort */ }
            }
          } catch { /* best effort */ }
        }
      }
    }
  }

  // Copy all files from release to portable
  copyDir(RELEASE_DIR, PORTABLE_DIR);

  // Restore batch file (or create if not exists)
  if (batchContent) {
    fs.writeFileSync(portableBatch, batchContent, "utf-8");
    console.log("  ✓ Launcher batch file preserved");
  }

  // Ensure the server/node_modules junction exists in the portable dir too
  const portableServerDir = path.join(PORTABLE_DIR, "resources", "server");
  const portableUnpackedNM = path.join(
    PORTABLE_DIR,
    "resources",
    "app.asar.unpacked",
    "node_modules",
  );
  if (fs.existsSync(portableUnpackedNM)) {
    createJunction(portableUnpackedNM, path.join(portableServerDir, "node_modules"));
  }
  console.log("  ✓ Deployed");

  // ── Done ───────────────────────────────────────────────────────────

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"=".repeat(60)}`);
  console.log(` ✓ Build complete!  (${elapsed}s)`);
  console.log(`${"=".repeat(60)}`);
  console.log(`\nPortable app: ${PORTABLE_DIR}`);
  console.log(`Launch with:  ${path.join(PORTABLE_DIR, "启动AgentHub.bat")}`);
  console.log(`Exe:          ${path.join(PORTABLE_DIR, "AgentHub.exe")}`);
  console.log("");
}

main().catch((err) => {
  console.error("\nBuild failed:", err);
  process.exit(1);
});
