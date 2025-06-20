# EmailConnect n8n Node Analysis & Implementation Plan

## Executive Summary

Based on analysis of the current n8n node implementation and backend API, we've identified four key areas for improvement:

1. **User Experience**: Need better guidance for registration and API key setup
2. **Catch-all Alias Validation**: Backend JSON schema rejects `*@domain.com` format
3. **Webhook Synchronization**: Catch-all aliases should sync with domain webhooks
4. **New Alias Creation**: Frontend logic preventing POST requests

## Recommended Implementation Approach

**Backend-Focused Solution**: Create new specialized endpoints that handle the complexity, rather than trying to fix multiple frontend API calls. This approach offers:
- Simplified n8n node logic
- Better error handling and validation
- Centralized webhook synchronization logic
- Reduced API call complexity

---

# EmailConnect API Schema Issues & TODO Items

## API Schema Discrepancies (Backend/Schema Updates Needed)

### 1. Alias Creation API Schema Mismatch

**Issue**: The OpenAPI schema for alias creation doesn't match the actual API behavior.

**Current Schema** (`CreateAliasPayload`):
```json
{
  "localPart": "string",
  "destinationEmail": "string (email format)"
}
```

**Actual API Requirements** (discovered through testing):
```json
{
  "domainId": "string (uuid)",
  "email": "string (full email address)",
  "webhookId": "string (uuid)",
  "active": "boolean (default: true)"
}
```

**Problems**:
- Missing `domainId` field in schema (causes validation error)
- Missing `webhookId` field in schema (causes validation error)
- Wrong field names (`localPart`/`destinationEmail` vs `email`)
- API expects full email address, not separate parts
- API requires webhook to be assigned during alias creation, not separately

### 2. Query Parameter vs Body Parameter Confusion

**Issue**: Schema shows `domainId` as query parameter only, but API requires it in both places.

**Current**: `POST /api/aliases?domainId={id}` with body containing other fields
**Actual**: `POST /api/aliases` with `domainId` in BOTH query AND body

### 3. Webhook-Only Alias Support

**Issue**: No documented way to create aliases that only use webhooks (no email forwarding).

**Current Workaround**: We construct full email addresses like `support@domain.com` or `*@domain.com`
**Need**: Clarify if this is the intended approach or if there should be a webhook-only mode

### 4. Catch-All Alias Creation

**Issue**: No documentation on how to create catch-all aliases.

**Working Solution**: Use `email: "*@domain.com"` in request body
**Need**: Document this pattern in the API schema and examples

### 5. Email Address Construction

**Issue**: Unclear whether API expects full email addresses or separate components.

**Reality**: API expects full email addresses in `email` field
**Schema Shows**: Separate `localPart` and `destinationEmail` fields

## Recommended Schema Updates

### Update `CreateAliasPayload` Schema:
```json
{
  "type": "object",
  "properties": {
    "domainId": {
      "type": "string",
      "format": "uuid",
      "description": "Domain ID for the alias"
    },
    "email": {
      "type": "string",
      "format": "email",
      "description": "Full email address for the alias (e.g., 'support@domain.com' or '*@domain.com' for catch-all)",
      "example": "support@example.com"
    }
  },
  "required": ["domainId", "email"]
}
```

### Add Catch-All Example:
```json
{
  "domainId": "123e4567-e89b-12d3-a456-426614174000",
  "email": "*@example.com"
}
```

### Update API Documentation:
- Clarify that `domainId` is required in both query parameter and request body
- Document catch-all alias creation pattern
- Explain webhook-only vs email-forwarding behavior
- Add examples for common use cases

## n8n Node Implementation Notes

### Current Working Implementation:
1. **Domain Catch-All**: Creates `*@domain.com` alias automatically
2. **Existing Alias**: User selects from dropdown of existing aliases
3. **Create New Alias**: User enters local part, system creates `localpart@domain.com`

### Webhook Synchronization:
- Domain webhooks and catch-all alias webhooks are kept synchronized
- When updating one, the other is automatically updated to match
- Proper cleanup restores both webhooks when node is deleted

### API Call Format That Works:
```javascript
const aliasData = { 
  domainId: "uuid-string",
  email: "support@domain.com"  // or "*@domain.com" for catch-all
};
await emailConnectApiRequest.call(this, 'POST', '/api/aliases', aliasData);
```

## Testing Notes

The following errors were encountered during development:
1. `"body must have required property 'email'"` - Fixed by using `email` field
2. `"body must have required property 'domainId'"` - Fixed by including `domainId` in body
3. Various validation errors when following the documented schema

These issues significantly slowed development and required trial-and-error to discover the correct API format.

### 6. Webhook Assignment Endpoints Missing from Schema

**Issue**: Webhook assignment endpoints are completely missing from the OpenAPI schema.

**Missing Endpoints**:
- `PUT /api/domains/{domainId}/webhook` - Assign webhook to domain
- `PUT /api/aliases/{aliasId}/webhook` - Assign webhook to alias

**Current Error**: `"body must have required property 'webhookId'"` even when sending `{ webhookId: "uuid" }`

**Possible Issues**:
- Field name might be different (`webhook_id`, `id`, etc.)
- Additional required fields not documented
- Different request body structure expected
- Endpoints might not exist or have different paths

**Impact**: Cannot assign webhooks to domains/aliases, making trigger functionality impossible

### 7. Domain API Field Inconsistency

**Issue**: Domain API endpoints return different field names for the domain name.

**Inconsistency**:
- `GET /api/domains` (list): Returns `domainName` field
- `GET /api/domains/{id}` (single): Returns `domain` field

**Example**:
```json
// List endpoint response
{
  "domains": [
    {
      "id": "cmbw6hopl002uru1qqyx7b18a",
      "domainName": "in.xadi.nl",  // ← domainName field
      "webhook": {...}
    }
  ]
}

// Single endpoint response
{
  "id": "cmbw6hopl002uru1qqyx7b18a",
  "domain": "in.xadi.nl",  // ← domain field (different!)
  "webhookUrl": "...",
  "active": true
}
```

**Impact**: Caused `"*@undefined"` errors in catch-all alias creation when code expected `domainName` but API returned `domain`.

**Fix Applied**: Code now checks for both `domain.domain || domain.domainName` to handle inconsistency.

### 8. Confusing destinationEmail Field in Domain Aliases

**Issue**: Domain API response includes aliases with misleading `destinationEmail` field.

**Confusing Structure**:
```json
{
  "aliases": [
    {
      "id": "cmbw6hopp002wru1qk18cowjg",
      "localPart": "*",
      "destinationEmail": "https://webhook.site/6b7d9270-c1fd-4ac6-bdb4-731a6c7018fc",
      "webhookName": "18fc",
      "active": true
    }
  ]
}
```

**Problems**:
- Field named `destinationEmail` but contains webhook URL, not email address
- Misleading for developers who expect actual email addresses
- Inconsistent with EmailConnect's webhook-only routing model

**Recommendation**: Rename field to `webhookUrl` or `destination` to clarify it's not an email address.

## Priority

**Critical Priority**:
1. Document webhook assignment endpoints in OpenAPI schema
2. Update alias creation schema to match actual API behavior
3. Fix domain API field inconsistency (`domainName` vs `domain`)
4. Add proper examples and field documentation

**High Priority**:
1. Rename misleading `destinationEmail` field in alias responses
2. Update remaining schema discrepancies to improve developer experience and prevent integration issues

**Fixed in n8n Node v0.1.18**:
- ✅ Domain API field inconsistency handled with fallback logic
- ✅ Catch-all alias creation now works correctly
- ✅ Better error messages for domain API issues

---

# Detailed Analysis & Implementation Plan

## Issue 1: User Experience & Marketing

### Problem
- High download count but low signup conversion
- Users need guidance to registration and API key setup
- USPs not prominently displayed

### Root Cause Analysis
The n8n node lacks user guidance about:
- Where to register (https://emailconnect.eu/register)
- Where to get API keys (https://emailconnect.eu/settings)
- Key value propositions (100% EU operated, multi-alias support, free 50 emails/month)

### Recommended Solution
Enhance n8n node with user guidance using n8n's built-in UI capabilities:

1. **Add Notice Field** with USPs and registration info
2. **Parameter Hints** for API key field
3. **Enhanced Descriptions** with links
4. **Node-level Hints** for first-time setup

### Implementation Details
```typescript
// Add to node properties
{
  displayName: 'Getting Started',
  name: 'gettingStarted',
  type: 'notice',
  default: '',
  displayOptions: {
    show: {
      '@version': [1] // Show only for new nodes
    }
  },
  typeOptions: {
    theme: 'info'
  },
  description: `
    <strong>🇪🇺 100% EU-operated email service</strong><br/>
    • Multi-alias support for organized email routing<br/>
    • Free to start: 50 emails per month<br/>
    <br/>
    <strong>Quick Setup:</strong><br/>
    1. <a href="https://emailconnect.eu/register" target="_blank">Register your account</a><br/>
    2. <a href="https://emailconnect.eu/settings" target="_blank">Get your API key</a><br/>
    3. Configure your domain and aliases below
  `
}
```

## Issue 2: Catch-all Alias Validation

### Problem
Backend JSON schema validation rejects `*@domain.com` format due to `format: 'email'` constraint.

### Root Cause Analysis
The issue is in `/src/backend/schemas/user/alias.schemas.ts`:
```typescript
email: {
  type: 'string',
  format: 'email',  // This rejects *@domain.com
  description: 'Full email address (e.g., support@domain.com)'
}
```

The `format: 'email'` uses strict RFC email validation that doesn't allow `*` in the local part.

### Recommended Solutions

#### Option A: Custom Email Validation (Preferred)
Remove `format: 'email'` and implement custom validation in the service layer:

```typescript
// In alias.schemas.ts
email: {
  type: 'string',
  description: 'Full email address or catch-all pattern (e.g., support@domain.com or *@domain.com)'
}

// In alias.service.ts
function isValidEmailOrCatchAll(email: string): boolean {
  // Allow catch-all format
  if (email.match(/^\*@[^\s@]+\.[^\s@]+$/)) {
    return true;
  }
  // Standard email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
```

#### Option B: New Specialized Endpoint (Recommended)
Create `POST /api/webhooks/alias` endpoint that handles both regular and catch-all aliases:

```typescript
// New endpoint: POST /api/webhooks/alias
interface CreateWebhookAliasRequest {
  domainId: string;
  webhookUrl: string;
  webhookName: string;
  aliasType: 'catchall' | 'specific';
  localPart?: string; // Only for specific aliases
  syncWithDomain?: boolean; // For catch-all aliases
}
```

## Issue 3: Webhook Synchronization

### Problem
Catch-all aliases should synchronize webhooks with domain webhooks, but currently don't.

### Root Cause Analysis
The current implementation creates catch-all aliases but doesn't implement the bidirectional synchronization logic mentioned in the memories.

### Recommended Solution
Implement webhook synchronization in the backend service layer:

```typescript
// In alias.service.ts
async createCatchAllAlias(data: CreateAliasData & { syncWithDomain: boolean }) {
  // Create catch-all alias
  const alias = await this.createAlias(data);

  if (data.syncWithDomain) {
    // Update domain webhook to match
    await this.domainService.updateDomainWebhook(data.domainId, data.webhookId);

    // Set up bidirectional sync triggers
    await this.setupWebhookSync(data.domainId, alias.id);
  }

  return alias;
}

async setupWebhookSync(domainId: string, catchAllAliasId: string) {
  // Store sync relationship in database
  await prisma.webhookSync.create({
    data: {
      domainId,
      catchAllAliasId,
      syncEnabled: true
    }
  });
}
```

## Issue 4: New Alias Creation Failure

### Problem
No POST request being made when trying to create new aliases in the n8n node.

### Root Cause Analysis
Looking at the server logs, only GET requests to `/api/webhooks` are being made, suggesting the frontend logic isn't triggering the alias creation POST request.

### Investigation Needed
1. Check if the `newAliasLocalPart` parameter is being properly captured
2. Verify the conditional logic in the trigger node creation flow
3. Ensure the alias creation code path is being executed

### Recommended Solution
Debug and fix the existing logic, or implement the new specialized endpoint approach which would simplify this flow significantly.

## Proposed New Backend Endpoint

### Endpoint: `POST /api/webhooks/alias`

This endpoint would handle the complete workflow of creating a webhook and alias in one atomic operation:

```typescript
interface CreateWebhookAliasRequest {
  domainId: string;
  webhookUrl: string;
  webhookName: string;
  webhookDescription?: string;
  aliasType: 'catchall' | 'specific';
  localPart?: string; // Required for 'specific', ignored for 'catchall'
  syncWithDomain?: boolean; // For catch-all aliases
  autoVerify?: boolean; // Auto-verify webhook using last 5 chars of ID
}

interface CreateWebhookAliasResponse {
  success: boolean;
  webhook: {
    id: string;
    url: string;
    verified: boolean;
    verificationToken?: string;
  };
  alias: {
    id: string;
    email: string;
    active: boolean;
  };
  domain?: {
    id: string;
    webhookUpdated: boolean; // If syncWithDomain was used
  };
  message: string;
}
```

### Benefits of This Approach
1. **Atomic Operations**: Webhook and alias creation in single transaction
2. **Custom Validation**: Handle catch-all format without schema conflicts
3. **Automatic Synchronization**: Built-in domain/catch-all webhook sync
4. **Simplified n8n Logic**: Single API call instead of multiple
5. **Better Error Handling**: Rollback on failure
6. **Auto-verification**: Handle webhook verification automatically

## Implementation Priority

### Phase 1: Quick Wins (1-2 days) ✅ COMPLETED
1. **User Experience Improvements**: Add notice fields and hints to n8n node ✅
2. **Documentation**: Update TODO.md with current findings ✅

#### Phase 1 Changes Implemented:
- **Welcome Notice**: Added prominent info box with USPs and registration links
- **Enhanced Descriptions**: Improved all field descriptions with clearer guidance
- **Parameter Hints**: Added contextual hints for better user understanding
- **Credential Guidance**: Enhanced API key setup with step-by-step instructions
- **Better Placeholders**: Updated examples to follow n8n conventions

#### Files Modified:
- `nodes/EmailConnectTrigger/EmailConnectTrigger.node.ts`: Enhanced UI guidance
- `credentials/EmailConnectApi.credentials.ts`: Added setup instructions
- `docs/TODO.md`: Comprehensive analysis and implementation plan

### Phase 2: Backend Enhancements (3-5 days)
1. **New Endpoint**: Implement `POST /api/webhooks/alias`
2. **Custom Validation**: Update email validation for catch-all support
3. **Webhook Synchronization**: Implement bidirectional sync logic

### Phase 3: Frontend Updates (2-3 days)
1. **n8n Node Updates**: Simplify logic to use new endpoint
2. **Testing**: Comprehensive testing of all three alias modes
3. **Error Handling**: Improve error messages and user feedback

### Phase 4: Documentation & Cleanup (1 day)
1. **API Documentation**: Update OpenAPI specs
2. **User Documentation**: Update n8n node documentation
3. **Code Cleanup**: Remove deprecated code paths

## Testing Strategy

### Test Cases to Implement
1. **Catch-all Creation**: Verify `*@domain.com` aliases work
2. **Webhook Synchronization**: Test domain/catch-all webhook sync
3. **New Alias Creation**: Verify POST requests are made
4. **Error Scenarios**: Test validation and error handling
5. **User Experience**: Test guidance and setup flow

### Recommended Testing Approach
1. **Unit Tests**: Backend service layer validation
2. **Integration Tests**: Full API endpoint testing
3. **E2E Tests**: Complete n8n node workflow testing
4. **User Testing**: Real-world setup scenarios

## Next Steps

1. **Discuss Approach**: Review this analysis and confirm preferred implementation strategy
2. **Prioritize Issues**: Decide which issues to tackle first
3. **Resource Allocation**: Determine backend vs frontend development focus
4. **Timeline Planning**: Set realistic milestones for each phase

Would you like to proceed with implementing the new backend endpoint approach, or would you prefer to fix the existing frontend logic first?
