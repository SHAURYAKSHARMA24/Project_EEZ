import { exec } from "node:child_process";

const unrelated = { text: "safe", output_text: "safe" };
exec(unrelated.text);
eval(unrelated.output_text);
