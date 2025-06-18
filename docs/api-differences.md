# EmailConnect API Differences & TODOs

This document tracks differences between the current OpenAPI spec and the actual implementation needed for the n8n node.

## Domain Operations - Actual Implementation

### Supported Operations (n8n node will implement):
- ✅ `GET /api/domains` - List user domains
- ✅ `GET /api/domains/{domainId}` - Get domain details  
- ✅ `GET /api/domains/{domainId}/status` - Check verification status
- ✅ `PUT /api/domains/{domainId}` - Update domain configuration

### NOT Supported (excluded from n8n node):
- ❌ `POST /api/domains` - Add new domain (requires MX/TXT validation)
- ❌ `DELETE /api/domains/{domainId}` - Delete domain
- ❌ `POST /api/domains/{domainId}/verify` - Trigger verification

**Rationale**: Domain creation requires DNS validation which is better handled through the EmailConnect web interface.

## Domain Configuration Update (PUT /api/domains/{domainId})

### Configuration Options:
- `allowAttachments` (boolean) - Whether to include email attachments in webhook payload
- `includeEnvelopeData` (boolean) - Whether to include SMTP envelope data in webhook payload

**Note**: These are stored in the `configuration` JSONB column.

## TODOs for EmailConnect API Documentation

1. **Add PUT /api/domains/{domainId} endpoint** to OpenAPI spec
   - Request body should include configuration options
   - Document the JSONB configuration structure
   
2. **Update domain schema** to include configuration field
   - Add `configuration` object with `allowAttachments` and `includeEnvelopeData` properties

3. **Remove or mark as admin-only** the domain creation/deletion endpoints if they shouldn't be available to regular API users

## n8n Node Design Decisions

- **Domain Management**: Read-only operations + configuration updates only
- **Alias Management**: Full CRUD operations as specified
- **Webhook Management**: Full CRUD operations as specified
- **Trigger Node**: Receives webhook data from EmailConnect service

## Email Flow Architecture

```
Email → EmailConnect Processing → Webhook → n8n Automation
```

- EmailConnect handles email processing complexity
- n8n handles automation workflows  
- Clean separation of concerns
- Users can route different aliases to different webhooks/workflows
