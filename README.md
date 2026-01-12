# create-barejs

The official scaffolding tool for **BareJS** — an ultra-high-performance web engine architected for [Bun](https://bun.sh) and built for **Mechanical Sympathy**.

[![NPM Version](https://img.shields.io/npm/v/create-barejs.svg)](https://www.npmjs.com/package/create-barejs)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Why BareJS?

BareJS isn't just another framework; it's a specialized engine built to eliminate overhead at every layer of the HTTP lifecycle.

* **JIT Route Compilation**: Routes and middleware chains are flattened into a single, high-speed execution path at startup.
* **Object Pooling**: Eliminates Garbage Collection (GC) spikes by recycling the `Context` object through a pre-allocated circular pool.
* **Lazy Body Parsing**: Maintains nanosecond-level latency for GET requests by only parsing JSON payloads on-demand via `ctx.jsonBody()`.
* **Zero-Dependency Core**: Leverages Bun's native APIs for maximum optimization without the bloat.

## Quick Start

Initialize a new high-performance project instantly using the Bun CLI. No global installation required.

```bash
bun create barejs my-awesome-app

```

### What's Inside?

Running this command generates a production-ready boilerplate including:

* **`index.ts`**: Optimized starter code with GET, Parametric, and POST routes.
* **`tsconfig.json`**: Pre-configured for Bun types and strict TypeScript safety.
* **Object-Pool Ready**: Pre-tuned environment for high-concurrency workloads.

## Development

Once created, navigate to your folder and start the development server with hot-reloading:

```bash
cd my-awesome-app
bun dev

```

## 📘 Documentation

For advanced usage, including **JWT Authentication**, **Data Validation (TypeBox/Zod)**, and **Middleware Orchestration**, please visit the main [BareJS Repository](https://www.google.com/search?q=https://github.com/xarhang/bareJS).

---

**Maintained by [xarhang](https://github.com/xarhang) | **License: MIT**