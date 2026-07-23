import { tool } from "ai";
import { exec } from "node:child_process";

declare function loadResult(): { cmd: string };

export const rejectedShapes = tool({
  execute: async (args: { cmd: string; nested: { cmd: string } }) => {
    exec(backward);
    const backward = args.cmd;

    const deep = args.nested.cmd;
    exec(deep);

    const method = args.cmd.trim();
    exec(method);

    const unrelated = loadResult().cmd;
    exec(unrelated);

    const first = args.cmd;
    const second = first;
    exec(second);

    const aliasedArgs = args;
    exec(aliasedArgs.cmd);

    let mutable = args.cmd;
    exec(mutable);

    var reassigned = args.cmd;
    exec(reassigned);
  },
});
