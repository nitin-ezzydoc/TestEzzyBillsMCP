# EzzyBills MCP — source-verified developer specification

This is the developer specification used by the EzzyBills MCP server and by
ChatGPT when generating EzzyBills applications. It combines the original
browser captures with the current frontend, REST interface, service
implementation, DTOs, workflow-engine source, and EzzyBills developer portal
documentation.

## Specification precedence and API catalogue discipline

When generating applications using the EzzyBills integration:

1. Use only the catalogued endpoints, parameters, and response structures in this specification.
2. If a required capability is not catalogued, report a specification gap. Do not obtain or invent another EzzyBills endpoint from external documentation or memory.
3. Generated applications must call EzzyBills REST APIs directly at runtime; they must not route requests through MCP after code generation.

## Base URL

```text
https://app.ezzydoc.com/EzzyService.svc/Rest/
```

SOURCE VERIFIED.

---

## Core Architecture

Four actors with distinct responsibilities:

| Actor | Responsibility |
|---|---|
| **MCP Server** | Stateless knowledge engine. Returns source-verified API contracts and generation rules. Does not hold customer credentials, session cookies, or proxy REST calls. |
| **ChatGPT / Generator** | Interprets user intent, reads the specification, generates standalone application code. |
| **Generated Frontend** | Communicates only with its local backend via relative `/api/*` routes. Never holds client secrets or JWTs. |
| **Generated Backend** | Holds `EZZYBILLS_CLIENT_ID` and `EZZYBILLS_CLIENT_SECRET` in environment variables, requests REST JWTs, handles token caching, and invokes EzzyBills REST APIs directly. |

### Default Stack

**Always generate a React + Vite frontend with a Node.js/Express backend**
unless the user explicitly requests a different technology. This is the
**mandatory default stack** — not a suggestion. If the user simply says
"create an app" or "build me an app", always use React + Vite + Express.

Only deviate when the user specifically asks for another framework (e.g.
Next.js, Angular, Vue). The core architecture requirements remain:
- Browser/frontend.
- Server-side backend.
- Backend-only credentials.
- Relative frontend-to-backend API calls.

---

## Authentication (OAuth2 / JWT)

**Used by: applications generated from ChatGPT prompts.**

SOURCE VERIFIED — OAuth2 client credentials authentication model.

### Token endpoint

```text
POST https://app.ezzydoc.com/EzzyService.svc/Rest/oauth/token
Content-Type: application/json
```

Contract signature:
```csharp
[WebInvoke(UriTemplate = "/oauth/token", Method = "POST",
           RequestFormat = WebMessageFormat.Json,
           ResponseFormat = WebMessageFormat.Json)]
JWTTokenSS oauthEzzyBillsToken(OAuthTokenRequest request);
```

### Request body

SOURCE VERIFIED — Request type: `OAuthTokenRequest`

```json
{
  "grant_type": "client_credentials",
  "client_id": "YOUR_CLIENT_ID",
  "client_secret": "YOUR_CLIENT_SECRET"
}
```

Field names are exactly `grant_type`, `client_id`, `client_secret`.
The implementation validates `grant_type === "client_credentials"` and
returns a service error for any other value.

### Response

SOURCE VERIFIED — Response type: `JWTTokenSS`

```json
{
  "token": "eyJ...",
  "service_status": {
    "status": 0,
    "message": "",
    "invoice_id": 0
  }
}
```

The JWT is in the property named **`token`** (not `access_token`).
Check `service_status.status === 0` before using the token.

### Token expiry

SOURCE VERIFIED — Token validity: **1 year** from issuance.

**Usage and lifecycle strategy**:
- The JWT is obtained from `POST /oauth/token` using `grant_type: "client_credentials"`, `client_id`, and `client_secret`.
- The token is passed in requests as `Authorization: Bearer <token>`.
- Cache tokens securely in the application backend (server-side only).
- Derive renewal timing from the JWT `exp` claim with a clock-skew margin (e.g. renew 5 minutes before expiration).
- Single refresh-and-retry is allowed **only for READ_ONLY calls** upon receiving a 401 response. Do not automatically retry mutating operations.

### Using the token

SOURCE VERIFIED — Bearer token authorization:

```text
Authorization: Bearer <token>
```

Strip the `Bearer ` prefix (case-insensitive) and validate the JWT signature.

### Token storage rules

- Never store or transmit EzzyBills JWTs in browser storage (`localStorage`,
  `sessionStorage`, cookies) or frontend code.
- Hosted applications require separate human authentication, tenant mapping,
  server-side role authorization, and audit identity.
- REST API JWTs (valid for 1 year) are cached backend-only and used solely
  for authenticating EzzyBills REST API calls. Webhook/workflow tokens are
  separate and must not be used as Bearer JWTs for REST API calls.
- Never log secrets, bearer tokens, or signed SAS query strings.

### Endpoints that accept Bearer JWT

SOURCE VERIFIED — Bearer authentication applies to all non-anonymous REST endpoints:

- `GET searchInvoicesPaged` — SOURCE VERIFIED
- `GET getMyAttachments2` — SOURCE VERIFIED
- `GET getFormData` — SOURCE VERIFIED
- `GET getInvoiceDetails` — SOURCE VERIFIED
- `GET getDocumentClassification` — SOURCE VERIFIED
- `POST updateInvoiceImage` — SOURCE VERIFIED
- `GET approveInvoice` — SOURCE VERIFIED
- `GET rejectInvoice` — SOURCE VERIFIED
- `GET getPurchaseOrders3` — SOURCE VERIFIED
- `GET moveToRecycleBin` — SOURCE VERIFIED

The `oauth/token` endpoint itself is `allow_anonymous: true` and does not require a token.

---

## ID roles

Two different IDs are used and must not be mixed:

- **Parent document ID** — returned as `InvoiceId` by the list call. Use it
  for detail, approve, reject, and moveToRecycleBin calls.
- **AI reply attachment ID** — returned as `queue[].invoice_id` for the
  `AIEMAILRESPONSE` attachment. Use it to update the HTML attachment.

All IDs used by generated applications must be positive integers.

## Service-status rules

EzzyBills commonly returns application errors inside HTTP 200 responses.

- Read wrappers use nested `service_status.status`.
- `updateInvoiceImage` uses nested `service_status.status`; success is
  `0`.
- `approveInvoice`, `rejectInvoice`, and `moveToRecycleBin` return a direct
  `Servicestatus`; success is direct `status === 0`.

Generated applications must treat confirmed nonzero statuses as errors and
must not retry mutating calls automatically.

## Environment & Server Startup Rules

- Always include `dotenv` in `package.json` dependencies.
- The server entry file (e.g. `server/index.js`) must have
  `import 'dotenv/config';` (ESM) or `require('dotenv').config();` (CJS) as
  the **very first statement**, before any `process.env` access. Without this,
  `.env` values will not load.
- Place `EZZYBILLS_CLIENT_ID`, `EZZYBILLS_CLIENT_SECRET`, and `PORT` in the
  `.env` file at the project root (same directory as `package.json`).
- The `.env.example` file must list these with placeholder values.
- Read the backend port from `process.env.PORT` (loaded from `.env`). Do not
  hardcode or assume port 3000.
- Handle `EADDRINUSE` on server startup: catch the error event from
  `app.listen()` and print a clear message like
  `"Port {PORT} is already in use. Change PORT in .env or stop the other process."`
  then exit with `process.exit(1)`.
- Configure `vite.config.js` to load the backend port from `.env` dynamically
  (e.g. using `loadEnv(mode, process.cwd(), '')` to point the `/api` proxy to
  `http://localhost:${env.PORT || 3002}`) so changing `PORT` in `.env` automatically
  synchronizes both the backend and the Vite frontend proxy.
- Vite frontend development ports can also be set via `VITE_PORT` in `.env` with
  `strictPort: false` to avoid port collisions.

---

## Action Risk Tiers

| Risk Tier | Description | Endpoints |
|---|---|---|
| `READ_ONLY` | Safe for caching and automatic retry after token refresh | `searchInvoicesPaged`, `getMyAttachments2`, `getFormData`, `getInvoiceDetails`, `getDocumentClassification`, `getPurchaseOrders3` |
| `WRITE` | Modifies attachment or state without external dispatch | `updateInvoiceImage` |
| `DESTRUCTIVE_OR_EXTERNAL` | Triggers external workflows, email sending, permanent state transitions, or document deletion | `approveInvoice`, `rejectInvoice`, `moveToRecycleBin` |

### Backend guardrails for WRITE and DESTRUCTIVE_OR_EXTERNAL

- Require explicit human confirmation before invocation.
- Server-side user authentication and tenant authorization checks.
- Duplicate-action prevention and idempotency.
- Audit trail logging.
- CSRF protection when cookie sessions are used.
- No automatic retries for mutating calls.

---

## Content Security Rules

Apply when the generated application displays rich text, HTML, files, or
attachment content:

1. **Sanitization**: Sanitize untrusted HTML before rendering previews and
   before saving back to the server. Use an appropriate sanitization library.
2. **Script Blocking**: Strip `<script>`, inline event handlers, and unsafe
   elements (`<object>`, `<embed>`). Block remote/tracking content.
3. **Sandboxing**: Render rich HTML in a sandboxed container with restrictive
   CSP.
4. **Blob Security**:
   - Accept only HTTPS URLs on trusted hosts (e.g.
     `ezzydoc.blob.core.windows.net`). Enforce exact host allowlisting.
   - Validate MIME type, enforce response-size limits (e.g. 10 MB) and timeout
     limits.
   - Revalidate redirects and enforce redirect limits.
   - Never forward EzzyBills `Authorization: Bearer` headers to blob storage.
   - Never expose signed SAS query parameters in logs or standard UI.
5. **Backend Proxying**: Prefer backend-controlled fetch, sanitize, and proxy
   for rich content.

---

## API Catalogue — 10 verified endpoints

### 1. List documents and email approvals

Call `searchInvoicesPaged` with one of these validated filters:

```text
SHOW_ALL         all visible active documents                        SOURCE VERIFIED
APPROVAL         normal dashboard approval states (ALLMYAPPROVAL)    SOURCE VERIFIED
EMAIL_APPROVAL   email approval states (waiting, in-progress, etc.)  SOURCE VERIFIED
FAILED           failed documents (terminal / read-only)             SOURCE VERIFIED
COMPLETE         completed documents (terminal / read-only)          SOURCE VERIFIED
```

**Terminal State & Completed UI Rule**: Keep documents in terminal states (`FAILED`, `COMPLETE`) or where `Completed === 1` visible to all users in document listings and search, but render them strictly in read-only mode with their status badge. Generated applications must **never** display Approve, Reject, or Reply action controls for these documents.

The supported `documentType` filter values are `0` (all), `1` (invoices),
`12` (blobs), and `13` (statements). Although the backend enum contains other
types, its current search implementation silently ignores them.

```http
GET /searchInvoicesPaged
  ?search_tag=
  &includedeleted=0
  &page=0
  &count=10
  &statefilter=EMAIL_APPROVAL
  &order=UPLOAD
  &documentType=0
Authorization: Bearer <token>
```

Risk tier: **READ_ONLY**

The response has mixed casing. The envelope is snake_case, while document
items use PascalCase plus lower-case URL fields:

```json
{
  "list": [
    {
      "InvoiceId": "47490035",
      "ImageState": 154,
      "Completed": 0,
      "Contact": "Acme Corp",
      "Filename": "email.html",
      "DocumentType": 3,
      "DocumentSubType": 0,
      "Data": "...",
      "Date": "...",
      "blob_url": "https://...",
      "thumb_url": null
    }
  ],
  "page_count": 10,
  "total_count": 1,
  "service_status": {
    "invoice_id": 0,
    "message": "",
    "status": 0
  }
}
```

`page_count` is the requested page size in the current backend
implementation, not the number of pages.

`EMAIL_APPROVAL` includes waiting, in-progress, resend, and project-manager
email states. Presence in the list does not by itself prove that the document
is ready to approve or reject.

Confirmed actionable in-progress states are:

```text
154, 219, 324, 344, 374, 414, 464
```

The action endpoint remains authoritative because state can change after a
read.

### 2. Open an email approval

Call these four endpoints with the **parent document ID** and the
`Authorization: Bearer <token>` header:

```http
GET /getMyAttachments2?invoiceid=PARENT_ID
GET /getFormData?invoiceid=PARENT_ID
GET /getInvoiceDetails?invoiceid=PARENT_ID
GET /getDocumentClassification?invoiceid=PARENT_ID
```

Risk tier: all **READ_ONLY**

#### Attachments

`getMyAttachments2` returns `AttachmentQueueSS`:

```json
{
  "queue": [
    {
      "attached_id": 47490037,
      "invoice_id": 47490037,
      "file_name": "47490035_generated_email_response.html",
      "blob_url": "https://ezzydoc.blob.core.windows.net/docs/...?...",
      "display_priority": 1,
      "tag": "AIEMAILRESPONSE",
      "state": 26,
      "type": 12,
      "subtype": 0
    }
  ],
  "service_status": { "status": 0 }
}
```

Select the attachment whose tag is exactly `AIEMAILRESPONSE`.

Generated applications must use the exact tag so attachment ordering cannot
select the wrong file.

#### Form data and email metadata

`getFormData` returns `FormDataSS`. Important values are inside
`form_data`:

```text
form_data.from_email
form_data.email_to
form_data.email_subject
form_data.email_conversation_id
form_data.email_message_id
```

Generated applications may normalize these values into an `emailContext`
object while preserving the complete form-data response when needed.

#### Invoice details

`getInvoiceDetails` returns an envelope:

```json
{
  "invForm": {
    "invoice_id": 47490035,
    "state": 154,
    "file_name": "email.html",
    "message_id": "..."
  },
  "service_status": { "status": 0 }
}
```

Generated applications may derive UI action readiness from `invForm.state`,
but the EzzyBills server remains authoritative at write time.

#### Classification

`getDocumentClassification` returns:

```text
classification
doc_classification
doc_subtype
doc_type
is_tax_inclusive
service_status
```

### 3. Read the AI reply HTML

1. Call `getMyAttachments2` with the parent ID.
2. Find the exact `AIEMAILRESPONSE` attachment.
3. Fetch its signed `blob_url` with a plain GET.

The blob request must not receive the EzzyBills authorization header. Generated
applications should accept only HTTPS URLs on
`ezzydoc.blob.core.windows.net` for this operation.

The downloaded content is the complete UTF-8 HTML document. It contains the
editable generated response and the original-email context. Generated
applications should render it only in a sandboxed iframe or an appropriately
sanitized editor and must not expose signed blob query strings in logs or UI.

### 4. Update the AI reply

```http
POST /updateInvoiceImage
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "PictureName": "47490037.html",
  "PictureStream": [60, 104, 116, 109, 108, 62]
}
```

Risk tier: **WRITE**

`PictureStream` is the complete edited HTML encoded as UTF-8 bytes.

`PictureName` is not a descriptive filename. The backend removes the
extension and converts the remaining text to an integer to identify and
authorize the attachment. It must therefore be exactly:

```text
<AI_REPLY_ATTACHMENT_ID>.html
```

For example, `47490035_generated_email_response.html` is not a valid update
target even if that is the attachment's returned `file_name`.

Confirmed response:

```json
{
  "invoice_id": 47490037,
  "service_status": {
    "invoice_id": 0,
    "message": "",
    "status": 0
  },
  "url": "https://ezzydoc.blob.core.windows.net/docs/47490037.html?..."
}
```

Generated applications must require the nested success status and strip the
signed query string before exposing the returned URL to the browser.

### 5. Approve & Continue Workflow

```http
GET /approveInvoice?invoicelist=PARENT_ID&note=
Authorization: Bearer <token>
```

Risk tier: **DESTRUCTIVE_OR_EXTERNAL**

The parameter is exactly `invoicelist`; it accepts a comma-separated string.
Generated applications should approve one parent document per call unless the
user explicitly requests a reviewed batch operation.

Confirmed response:

```json
{
  "invoice_id": 0,
  "message": "",
  "status": 0
}
```

The endpoint validates role, ownership, and approver state, then commits the
approval state transition. The configured workflow engine subsequently sends
the saved reply.

**Important**: `status: 0` is an approval receipt — it does not confirm
final email delivery by the workflow engine. External delivery status is not
available unless a separate verified API provides it.

Only invoke this action after the user explicitly confirms it.

### 6. Reject

```http
GET /rejectInvoice?invoiceid=PARENT_ID&note=REASON
Authorization: Bearer <token>
```

Risk tier: **DESTRUCTIVE_OR_EXTERNAL**

The parameter is exactly `invoiceid`. The response is direct
`Servicestatus`:

```json
{
  "invoice_id": 0,
  "message": "",
  "status": 0
}
```

The backend permits an empty note, but generated applications must require a
nonempty rejection reason as a safety policy. Only invoke rejection after
explicit confirmation.

### 7. Purchase Orders (getPurchaseOrders3)

SOURCE VERIFIED — Operation: `getPurchaseOrders3`, Response: `PurchaseOrderSS`

```csharp
[WebGet(UriTemplate = "/getPurchaseOrders3?type={type}&target={target}",
        ResponseFormat = WebMessageFormat.Json)]
PurchaseOrderSS getPurchaseOrders3(int type, InvoiceEngine.exporttarget target);
```

```http
GET /getPurchaseOrders3?type={type}&target={target}
Authorization: Bearer <token>
```

Risk tier: **READ_ONLY**

#### Parameters

- **`type`** (integer): Order type filter.
  - `0` = PURCHASE
  - `1` = CONTRACTOR
  - Enum: `ordertype` (0=PURCHASE, 1=CONTRACTOR).

- **`target`** (integer): Numeric export target ID sent in query string (e.g. `?target=1`).
  The frontend UI displays user-friendly names in a dropdown (`Xero`, `Simpro`, `Procore`, `QuickBooks`, `MYOB`)
  and sends the corresponding integer ID (`1`, `27`, `48`, `9`, `2`) to the API.
  No environment variable configuration is required for target.

#### Response

```json
{
  "my_orders": [
    { "po_number": "PO-001", "supplier": "Acme Corp" }
  ],
  "service_status": {
    "status": 0,
    "message": "",
    "invoice_id": 0
  }
}
```

- `my_orders`: array of `{ po_number, supplier }`.
- Results are de-duplicated by purchase-order number (SQL-level).
- Handle an empty `my_orders` result normally — it is not an error condition.
- Authorization scoped to authenticated membership user ID. Required roles:
  `"Registered Users,HQ User,HQApprover,HQReviewer"`.

### 8. Move Document to Recycle Bin (moveToRecycleBin)

SOURCE VERIFIED — Operation: `moveToRecycleBin`, Response: `ServiceStatus`

```http
GET /moveToRecycleBin?invoiceid={invoiceid}
Authorization: Bearer <token>
```

Risk tier: **DESTRUCTIVE_OR_EXTERNAL**

#### Parameters

- **`invoiceid`** (string, required): The parent document ID to move to the recycle bin (e.g. `47490035`).

#### Response

```json
{
  "invoice_id": 0,
  "message": "",
  "status": 0
}
```

- Pass the `parentDocumentId` as `invoiceid` (never pass an attachment ID).
- Check `status === 0` for success.
- Requires explicit human confirmation before invocation.

### 9. Related endpoints not required by the core application flow

#### `getEmailBody`

```http
GET /getEmailBody?invoiceid=PARENT_ID
Authorization: Bearer <token>
```

Returns `{ email_body, service_status }`, but the backend simply downloads
the first attachment ordered by display priority/time. It does not select an
original-email tag, so generated applications should not rely on it.

#### `getEmailSubject`

```http
GET /getEmailSubject?invoiceid=PARENT_ID
Authorization: Bearer <token>
```

Returns `{ email_subject, service_status }`. It regex-parses the top-level
form tag and can return a null subject with status 0. Use
`form_data.email_subject` from the already-required form-data call instead.

#### `getEmailMessage`

```http
GET /getEmailMessage?invoiceid=PARENT_ID
Authorization: Bearer <token>
```

Returns the original mailbox message as `EmailStream` bytes. The frontend
uses it to download an `.eml` file. It requires mailbox-service work and is
not needed because the core approval HTML already contains the original
context and form data supplies sender/subject metadata.

#### `getAIResult`

This endpoint reads AI extraction JSON. It is unrelated to the generated email
reply and is not part of the core application flow.

---

## Workflow Recipes

### Recipe 1: Search & List Documents
`searchInvoicesPaged` with pagination and keyword filtering.

### Recipe 2: Filter by State & Type
Combine verified `statefilter` and `documentType` values.

### Recipe 3: Retrieve Document Details
Call `getInvoiceDetails`, `getFormData`, `getDocumentClassification` using
`parentDocumentId`.

### Recipe 4: Retrieve Attachments
Call `getMyAttachments2` and locate target attachments by exact `tag`.

### Recipe 5: Display Attachment Content Safely
Fetch signed Azure Blob URLs with plain GET; sanitize and sandbox HTML.

### Recipe 6: Approve or Reject Document
Consequential actions with human confirmation. "Approve & Continue Workflow"
and "Reject" are mutually exclusive. An approval receipt is not a delivery
receipt.

### Recipe 7: Email Response Workflow
Complete lifecycle: list → fetch form data & attachment → fetch HTML blob →
sanitize & edit → save draft via `updateInvoiceImage` → human confirmation →
`approveInvoice` (advances workflow; does not confirm delivery).

### Recipe 8: Retrieve Purchase Orders
Call `getPurchaseOrders3` with order type (`0=PURCHASE` or `1=CONTRACTOR`) and numeric target ID from the five-option dropdown (`Xero=1`, `MYOB=2`, `QuickBooks=9`, `Simpro=27`, `Procore=48`). Handle empty results normally.

### Recipe 9: Delete or Recycle Document
Call `moveToRecycleBin` with `invoiceid` set to `parentDocumentId` after explicit human confirmation. Check `status === 0` for success and remove the item from the list.

---

## Application Profiles

Optional UI blueprints — apply only when the user requests that type.

| Profile | Description | Key Endpoints |
|---|---|---|
| `document-browser` | Grid/table view with search, filter tabs, pagination, metadata | `searchInvoicesPaged`, `getInvoiceDetails`, `getFormData`, `getDocumentClassification` |
| `approval-queue` | Pending approval queue with preview and confirmation dialogs | `searchInvoicesPaged`, `getInvoiceDetails`, `approveInvoice`, `rejectInvoice`, `moveToRecycleBin` |
| `email-response-approval` | Outlook-style 2-pane email approval layout with WYSIWYG editor and independent pane scrolling | `searchInvoicesPaged`, `getMyAttachments2`, `getFormData`, `updateInvoiceImage`, `approveInvoice`, `moveToRecycleBin` |
| `purchase-order-selector` | PO lookup with type toggle and target selector | `getPurchaseOrders3` |
| `invoice-editor` | **DEFERRED** — pending source verification of mutation APIs | — |

### `email-response-approval` Blueprint Rules
- **Layout**: Full height (`100vh`) with fixed app header. Left pane (inbox list, `360px-400px`, `overflow-y: auto`) and right pane (reading & reply area, `flex: 1`, `overflow-y: auto`). Independent scrolling ensures the header and left list do not scroll away.
- **Left Inbox Cards & Pagination**: Left list loads records in batches based on `count` (e.g. 20 or 50) and provides a "See More" / "Load More" button (or infinite scroll) using `page` and `total_count` from `searchInvoicesPaged` to browse all 2,000+ records. Each card uses an Outlook 3-line layout:
  - **Line 1 (Top)**: Human / Contact Name (from `Contact`, `form_data.email_to`, or the user handle parsed from `from_email`, e.g. `"nickw"`, `"noreply"`, `"support"`, `"Clinton"`) in bold on the left; formatted Time/Date on the right.
  - **Line 2 (Middle)**: The actual email Subject line (from `form_data.email_subject`, e.g. `"Re: 47632108 - Ditec"`, `"Cin7 Core verification code"`, `"Fw: Doc ID 47652181"`) prominent below the name.
  - **Line 3 (Bottom)**: Clean status pill badge (e.g. `"In Progress"`, `"Waiting for Approval"`) and preview snippet (e.g. `"AI response ready to review"`).
  - *NEVER display `"Unknown sender"`, filenames like `"email.html"` / `"doc.pdf"`, or generic placeholder titles on cards.*
- **Left Pane Card Hover Actions**: On hovering an inbox card, display Outlook-style quick action icons including 🗑️ **Delete** (calls `moveToRecycleBin` with `parentDocumentId`, with confirmation dialog or undo toast).
- **Right Pane Header**: Clean email metadata (Subject title as main heading, From, and Date/Time).
- **Right Pane Reply Toolbar & Attachments**: Complete visual rich-text toolbar above the WYSIWYG editor containing formatting buttons (Bold, Italic, Underline, Bullet/Numbered Lists, Quotes, Code, Links 🔗, Clear Formatting) and an Attachment / Screenshot upload button (`"📎 Choose File or Drop file here / Paste Screenshot"`) allowing users to add screenshot images and file attachments alongside the email response.
- **WYSIWYG Rich Editor & AI Response Separation**: Single visual editor (using `contentEditable` or rich-text component with toolbar) allowing direct formatting of ONLY the AI response portion. The `AIEMAILRESPONSE` attachment HTML contains the generated reply at top and original email thread inside `<div id="ai-original-email">`. Only the top AI reply portion is editable; the original email inside `<div id="ai-original-email">` remains sanitized and strictly read-only. Never display raw HTML `<p>` tags inside a `<textarea>` with a separate preview.
- **Default Approval Filter**: Default to `statefilter=APPROVAL` to retrieve all pending dashboard approvals. Use `statefilter=EMAIL_APPROVAL` only when the user specifically requests filtering exclusively for the email approval queue.
- **Action Enablement**: If `Completed === 1`, the workflow is completed/read-only (does not prove email delivery; hide actions). Active pending items (`Completed === 0`) are actionable with "Save Draft" and "Approve & Reply". Never disable actions on pending items based on unrecognized internal `ImageState` numeric codes.

---

## Specification Gaps

Items requiring backend-developer verification:

| Gap ID | Description |
|---|---|
| `INVOICE_EDITOR_APIS` | Invoice row/header mutation APIs pending source verification |
| `EMAIL_DELIVERY_STATUS` | No external email delivery status API currently verified |
| `WEBHOOK_TOKEN_LIFETIME` | Webhook/workflow token lifecycle is separate from REST API JWT (1 year) |

---

## REST workflow example

Use a disposable approval for testing write operations:

1. Call `searchInvoicesPaged` with `statefilter=EMAIL_APPROVAL`.
2. Use the returned parent `InvoiceId` with the four detail endpoints.
3. Select the exact `AIEMAILRESPONSE` attachment and retain its attachment ID.
4. Fetch the attachment's signed blob URL without forwarding the Bearer token.
5. Save edited HTML with `updateInvoiceImage`, using the attachment ID in
   `PictureName`.
6. After explicit confirmation, call either `approveInvoice` or
   `rejectInvoice` with the parent document ID. Never perform both terminal
   actions for the same approval.
