#!/usr/bin/env bun
import { write, spawn } from "bun";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const projectName = Bun.argv[2];

if (!projectName) {
  console.error("❌ Error: Please provide a project name.");
  console.log("Usage: bun create barejs <name>");
  process.exit(1);
}

const root = join(process.cwd(), projectName);

async function init() {
  console.log(`\n🚀 Initializing BareJS project: ${projectName}...`);

  // 1. Create directory structure
  await mkdir(root, { recursive: true });

  // 2. package.json (The user's project details)
  const pkg = {
    name: projectName,
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

  // 3. index.ts (The starter code)
  const indexTs = `import { BareJS } from "barejs";
import type { Context, Params } from "barejs"; 

const app = new BareJS();

app.get("/", (ctx: Context) => {
  return ctx.json({ message: "Welcome to BareJS!" });
});

app.get("/user/:id", (req: Request, params: Params) => {
  return { id: params.id };
});

app.listen(3000);
console.log("🔥 BareJS running on http://localhost:3000");`;

  // 4. YOUR Updated tsconfig.json 
  // We add "types" to solve the VS Code errors!
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
      types: ["bun-types"] // 👈 The critical fix for Bun globals
    }
  };

  // Write all files to the new project
  await write(join(root, "package.json"), JSON.stringify(pkg, null, 2));
  await write(join(root, "index.ts"), indexTs);
  await write(join(root, "tsconfig.json"), JSON.stringify(tsConfig, null, 2));
  await write(join(root, ".gitignore"), "node_modules/\ndist/");

  console.log("📦 Installing dependencies...");
  
  // 5. Run Bun Install
  const install = spawn(["bun", "install"], { cwd: root, stdout: "inherit" });
  await install.exited;

  console.log(`\n✅ Project "${projectName}" is ready!`);
  console.log(`  cd ${projectName}\n  bun dev\n`);
}

init();