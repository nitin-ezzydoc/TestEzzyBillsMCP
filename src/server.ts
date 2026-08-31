import { McpServer } from '@modelcontextprotocol/server';
import { ezzyBillsDeveloperResource } from './resources/ezzyBillsDeveloperResource.js';
import { registerGetEzzyBillsDeveloperSpecTool } from './tools/getEzzyBillsDeveloperSpec.js';
import 'dotenv/config';

export function createEzzyBillsMcpServer() {
  const server = new McpServer({
    name: 'ezzybills-mcp',
    version: '1.3.0',
  });

  // Generic EzzyBills developer API resource.
  // Exposes the source-verified API documentation for any EzzyBills application.
  server.registerResource(
    'ezzybills-developer-spec',
    ezzyBillsDeveloperResource.uri,
    {
      title: ezzyBillsDeveloperResource.name,
      description: ezzyBillsDeveloperResource.description,
      mimeType: 'text/markdown',
    },
    async () => ezzyBillsDeveloperResource.read()
  );

  // Code-generation tool — returns the structured developer spec.
  // Use this when the user asks to build, generate, or scaffold an EzzyBills application.
  registerGetEzzyBillsDeveloperSpecTool(server);

  return server;
}
