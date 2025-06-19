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

## Priority

**Critical Priority**:
1. Document webhook assignment endpoints in OpenAPI schema
2. Update alias creation schema to match actual API behavior
3. Add proper examples and field documentation

**High Priority**: Update remaining schema discrepancies to improve developer experience and prevent integration issues.
