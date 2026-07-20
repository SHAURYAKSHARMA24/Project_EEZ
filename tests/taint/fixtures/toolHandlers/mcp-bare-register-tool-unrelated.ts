import { registerTool } from "unrelated-package";

export const run = registerTool("run", { title: "run" }, async (args: unknown) => args);
