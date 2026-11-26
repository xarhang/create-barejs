import { describe, expect, test, afterEach } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const CLI_PATH = join(import.meta.dir, "../bin/index.ts");

function runCli(args: string[], cwd: string): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolvePromise) => {
    const child = spawn("bun", [CLI_PATH, ...args], { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolvePromise({ code: code ?? 1, stdout, stderr }));
  });
}

describe("create-barejs CLI", () => {
  let tempDirs: string[] = [];

  async function makeTempDir() {
    const dir = await mkdtemp(join(tmpdir(), "create-barejs-test-"));
    tempDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    for (const d of tempDirs) {
      await rm(d, { recursive: true, force: true });
    }
    tempDirs = [];
  });

  test("prints help with --help", async () => {
    const cwd = await makeTempDir();
    const res = await runCli(["--help"], cwd);
    expect(res.code).toBe(0);
    expect(res.stdout).toContain("create-barejs");
    expect(res.stdout).toContain("--runtime");
    expect(res.stdout).toContain("--node-uws");
  });

  test("rejects missing project name or path traversal", async () => {
    const cwd = await makeTempDir();
    const missing = await runCli([], cwd);
    expect(missing.code).toBe(1);

    const traversal = await runCli(["../outside", "--no-install"], cwd);
    expect(traversal.code).toBe(1);
    expect(traversal.stderr).toContain("Invalid project path");
  });

  test("scaffolds Bun template with dynamic latest barejs, JSON useLog, and OpenAPI docs", async () => {
    const cwd = await makeTempDir();
    const res = await runCli(["my-bun-app", "--bun", "--no-install"], cwd);
    expect(res.code).toBe(0);

    const pkg = JSON.parse(await readFile(join(cwd, "my-bun-app/package.json"), "utf8"));
    expect(pkg.name).toBe("my-bun-app");
    expect(pkg.dependencies.barejs).toMatch(/^(\^0\.\d+\.\d+|latest)$/);
    expect(pkg.dependencies["@sinclair/typebox"]).toMatch(/^(\^0\.\d+\.\d+|latest)$/);

    const code = await readFile(join(cwd, "my-bun-app/index.ts"), "utf8");
    expect(code).toContain('from "barejs"');
    expect(code).toContain('app.useLog({ format: "json" })');
    expect(code).toContain('app.docs("/docs"');
    expect(code).toContain("app.listen(3000)");
  });

  test("scaffolds Node.js and Node.js + uWebSockets.js templates", async () => {
    const cwd = await makeTempDir();

    const resNode = await runCli(["my-node-app", "--node", "--no-install"], cwd);
    expect(resNode.code).toBe(0);
    const codeNode = await readFile(join(cwd, "my-node-app/index.ts"), "utf8");
    expect(codeNode).toContain('from "barejs/node"');
    expect(codeNode).toContain("app.listen(3000)");

    const resUws = await runCli(["my-uws-app", "--node-uws", "--no-install"], cwd);
    expect(resUws.code).toBe(0);
    const pkgUws = JSON.parse(await readFile(join(cwd, "my-uws-app/package.json"), "utf8"));
    expect(pkgUws.dependencies["uWebSockets.js"]).toContain("uNetworking/uWebSockets.js");
    const codeUws = await readFile(join(cwd, "my-uws-app/index.ts"), "utf8");
    expect(codeUws).toContain('from "barejs/node"');
    expect(codeUws).toContain('{ engine: "uws" }');
  });

  test("scaffolds Deno template with deno.json and Deno.serve", async () => {
    const cwd = await makeTempDir();
    const res = await runCli(["my-deno-app", "--deno"], cwd);
    expect(res.code).toBe(0);

    const denoJson = JSON.parse(await readFile(join(cwd, "my-deno-app/deno.json"), "utf8"));
    expect(denoJson.imports.barejs).toMatch(/^npm:barejs(@\^0\.\d+\.\d+)?$/);
    expect(denoJson.imports["@sinclair/typebox"]).toMatch(/^npm:@sinclair\/typebox(@\^0\.\d+\.\d+)?$/);

    const code = await readFile(join(cwd, "my-deno-app/index.ts"), "utf8");
    expect(code).toContain("Deno.serve({ port: 3000 }");
  });

  test("E2E: installs dependencies and serves routes + OpenAPI 3.1 + secret stripping", async () => {
    const cwd = await makeTempDir();
    const res = await runCli(["e2e-app", "--bun"], cwd);
    expect(res.code).toBe(0);

    const appDir = join(cwd, "e2e-app");
    // Replace port 3000 with random test port 0 or 34567 to avoid conflicts
    const origCode = await readFile(join(appDir, "index.ts"), "utf8");
    const port = 34567;
    const patchedCode = origCode.replace("app.listen(3000);", `const server = app.listen(${port});`);
    await Bun.write(join(appDir, "index.ts"), patchedCode);

    const serverProc = spawn("bun", ["index.ts"], { cwd: appDir });
    try {
      // Wait for server to be ready
      let ready = false;
      for (let i = 0; i < 30; i++) {
        try {
          const r = await fetch(`http://localhost:${port}/health`);
          if (r.ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 100));
      }
      expect(ready).toBe(true);

      // 1. GET /
      const rootRes = await fetch(`http://localhost:${port}/`);
      expect(rootRes.status).toBe(200);
      expect(await rootRes.json()).toEqual({
        message: "Welcome to BareJS!",
        runtime: "bun",
        docs: "/docs"
      });

      // 2. GET /user/:id (TypeBox integer coercion)
      const userRes = await fetch(`http://localhost:${port}/user/99`);
      expect(userRes.status).toBe(200);
      expect(await userRes.json()).toEqual({
        id: 99,
        message: "User ID is 99"
      });

      // 3. POST /submit (Validation + secret stripping)
      const submitRes = await fetch(`http://localhost:${port}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "BareJS Starter", qty: 5 })
      });
      expect(submitRes.status).toBe(201);
      const submitBody = (await submitRes.json()) as Record<string, unknown>;
      expect(submitBody).toEqual({
        received: true,
        data: { name: "BareJS Starter", qty: 5 }
      });
      expect("internal_secret" in submitBody).toBe(false);

      // 4. GET /docs/json (OpenAPI 3.1)
      const docsRes = await fetch(`http://localhost:${port}/docs/json`);
      expect(docsRes.status).toBe(200);
      const spec = (await docsRes.json()) as { openapi: string; paths: Record<string, unknown> };
      expect(spec.openapi).toBe("3.1.0");
      expect(Object.keys(spec.paths)).toEqual(
        expect.arrayContaining(["/", "/user/{id}", "/submit", "/health", "/ready"])
      );
    } finally {
      serverProc.kill();
    }
  }, 20000);
});
