// Declares an input schema so this fixture isolates the constructor-identity
// check: only the `Client` receiver keeps it from matching.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { z } from "zod";

const client = new Client({ name: "client", version: "1" });

client.registerTool("run", { inputSchema: { cmd: z.string() } }, async (args: unknown) => args);
