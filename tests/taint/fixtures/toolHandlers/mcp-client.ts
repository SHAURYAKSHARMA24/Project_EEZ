import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const client = new Client({ name: "client", version: "1" });

client.registerTool("run", {}, async (args: unknown) => args);
