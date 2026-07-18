import { exec } from "node:child_process";

const name = "world";
const command = `echo ${name}`;
exec(command);
