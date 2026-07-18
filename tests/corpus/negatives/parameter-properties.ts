import { exec } from "node:child_process";

function safe(result: { text: string; output_text: string }) {
  exec(result.text);
  eval(result.output_text);
}

void safe;
