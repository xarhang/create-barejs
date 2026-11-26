#!/usr/bin/env bun
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";

type RuntimeTarget = "bun" | "node" | "node-uws" | "deno";

const VALID_RUNTIMES: readonly RuntimeTarget[] = ["bun", "node", "node-uws", "deno"];

async function resolveLatestVersion(pkg: string, fallback = "latest"): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, {
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = (await res.json()) as { version?: string };
      if (data.version) {
        return `^${data.version}`;
      }
    }
  } catch {
    // Fallback if offline or registry unreachable
  }
  return fallback;
}

function printHelp() {
  console.log(`
🚀 create-barejs — Official Multi-Runtime Starter for BareJS

Usage:
  bun create barejs <project-name> [options]

Options:
  -r, --runtime <target>   Target runtime: bun (default) | node | node-uws | deno
  --bun                    Shortcut for --runtime bun
  --node                   Shortcut for --runtime node
  --node-uws, --uws        Shortcut for --runtime node-uws (Node.js + uWebSockets.js)
  --deno                   Shortcut for --runtime deno
  --no-install             Skip automatic dependency installation
  -h, --help               Show this help message
`);
}

function parseArgs(argv: string[]): {
  projectName?: string;
  runtime?: RuntimeTarget;
  noInstall: boolean;
  help: boolean;
} {
  let projectName: string | undefined;
  let runtime: RuntimeTarget | undefined;
  let noInstall = false;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]?.trim();
    if (!arg) continue;

    if (arg === "-h" || arg === "--help") {
      help = true;
    } else if (arg === "--no-install") {
      noInstall = true;
    } else if (arg === "--bun") {
      runtime = "bun";
    } else if (arg === "--node") {
      runtime = "node";
    } else if (arg === "--node-uws" || arg === "--uws") {
      runtime = "node-uws";
    } else if (arg === "--deno") {
      runtime = "deno";
    } else if (arg === "-r" || arg === "--runtime") {
      const val = argv[++i]?.trim().toLowerCase() as RuntimeTarget | undefined;
      if (!val || !VALID_RUNTIMES.includes(val)) {
        console.error(`❌ Error: Invalid runtime "${val ?? ""}". Expected one of: ${VALID_RUNTIMES.join(", ")}`);
        process.exit(1);
      }
      runtime = val;
    } else if (arg.startsWith("--runtime=")) {
      const val = arg.slice("--runtime=".length).trim().toLowerCase() as RuntimeTarget;
      if (!VALID_RUNTIMES.includes(val)) {
        console.error(`❌ Error: Invalid runtime "${val}". Expected one of: ${VALID_RUNTIMES.join(", ")}`);
        process.exit(1);
      }
      runtime = val;
    } else if (!arg.startsWith("-")) {
      if (!projectName) {
        projectName = arg;
      }
    } else {
      console.error(`❌ Error: Unknown option "${arg}". Run with --help for usage.`);
      process.exit(1);
    }
  }

  return { projectName, runtime, noInstall, help };
}

async function promptRuntime(): Promise<RuntimeTarget> {
  if (!process.stdin.isTTY) {
    return "bun";
  }

  console.log("\nSelect a target runtime:");
  console.log("  1) Bun (Native Bun.serve + JIT route offloading) [default]");
  console.log("  2) Node.js (barejs/node — Node >= 20 native HTTP & RFC 6455 WS)");
  console.log("  3) Node.js + uWebSockets.js (barejs/node with Tier 1 uWS fast-path)");
  console.log("  4) Deno (Deno.serve + native Deno.upgradeWebSocket)");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question("Runtime [1-4, default: 1]: ")).trim().toLowerCase();
    if (answer === "" || answer === "1" || answer === "bun") return "bun";
    if (answer === "2" || answer === "node") return "node";
    if (answer === "3" || answer === "node-uws" || answer === "uws") return "node-uws";
    if (answer === "4" || answer === "deno") return "deno";
    console.log(`ℹ️  Unrecognized selection "${answer}", defaulting to Bun.`);
    return "bun";
  } finally {
    rl.close();
  }
}

function buildStarterCode(pkgName: string, runtime: RuntimeTarget): string {
  const isNode = runtime === "node" || runtime === "node-uws";
  const isUws = runtime === "node-uws";
  const isDeno = runtime === "deno";

  const importPkg = isNode ? "barejs/node" : "barejs";
  const runtimeLabel = isUws ? "node-uws" : runtime;

  const listenBlock = isDeno
    ? `Deno.serve({ port: 3000 }, (req, info) => app.fetch(req, info.remoteAddr.hostname));
console.log("🔥 BareJS (Deno) running on http://localhost:3000 (Docs: http://localhost:3000/docs)");`
    : isUws
    ? `app.listen(3000, "0.0.0.0", false, { engine: "uws" });
console.log("🔥 BareJS (Node.js + uWebSockets.js) running on http://localhost:3000 (Docs: http://localhost:3000/docs)");`
    : `app.listen(3000);
console.log("🔥 BareJS (${runtime}) running on http://localhost:3000 (Docs: http://localhost:3000/docs)");`;

  return `import { BareJS, Type, healthcheck, securityHeaders, type Context } from "${importPkg}";

const app = new BareJS();

// Structured JSON request logging & security headers
app.useLog({ format: "json" });
app.use(securityHeaders());
app.use(healthcheck({ path: "/health", readyPath: "/ready", version: "1.0.0" }));

// Automatic OpenAPI 3.1 spec (/docs/json) + Scalar interactive UI (/docs)
app.docs("/docs", {
  title: ${JSON.stringify(`${pkgName} API`)},
  version: "1.0.0",
  description: "High-performance BareJS API with TypeBox validation & OpenAPI 3.1"
});

// Basic GET route
app.get(
  "/",
  {
    detail: { summary: "Root welcome endpoint", tags: ["General"] },
    response: Type.Object({
      message: Type.String(),
      runtime: Type.String(),
      docs: Type.String()
    })
  },
  () => ({
    message: "Welcome to BareJS!",
    runtime: ${JSON.stringify(runtimeLabel)},
    docs: "/docs"
  })
);

// Route with Parameters (JIT extracted + TypeBox auto-coercion)
app.get(
  "/user/:id",
  {
    detail: { summary: "Get user by ID", tags: ["Users"] },
    params: Type.Object({ id: Type.Integer() }),
    response: Type.Object({
      id: Type.Integer(),
      message: Type.String()
    })
  },
  (ctx: Context) => {
    const id = ctx.params.id;
    return {
      id,
      message: \`User ID is \${id}\`
    };
  }
);

// POST route with Unified Schema Validation & automatic secret stripping
app.post(
  "/submit",
  {
    detail: { summary: "Submit payload", tags: ["General"] },
    body: Type.Object({
      name: Type.String({ minLength: 1 }),
      qty: Type.Optional(Type.Integer({ minimum: 1 }))
    }),
    response: Type.Object({
      received: Type.Boolean(),
      data: Type.Object({
        name: Type.String(),
        qty: Type.Optional(Type.Integer())
      })
    })
  },
  (ctx: Context) => {
    ctx.status(201);
    return {
      received: true,
      data: ctx.body,
      internal_secret: "stripped-by-response-schema"
    };
  }
);

${listenBlock}
`;
}

function buildPackageJson(
  pkgName: string,
  runtime: RuntimeTarget,
  bareVersion: string,
  typeboxVersion: string
) {
  if (runtime === "node" || runtime === "node-uws") {
    const dependencies: Record<string, string> = {
      "barejs": bareVersion,
      "@sinclair/typebox": typeboxVersion
    };
    if (runtime === "node-uws") {
      dependencies["uWebSockets.js"] = "github:uNetworking/uWebSockets.js#v20.51.0";
    }
    return {
      name: pkgName,
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "npx tsx watch index.ts",
        start: "node --import tsx index.ts"
      },
      dependencies,
      devDependencies: {
        "@types/node": "^22.0.0",
        "tsx": "^4.19.2",
        "typescript": "^5.7.0"
      }
    };
  }

  return {
    name: pkgName,
    version: "1.0.0",
    type: "module",
    scripts: {
      dev: "bun --watch index.ts",
      build: "bun build ./index.ts --outdir ./dist --target bun",
      start: "bun ./dist/index.js"
    },
    dependencies: {
      "barejs": bareVersion,
      "@sinclair/typebox": typeboxVersion
    },
    devDependencies: {
      "bun-types": "latest"
    }
  };
}

function buildDenoJson(bareVersion: string, typeboxVersion: string) {
  const bareSpecifier = bareVersion === "latest" ? "npm:barejs" : `npm:barejs@${bareVersion}`;
  const typeboxSpecifier =
    typeboxVersion === "latest" ? "npm:@sinclair/typebox" : `npm:@sinclair/typebox@${typeboxVersion}`;
  return {
    tasks: {
      dev: "deno run --allow-net --allow-env --allow-read --watch index.ts",
      start: "deno run --allow-net --allow-env --allow-read index.ts"
    },
    imports: {
      "barejs": bareSpecifier,
      "@sinclair/typebox": typeboxSpecifier
    }
  };
}

function buildTsConfig(runtime: RuntimeTarget) {
  const isNode = runtime === "node" || runtime === "node-uws";
  return {
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
      types: isNode ? ["node"] : ["bun-types"]
    }
  };
}

function runCommand(cmd: string, args: string[], cwd: string): Promise<number> {
  return new Promise((resolvePromise) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.on("error", () => resolvePromise(1));
    child.on("close", (code) => resolvePromise(code ?? 1));
  });
}

async function init() {
  const parsed = parseArgs(process.argv.slice(2));

  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  const projectName = parsed.projectName;
  if (!projectName) {
    console.error("❌ Error: Please provide a project name.");
    printHelp();
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

  const runtime: RuntimeTarget = parsed.runtime ?? (await promptRuntime());

  const [bareVersion, typeboxVersion] = await Promise.all([
    resolveLatestVersion("barejs", "latest"),
    resolveLatestVersion("@sinclair/typebox", "latest")
  ]);

  console.log(`\n🚀 Initializing BareJS (${bareVersion}) project "${projectName}" [runtime: ${runtime}]...`);

  // 2. Create directory structure
  await mkdir(root, { recursive: true });

  // 3. Generate starter files
  const indexTs = buildStarterCode(pkgName, runtime);
  await writeFile(join(root, "index.ts"), indexTs, "utf8");
  await writeFile(join(root, ".gitignore"), "node_modules/\ndist/\n.env\n", "utf8");

  if (runtime === "deno") {
    const denoJson = buildDenoJson(bareVersion, typeboxVersion);
    await writeFile(join(root, "deno.json"), JSON.stringify(denoJson, null, 2) + "\n", "utf8");
  } else {
    const pkg = buildPackageJson(pkgName, runtime, bareVersion, typeboxVersion);
    const tsConfig = buildTsConfig(runtime);
    await writeFile(join(root, "package.json"), JSON.stringify(pkg, null, 2) + "\n", "utf8");
    await writeFile(join(root, "tsconfig.json"), JSON.stringify(tsConfig, null, 2) + "\n", "utf8");
  }

  // 4. Install dependencies unless --no-install or Deno
  if (!parsed.noInstall && runtime !== "deno") {
    const hasBun = typeof (globalThis as any).Bun !== "undefined";
    const installer = runtime === "bun" && hasBun ? "bun" : "npm";
    console.log(`📦 Installing dependencies with ${installer}...`);

    const exitCode = await runCommand(installer, ["install"], root);
    if (exitCode !== 0) {
      console.error(`\n❌ Failed to install dependencies (exit code ${exitCode}).`);
      process.exit(exitCode);
    }
  }

  const cdTarget = projectName.includes(" ") ? JSON.stringify(projectName) : projectName;
  const runCmd =
    runtime === "deno"
      ? "deno task dev"
      : runtime === "node" || runtime === "node-uws"
      ? "npm run dev"
      : "bun dev";

  console.log(`\n✅ Project "${projectName}" (${runtime}) is ready!`);
  console.log(`  cd ${cdTarget}`);
  if (parsed.noInstall && runtime !== "deno") {
    console.log(`  ${runtime === "bun" ? "bun install" : "npm install"}`);
  }
  console.log(`  ${runCmd}`);
  console.log(`\n📘 OpenAPI UI:   http://localhost:3000/docs`);
  console.log(`📄 OpenAPI JSON: http://localhost:3000/docs/json\n`);
}

init().catch((err) => {
  console.error("❌ Error initializing project:", err instanceof Error ? err.message : err);
  process.exit(1);
});