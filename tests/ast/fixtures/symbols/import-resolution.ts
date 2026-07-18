import { exec as run } from "node:child_process";
import OpenAI from "openai";
import * as cp from "node:child_process";
import { generateText } from "ai";

const namedAliasUse = run;
const defaultUse = OpenAI;
const namespaceUse = cp;
const namedSourceUse = generateText;

eval("global");
Function("global");

function shadowed(run: unknown, OpenAI: unknown, cp: unknown, generateText: unknown, eval: Function, Function: Function) {
  const shadowNamedAliasUse = run;
  const shadowDefaultUse = OpenAI;
  const shadowNamespaceUse = cp;
  const shadowNamedSourceUse = generateText;
  eval("shadowed");
  Function("shadowed");
}

const topLevel = true;

async function outer() {
  const value = "value";
  const normalized = ((await value));
  const outerUse = value;
  const nested = () => {
    const nestedUse = value;
    return nestedUse;
  };
  return { normalized, outerUse, nested };
}

void shadowed;
void topLevel;
void outer;
