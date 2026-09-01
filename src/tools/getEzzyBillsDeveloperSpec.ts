/**
 * get_ezzybills_developer_spec
 *
 * Returns a structured developer specification that ChatGPT uses when
 * generating EzzyBills applications from user prompts.
 *
 * This tool does NOT call the live EzzyBills service and does NOT require
 * EzzyBills credentials to be present.
 *
 * SOURCE VERIFICATION STATUS:
 * - authContract / JWT model: SOURCE VERIFIED (oauthEzzyBillsToken, OAuthTokenRequest, JWTTokenSS).
 * - searchInvoicesPaged & state filters: SOURCE VERIFIED (all switch cases confirmed).
 * - detail APIs (getMyAttachments2, getFormData, getInvoiceDetails, getDocumentClassification): SOURCE VERIFIED.
 * - Token expiry: SOURCE VERIFIED as 1 year.
 * - getPurchaseOrders3: SOURCE VERIFIED (PurchaseOrderSS, ordertype, exporttarget).
 *
 * SPECIFICATION STRUCTURE:
 * 11 sections: coreArchitecture, authContract, universalRules,
 * contentSecurityRules, actionRiskRules, apiCatalogue, workflowRecipes,
 * applicationProfiles, idRules, specificationGaps, generationRules.
 */
import YAML from 'yaml';
import { Octokit } from 'octokit';

// import { DefaultAzureCredential } from '@azure/identity';
// import { SecretClient } from '@azure/keyvault-secrets';

import { buildApiCatalogue } from './openApiToCatalogue.js';

async function loadOpenApiSpec() {
  const githubToken = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const path = process.env.OPENAPI_SPEC_PATH;
  const ref = process.env.GITHUB_BRANCH ?? 'main';

  if (!githubToken) {
    throw new Error('GITHUB_TOKEN is not configured.');
  }

  if (!owner) {
    throw new Error('GITHUB_OWNER is not configured.');
  }

  if (!repo) {
    throw new Error('GITHUB_REPO is not configured.');
  }

  if (!path) {
    throw new Error('OPENAPI_SPEC_PATH is not configured.');
  }

  const octokit = new Octokit({
    auth: githubToken,
  });

  console.log(
    `Loading OpenAPI from GitHub: ${owner}/${repo}/${path} @ ${ref}`
  );

  const response = await octokit.request(
    'GET /repos/{owner}/{repo}/contents/{path}',
    {
      owner,
      repo,
      path,
      ref,
      headers: {
        accept: 'application/vnd.github.raw+json',
      },
    }
  );

  const yamlText = response.data as unknown as string;

  console.log('OpenAPI fetched successfully.');

  const parsed = YAML.parse(yamlText);

  console.log(
    'Parsed top-level keys:',
    Object.keys(parsed ?? {})
  );

  console.log(
    'OpenAPI paths count:',
    Object.keys(parsed?.paths ?? {}).length
  );

  return parsed;
}
export function registerGetEzzyBillsDeveloperSpecTool(server: any) {
  server.registerTool(
    'get_ezzybills_developer_spec',
    {
      title: 'Get EzzyBills Developer Specification',

      description:
        'Returns the authoritative EzzyBills developer specification for generating applications from user prompts. ' +
        'Use this whenever the user asks to build, generate, scaffold, or create an EzzyBills application. ' +
        'Returns eleven structured sections: coreArchitecture, authContract, universalRules, ' +
        'contentSecurityRules, actionRiskRules, apiCatalogue, workflowRecipes, applicationProfiles, ' +
        'idRules, specificationGaps, and generationRules (compatibility alias). ' +
        'This tool does not call the live EzzyBills account and does not require EzzyBills credentials.',

      inputSchema: {},

      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
      },
    },

    async () => {
      const spec = await buildDeveloperSpec();

      return {
        content: [
          {
            type: 'text',
            text:
              'EzzyBills developer specification loaded. ' +
              'Create a complete, production-ready, downloadable/runnable project artifact (package.json, server backend, frontend components, styling, and .env.example) for the requested application. ' +
              'Do not merely summarize or describe the architecture — provide the complete runnable codebase directly. ' +
              'Generated applications must call EzzyBills REST APIs directly at runtime; ' +
              'they must not call MCP after code generation is complete.',
          },
        ],
        structuredContent: spec,
      };
    }
  );
}

export async function buildDeveloperSpec() {
  const openApi = await loadOpenApiSpec();
  const apiCatalogue = buildApiCatalogue(openApi);
  return {

    // ─────────────────────────────────────────────────────────────────────────
    // 1. CORE ARCHITECTURE
    //
    // Describes the four actors and their responsibilities. The MCP server is
    // a stateless knowledge engine that returns source-verified API contracts
    // and generation rules. It does not hold customer credentials, session
    // cookies, or proxy REST calls.
    // ─────────────────────────────────────────────────────────────────────────
    coreArchitecture: {
      mcpServer:
        'Stateless knowledge engine. Returns source-verified API contracts and generation rules. ' +
        'Does not hold customer credentials, session cookies, or proxy REST calls.',
      generator:
        'ChatGPT or equivalent. Interprets user intent, reads the specification, and generates standalone application code.',
      generatedFrontend:
        'Communicates only with its local backend via relative /api/* routes. Never holds client secrets or JWTs.',
      generatedBackend:
        'Holds EZZYBILLS_CLIENT_ID and EZZYBILLS_CLIENT_SECRET in environment variables, requests REST JWTs, ' +
        'handles token caching, and invokes EzzyBills REST APIs directly.',

      defaultStack: {
        frontend: 'React + Vite',
        backend: 'Node.js / Express',
        note:
          'Always generate a React + Vite frontend with a Node.js/Express backend unless the user explicitly requests a different technology. ' +
          'This is the mandatory default stack. If the user simply says "create an app" or "build me an app", use React + Vite + Express. ' +
          'Only deviate when the user specifically asks for another framework (e.g. Next.js, Angular, Vue).',
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 2. AUTH CONTRACT
    //
    // The OAuth client_credentials model below is the source-verified
    // authentication contract for generated applications. The MCP itself is a
    // read-only code-generation service and does not call EzzyBills at runtime.
    // ─────────────────────────────────────────────────────────────────────────
    authContract: {
      _verificationStatus: 'SOURCE_VERIFIED',
      _contract: {
        operation: 'oauthEzzyBillsToken',
        requestType: 'OAuthTokenRequest',
        responseType: 'JWTTokenSS',
        authScheme: 'Bearer <token>',
      },

      model: 'oauth2_client_credentials',

      credentials: {
        EZZYBILLS_CLIENT_ID: 'Developer Portal application client ID',
        EZZYBILLS_CLIENT_SECRET:
          'Developer Portal application client secret. Never expose in browser/frontend code.',
      },

      tokenRequest: {
        method: 'POST',
        fullPath: 'https://app.ezzydoc.com/EzzyService.svc/Rest/oauth/token',
        contentType: 'application/json',
        body: {
          grant_type: 'client_credentials',
          client_id: '<EZZYBILLS_CLIENT_ID>',
          client_secret: '<EZZYBILLS_CLIENT_SECRET>',
        },
        note: 'Endpoint is allow_anonymous:true — no Authorization header needed for the token request itself.',
      },

      tokenResponse: {
        // SOURCE VERIFIED — Response type JWTTokenSS:
        successCheck: 'service_status.status === 0',
        tokenProperty: 'token',
        tokenPropertyNote:
          'The JWT is in the property named "token", NOT "access_token". Check service_status.status === 0 before using it.',
        shape: {
          token: 'string — the JWT',
          service_status: {
            status: 'integer — 0 = success, nonzero = error',
            message: 'string',
            invoice_id: 'integer',
          },
        },
      },

      tokenExpiry: {
        // SOURCE VERIFIED — Token validity: 1 year from issuance
        validity: '1 year',
        usage:
          'The REST API JWT is valid for 1 year from issuance. ' +
          'Generated applications pass it as Authorization: Bearer <token> on all EzzyBills REST API calls.',
        recommendedStrategy:
          'Derive renewal timing from the JWT exp claim with a clock-skew margin (e.g. renew 5 minutes before expiration). ' +
          'Do not assume a fixed lifetime. Cache tokens server-side only, scoped per credential/tenant. ' +
          'Single refresh-and-retry is allowed ONLY for READ_ONLY calls. ' +
          'Do not automatically retry mutating operations unless non-execution or idempotency is guaranteed.',
      },

      tokenUsage: {
        // SOURCE VERIFIED — Authorization header validation (Bearer <token>):
        header: 'Authorization: Bearer <token>',
        note: 'The prefix check is case-insensitive. Strip 7 chars: token = header.substring(7).trim()',
      },

      tokenStorage: {
        rule: 'Never store or transmit EzzyBills JWTs in browser storage (localStorage, sessionStorage, cookies) or frontend code.',
        hostedAppNote:
          'Hosted applications require separate human authentication, tenant mapping, server-side role authorization, and audit identity. ' +
          'REST API JWTs are cached backend-only and used solely for authenticating EzzyBills REST API calls.',
        logging: 'Never log secrets, bearer tokens, or signed SAS query strings.',
      },

      endpointsCoveredByBearerAuth: {
        // SOURCE VERIFIED — Bearer authentication applies to all non-anonymous endpoints.
        searchInvoicesPaged: 'SOURCE_VERIFIED',
        getMyAttachments2: 'SOURCE_VERIFIED',
        getFormData: 'SOURCE_VERIFIED',
        getInvoiceDetails: 'SOURCE_VERIFIED',
        getDocumentClassification: 'SOURCE_VERIFIED',
        updateInvoiceImage: 'SOURCE_VERIFIED',
        approveInvoice: 'SOURCE_VERIFIED',
        rejectInvoice: 'SOURCE_VERIFIED',
        getPurchaseOrders3: 'SOURCE_VERIFIED',
        moveToRecycleBin: 'SOURCE_VERIFIED',
        oauthToken: 'allow_anonymous — no Bearer needed for the token request itself',
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 3. UNIVERSAL RULES
    //
    // Apply to ALL generated applications regardless of feature set.
    // ─────────────────────────────────────────────────────────────────────────
    universalRules: [
      'Use only catalogued EzzyBills routes, parameter names, verified filter values, and response fields.',
      'Never invent or hallucinate EzzyBills endpoints.',
      'If the specification does not provide enough information, report the missing information rather than guessing.',
      'Maintain strict separation of frontend and backend responsibilities.',
      'Provide comprehensive UI states: loading, empty, validation, authentication, permission, and API error states.',
      'Display user-friendly labels (names, dates, statuses) rather than raw numeric codes or internal IDs.',
      'Keep internal identifiers available only in diagnostic/debug views.',
      'Generate responsive and accessible interfaces (proper semantic markup, ARIA labels, keyboard navigability).',
      'Generate .env.example with descriptive placeholders only. Ensure .env, secrets, and credentials are excluded from Git (.gitignore) and Docker build context (.dockerignore).',
      'Generated applications call EzzyBills REST APIs directly at runtime.',
      'MCP is a development and code-generation knowledge tool only. Generated applications must NOT call MCP at runtime.',
      'Do not route API requests through the MCP server after code generation is complete.',
      'Never expose CLIENT_SECRET in React/browser/frontend code.',
      'Never log or print CLIENT_SECRET, Bearer tokens, or signed blob query strings.',
      'Include vite.config.js configured to dynamically proxy /api/* calls to the local backend using the PORT loaded from .env (e.g. via loadEnv(mode, process.cwd(), "") targeting `http://localhost:${env.PORT || 3002}`) so changing PORT in .env updates both the backend and Vite proxy seamlessly.',
      'Keep all frontend /api calls relative (e.g. /api/invoices, not http://localhost:3001/api/invoices).',
      'Always include "dotenv" in package.json dependencies and add `import \'dotenv/config\';` (ESM) or `require(\'dotenv\').config();` (CJS) as the very first statement in the server entry file (e.g. server/index.js) BEFORE any process.env access. Without this, .env variables will not load.',
      'Place EZZYBILLS_CLIENT_ID, EZZYBILLS_CLIENT_SECRET, and PORT in the .env file. The .env file must be in the project root (same directory as package.json).',
      'Generated applications must read backend ports from environment configuration (e.g. process.env.PORT from .env). Do not assume port 3000 is always available.',
      'Handle EADDRINUSE errors on server startup: catch the error event from app.listen() and print a clear message like "Port {PORT} is already in use. Change PORT in .env or stop the other process." then exit gracefully.',
      'Vite development ports should be configurable or allowed to auto-select an available port (e.g. strictPort: false in vite.config.js, or VITE_PORT from .env).',
      'Use Express 5 compatible routing. Do not generate app.get("*", ...) — use router.get("*") or a named catch-all instead.',
      'The generated project must be runnable with: npm install → set environment variables → npm run dev.',
      'Do not invent parameter names, parameter values, state filters, document types, or response fields.',
      'Use the exact parameter names documented: "invoicelist" for approveInvoice, "invoiceid" for rejectInvoice, moveToRecycleBin, and detail endpoints.',
      'Apply the parentDocumentId vs attachmentInvoiceId rules documented in idRules. Never mix them.',
      'Check the correct status location for each endpoint: nested service_status.status for read endpoints and updateInvoiceImage; direct status for approveInvoice, rejectInvoice, and moveToRecycleBin.',
      'Treat any nonzero status as an error. Do not retry mutating calls automatically.',
      'Keep documents in terminal states (FAILED, COMPLETE) or with Completed === 1 visible to all users in document listings, but render them strictly read-only with their status badge; never display Approve, Reject, or Reply action controls on these documents.',
      'If Completed === 1, the workflow is completed/read-only (does not prove email delivery); keep the document in read-only mode and do not show Approve or Reject action buttons. For active pending approval documents (where Completed === 0), enable the action buttons (Save Draft, Approve & Reply / Approve & Continue Workflow) directly. Do not arbitrarily disable actions on pending items based on unrecognized internal ImageState numeric codes (such as 109).',
      'For general approval queues, default to statefilter=APPROVAL to retrieve all pending dashboard approvals. Use statefilter=EMAIL_APPROVAL only when the user specifically requests filtering exclusively for the email approval queue.',
      'When displaying document listings or message cards, resolve human-friendly metadata: display the Contact/Sender name (from Contact, form_data.email_to, or from_email) and Subject (from form_data.email_subject). Avoid displaying raw internal file names (e.g. "email.html", "doc.pdf") or generic placeholders as the primary title when meaningful metadata is available.',
      'Provide attachment upload and download capabilities when handling document responses or draft updates.',
      'Destructive operations (e.g. deleting via moveToRecycleBin) must always prompt for human confirmation before execution.',
      'Paginate records based on the API count parameter (e.g. count=20 or 50 per request). Do not render all thousands of records on a single page at once; provide pagination controls or page-by-page loading using page and total_count.',
      'Translate internal ImageState numeric codes to human-readable status labels (e.g. "Waiting for Approval", "In Progress", "Complete", "Failed"). Never display raw codes like "State 109" in the UI.',
      'When editing HTML content (such as AI email responses), only the AI reply portion (before <div id="ai-original-email">) is editable in the rich-text editor; the original email block (<div id="ai-original-email">) must remain sanitized and strictly read-only. Never show raw HTML tags (<p>, <br>, <div>) inside a plain text <textarea>.',
      'Specific UI layouts, themes, and design choices (e.g. Outlook-style, side-by-side split pane, cards, modals) should be guided by user prompts or ChatGPT app prompts; the MCP specification defines backend API contracts, security rules, and integration workflows.',
      'When the user requests to create, build, or generate an application, create a complete, production-ready, runnable/downloadable project artifact (package.json, backend server, frontend components, CSS/styles, and configuration) rather than merely summarizing the architecture or printing fragmented snippets.',
      'Select only the API endpoints required for the user\'s specific request. Do not include all endpoints by default.',
      'The application scope is determined by the user\'s prompt, not by any single workflow example.',
    ],

    // ─────────────────────────────────────────────────────────────────────────
    // 4. CONTENT SECURITY RULES
    //
    // Conditional rules for applications displaying rich text, HTML, files,
    // or attachments. Apply when the application renders email content,
    // HTML previews, or fetches from blob storage.
    // ─────────────────────────────────────────────────────────────────────────
    contentSecurityRules: {
      applicability:
        'Apply these rules when the generated application displays rich text, HTML, files, or attachment content.',

      sanitization: {
        rule: 'Sanitize untrusted HTML before rendering previews and before saving back to the server.',
        implementation: 'Use any appropriate sanitization library (e.g. DOMPurify, sanitize-html).',
      },

      scriptBlocking: {
        rule: 'Strip <script>, inline event handlers (onclick, onload), and unsafe elements (<object>, <embed>). Block or mediate remote/tracking content.',
      },

      sandboxing: {
        rule: 'Render rich HTML content in an appropriately sandboxed container with restrictive CSP where applicable.',
      },

      blobSecurity: {
        httpsValidation: 'Accept only HTTPS URLs on trusted hosts (e.g. ezzydoc.blob.core.windows.net). Enforce exact host allowlisting.',
        mimeAndSize: 'Validate MIME type, enforce response-size limits (e.g. 10 MB) and timeout limits.',
        redirects: 'Revalidate redirects and enforce redirect limits.',
        bearerTokens: 'Never forward EzzyBills Authorization: Bearer headers to Azure Blob Storage URLs.',
        sasTokens: 'Never expose signed SAS token query parameters in application logs or standard UI.',
      },

      backendProxying: {
        rule: 'Prefer backend-controlled fetch, sanitize, and proxy behaviour for rich email and attachment content.',
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 5. ACTION RISK RULES
    //
    // Explicit risk classification for all REST operations.
    // ─────────────────────────────────────────────────────────────────────────
    actionRiskRules: {
      classifications: {
        READ_ONLY: {
          description: 'Safe for caching and automatic retry after token refresh.',
          endpoints: [
            'searchInvoicesPaged',
            'getMyAttachments2',
            'getFormData',
            'getInvoiceDetails',
            'getDocumentClassification',
            'getPurchaseOrders3',
          ],
        },
        WRITE: {
          description: 'Modifies attachment or state without external dispatch.',
          endpoints: ['updateInvoiceImage'],
        },
        DESTRUCTIVE_OR_EXTERNAL: {
          description: 'Triggers external workflows, email sending, or permanent state transitions.',
          endpoints: ['approveInvoice', 'rejectInvoice', 'moveToRecycleBin'],
        },
      },

      backendGuardrails: {
        applicability: 'Apply to WRITE and DESTRUCTIVE_OR_EXTERNAL operations.',
        rules: [
          'Require explicit human confirmation before invocation.',
          'Server-side user authentication and tenant authorization checks.',
          'Duplicate-action prevention and idempotency (disable UI buttons while in-flight, idempotency locks).',
          'Audit trail logging (who performed what action, timestamp, document ID).',
          'CSRF protection when cookie sessions are used in generated backends.',
          'Safe error handling: display failure messages clearly, do not execute automatic retries for mutating calls.',
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 6. API CATALOGUE
    //
    // Endpoint definitions are generated from the Mintlify-generated OpenAPI
    // specification. Keep only higher-level EzzyBills rules/overrides curated
    // separately from the generated API contract.
    // ─────────────────────────────────────────────────────────────────────────
    apiCatalogue: {
      ...apiCatalogue,

      // VERIFIED from mcp_api_spec.md section 7 — endpoints NOT to use in generated apps:
      deprecatedOrExcluded: {
        getEmailBody: {
          reason:
            'Downloads the first attachment by display priority — does not select by tag. ' +
            'Unreliable for finding the AIEMAILRESPONSE. Use getMyAttachments2 + tag filter instead.',
        },
        getEmailSubject: {
          reason:
            'Regex-parses the form tag; can return null subject with status 0. ' +
            'Use form_data.email_subject from getFormData instead.',
        },
        getEmailMessage: {
          reason:
            'Returns the raw .eml mailbox stream. Requires mailbox-service work. ' +
            'Not needed because the approval HTML contains the original email context.',
        },
        getAIResult: {
          reason:
            'Reads AI extraction JSON — unrelated to the generated email reply. Not part of the email approval flow.',
        },
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 7. WORKFLOW RECIPES
    //
    // Step-by-step ordered recipes for common EzzyBills development tasks.
    // ─────────────────────────────────────────────────────────────────────────
    workflowRecipes: {
      searchAndListDocuments: {
        description: 'Search and list documents with pagination and keyword filtering.',
        steps: [
          'Call searchInvoicesPaged with search_tag, statefilter (default APPROVAL for dashboard approvals), page, count.',
          'Implement pagination (infinite scrolling or page controls) using page index and total_count so all records can be retrieved beyond the initial page (supporting 2,000+ documents).',
          'Display document list with user-friendly format: Sender Name (Contact / form_data.from_email), Subject, Date, and status badge. Never display raw InvoiceId, ImageState, or repetitive placeholder headings.',
        ],
      },
      filterDocumentsByStateAndType: {
        description: 'Filter documents by verified statefilter and documentType combinations.',
        steps: [
          'Use verified statefilter values: SHOW_ALL, APPROVAL, EMAIL_APPROVAL, FAILED, COMPLETE.',
          'Combine with documentType: 0 (all), 1 (invoices), 12 (blobs), 13 (statements).',
        ],
      },
      retrieveDocumentDetails: {
        description: 'Combine detail endpoints for a complete document view.',
        steps: [
          'Use the parentDocumentId from searchInvoicesPaged list items.',
          'Call getInvoiceDetails for state, file name, message ID.',
          'Call getFormData for email metadata (sender, recipient, subject).',
          'Call getDocumentClassification for document type and tax info.',
        ],
      },
      retrieveAttachments: {
        description: 'List and locate specific attachments by tag.',
        steps: [
          'Call getMyAttachments2 with the parentDocumentId.',
          'Select attachment by exact tag value (e.g. "AIEMAILRESPONSE").',
          'Use attachment invoice_id (not parent ID) for updateInvoiceImage.',
        ],
      },
      displayAttachmentContentSafely: {
        description: 'Fetch and display blob content with security measures.',
        steps: [
          'Extract blob_url from the target attachment.',
          'Fetch with plain GET — do NOT send EzzyBills Authorization header to blob.',
          'Validate HTTPS on trusted host (ezzydoc.blob.core.windows.net).',
          'Sanitize HTML content before rendering.',
          'Render in sandboxed container with restrictive CSP.',
          'Strip signed query string from URLs before displaying to user.',
        ],
      },
      approveOrRejectDocument: {
        description: 'Consequential document actions with human confirmation.',
        steps: [
          'Display "Approve & Continue Workflow" and "Reject" as mutually exclusive actions.',
          'Do NOT display Approve, Reject, or Reply actions on documents in terminal states (FAILED, COMPLETE) or where Completed === 1.',
          'Require explicit human confirmation before invoking either action.',
          'For approve: call approveInvoice with parentDocumentId. Approval advances the configured workflow.',
          'For reject: call rejectInvoice with parentDocumentId and non-empty reason.',
          'An approval receipt is not a delivery receipt. External delivery status is not available unless a separate verified API provides it.',
          'Do not invoke both approve and reject for the same document.',
        ],
      },
      deleteOrRecycleDocument: {
        description: 'Move a document to the recycle bin via moveToRecycleBin with human confirmation.',
        steps: [
          'Require explicit human confirmation (e.g. confirmation modal or quick undo toast).',
          'Call moveToRecycleBin with invoiceid set to parentDocumentId.',
          'Check status === 0 for success.',
          'Remove the deleted document from the active document list.',
        ],
      },
      emailResponseWorkflow: {
        description: 'Complete email response lifecycle: list, fetch, separate AI reply at div#ai-original-email, edit, save draft, approve.',
        steps: [
          'List pending approval documents via searchInvoicesPaged (default statefilter=APPROVAL for general dashboard approvals; statefilter=EMAIL_APPROVAL if specifically requested).',
          'Fetch form data (form_data.from_email, form_data.email_subject) and attachments for the selected document.',
          'Locate AIEMAILRESPONSE attachment by exact tag.',
          'Fetch HTML blob content with plain GET (no Bearer token to blob).',
          'AI Attachment HTML Structure: Contains the AI-generated reply at the top and original email thread inside <div id="ai-original-email">.',
          'Editor separation: Only the top AI reply portion (before <div id="ai-original-email">) is editable in the WYSIWYG editor. The original email (<div id="ai-original-email">) must remain sanitized and strictly read-only.',
          'Save edited HTML via updateInvoiceImage using attachmentInvoiceId (PictureName="<attachmentInvoiceId>.html") preserving the read-only original email structure.',
          'After explicit human confirmation, call approveInvoice (advances workflow; does not confirm delivery).',
        ],
      },
      retrievePurchaseOrders: {
        description: 'Purchase order lookup via getPurchaseOrders3 with type filter and numeric target ID.',
        steps: [
          'In the UI, render a target selector dropdown with options: Xero (1), Simpro (27), Procore (48), QuickBooks (9), MYOB (2).',
          'Call getPurchaseOrders3 with type (0=PURCHASE or 1=CONTRACTOR) and numeric target ID (e.g. ?type=0&target=1).',
          'Handle empty my_orders result normally — it is not an error condition.',
        ],
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 8. APPLICATION PROFILES
    //
    // Optional capability profiles describing required backend endpoints and
    // business workflows. Specific UI layouts, styling, and presentation formats
    // (e.g. Outlook-style, split-pane, modals) are determined by user prompts.
    // ─────────────────────────────────────────────────────────────────────────
    applicationProfiles: {
      _note:
        'These are optional high-level capability profiles describing required backend endpoints and business rules. ' +
        'Specific UI layouts (e.g. Outlook-style, side-by-side split pane, table views), styling, and presentation choices ' +
        'are generic and should be guided by the user prompt or ChatGPT app prompt.',

      'document-browser': {
        description: 'Document exploration interface with search, state filtering, pagination, and metadata inspection.',
        requiredEndpoints: ['searchInvoicesPaged', 'getInvoiceDetails', 'getFormData', 'getDocumentClassification'],
        capabilities: ['Search filtering', 'State filter tabs', 'Pagination controls', 'Document metadata inspector'],
      },
      'approval-queue': {
        description: 'Focused approval workflow queue with document preview, approval submission, and rejection handling.',
        requiredEndpoints: ['searchInvoicesPaged', 'getInvoiceDetails', 'approveInvoice', 'rejectInvoice'],
        capabilities: [
          'Pending approval list with statefilter=APPROVAL',
          'Document preview display',
          'Approval execution (approveInvoice with parentDocumentId)',
          'Rejection execution (rejectInvoice with invoiceid and reason)',
        ],
      },
      'email-response-approval': {
        description: 'Email approval and reply workflow interface with draft editing, attachment management, and approval actions.',
        requiredEndpoints: [
          'searchInvoicesPaged', 'getMyAttachments2', 'getFormData',
          'updateInvoiceImage', 'approveInvoice', 'moveToRecycleBin',
        ],
        capabilities: [
          'Document/message listing with sender and subject resolution',
          'Rich text editing for draft response with original context separation (<div id="ai-original-email">)',
          'Draft saving (updateInvoiceImage with attachmentInvoiceId)',
          'Approval execution (approveInvoice with parentDocumentId)',
          'Document deletion (moveToRecycleBin with parentDocumentId)',
          'Attachment and screenshot upload handling',
        ],
        _notes: [
          'Default to statefilter=APPROVAL to retrieve pending dashboard approvals unless the user specifies EMAIL_APPROVAL.',
          'Completed items (Completed === 1) are read-only; active pending items (Completed === 0) are actionable.',
          'UI layouts, themes, and styling (e.g. 2-pane, Outlook-style, modal dialogs) should be determined by user prompts.',
        ],
      },
      'purchase-order-selector': {
        description: 'Purchase order lookup component with type toggle and target dropdown.',
        requiredEndpoints: ['getPurchaseOrders3'],
        capabilities: [
          'Type toggle (Purchase = 0 / Contractor = 1)',
          'Target dropdown: Displays user-friendly names (Xero, Procore, Simpro, QuickBooks, MYOB) and sends numeric target ID (1, 48, 27, 9, 2)',
          'Purchase order results list with po_number and supplier',
        ],
        _notes: [
          'Handle an empty purchase-order result normally.',
        ],
      },
      'invoice-editor': {
        description: 'Deferred to specificationGaps until invoice row/header mutation APIs are source-verified.',
        status: 'DEFERRED',
      },
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 9. ID RULES
    //
    // VERIFIED from the mcp_api_spec.md "ID roles" section.
    // ─────────────────────────────────────────────────────────────────────────
    idRules: {
      _critical:
        'Two different integer IDs are used and must NEVER be mixed. Using the wrong ID will call the wrong document.',

      parentDocumentId: {
        source: 'InvoiceId field in searchInvoicesPaged list items',
        type: 'positive integer (returned as string in the list response)',
        useFor: [
          'getMyAttachments2 (invoiceid parameter)',
          'getFormData (invoiceid parameter)',
          'getInvoiceDetails (invoiceid parameter)',
          'getDocumentClassification (invoiceid parameter)',
          'approveInvoice (invoicelist parameter)',
          'rejectInvoice (invoiceid parameter)',
        ],
        doNotUseFor: [
          'updateInvoiceImage — use attachmentInvoiceId instead',
        ],
      },

      attachmentInvoiceId: {
        source:
          'invoice_id field from the AIEMAILRESPONSE entry in getMyAttachments2 queue array. ' +
          'Also returned as attached_id in the same attachment item.',
        type: 'positive integer',
        useFor: [
          'updateInvoiceImage (PictureName must be "<attachmentInvoiceId>.html")',
        ],
        doNotUseFor: [
          'All detail endpoints (getMyAttachments2, getFormData, getInvoiceDetails, getDocumentClassification)',
          'approveInvoice',
          'rejectInvoice',
        ],
        _warning:
          'The attachment file_name (e.g. "47490035_generated_email_response.html") is NOT a valid PictureName. ' +
          'PictureName must be the numeric attachment ID followed by ".html" (e.g. "47490037.html").',
      },

      generalRule: 'All IDs must be positive integers.',
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 10. SPECIFICATION GAPS
    //
    // Clearly labelled unverified items for EzzyBills backend developer review.
    // ─────────────────────────────────────────────────────────────────────────
    specificationGaps: {
      _note:
        'These items require backend-developer verification before they can be documented as confirmed contracts.',

      items: [
        {
          id: 'INVOICE_EDITOR_APIS',
          description:
            'invoice-editor mutation APIs (saveInvoiceRows, getInvoiceHeaderBlocks) are pending full source verification.',
          impact: 'The invoice-editor application profile is deferred.',
        },
        {
          id: 'EMAIL_DELIVERY_STATUS',
          description: 'External email delivery status API — none currently verified.',
          impact: 'Approval receipt is not proof of email delivery. No status polling available.',
        },
        {
          id: 'WEBHOOK_TOKEN_LIFETIME',
          description:
            'Webhook/workflow processes manage their own short-lived tokens separately from the 1-year REST API JWT.',
          impact: 'Do not use webhook/workflow tokens for authenticating REST API calls.',
        },
      ],
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 11. GENERATION RULES (Compatibility Alias)
    //
    // Retains flat array of generation rules to ensure full backwards
    // compatibility with existing consumers. Content merges universalRules +
    // contentSecurityRules + actionRiskRules highlights.
    // ─────────────────────────────────────────────────────────────────────────
    generationRules: [
      // Runtime independence
      'Generated applications call EzzyBills REST APIs directly at runtime.',
      'MCP is a development and code-generation knowledge tool only. Generated applications must NOT call MCP at runtime.',
      'Do not route API requests through the MCP server after code generation is complete.',

      // Secret handling
      'Never expose CLIENT_SECRET in React/browser/frontend code.',
      'When client credentials are required, generate a backend to hold the secret and obtain the Bearer JWT.',
      'Never log or print CLIENT_SECRET, Bearer tokens, or signed blob query strings.',

      // Project structure (mandatory default stack)
      'Always generate a React + Vite frontend with a Node.js/Express backend unless the user explicitly requests a different technology. This is the mandatory default stack — not optional. If the user simply says "create an app" or "build me an app", always use React + Vite + Express.',
      'Only deviate from the default stack when the user specifically asks for another framework (e.g. Next.js, Angular, Vue). The core architecture requirements remain: browser/frontend, server-side backend, backend-only credentials, relative frontend-to-backend API calls.',
      'Include .env.example listing all required environment variables with placeholder values and descriptions.',
      'Include vite.config.js configured to dynamically proxy /api/* calls to the local backend using the backend PORT loaded from .env (e.g. using `loadEnv(mode, process.cwd(), "")` to point proxy to `http://localhost:${env.PORT || 3002}`) so that updating PORT in .env synchronizes both backend and frontend proxy automatically.',
      'Keep all frontend /api calls relative (e.g. /api/invoices, not http://localhost:3001/api/invoices).',

      // dotenv and .env loading (CRITICAL)
      'Always include "dotenv" in package.json dependencies. The server entry file (e.g. server/index.js) must have `import \'dotenv/config\';` (ESM) or `require(\'dotenv\').config();` (CJS) as the VERY FIRST statement, before any process.env access. Without this, .env values will not load and credentials will appear missing.',
      'Place EZZYBILLS_CLIENT_ID, EZZYBILLS_CLIENT_SECRET, and PORT in the .env file at the project root (same directory as package.json). The .env.example file must list these with placeholder values.',

      // Port and host configuration
      'Generated applications must read backend ports from process.env.PORT (loaded from .env). Do not assume port 3000 is always available.',
      'Handle EADDRINUSE on server startup: catch the error event from app.listen() and print a clear message like "Port {PORT} is already in use. Change PORT in .env or stop the other process." then exit with process.exit(1).',
      'Vite development ports should be configurable or allowed to auto-select an available port (e.g. strictPort: false in vite.config.js, or VITE_PORT from .env).',

      // Express compatibility
      'Use Express 5 compatible routing. Do not generate app.get("*", ...) — use router.get("*") or a named catch-all instead.',
      'The generated project must be runnable with: npm install → set environment variables → npm run dev.',

      // API discipline
      'Do not invent EzzyBills endpoints. Use only the APIs listed in the apiCatalogue.',
      'Do not invent parameter names, parameter values, state filters, document types, or response fields.',
      'Use the exact parameter names documented: "invoicelist" for approveInvoice, "invoiceid" for rejectInvoice, moveToRecycleBin, and detail endpoints.',

      // ID discipline
      'Apply the parentDocumentId vs attachmentInvoiceId rules documented in idRules. Never mix them.',

      // Response handling
      'Check the correct status location for each endpoint: nested service_status.status for read endpoints and updateInvoiceImage; direct status for approveInvoice, rejectInvoice, and moveToRecycleBin.',
      'Treat any nonzero status as an error. Do not retry mutating calls automatically.',

      // State handling & UI action controls
      'Keep documents in terminal states (FAILED, COMPLETE) or where Completed === 1 visible to all users in document listings, but render them strictly read-only with their status badge; never display Approve, Reject, or Reply action controls on these documents.',

      // Content security highlights
      'Sanitize untrusted HTML before rendering previews and before saving back to the server.',
      'Render rich HTML content in a sandboxed container. Strip <script>, inline handlers, and unsafe elements.',
      'Accept blob URLs only from HTTPS on trusted hosts. Never forward Bearer tokens to blob storage.',
      'Strip signed query strings from blob URLs before displaying to the user.',

      // Action risk highlights
      'Require explicit human confirmation before invoking WRITE or DESTRUCTIVE_OR_EXTERNAL operations (approveInvoice, rejectInvoice, moveToRecycleBin).',
      'Approval advances the configured workflow. An approval receipt is not a delivery receipt.',

      // UI rules
      'Do not display raw API response JSON in the normal UI unless the user explicitly requests a debug view.',
      'Do not display raw HTML strings in the UI. When editing HTML (such as AI email responses), use a WYSIWYG visual rich-text editor (contentEditable) for ONLY the AI reply portion (before <div id="ai-original-email">) with a rich-text toolbar (Bold, Italic, Underline, Lists, Links 🔗, Attachments). The original email block (<div id="ai-original-email">) must remain sanitized and read-only. Never show raw HTML tags (<p>, <br>) in a <textarea>.',
      'In the reply section, provide an Attachment / Screenshot upload feature ("📎 Choose File or Drop file here / Paste screenshot") so the user can easily attach images or files alongside their response.',
      'If Completed is 1, the workflow is completed/read-only (does not prove email delivery); keep the document in read-only mode and do not show Approve or Reject action buttons. For active pending approval documents (where Completed === 0), enable the action buttons (Save Draft, Approve & Reply) directly.',
      'For general approval queues, default to statefilter=APPROVAL to query all pending dashboard approvals. Use statefilter=EMAIL_APPROVAL only when specifically requested.',
      'When displaying document listings or message cards, resolve human-friendly metadata: display the Contact/Sender name (from Contact, form_data.email_to, or from_email) and Subject (from form_data.email_subject). Avoid displaying raw internal file names (e.g. "email.html", "doc.pdf") or generic placeholders as the primary title when meaningful metadata is available.',
      'Paginate records based on the API count parameter (e.g. count=20 or 50 per request). Do not render all thousands of records on a single page at once; provide a "See More" / "Load More" button or page-by-page infinite scroll using page and total_count.',
      'Translate internal ImageState numeric codes to human-readable status labels (e.g. "Waiting for Approval", "In Progress", "Complete", "Failed"). Never display raw "State 109" in the UI.',
      'Specific UI layouts, themes, and design choices (e.g. multi-pane, cards, tables, modals) should be guided by user prompts or ChatGPT app prompts; the MCP specification defines backend API contracts, security rules, and integration workflows.',

      // Code output directive
      'When the user requests to create, build, or generate an application, create a complete, production-ready, runnable/downloadable project artifact (package.json, backend server, frontend components, CSS/styles, and configuration) rather than merely summarizing the architecture or printing fragmented snippets.',

      // Application scope
      'Select only the API endpoints required for the user\'s specific request. Do not include all endpoints by default.',
      'The application scope is determined by the user\'s prompt, not by any single workflow example.',
    ],

  };
}
