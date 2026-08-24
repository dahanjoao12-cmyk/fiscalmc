import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({ test:{ environment:"node", include:["tests/unit/**/*.test.ts"], exclude:["tests/e2e/**"], coverage:{ reporter:["text","json","html"], include:["src/lib/**/*.ts"] } }, resolve:{ alias:{ "@":fileURLToPath(new URL("./src",import.meta.url)), "server-only":fileURLToPath(new URL("./tests/mocks/server-only.ts",import.meta.url)) } } });
