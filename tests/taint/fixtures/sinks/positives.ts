import { exec as run, execSync as sync } from "node:child_process";
import * as cp from "child_process";

export function positiveSinks(body: string) {
  run(body);
  sync(body);
  cp.exec(body);
  cp.execSync(body);
  eval(body);
  Function(body);
  new Function("parameter", body);
}
