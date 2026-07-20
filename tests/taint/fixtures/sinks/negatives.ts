import { exec, execFile, execSync } from "node:child_process";
import * as cp from "node:child_process";

const obj = { exec(_value: string) {} };

export function parameterShadows(
  exec: (value: string) => void,
  execSync: (value: string) => void,
  eval: (value: string) => void,
  Function: (value: string) => void,
  cp: { exec(value: string): void; execSync(value: string): void },
) {
  exec("safe");
  execSync("safe");
  eval("safe");
  Function("safe");
  cp.exec("safe");
  cp.execSync("safe");
  obj.exec("safe");
  execFile("safe", []);
}

export function localShadows() {
  const exec = (_value: string) => {};
  const execSync = (_value: string) => {};
  const eval = (_value: string) => {};
  const Function = (_value: string) => {};
  const cp = { exec, execSync };
  exec("safe");
  execSync("safe");
  eval("safe");
  Function("safe");
  cp.exec("safe");
}

void exec;
void execSync;
void cp;

import { spawn as spawnSafe } from "node:child_process";
export function spawnNoShell(cmd: string) {
  spawnSafe(cmd, ["--flag"], { shell: false });
  spawnSafe(cmd, ["--flag"]);
}

export function spawnNonLiteralShell(cmd: string, shellFlag: boolean) {
  spawnSafe(cmd, { shell: shellFlag });
}
