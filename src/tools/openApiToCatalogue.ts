type OpenApiParameter = {
  name?: string;
  in?: string;
  required?: boolean | string;
  description?: string;
  schema?: Record<string, unknown>;
  example?: unknown;
};

type OpenApiOperation = {
  summary?: string;
  description?: string;
  operationId?: string;
  parameters?: OpenApiParameter[];
  requestBody?: Record<string, unknown>;
  responses?: Record<string, unknown>;
  security?: Record<string, unknown>[];
};

type OpenApiPathItem = Record<string, unknown> & {
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  patch?: OpenApiOperation;
  delete?: OpenApiOperation;
};

type OpenApiDocument = {
  openapi?: string;
  servers?: Array<{
    url?: string;
    description?: string;
  }>;
  paths?: Record<string, OpenApiPathItem>;
};

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

/**
 * Endpoints that are present in the REST/OpenAPI description but are
 * deliberately excluded from generated applications because the current
 * EzzyBills developer contract says not to use them.
 */
const EXCLUDED_ENDPOINTS = new Set([
  'getPurchaseOrders',
  'getPurchaseOrders2',
  'getEmailBody',
  'getEmailSubject',
  'getEmailMessage',
  'getAIResult',
]);

/**
 * HTTP method alone is not enough to determine business risk.
 * These are the verified EzzyBills-specific classifications we already had.
 */
const RISK_OVERRIDES: Record<string, string> = {
  searchInvoicesPaged: 'READ_ONLY',
  getMyAttachments2: 'READ_ONLY',
  getFormData: 'READ_ONLY',
  getInvoiceDetails: 'READ_ONLY',
  getDocumentClassification: 'READ_ONLY',
  getPurchaseOrders3: 'READ_ONLY',

  updateInvoiceImage: 'WRITE',

  approveInvoice: 'DESTRUCTIVE_OR_EXTERNAL',
  rejectInvoice: 'DESTRUCTIVE_OR_EXTERNAL',
  moveToRecycleBin: 'DESTRUCTIVE_OR_EXTERNAL',
};

/**
 * The OpenAPI document provides the mechanical API contract.
 *
 * These small overrides preserve verified EzzyBills business semantics
 * that are not represented completely by generic OpenAPI metadata.
 */
const CURATED_OVERRIDES: Record<string, Record<string, unknown>> = {
  searchInvoicesPaged: {
    purpose:
      'Search and list EzzyBills documents. The primary entry point for listing invoices, email approvals, or all documents.',

    parameters: {
      search_tag: {
        type: 'string',
        description:
          'Free-text search. Empty string returns all documents matching the filter.',
        default: '',
      },

      includedeleted: {
        type: 'integer',
        description: 'Include soft-deleted documents.',
        allowedValues: [0, 1],
        default: 0,
      },

      page: {
        type: 'integer',
        description: 'Zero-based page index.',
        default: 0,
      },

      count: {
        type: 'integer',
        description: 'Items per page. Max 100.',
        default: 10,
      },

      statefilter: {
        type: 'enum',
        allowedValues: {
          SHOW_ALL:
            'All visible active documents. SOURCE_VERIFIED.',
          APPROVAL:
            'Normal dashboard approval states (alias: ALLMYAPPROVAL). SOURCE_VERIFIED.',
          EMAIL_APPROVAL:
            'Email approval states (waiting, in-progress, resend, PM email states). SOURCE_VERIFIED.',
          FAILED:
            'Failed documents (terminal state — read-only in UI, no approve/reject/reply actions). SOURCE_VERIFIED.',
          COMPLETE:
            'Completed documents (terminal state — read-only in UI, no approve/reject/reply actions). SOURCE_VERIFIED.',
        },
        default: 'SHOW_ALL',
      },

      order: {
        type: 'string',
        description: 'Sort order.',
        verifiedValues: ['UPLOAD'],
        default: 'UPLOAD',
      },

      documentType: {
        type: 'integer',
        allowedValues: {
          0: 'All document types.',
          1: 'Invoices only.',
          12: 'Blobs only.',
          13: 'Statements only.',
        },
        default: 0,
      },
    },

    responseShape: {
      list: 'array of document items',
      page_count:
        'The requested page size, NOT the number of pages (current backend behaviour).',
      total_count: 'Total matching documents.',
      service_status: {
        invoice_id: 'integer',
        message: 'string',
        status: 'integer — 0 = success, nonzero = error',
      },
      documentItem: {
        InvoiceId:
          'string — use as parentDocumentId for detail/approve/reject calls',
        ImageState: 'integer — document state code',
        Completed:
          'integer — 0 if pending/in-progress (actionable), 1 if workflow completed/read-only (does not prove delivery)',
        Contact: 'string — contact or sender organization name',
        Filename: 'string',
        DocumentType: 'integer',
        DocumentSubType: 'integer',
        Data: 'string',
        Date: 'string',
        blob_url: 'string or null',
        thumb_url: 'string or null',
      },
    },

    _notes: [
      'Response envelope is snake_case; document items are PascalCase plus lower-case URL fields.',
      'Confirmed actionable in-progress email states: 154, 219, 324, 344, 374, 414, 464. The action endpoint remains authoritative because state can change after a read.',
    ],
  },

  getMyAttachments2: {
    purpose:
      'Returns all attachments for a parent document. Use to find the AIEMAILRESPONSE attachment for the AI-generated email reply.',

    parameters: {
      invoiceid: {
        type: 'integer',
        description:
          'Parent document ID (InvoiceId from searchInvoicesPaged).',
        idType: 'parentDocumentId',
      },
    },

    responseShape: {
      queue: 'array of attachment objects',
      service_status: {
        status: 'integer',
      },
      attachmentItem: {
        attached_id: 'integer',
        invoice_id:
          'integer — THIS is the attachment invoice_id. Use for updateInvoiceImage, NOT the parent ID.',
        file_name: 'string',
        blob_url: 'string — signed Azure Blob URL',
        display_priority: 'integer',
        tag: 'string — e.g. AIEMAILRESPONSE',
        state: 'integer',
        type: 'integer',
        subtype: 'integer',
      },
    },

    _notes: [
      'To find the AI reply: select the attachment whose tag is exactly "AIEMAILRESPONSE".',
      'Use the exact tag — do not rely on display_priority order.',
      'The blob_url is a signed Azure Blob URL on ezzydoc.blob.core.windows.net. Fetch it with a plain GET — do not send the EzzyBills Authorization header to the blob.',
    ],
  },

  getFormData: {
    purpose:
      'Returns form metadata for a document, including email sender, recipient, subject, and conversation IDs.',

    parameters: {
      invoiceid: {
        type: 'integer',
        description: 'Parent document ID.',
        idType: 'parentDocumentId',
      },
    },

    responseShape: {
      form_data: {
        from_email: 'string',
        email_to: 'string',
        email_subject: 'string',
        email_conversation_id: 'string',
        email_message_id: 'string',
      },
      service_status: {
        status: 'integer',
      },
    },

    _notes: [
      'Use form_data.email_subject rather than the getEmailSubject endpoint. getEmailSubject regex-parses the form tag and can return null with status 0.',
    ],
  },

  getInvoiceDetails: {
    purpose:
      'Returns document metadata including state code, file name, and message ID.',

    parameters: {
      invoiceid: {
        type: 'integer',
        description: 'Parent document ID.',
        idType: 'parentDocumentId',
      },
    },

    responseShape: {
      invForm: {
        invoice_id: 'integer — parent document ID',
        state: 'integer — document state code',
        file_name: 'string',
        message_id: 'string',
      },
      service_status: {
        status: 'integer',
      },
    },
  },

  getDocumentClassification: {
    purpose:
      'Returns document classification, subtype, and tax information.',

    parameters: {
      invoiceid: {
        type: 'integer',
        description: 'Parent document ID.',
        idType: 'parentDocumentId',
      },
    },

    responseShape: {
      classification: 'value',
      doc_classification: 'value',
      doc_subtype: 'value',
      doc_type: 'value',
      is_tax_inclusive: 'value',
      service_status: {
        status: 'integer',
      },
    },
  },

  updateInvoiceImage: {
    purpose:
      'Replaces the content of an existing attachment. Used to save an edited AI email reply HTML back to EzzyBills.',

    parameters: {
      PictureName: {
        type: 'string',
        description:
          'Must be exactly "<attachmentInvoiceId>.html". The backend strips the extension and converts the remainder to an integer to identify and authorise the attachment. Do NOT use the attachment file_name returned by getMyAttachments2.',
        example: '47490037.html',
      },

      PictureStream: {
        type: 'integer[]',
        description:
          'Complete edited HTML encoded as a UTF-8 byte array. Use Array.from(new TextEncoder().encode(html)) to produce this.',
      },
    },

    idUsed:
      'attachmentInvoiceId — invoice_id from the AIEMAILRESPONSE attachment, NOT the parent document ID',

    responseShape: {
      invoice_id: 'integer — attachment ID',
      service_status: {
        invoice_id: 'integer',
        message: 'string',
        status: 'integer — 0 = success',
      },
      url: 'string — new signed blob URL (strip query string before returning to browser)',
    },

    _notes: [
      'Check nested service_status.status === 0 for success.',
      'Maximum verified payload: 10 MB.',
      'Strip the signed query string from the returned URL before displaying to the user.',
    ],
  },

  approveInvoice: {
    purpose:
      'Approves a parent document, advancing the configured EzzyBills workflow. For email-approval documents, the workflow engine subsequently sends the saved reply. An approval receipt is not a delivery receipt.',

    parameters: {
      invoicelist: {
        type: 'string',
        description:
          'Parent document ID. Accepts a comma-separated string of IDs; approve one per call in this integration.',
        idType: 'parentDocumentId',
      },

      note: {
        type: 'string',
        description: 'Optional approval note. Defaults to empty string.',
        default: '',
      },
    },

    responseShape: {
      invoice_id: 'integer',
      message: 'string',
      status:
        'integer — 0 = approval accepted (NOT proof of final email delivery)',
    },

    _notes: [
      'Check direct status === 0 (not nested service_status) for success.',
      'status: 0 is an approval receipt; it does not confirm final email delivery by the workflow engine.',
      'The endpoint validates role, ownership, and approver state.',
      'Only invoke after explicit user confirmation.',
      'Do not invoke both approve and reject for the same document.',
    ],
  },

  rejectInvoice: {
    purpose: 'Rejects a parent document with a reason.',

    parameters: {
      invoiceid: {
        type: 'integer',
        description: 'Parent document ID.',
        idType: 'parentDocumentId',
      },

      note: {
        type: 'string',
        description:
          'Rejection reason. The backend permits an empty note, but a non-empty reason is required as a safety policy.',
      },
    },

    responseShape: {
      invoice_id: 'integer',
      message: 'string',
      status: 'integer — 0 = success',
    },

    _notes: [
      'Check direct status === 0 (not nested service_status) for success.',
      'Require a non-empty rejection reason before calling.',
      'Only invoke after explicit user confirmation.',
      'Do not invoke both approve and reject for the same document.',
    ],
  },

  getPurchaseOrders3: {
    _verificationStatus: 'SOURCE_VERIFIED',

    _contract: {
      operation: 'getPurchaseOrders3',
      responseType: 'PurchaseOrderSS',
      itemType: 'PurchaseOrder',
      orderTypeEnum: 'ordertype',
      targetEnum: 'exporttarget',
    },

    purpose:
      'Purchase order lookup by order type and export target. Results are de-duplicated by purchase-order number (SQL-level).',

    uriTemplate:
      '/getPurchaseOrders3?type={type}&target={target}',

    authorization:
      'Scoped to authenticated membership user ID. Required roles: "Registered Users,HQ User,HQApprover,HQReviewer".',

    parameters: {
      type: {
        type: 'integer',
        description: 'Order type filter.',
        allowedValues: {
          0: 'PURCHASE',
          1: 'CONTRACTOR',
        },
        enumType: 'ordertype (0=PURCHASE, 1=CONTRACTOR)',
      },

      target: {
        type: 'integer',
        description:
          'Numeric export target ID sent in the query string (e.g. ?target=1).',
        allowedValues: {
          1: 'Xero',
          2: 'MYOB',
          9: 'QuickBooks',
          27: 'Simpro',
          48: 'Procore',
        },
        enumType:
          'exporttarget (XERO=1, MYOB=2, QUICKBOOKS=9, SIMPRO=27, PROCORE=48)',
      },
    },

    responseShape: {
      my_orders:
        'array of { po_number: string, supplier: string }',
      service_status: {
        status: 'integer — 0 = success',
        message: 'string',
        invoice_id: 'integer',
      },
    },

    _notes: [
      'Handle an empty my_orders result normally — it is not an error condition.',
    ],
  },

  moveToRecycleBin: {
    _verificationStatus: 'SOURCE_VERIFIED',

    _contract: {
      operation: 'moveToRecycleBin',
      responseType: 'ServiceStatus',
    },

    purpose:
      'Moves a document to the recycle bin / trash by its parent invoice ID.',

    uriTemplate:
      '/moveToRecycleBin?invoiceid={invoiceid}',

    authorization:
      'Scoped to authenticated membership user ID.',

    parameters: {
      invoiceid: {
        type: 'string',
        description:
          'The parent document ID to move to the recycle bin (required).',
        example: '47490035',
        idType: 'parentDocumentId',
      },
    },

    responseShape: {
      invoice_id: 'integer',
      message: 'string',
      status: 'integer — 0 = success, nonzero = error',
    },

    _notes: [
      'Pass the parent document ID as invoiceid (not an attachment ID).',
      'Check direct status === 0 for success.',
      'Requires explicit human confirmation before invoking.',
    ],
  },
};

function buildParameters(parameters: OpenApiParameter[] = []) {
  const result: Record<string, unknown> = {};

  for (const parameter of parameters) {
    if (!parameter.name) {
      continue;
    }

    const schema = parameter.schema ?? {};

    const parameterResult: Record<string, unknown> = {
      type: schema.type ?? 'unknown',
      location: parameter.in,
      required: parameter.required ?? false,
    };

    if (parameter.description) {
      parameterResult.description = parameter.description;
    }

    if (schema.enum) {
      parameterResult.allowedValues = schema.enum;
    }

    if (schema['x-enumNames']) {
      parameterResult.enumNames = schema['x-enumNames'];
    }

    if (parameter.example !== undefined) {
      parameterResult.example = parameter.example;
    }

    result[parameter.name] = parameterResult;
  }

  return result;
}

function getRiskTier(operationId: string): string {
  return RISK_OVERRIDES[operationId] ?? 'UNCLASSIFIED';
}

export function buildApiCatalogue(openApi: OpenApiDocument) {
  const endpoints: Record<string, Record<string, unknown>> = {};

  for (const [path, pathItem] of Object.entries(openApi.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];

      if (!operation || typeof operation !== 'object') {
        continue;
      }

      const operationData = operation as OpenApiOperation;

      const operationId =
        operationData.operationId ??
        `${method.toUpperCase()}_${path.replace(/[^a-zA-Z0-9]+/g, '_')}`;

      if (EXCLUDED_ENDPOINTS.has(operationId)) {
        continue;
      }

      const generatedEndpoint: Record<string, unknown> = {
        operationId,
        method: method.toUpperCase(),
        path,
        summary: operationData.summary ?? '',
        ...(operationData.description
          ? { description: operationData.description }
          : {}),
        riskTier: getRiskTier(operationId),
        parameters: buildParameters(operationData.parameters),
        ...(operationData.requestBody
          ? { requestBody: operationData.requestBody }
          : {}),
        responses: operationData.responses ?? {},
        security: operationData.security ?? [],
      };

      const curated = CURATED_OVERRIDES[operationId];

      endpoints[operationId] = curated
        ? {
            ...generatedEndpoint,
            ...curated,

            // Preserve generated API metadata unless the curated contract
            // intentionally overrides a field.
            method:
              curated.method ?? generatedEndpoint.method,
            path:
              curated.path ??
              generatedEndpoint.path,
            parameters:
              curated.parameters ??
              generatedEndpoint.parameters,
          }
        : generatedEndpoint;
    }
  }

  return {
    _verified_base_url: openApi.servers?.[0]?.url ?? '',
    _generated_from: 'Mintlify OpenAPI specification',
    _endpointCount: Object.keys(endpoints).length,
    _note:
      'Endpoint definitions are generated from the EzzyBills OpenAPI specification. ' +
      'Verified EzzyBills-specific business rules are applied as curated overrides. ' +
      'Do not invent endpoints, parameter names, values, or response fields.',
    endpoints,
  };
}