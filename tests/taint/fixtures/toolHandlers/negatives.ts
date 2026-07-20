function tool(config: { execute: (input: unknown) => unknown }) {
  return config;
}
const server = { registerTool(_n: string, _c: unknown, handler: unknown) { return handler; } };

export const a = tool({ execute: async (input) => input });
export const b = server.registerTool("run", {}, async (args: unknown) => args);
