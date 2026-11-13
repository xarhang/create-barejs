#!/usr/bin/env bun
import { write, spawn } from "bun";
import { mkdir, readdir } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

const projectName = Bun.argv[2]?.trim();

if (!projectName) {
  console.error("❌ Error: Please provide a project name.");
  console.log("Usage: bun create barejs <name>");
  process.exit(1);
}

const cwd = process.cwd();
const root = resolve(cwd, projectName);
const rel = relative(cwd, root);

if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
  console.error("❌ Error: Invalid project path. Project must be created inside a new subdirectory of the current working directory.");
  process.exit(1);
}

const rawPkgName = basename(root).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[._-]+|[._-]+$/g, "");
const pkgName = rawPkgName || "barejs-app";

async function init() {
  console.log(`\n🚀 Initializing BareJS project: ${projectName}...`);

  // 1. Ensure target directory does not already contain files
  try {
    const existing = await readdir(root);
    if (existing.length > 0) {
      console.error(`❌ Error: Directory "${projectName}" already exists and is not empty.`);
      process.exit(1);
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }

  // 2. Create directory structure
  await mkdir(root, { recursive: true });

  // 3. package.json
  const pkg = {
    name: pkgName,
    version: "1.0.0",
    type: "module",
    scripts: {
      "dev": "bun --watch index.ts",
      "build": "bun build ./index.ts --outdir ./dist --target bun",
      "start": "bun ./dist/index.js"
    },
    dependencies: {
      "barejs": "latest"
    },
    devDependencies: {
      "bun-types": "latest"
    }
  };

  // 4. index.ts (Updated for the new Lazy Body & Context Architecture)
  const indexTs = `import { BareJS, type Context } from "barejs";

const app = new BareJS();

// Basic GET route
app.get("/", (ctx: Context) => {
  return ctx.json({ message: "Welcome to BareJS!" });
});

// Route with Parameters (JIT extracted)
app.get("/user/:id", (ctx: Context) => {
  const id = ctx.params.id;
  return { 
    id,
    message: \`User ID is \${id}\` 
  };
});

// POST route with Lazy Body Parsing
app.post("/submit", async (ctx: Context) => {
  const body = await ctx.jsonBody(); // ⚡ JIT Lazy Parsing
  return ctx.status(201).json({ 
    received: true, 
    data: body 
  });
});

app.listen(3000);
console.log("🔥 BareJS running on http://localhost:3000");`;

  // 5. tsconfig.json
  const tsConfig = {
    compilerOptions: {
      lib: ["ESNext"],
      target: "ESNext",
      module: "Preserve",
      moduleDetection: "force",
      jsx: "react-jsx",
      allowJs: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      verbatimModuleSyntax: true,
      noEmit: true,
      strict: true,
      skipLibCheck: true,
      noFallthroughCasesInSwitch: true,
      noUncheckedIndexedAccess: true,
      noImplicitOverride: true,
      types: ["bun-types"]
    }
  };

  // Write all files to the new project
  await write(join(root, "package.json"), JSON.stringify(pkg, null, 2));
  await write(join(root, "index.ts"), indexTs);
  await write(join(root, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));
  await write(join(root, ".gitignore"), "node_modules/\ndist/");

  console.log("📦 Installing dependencies...");

  // 6. Run Bun Install
  const install = spawn(["bun", "install"], {
    cwd: root,
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await install.exited;

  if (exitCode !== 0) {
    console.error(`\n❌ Failed to install dependencies (exit code ${exitCode}).`);
    process.exit(exitCode);
  }

  const cdTarget = projectName.includes(" ") ? JSON.stringify(projectName) : projectName;
  console.log(`\n✅ Project "${projectName}" is ready!`);
  console.log(`  cd ${cdTarget}\n  bun dev\n`);
}

init().catch((err) => {
  console.error("❌ Error initializing project:", err instanceof Error ? err.message : err);
  process.exit(1);
});