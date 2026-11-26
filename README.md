# create-barejs

The official multi-runtime scaffolding tool for **[BareJS](https://github.com/xarhang/bareJS)** — an ultra-fast, zero-allocation JIT-compiled web framework for **Bun**, **Node.js** (native & **`uWebSockets.js`**), and **Deno**.

[![NPM Version](https://img.shields.io/npm/v/create-barejs.svg)](https://www.npmjs.com/package/create-barejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why BareJS?

BareJS isn't just another framework; it's a batteries-included web engine built to eliminate overhead at every layer of the HTTP lifecycle:

* **O(1) JIT Route Compilation & Native Offloading**: Static routes compile to a top-level `switch` fast-path and dynamic routes use a radix jump-table (`:params`, `*` wildcards). On Bun, eligible routes offload to `Bun.serve({ routes })`; on Node.js, optional `uWebSockets.js` (`{ engine: "uws" }`) unlocks Tier 1 direct `uWS` routing.
* **Bounded LIFO Context Pooling**: Eliminates Garbage Collection (GC) spikes by recycling `Context` objects through a lazy bounded LIFO pool (`0..65536`) with a dev-mode Use-After-Free Proxy guard.
* **Unified Schema Validation & Secret Stripping**: First-class **TypeBox**, **Zod**, and **Native JSON Schema** validation (`params`, `query`, `headers`, `body`, `response`) with auto-coercion and automatic response secret stripping.
* **Production Ready Out of the Box**: Pre-configured with structured JSON logging (`app.useLog({ format: "json" })`), `securityHeaders()`, `healthcheck()` (`/health`, `/ready`), and **OpenAPI 3.1 + Scalar UI** (`app.docs("/docs")`).

## Quick Start

Initialize a new project interactively or pass a target runtime flag:

```bash
# Interactive (prompts for Bun, Node.js, Node.js + uWebSockets.js, or Deno)
bun create barejs my-awesome-app

# Or specify the target runtime directly:
bun create barejs my-bun-app --bun
bun create barejs my-node-app --node
bun create barejs my-uws-app --node-uws
bun create barejs my-deno-app --deno
```

### CLI Options

| Flag | Description |
| :--- | :--- |
| `-r, --runtime <target>` | Target runtime: `bun` (default), `node`, `node-uws`, or `deno` |
| `--bun` | Shortcut for `--runtime bun` |
| `--node` | Shortcut for `--runtime node` (`barejs/node` on Node.js >= 20) |
| `--node-uws`, `--uws` | Shortcut for `--runtime node-uws` (`barejs/node` + `uWebSockets.js` Tier 1 fast-path) |
| `--deno` | Shortcut for `--runtime deno` (`Deno.serve` + `deno.json`) |
| `--no-install` | Scaffold project files without running package installation |
| `-h, --help` | Display CLI help message |

### What's Inside?

Running `create-barejs` generates a production-ready starter project including:

* **`index.ts`**:
  * `app.useLog({ format: "json" })` for structured JSON request logging.
  * `securityHeaders()` and `healthcheck({ path: "/health", readyPath: "/ready" })`.
  * `app.docs("/docs")` serving **OpenAPI 3.1** JSON at `/docs/json` and interactive **Scalar API Reference** at `/docs`.
  * Sample `GET /`, `GET /user/:id` (with TypeBox `Type.Integer()` auto-coercion), and `POST /submit` (with schema validation and response secret stripping).
* **`package.json` / `deno.json`**: Automatically fetches the latest published `barejs` and `@sinclair/typebox` versions from the npm registry (e.g., `^0.2.1`, falling back to `"latest"` if offline), plus `uWebSockets.js` when `--node-uws` is selected.
* **`tsconfig.json`**: Strict TypeScript setup tailored to the chosen runtime.

## Development

Once created, start the development server with hot-reloading:

```bash
cd my-awesome-app

# Bun
bun dev

# Node.js / Node.js + uWebSockets.js
npm run dev

# Deno
deno task dev
```

Then open:
* **API**: `http://localhost:3000`
* **Interactive OpenAPI Docs (Scalar)**: `http://localhost:3000/docs`
* **OpenAPI 3.1 Spec**: `http://localhost:3000/docs/json`

## 📘 Documentation

For advanced usage — including **JWT / JWKS Authentication (`bareAuth`)**, **Password Hashing (`Hash`)**, **Rate Limiting & Idempotency**, **WebSockets & SSE**, **JSON-RPC 2.0**, and **`bareClient` End-to-End Type Safety** — visit the main [BareJS Repository](https://github.com/xarhang/bareJS).

---

**Maintained by [xarhang](https://github.com/xarhang)** | **License: MIT**