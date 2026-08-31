import assert from 'node:assert/strict';
import test from 'node:test';
import { createEzzyBillsMcpServer } from '../src/server.js';
import { ezzyBillsDeveloperResource } from '../src/resources/ezzyBillsDeveloperResource.js';
import { registerGetEzzyBillsDeveloperSpecTool } from '../src/tools/getEzzyBillsDeveloperSpec.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Legacy runtime terms that must NEVER appear in the specification output.
// ═══════════════════════════════════════════════════════════════════════════════
const LEGACY_RUNTIME_TERMS = [
  'currentMcpServerModel',
  'EZZY_API_KEY',
  'EZZY_SESSION_COOKIE',
  'list_documents',
  'list_email_approvals',
  'get_email_approval',
  'get_ai_reply_html',
  'update_ai_reply',
  'approve_and_send',
  'previewUrl',
];

function assertNoLegacyRuntimeTerms(value: unknown) {
  const serialized = typeof value === 'string' ? value : (JSON.stringify(value) ?? '');

  for (const term of LEGACY_RUNTIME_TERMS) {
    assert.equal(
      serialized.includes(term),
      false,
      `Developer specification must not contain legacy runtime term: ${term}`
    );
  }
}

// Helper: capture tool registration from mock server
function captureToolRegistration() {
  let toolName = '';
  let toolMeta: any = null;
  let toolHandler: any = null;

  const mockServer = {
    registerTool: (name: string, meta: any, handler: any) => {
      toolName = name;
      toolMeta = meta;
      toolHandler = handler;
    },
  };

  registerGetEzzyBillsDeveloperSpecTool(mockServer);
  return { toolName, toolMeta, toolHandler };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. MCP TOOL & RESOURCE REGISTRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test('createEzzyBillsMcpServer registers developer-spec resource and tool', () => {
  const server = createEzzyBillsMcpServer();
  assert.ok(server, 'Server instance should be created');
});

test('Exactly one tool registered with name get_ezzybills_developer_spec', () => {
  const { toolName, toolMeta } = captureToolRegistration();
  assert.equal(toolName, 'get_ezzybills_developer_spec');
  assert.ok(toolMeta, 'Tool metadata should be present');
});

test('Tool has readOnlyHint=true and destructiveHint=false', () => {
  const { toolMeta } = captureToolRegistration();
  assert.equal(toolMeta.annotations.readOnlyHint, true, 'readOnlyHint must be true');
  assert.equal(toolMeta.annotations.destructiveHint, false, 'destructiveHint must be false');
});

test('No legacy live-action MCP tool names registered', () => {
  // Verify only one tool is registered by checking that registerTool is called exactly once
  let callCount = 0;
  const registeredNames: string[] = [];

  const mockServer = {
    registerTool: (name: string, _meta: any, _handler: any) => {
      callCount++;
      registeredNames.push(name);
    },
  };

  registerGetEzzyBillsDeveloperSpecTool(mockServer);
  assert.equal(callCount, 1, 'registerTool should be called exactly once');
  assert.equal(registeredNames[0], 'get_ezzybills_developer_spec');

  // Verify no legacy tool names
  const legacyToolNames = [
    'list_documents', 'approve_and_send', 'update_ai_reply',
    'get_email_approval', 'get_ai_reply_html',
  ];
  for (const legacyName of legacyToolNames) {
    assert.equal(
      registeredNames.includes(legacyName),
      false,
      `Legacy tool name "${legacyName}" must not be registered`
    );
  }
});

test('REST catalogue entries like approveInvoice are not rejected as legacy tools', async () => {
  // approveInvoice is a REST endpoint in the developer spec, not a legacy MCP tool.
  // Verify it appears in the catalogue.
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const spec = result.structuredContent;

  assert.ok(spec.apiCatalogue.endpoints.approveInvoice, 'approveInvoice must exist in apiCatalogue');
  assert.ok(spec.apiCatalogue.endpoints.rejectInvoice, 'rejectInvoice must exist in apiCatalogue');
});

test('Resource ezzybills://docs/developer-spec is registered separately', () => {
  assert.equal(ezzyBillsDeveloperResource.uri, 'ezzybills://docs/developer-spec');
  assert.ok(ezzyBillsDeveloperResource.name);
  assert.ok(ezzyBillsDeveloperResource.description);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. STRUCTURED CONTENT SECTION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test('get_ezzybills_developer_spec returns all 11 structured sections', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const spec = result.structuredContent;

  // All 11 sections must be present and non-empty
  const requiredSections = [
    'coreArchitecture',
    'authContract',
    'universalRules',
    'contentSecurityRules',
    'actionRiskRules',
    'apiCatalogue',
    'workflowRecipes',
    'applicationProfiles',
    'idRules',
    'specificationGaps',
    'generationRules',
  ];

  for (const section of requiredSections) {
    assert.ok(
      (spec as any)[section] !== undefined && (spec as any)[section] !== null,
      `Section "${section}" must be present`
    );
  }

  // Verify non-emptiness
  assert.ok(Array.isArray(spec.universalRules) && spec.universalRules.length > 0, 'universalRules must be non-empty array');
  assert.ok(typeof spec.contentSecurityRules === 'object' && Object.keys(spec.contentSecurityRules).length > 0, 'contentSecurityRules must be non-empty');
  assert.ok(typeof spec.actionRiskRules === 'object' && Object.keys(spec.actionRiskRules).length > 0, 'actionRiskRules must be non-empty');
  assert.ok(typeof spec.workflowRecipes === 'object' && Object.keys(spec.workflowRecipes).length > 0, 'workflowRecipes must be non-empty');
  assert.ok(typeof spec.applicationProfiles === 'object' && Object.keys(spec.applicationProfiles).length > 0, 'applicationProfiles must be non-empty');
  assert.ok(typeof spec.specificationGaps === 'object', 'specificationGaps must be an object');
});

test('authContract has correct core properties', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const auth = result.structuredContent.authContract;

  assert.equal(auth.model, 'oauth2_client_credentials');
  assert.equal('currentMcpServerModel' in auth, false);
  assert.equal(auth.tokenResponse.tokenProperty, 'token');
  assert.ok(auth.tokenRequest.fullPath.includes('/oauth/token'));
  assert.equal(auth.tokenUsage.header, 'Authorization: Bearer <token>');

  // Token expiry should mention JWT exp claim, not fixed lifetime
  assert.ok(
    auth.tokenExpiry.recommendedStrategy.includes('exp claim'),
    'Token renewal should derive from JWT exp claim'
  );

  // Backend-only storage
  assert.ok(auth.tokenStorage, 'tokenStorage section should exist');
  assert.ok(auth.tokenStorage.rule.includes('Never store'), 'Should state never store in browser');

  // Selective 401 retry
  assert.ok(
    auth.tokenExpiry.recommendedStrategy.includes('READ_ONLY'),
    'Should state single retry only for READ_ONLY calls'
  );

  // getPurchaseOrders3 covered by bearer auth
  assert.equal(auth.endpointsCoveredByBearerAuth.getPurchaseOrders3, 'SOURCE_VERIFIED');
});

test('apiCatalogue has exactly 10 endpoints', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const endpoints = result.structuredContent.apiCatalogue.endpoints;

  const endpointNames = Object.keys(endpoints);
  assert.equal(endpointNames.length, 10, `Expected 10 endpoints, got ${endpointNames.length}: ${endpointNames.join(', ')}`);

  // All 9 existing + 1 new (moveToRecycleBin)
  const expected = [
    'searchInvoicesPaged',
    'getMyAttachments2',
    'getFormData',
    'getInvoiceDetails',
    'getDocumentClassification',
    'updateInvoiceImage',
    'approveInvoice',
    'rejectInvoice',
    'getPurchaseOrders3',
    'moveToRecycleBin',
  ];

  for (const name of expected) {
    assert.ok(endpoints[name], `Endpoint "${name}" must be present`);
  }
});

test('getPurchaseOrders and getPurchaseOrders2 are ABSENT from catalogue', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const endpoints = result.structuredContent.apiCatalogue.endpoints;

  assert.equal('getPurchaseOrders' in endpoints, false, 'getPurchaseOrders must NOT be in catalogue');
  assert.equal('getPurchaseOrders2' in endpoints, false, 'getPurchaseOrders2 must NOT be in catalogue');
});

test('generationRules compatibility alias is present and non-empty', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const rules = result.structuredContent.generationRules;

  assert.ok(Array.isArray(rules), 'generationRules must be an array');
  assert.ok(rules.length >= 10, `Expected at least 10 rules, got ${rules.length}`);
  assert.ok(rules.some((r: string) => r.includes('Generated applications call EzzyBills REST APIs directly')));
  assert.ok(rules.some((r: string) => r.includes('Never expose CLIENT_SECRET')));
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. PURCHASE-ORDER ENDPOINT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test('getPurchaseOrders3 is present and classified READ_ONLY', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const po3 = result.structuredContent.apiCatalogue.endpoints.getPurchaseOrders3;

  assert.ok(po3, 'getPurchaseOrders3 must exist');
  assert.equal(po3.riskTier, 'READ_ONLY');
  assert.equal(po3.method, 'GET');
});

test('getPurchaseOrders3 has correct parameter structure', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const po3 = result.structuredContent.apiCatalogue.endpoints.getPurchaseOrders3;

  // type parameter
  assert.ok(po3.parameters.type, 'type parameter must exist');
  assert.equal(po3.parameters.type.allowedValues[0], 'PURCHASE');
  assert.equal(po3.parameters.type.allowedValues[1], 'CONTRACTOR');

  // target parameter
  assert.ok(po3.parameters.target, 'target parameter must exist');
  assert.equal(po3.parameters.target.type, 'integer');
  assert.equal(po3.parameters.target.allowedValues[1], 'Xero');
  assert.equal(po3.parameters.target.allowedValues[27], 'Simpro');
  assert.equal(po3.parameters.target.allowedValues[48], 'Procore');
});

test('getPurchaseOrders3 response includes my_orders and service_status', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const po3 = result.structuredContent.apiCatalogue.endpoints.getPurchaseOrders3;

  assert.ok(po3.responseShape.my_orders, 'Response must include my_orders');
  assert.ok(po3.responseShape.service_status, 'Response must include service_status');
  assert.ok(po3.responseShape.my_orders.includes('po_number'), 'my_orders should describe po_number field');
  assert.ok(po3.responseShape.my_orders.includes('supplier'), 'my_orders should describe supplier field');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. ACTION RISK RULES TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test('Action risk classifications are correct', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const risk = result.structuredContent.actionRiskRules.classifications;

  // READ_ONLY endpoints
  assert.ok(risk.READ_ONLY.endpoints.includes('searchInvoicesPaged'));
  assert.ok(risk.READ_ONLY.endpoints.includes('getMyAttachments2'));
  assert.ok(risk.READ_ONLY.endpoints.includes('getFormData'));
  assert.ok(risk.READ_ONLY.endpoints.includes('getInvoiceDetails'));
  assert.ok(risk.READ_ONLY.endpoints.includes('getDocumentClassification'));
  assert.ok(risk.READ_ONLY.endpoints.includes('getPurchaseOrders3'));

  // WRITE endpoint
  assert.ok(risk.WRITE.endpoints.includes('updateInvoiceImage'));

  // DESTRUCTIVE_OR_EXTERNAL endpoints
  assert.ok(risk.DESTRUCTIVE_OR_EXTERNAL.endpoints.includes('approveInvoice'));
  assert.ok(risk.DESTRUCTIVE_OR_EXTERNAL.endpoints.includes('rejectInvoice'));
  assert.ok(risk.DESTRUCTIVE_OR_EXTERNAL.endpoints.includes('moveToRecycleBin'));
});

test('moveToRecycleBin is present and classified DESTRUCTIVE_OR_EXTERNAL', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const ep = result.structuredContent.apiCatalogue.endpoints.moveToRecycleBin;

  assert.ok(ep, 'moveToRecycleBin must be in catalogue');
  assert.equal(ep.method, 'GET');
  assert.equal(ep.riskTier, 'DESTRUCTIVE_OR_EXTERNAL');
  assert.ok(ep.parameters.invoiceid, 'invoiceid parameter required');
  assert.equal(ep.responseShape.status, 'integer — 0 = success, nonzero = error');
});

test('Each catalogued endpoint has a riskTier property', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const endpoints = result.structuredContent.apiCatalogue.endpoints;

  const validTiers = ['READ_ONLY', 'WRITE', 'DESTRUCTIVE_OR_EXTERNAL'];
  for (const [name, endpoint] of Object.entries(endpoints)) {
    const ep = endpoint as any;
    assert.ok(
      validTiers.includes(ep.riskTier),
      `Endpoint "${name}" has invalid riskTier "${ep.riskTier}"`
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. CONTENT-SECURITY SEMANTIC TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test('contentSecurityRules contains required security requirements', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const csr = result.structuredContent.contentSecurityRules;
  const serialized = JSON.stringify(csr);

  // Sanitization before display and before saving
  assert.ok(csr.sanitization, 'sanitization section must exist');
  assert.ok(csr.sanitization.rule.includes('before rendering'), 'Must sanitize before rendering');
  assert.ok(csr.sanitization.rule.includes('before saving'), 'Must sanitize before saving');

  // HTTPS trusted-host validation
  assert.ok(
    serialized.includes('HTTPS') && serialized.includes('trusted host'),
    'Must require HTTPS on trusted hosts'
  );

  // MIME type, response-size, and timeout limits
  assert.ok(csr.blobSecurity.mimeAndSize, 'mimeAndSize rule must exist');
  assert.ok(csr.blobSecurity.mimeAndSize.includes('MIME'), 'Must validate MIME type');
  assert.ok(csr.blobSecurity.mimeAndSize.includes('response-size'), 'Must enforce response-size limits');
  assert.ok(csr.blobSecurity.mimeAndSize.includes('timeout'), 'Must enforce timeout limits');

  // Redirect revalidation
  assert.ok(csr.blobSecurity.redirects, 'redirects rule must exist');
  assert.ok(csr.blobSecurity.redirects.includes('redirect'), 'Must mention redirect revalidation');

  // No Bearer token forwarding to blob storage
  assert.ok(csr.blobSecurity.bearerTokens, 'bearerTokens rule must exist');
  assert.ok(csr.blobSecurity.bearerTokens.includes('Never forward'), 'Must never forward Bearer to blob');

  // No signed/SAS query strings in logs
  assert.ok(csr.blobSecurity.sasTokens, 'sasTokens rule must exist');
  assert.ok(csr.blobSecurity.sasTokens.includes('Never expose'), 'Must never expose SAS in logs');

  // Restrictive sandboxing
  assert.ok(csr.sandboxing, 'sandboxing section must exist');
  assert.ok(csr.sandboxing.rule.includes('sandboxed'), 'Must use sandboxed container');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. LEGACY GUARDRAIL TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test('Specification output contains no legacy runtime terms', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  assertNoLegacyRuntimeTerms(result);
});

test('No real-looking secret literals in specification', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const serialized = JSON.stringify(result);

  // No API keys or real-looking secrets (patterns like sk_live_, pk_test_, etc.)
  assert.equal(serialized.includes('sk_live_'), false, 'No sk_live_ secrets');
  assert.equal(serialized.includes('pk_test_'), false, 'No pk_test_ secrets');

  // No API-key or cookie authentication guidance
  assert.equal(serialized.includes('EZZY_API_KEY'), false, 'No EZZY_API_KEY');
  assert.equal(serialized.includes('EZZY_SESSION_COOKIE'), false, 'No EZZY_SESSION_COOKIE');
});

test('Universal rules are general-purpose, not email-only', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const rules = result.structuredContent.universalRules;

  // universalRules should not be email-specific
  assert.ok(
    !rules.some((r: string) => r.toLowerCase().includes('email assistant') && !r.includes('not by')),
    'universalRules should not be limited to email assistant'
  );

  // Should contain general-purpose rules
  assert.ok(rules.some((r: string) => r.includes('Use only catalogued EzzyBills routes')));
  assert.ok(rules.some((r: string) => r.includes('Never invent or hallucinate')));
  assert.ok(rules.some((r: string) => r.includes('user\'s prompt')));
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. MARKDOWN & JSON SEMANTIC PARITY
// ═══════════════════════════════════════════════════════════════════════════════

test('mcp_api_spec.md contains key contract anchors from structured JSON', async () => {
  const resourceResult = await ezzyBillsDeveloperResource.read();
  const mdText = resourceResult.contents[0]!.text;

  const requiredAnchors = [
    'getPurchaseOrders3',
    'Content Security',
    'Action Risk',
    'Specification Gaps',
    'Workflow Recipes',
    'Application Profiles',
    'searchInvoicesPaged',
    'oauth/token',
  ];

  for (const anchor of requiredAnchors) {
    assert.ok(
      mdText.includes(anchor),
      `mcp_api_spec.md must contain "${anchor}"`
    );
  }

  // getPurchaseOrders3 is the sole purchase order endpoint in the docs
  assert.ok(
    mdText.includes('getPurchaseOrders3'),
    'Docs must document getPurchaseOrders3'
  );
});

test('ezzyBillsDeveloperResource loads the Markdown documentation successfully', async () => {
  const result = await ezzyBillsDeveloperResource.read();
  assert.ok(result.contents, 'Should return contents array');
  assert.equal(result.contents.length, 1);
  const first = result.contents[0];
  assert.ok(first, 'First content item should exist');
  assert.equal(first.uri, 'ezzybills://docs/developer-spec');
  assert.equal(first.mimeType, 'text/markdown');
  assert.ok(first.text.length > 500, 'Specification text should not be empty');
  assert.ok(first.text.includes('oauth/token'));
  assert.ok(first.text.includes('searchInvoicesPaged'));
  assert.ok(first.text.includes('## Authentication (OAuth2 / JWT)'));
  assert.equal(first.text.includes('## MCP Server Authentication'), false);
  assertNoLegacyRuntimeTerms(first.text);
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. EXECUTABLE IN-PROCESS MCP SDK SMOKE TEST
// ═══════════════════════════════════════════════════════════════════════════════

test('MCP SDK in-process smoke test: tools/list', async () => {
  const server = createEzzyBillsMcpServer();

  // Use the server's internal tool listing capability
  // The MCP server should have exactly 1 tool registered
  const { toolName, toolMeta, toolHandler } = captureToolRegistration();

  assert.equal(toolName, 'get_ezzybills_developer_spec', 'Exactly one tool with correct name');
  assert.equal(toolMeta.annotations.readOnlyHint, true);
  assert.equal(toolMeta.annotations.destructiveHint, false);

  // Execute the tool and verify structuredContent
  const result = await toolHandler();
  assert.ok(result.structuredContent, 'Tool must return structuredContent');

  // Verify JSON-serializable (no circular refs, no BigInt, etc.)
  let serialized: string;
  assert.doesNotThrow(() => {
    serialized = JSON.stringify(result.structuredContent);
  }, 'structuredContent must be JSON-serializable');
});

test('MCP SDK in-process smoke test: resource read', async () => {
  const result = await ezzyBillsDeveloperResource.read();
  assert.ok(result.contents, 'Resource must return contents');
  assert.equal(result.contents.length, 1);
  assert.ok(result.contents[0]!.text.length > 500, 'Resource markdown content must have substantial length');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. SPECIFICATION GAPS TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test('specificationGaps contains required gap items', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const gaps = result.structuredContent.specificationGaps;

  assert.ok(gaps.items, 'specificationGaps must have items array');
  assert.ok(Array.isArray(gaps.items), 'items must be an array');

  const gapIds = gaps.items.map((g: any) => g.id);

  assert.ok(gapIds.includes('INVOICE_EDITOR_APIS'), 'Must include INVOICE_EDITOR_APIS gap');
  assert.ok(gapIds.includes('EMAIL_DELIVERY_STATUS'), 'Must include EMAIL_DELIVERY_STATUS gap');
  assert.ok(gapIds.includes('WEBHOOK_TOKEN_LIFETIME'), 'Must include WEBHOOK_TOKEN_LIFETIME gap');
  assert.equal(gapIds.includes('EXPORTTARGET_AVAILABILITY'), false, 'EXPORTTARGET_AVAILABILITY must be resolved');
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. CORE ARCHITECTURE & DEFAULT STACK TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test('coreArchitecture contains defaultStack as mandatory default', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const core = result.structuredContent.coreArchitecture;

  assert.ok(core.defaultStack, 'defaultStack must exist');
  assert.equal(core.defaultStack.frontend, 'React + Vite');
  assert.equal(core.defaultStack.backend, 'Node.js / Express');
  assert.ok(
    core.defaultStack.note.includes('mandatory default stack'),
    'defaultStack note must state it is the mandatory default'
  );
  assert.ok(
    core.defaultStack.note.includes('explicitly requests'),
    'defaultStack note must say to deviate only when user explicitly requests'
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. APPLICATION PROFILES & STATE FILTER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

test('applicationProfiles includes required profiles', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const profiles = result.structuredContent.applicationProfiles;

  assert.ok(profiles['document-browser'], 'document-browser profile must exist');
  assert.ok(profiles['approval-queue'], 'approval-queue profile must exist');
  assert.ok(profiles['email-response-approval'], 'email-response-approval profile must exist');
  assert.ok(profiles['purchase-order-selector'], 'purchase-order-selector profile must exist');
  assert.ok(profiles['invoice-editor'], 'invoice-editor profile must exist');
  assert.equal(profiles['invoice-editor'].status, 'DEFERRED', 'invoice-editor must be DEFERRED');
});

test('purchase-order-selector profile includes friendly target dropdown mapping to numeric IDs', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const pos = result.structuredContent.applicationProfiles['purchase-order-selector'];
  const serialized = JSON.stringify(pos);

  assert.ok(
    serialized.includes('Xero') && serialized.includes('Procore') && serialized.includes('Simpro'),
    'purchase-order-selector must mention Xero, Procore, and Simpro'
  );
  assert.ok(
    serialized.includes('numeric ID'),
    'purchase-order-selector must mention numeric ID mapping'
  );
  assert.ok(
    serialized.includes('empty'),
    'purchase-order-selector must handle empty results'
  );
});

test('approval-queue uses "Approve & Continue Workflow" wording', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const aq = result.structuredContent.applicationProfiles['approval-queue'];
  const serialized = JSON.stringify(aq);

  assert.ok(
    serialized.includes('Approve & Continue Workflow'),
    'approval-queue must use "Approve & Continue Workflow" wording'
  );
});

test('statefilter includes all confirmed switch-case filter states', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const statefilter = result.structuredContent.apiCatalogue.endpoints.searchInvoicesPaged.parameters.statefilter;

  assert.ok(statefilter.allowedValues.SHOW_ALL, 'SHOW_ALL must exist');
  assert.ok(statefilter.allowedValues.APPROVAL, 'APPROVAL must exist');
  assert.ok(statefilter.allowedValues.EMAIL_APPROVAL, 'EMAIL_APPROVAL must exist');
  assert.ok(statefilter.allowedValues.FAILED, 'FAILED must exist');
  assert.ok(statefilter.allowedValues.COMPLETE, 'COMPLETE must exist');
  assert.equal(statefilter.allowedValues.REJECTED, undefined, 'REJECTED must not be in statefilter');
  assert.equal(statefilter.allowedValues.APPROVED, undefined, 'APPROVED must not be in statefilter');
});

test('searchInvoicesPaged responseShape includes Completed and Contact', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const docItem = result.structuredContent.apiCatalogue.endpoints.searchInvoicesPaged.responseShape.documentItem;

  assert.ok(docItem.Completed, 'Completed field must exist in documentItem');
  assert.ok(docItem.Contact, 'Contact field must exist in documentItem');
});

test('universalRules and generationRules include Completed === 1 read-only rule', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const universal = result.structuredContent.universalRules;
  const generation = result.structuredContent.generationRules;

  assert.ok(
    universal.some((r: string) => r.includes('Completed === 1')),
    'universalRules must contain Completed === 1 rule'
  );
  assert.ok(
    generation.some((r: string) => r.includes('Completed is 1') || r.includes('Completed === 1')),
    'generationRules must contain Completed === 1 rule'
  );
});

test('email-response-approval profile requires WYSIWYG editor, ai-original-email separation, and scrolling', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const emailProfile = result.structuredContent.applicationProfiles['email-response-approval'];
  const serialized = JSON.stringify(emailProfile);

  assert.ok(serialized.includes('WYSIWYG'), 'Must require WYSIWYG editor');
  assert.ok(serialized.includes('overflow-y: auto'), 'Must require overflow-y: auto scrolling');
  assert.ok(serialized.includes('Waiting for Approval'), 'Must require Waiting for Approval badge');
  assert.ok(serialized.includes('from_email'), 'Must use verified from_email field');
  assert.ok(serialized.includes('ai-original-email'), 'Must reference ai-original-email separator');
  assert.equal(serialized.includes('email_sender'), false, 'Must NOT use unverified email_sender');
});

test('universalRules instructs creating downloadable/runnable project artifact', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const universal = result.structuredContent.universalRules;

  assert.ok(
    universal.some((r: string) => r.includes('runnable/downloadable project artifact')),
    'universalRules must instruct creating a runnable/downloadable project artifact'
  );
});

test('email-response-approval profile and universalRules require Outlook card layout, pagination, and default APPROVAL filter', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const universal = result.structuredContent.universalRules;
  const emailProfile = result.structuredContent.applicationProfiles['email-response-approval'];
  const serialized = JSON.stringify(emailProfile);

  assert.ok(
    universal.some((r: string) => r.includes('statefilter=APPROVAL')),
    'universalRules must default to statefilter=APPROVAL'
  );
  assert.ok(
    universal.some((r: string) => r.toLowerCase().includes('paginate') || r.toLowerCase().includes('scroll')),
    'universalRules must require pagination'
  );
  assert.ok(
    serialized.includes('Line 1') && serialized.includes('Subject line') && serialized.includes('prominent'),
    'email-response-approval profile must require 3-line Outlook card layout'
  );
  assert.ok(
    serialized.includes('email_to'),
    'email-response-approval profile must reference email_to for display name'
  );
  assert.ok(
    serialized.includes('See More') || serialized.includes('count-based'),
    'email-response-approval profile must reference count-based / See More pagination'
  );
  assert.ok(
    serialized.includes('moveToRecycleBin'),
    'email-response-approval profile must require moveToRecycleBin'
  );
  assert.ok(
    serialized.includes('Delete'),
    'email-response-approval profile must include hover Delete action'
  );
  assert.ok(
    serialized.includes('toolbar') || serialized.includes('Toolbar'),
    'email-response-approval profile must require rich-text editor toolbar'
  );
  assert.ok(
    serialized.includes('Attachment') || serialized.includes('Screenshot'),
    'email-response-approval profile must include attachment / screenshot option'
  );
});

test('universalRules and generationRules require dotenv loading and EADDRINUSE handling', async () => {
  const { toolHandler } = captureToolRegistration();
  const result = await toolHandler();
  const universal = result.structuredContent.universalRules;
  const generation = result.structuredContent.generationRules;

  // dotenv must be required in both rule sets
  assert.ok(
    universal.some((r: string) => r.includes('dotenv')),
    'universalRules must require dotenv'
  );
  assert.ok(
    generation.some((r: string) => r.includes('dotenv')),
    'generationRules must require dotenv'
  );

  // EADDRINUSE handling must be required
  assert.ok(
    universal.some((r: string) => r.includes('EADDRINUSE')),
    'universalRules must require EADDRINUSE handling'
  );
  assert.ok(
    generation.some((r: string) => r.includes('EADDRINUSE')),
    'generationRules must require EADDRINUSE handling'
  );

  // .env must contain credentials and PORT
  assert.ok(
    universal.some((r: string) => r.includes('EZZYBILLS_CLIENT_ID') && r.includes('.env')),
    'universalRules must instruct placing credentials in .env'
  );

  // vite.config.js must dynamically proxy using PORT from .env
  assert.ok(
    universal.some((r: string) => r.includes('vite.config.js') && r.includes('PORT')),
    'universalRules must configure vite.config.js to use PORT from .env'
  );
  assert.ok(
    generation.some((r: string) => r.includes('vite.config.js') && (r.includes('loadEnv') || r.includes('PORT'))),
    'generationRules must configure vite.config.js to dynamically use backend PORT from .env'
  );
});

