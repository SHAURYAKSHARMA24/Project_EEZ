// Locally-declared `tool` and a `registerTool` on a non-MCP receiver: neither
// is imported from the modeled SDKs, so `findToolHandler` returns null for
// both calls (see tests/taint/fixtures/toolHandlers/negatives.ts, which this
// mirrors). `findSources` must therefore emit no "tool-parameter" bindings
// for either shape.
function tool(config: { execute: (input: unknown) => unknown }) {
  return config;
}
const server = { registerTool(_n: string, _c: unknown, handler: unknown) { return handler; } };

export const a = tool({ execute: async (input) => input });
export const b = server.registerTool("run", {}, async (args: unknown) => args);
