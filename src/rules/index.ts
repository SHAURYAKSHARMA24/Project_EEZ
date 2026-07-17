import type { Rule } from "../types.ts";
import { hardcodedCredential } from "./hardcodedCredential.ts";
import { secretToBrowser } from "./secretToBrowser.ts";
import { llmOutputToShell } from "./llmOutputToShell.ts";

export const allRules: Rule[] = [hardcodedCredential, secretToBrowser, llmOutputToShell];
