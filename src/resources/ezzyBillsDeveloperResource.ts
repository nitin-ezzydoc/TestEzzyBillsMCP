import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generic EzzyBills developer API resource.
 *
 * Exposes the source-verified mcp_api_spec.md as a readable MCP resource.
 * ChatGPT can read this resource to understand the EzzyBills API contract
 * before generating application code.
 *
 * The URI ezzybills://docs/developer-spec replaces the previous
 * ezzybills://api/email-assistant URI, which was specific to one workflow.
 */
export const ezzyBillsDeveloperResource = {
  uri: 'ezzybills://docs/developer-spec',
  name: 'EzzyBills Developer API Specification',
  description:
    'Source-verified EzzyBills API documentation covering authentication, ' +
    'document listing, approval workflows, attachment handling, purchase orders, ' +
    'content security, action-risk rules, and application profiles. ' +
    'Use this as background knowledge when generating any EzzyBills application.',

  read: async () => {
    const specPath = path.resolve(
      __dirname,
      '../../docs/mcp_api_spec.md'
    );

    const content = fs.readFileSync(specPath, 'utf8');

    return {
      contents: [
        {
          uri: 'ezzybills://docs/developer-spec',
          mimeType: 'text/markdown',
          text: content,
        },
      ],
    };
  },
};
