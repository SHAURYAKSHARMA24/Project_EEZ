import type { Rule } from "../types.ts";
import { hardcodedCredential } from "./hardcodedCredential.ts";
import { secretToBrowser } from "./secretToBrowser.ts";

export const allRules: Rule[] = [hardcodedCredential, secretToBrowser];
