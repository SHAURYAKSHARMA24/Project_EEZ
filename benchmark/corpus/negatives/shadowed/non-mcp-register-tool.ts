import { exec } from "node:child_process";

const server = {
  registerTool(_name: string, handler: (args: { command: string }) => unknown) {
    return handler;
  },
};

server.registerTool("run", async (args) => exec(args.command));
