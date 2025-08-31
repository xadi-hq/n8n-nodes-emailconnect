# EmailConnect n8n Node: API Reference

**Project**: n8n-nodes-emailconnect | **Version**: 0.2.4 | **Updated**: 2025-08-31

## 📖 Overview

Complete API reference for the EmailConnect n8n community node, covering all operations, parameters, and response formats for both the main EmailConnect node and the EmailConnect Trigger node.

---

## 🔑 Authentication

### EmailConnect API Credentials

**Credential Type**: `EmailConnectApi`  
**Authentication Method**: Header-based (X-API-KEY)  
**Required Scope**: "API User"

```json
{
  "name": "EmailConnect API",
  "type": "generic",
  "properties": {
    "apiKey": {
      "displayName": "API Key",
      "name": "apiKey",
      "type": "string",
      "required": true,
      "typeOptions": {
        "password": true
      }
    }
  }
}
```

**Setup Instructions**:
1. Register at [EmailConnect](https://emailconnect.eu/register)
2. Get API key from [Settings](https://emailconnect.eu/settings)
3. Ensure key has "API User" scope permissions

---

## 📋 EmailConnect Main Node

**Node ID**: `n8n-nodes-emailconnect.emailConnect`  
**File**: [`nodes/EmailConnect/EmailConnect.node.ts`](../nodes/EmailConnect/EmailConnect.node.ts)  
**Purpose**: Primary operations node for domain/alias/webhook management

### Resources & Operations Matrix

| Resource | Operations | Description |
|----------|------------|-------------|
| **Domain** | `getAll`, `get`, `getStatus`, `updateConfig` | Domain management and status |
| **Alias** | `getAll`, `get`, `create`, `update`, `delete` | Email alias CRUD operations |
| **Webhook** | `getAll`, `get`, `create`, `update`, `delete` | Webhook configuration management |

---

## 🏗️ Domain Operations

### **Get All Domains**
**Operation**: `getAll`  
**Method**: `GET /api/domains`  
**Description**: Retrieves all domains configured in your EmailConnect account

**Parameters**: None

**Response**:
```json
{
  "domains": [
    {
      "id": "domain-uuid",
      "domainName": "example.com",
      "status": "verified",
      "webhook": {
        "id": "webhook-uuid",
        "url": "https://webhook.example.com"
      },
      "aliases": [...]
    }
  ]
}
```

**n8n Output**: Array of domain objects

---

### **Get Domain**
**Operation**: `get`  
**Method**: `GET /api/domains/{domainId}`  
**Description**: Retrieves detailed information for a specific domain

**Parameters**:
```json
{
  "domainId": {
    "displayName": "Domain ID",
    "name": "domainId",
    "type": "string",
    "required": true,
    "description": "The ID of the domain to retrieve"
  }
}
```

**Response**:
```json
{
  "id": "domain-uuid",
  "domain": "example.com",
  "webhookUrl": "https://webhook.example.com",
  "active": true,
  "allowAttachments": true,
  "includeEnvelopeData": false
}
```

---

### **Get Domain Status**
**Operation**: `getStatus`  
**Method**: `GET /api/domains/{domainId}/status`  
**Description**: Checks domain verification and DNS status

**Parameters**:
```json
{
  "domainId": {
    "displayName": "Domain ID",
    "name": "domainId",
    "type": "string",
    "required": true
  }
}
```

**Response**:
```json
{
  "domain": "example.com",
  "status": "verified",
  "mxRecord": {
    "required": "mx.emailconnect.eu",
    "current": "mx.emailconnect.eu",
    "status": "valid"
  },
  "spfRecord": {
    "required": "v=spf1 include:spf.emailconnect.eu ~all",
    "current": "v=spf1 include:spf.emailconnect.eu ~all",
    "status": "valid"
  }
}
```

---

### **Update Domain Configuration**
**Operation**: `updateConfig`  
**Method**: `PUT /api/domains/{domainId}`  
**Description**: Updates domain configuration settings

**Parameters**:
```json
{
  "domainId": {
    "displayName": "Domain ID",
    "name": "domainId",
    "type": "string",
    "required": true
  },
  "allowAttachments": {
    "displayName": "Allow Attachments",
    "name": "allowAttachments",
    "type": "boolean",
    "default": true,
    "description": "Whether to allow email attachments"
  },
  "includeEnvelopeData": {
    "displayName": "Include Envelope Data",
    "name": "includeEnvelopeData", 
    "type": "boolean",
    "default": false,
    "description": "Whether to include SMTP envelope data"
  }
}
```

**Request Body**:
```json
{
  "allowAttachments": true,
  "includeEnvelopeData": false
}
```

**Response**: Updated domain configuration object

---

## 📧 Alias Operations

### **Get All Aliases**
**Operation**: `getAll`  
**Method**: `GET /api/aliases?domainId={domainId}`  
**Description**: Lists all aliases for a specific domain

**Parameters**:
```json
{
  "domainId": {
    "displayName": "Domain ID",
    "name": "domainId",
    "type": "options",
    "required": true,
    "typeOptions": {
      "loadOptionsMethod": "getDomains"
    },
    "description": "The domain ID to list aliases for"
  }
}
```

**Response**:
```json
{
  "aliases": [
    {
      "id": "alias-uuid",
      "localPart": "support",
      "email": "support@example.com",
      "destinationEmail": "support@company.com",
      "active": true,
      "webhookId": "webhook-uuid"
    }
  ]
}
```

---

### **Get Alias**
**Operation**: `get`  
**Method**: `GET /api/aliases/{aliasId}`  
**Description**: Retrieves detailed information for a specific alias

**Parameters**:
```json
{
  "aliasId": {
    "displayName": "Alias ID",
    "name": "aliasId",
    "type": "string",
    "required": true,
    "description": "The ID of the alias to retrieve"
  }
}
```

**Response**: Single alias object with detailed information

---

### **Create Alias**
**Operation**: `create`  
**Method**: `POST /api/aliases`  
**Description**: Creates a new email alias

**Parameters**:
```json
{
  "domainId": {
    "displayName": "Domain",
    "name": "domainId",
    "type": "options",
    "required": true,
    "typeOptions": {
      "loadOptionsMethod": "getDomains"
    }
  },
  "aliasName": {
    "displayName": "Alias Name",
    "name": "aliasName",
    "type": "string",
    "required": true,
    "placeholder": "support",
    "description": "The local part of the email alias (before @)"
  },
  "description": {
    "displayName": "Description",
    "name": "description",
    "type": "string",
    "default": "",
    "description": "Optional description of the alias purpose"
  }
}
```

**Request Body**:
```json
{
  "domainId": "domain-uuid",
  "email": "support@example.com",
  "active": true
}
```

**Response**: Created alias object with generated ID

---

### **Update Alias**
**Operation**: `update`  
**Method**: `PUT /api/aliases/{aliasId}`  
**Description**: Updates an existing email alias

**Parameters**:
```json
{
  "aliasId": {
    "displayName": "Alias ID",
    "name": "aliasId",
    "type": "string",
    "required": true
  },
  "aliasName": {
    "displayName": "Alias Name",
    "name": "aliasName",
    "type": "string",
    "description": "New alias name (local part)"
  },
  "description": {
    "displayName": "Description",
    "name": "description",
    "type": "string",
    "description": "New description"
  }
}
```

**Response**: Updated alias object

---

### **Delete Alias**
**Operation**: `delete`  
**Method**: `DELETE /api/aliases/{aliasId}`  
**Description**: Deletes an email alias

**Parameters**:
```json
{
  "aliasId": {
    "displayName": "Alias ID",
    "name": "aliasId",
    "type": "string",
    "required": true
  }
}
```

**Response**: Success confirmation message

---

## 🔗 Webhook Operations

### **Get All Webhooks**
**Operation**: `getAll`  
**Method**: `GET /api/webhooks`  
**Description**: Retrieves all webhook configurations

**Parameters**:
```json
{
  "domainId": {
    "displayName": "Domain Filter",
    "name": "domainId",
    "type": "options",
    "required": false,
    "typeOptions": {
      "loadOptionsMethod": "getDomains"
    },
    "description": "Optional: Filter webhooks by domain"
  }
}
```

**Response**:
```json
{
  "webhooks": [
    {
      "id": "webhook-uuid",
      "url": "https://webhook.example.com",
      "description": "Support webhook",
      "verified": true,
      "active": true,
      "domainId": "domain-uuid",
      "aliasIds": ["alias-uuid"]
    }
  ]
}
```

---

### **Get Webhook**
**Operation**: `get`  
**Method**: `GET /api/webhooks/{webhookId}`  
**Description**: Retrieves detailed information for a specific webhook

**Parameters**:
```json
{
  "webhookId": {
    "displayName": "Webhook ID",
    "name": "webhookId",
    "type": "string",
    "required": true
  }
}
```

**Response**: Single webhook object with details

---

### **Create Webhook**
**Operation**: `create`  
**Method**: `POST /api/webhooks`  
**Description**: Creates a new webhook configuration

**Parameters**:
```json
{
  "domainId": {
    "displayName": "Domain",
    "name": "domainId",
    "type": "options",
    "typeOptions": {
      "loadOptionsMethod": "getDomains"
    }
  },
  "aliasId": {
    "displayName": "Alias",
    "name": "aliasId",
    "type": "options",
    "typeOptions": {
      "loadOptionsMethod": "getAliases",
      "loadOptionsDependsOn": ["domainId"]
    }
  },
  "url": {
    "displayName": "Webhook URL",
    "name": "url",
    "type": "string",
    "required": true,
    "placeholder": "https://your-webhook.example.com/hook"
  },
  "description": {
    "displayName": "Description",
    "name": "description",
    "type": "string",
    "placeholder": "Webhook description"
  }
}
```

**Request Body**:
```json
{
  "url": "https://webhook.example.com",
  "description": "Support webhook",
  "domainId": "domain-uuid",
  "aliasId": "alias-uuid"
}
```

**Response**: Created webhook object with generated ID

---

### **Update Webhook**
**Operation**: `update`  
**Method**: `PUT /api/webhooks/{webhookId}`  
**Description**: Updates an existing webhook configuration

**Parameters**:
```json
{
  "webhookId": {
    "displayName": "Webhook ID",
    "name": "webhookId",
    "type": "string",
    "required": true
  },
  "url": {
    "displayName": "Webhook URL",
    "name": "url",
    "type": "string"
  },
  "description": {
    "displayName": "Description",
    "name": "description",
    "type": "string"
  }
}
```

**Response**: Updated webhook object

---

### **Delete Webhook**
**Operation**: `delete`  
**Method**: `DELETE /api/webhooks/{webhookId}`  
**Description**: Deletes a webhook configuration

**Parameters**:
```json
{
  "webhookId": {
    "displayName": "Webhook ID",
    "name": "webhookId",
    "type": "string",
    "required": true
  }
}
```

**Response**: Success confirmation message

---

## 🔔 EmailConnect Trigger Node

**Node ID**: `n8n-nodes-emailconnect.emailConnectTrigger`  
**File**: [`nodes/EmailConnectTrigger/EmailConnectTrigger.node.ts`](../nodes/EmailConnectTrigger/EmailConnectTrigger.node.ts)  
**Purpose**: Webhook-based email processing triggers

### Configuration Parameters

### **Domain Selection**
```json
{
  "domainId": {
    "displayName": "Domain",
    "name": "domainId",
    "type": "options",
    "required": true,
    "typeOptions": {
      "loadOptionsMethod": "getDomains"
    },
    "description": "Select the domain to monitor for emails"
  }
}
```

### **Alias Mode Selection**
```json
{
  "aliasMode": {
    "displayName": "Alias Mode",
    "name": "aliasMode",
    "type": "options",
    "required": true,
    "options": [
      {
        "name": "Create New Alias",
        "value": "create",
        "description": "Create a new email alias with webhook"
      },
      {
        "name": "Use Existing Alias", 
        "value": "existing",
        "description": "Use an existing alias and update its webhook"
      },
      {
        "name": "Use Domain Catch-All",
        "value": "catchall",
        "description": "Use catch-all alias (*@domain.com) for the domain"
      }
    ],
    "default": "create"
  }
}
```

### **Create Mode Parameters**
```json
{
  "newAliasLocalPart": {
    "displayName": "Alias Local Part",
    "name": "newAliasLocalPart",
    "type": "string",
    "required": true,
    "placeholder": "support",
    "description": "The part before @ (e.g., 'support' for support@domain.com)",
    "displayOptions": {
      "show": {
        "aliasMode": ["create"]
      }
    }
  }
}
```

### **Existing Mode Parameters**
```json
{
  "existingAliasId": {
    "displayName": "Existing Alias",
    "name": "existingAliasId",
    "type": "options",
    "required": true,
    "typeOptions": {
      "loadOptionsMethod": "getAliases",
      "loadOptionsDependsOn": ["domainId"]
    },
    "displayOptions": {
      "show": {
        "aliasMode": ["existing"]
      }
    }
  }
}
```

### **Webhook Configuration**
```json
{
  "webhookName": {
    "displayName": "Webhook Name",
    "name": "webhookName", 
    "type": "string",
    "required": true,
    "placeholder": "Support Email Webhook",
    "description": "A descriptive name for the webhook"
  },
  "webhookDescription": {
    "displayName": "Webhook Description",
    "name": "webhookDescription",
    "type": "string",
    "default": "",
    "description": "Optional description of the webhook purpose"
  }
}
```

---

## 📨 Webhook Data Structure

### **Received Email Data**
When an email is processed through EmailConnect, the trigger node outputs:

```json
{
  "id": "email-processing-id",
  "domainId": "domain-uuid",
  "receivedAt": "2025-08-31T10:30:00Z",
  "sender": "user@example.com",
  "recipient": "support@yourdomain.com",
  "subject": "Email subject line",
  "status": "email.received",
  "payload": {
    "headers": {
      "from": "user@example.com",
      "to": "support@yourdomain.com",
      "subject": "Email subject line",
      "date": "Sat, 31 Aug 2025 10:30:00 +0000",
      "message-id": "<message-id@example.com>",
      "content-type": "multipart/mixed"
    },
    "text": "Plain text content of the email",
    "html": "<p>HTML content of the email</p>",
    "attachments": [
      {
        "filename": "document.pdf",
        "contentType": "application/pdf",
        "size": 12345,
        "data": "base64-encoded-content"
      }
    ]
  },
  "envelope": {
    "from": "user@example.com",
    "to": ["support@yourdomain.com"],
    "helo": "mail.example.com",
    "remoteAddress": "192.168.1.1"
  }
}
```

### **Data Field Descriptions**

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier for the email processing event |
| `domainId` | string | UUID of the domain that received the email |
| `receivedAt` | string (ISO 8601) | Timestamp when EmailConnect processed the email |
| `sender` | string | Email address of the sender |
| `recipient` | string | Email address of the recipient (your alias) |
| `subject` | string | Email subject line |
| `status` | string | Processing status (typically "email.received") |
| `payload.headers` | object | Full email headers |
| `payload.text` | string | Plain text content of the email |
| `payload.html` | string | HTML content of the email |
| `payload.attachments` | array | Email attachments (if allowAttachments is enabled) |
| `envelope.from` | string | SMTP envelope sender |
| `envelope.to` | array | SMTP envelope recipients |
| `envelope.helo` | string | HELO/EHLO identifier from sending server |
| `envelope.remoteAddress` | string | IP address of sending server |

---

## 🔧 Load Options Methods

### **getDomains()**
**Purpose**: Populates domain dropdown options  
**Returns**: Array of domain options for UI selection

```json
[
  {
    "name": "example.com (verified)",
    "value": "domain-uuid"
  },
  {
    "name": "test.com (pending)",
    "value": "domain-uuid-2"
  }
]
```

### **getAliases()**
**Purpose**: Populates alias dropdown options based on selected domain  
**Depends On**: `domainId` parameter  
**Returns**: Array of alias options for UI selection

```json
[
  {
    "name": "support@example.com",
    "value": "alias-uuid-1"
  },
  {
    "name": "info@example.com", 
    "value": "alias-uuid-2"
  }
]
```

---

## ⚠️ Error Handling

### **Common Error Responses**

**Invalid API Key**:
```json
{
  "error": "Unauthorized",
  "message": "Invalid API key",
  "statusCode": 401
}
```

**Domain Not Found**:
```json
{
  "error": "Not Found",
  "message": "Domain not found",
  "statusCode": 404
}
```

**Validation Error**:
```json
{
  "error": "Bad Request",
  "message": "Validation failed",
  "details": {
    "field": "email",
    "issue": "Invalid email format"
  },
  "statusCode": 400
}
```

**Permission Error**:
```json
{
  "error": "Forbidden", 
  "message": "Insufficient permissions",
  "statusCode": 403
}
```

### **Error Handling in n8n Nodes**
All API errors are wrapped and re-thrown with additional context:
- Original error message preserved
- HTTP status code included
- Operation context added
- User-friendly error descriptions provided

---

## 🔗 Related Documentation

- **User Guide**: [`README.md`](../README.md)
- **Technical Analysis**: [`docs/TODO.md`](../docs/TODO.md)
- **Implementation Summary**: [`docs/IMPLEMENTATION_SUMMARY.md`](../docs/IMPLEMENTATION_SUMMARY.md)
- **API Differences**: [`docs/api-differences.md`](../docs/api-differences.md)
- **Source Code**: [`nodes/`](../nodes/) directory

---

## 📋 API Permissions Summary

**API User Scope** limitations:
- ✅ Full access to aliases and webhooks
- ✅ Read access to domains and status
- ✅ Limited domain configuration updates
- ❌ Cannot create or delete domains (dashboard only)

For complete API specification, refer to [`emailconnect-openapi.json`](../emailconnect-openapi.json).

---

*This API reference covers all operations available in the n8n-nodes-emailconnect package. For implementation examples and troubleshooting, refer to the main [README.md](../README.md).*