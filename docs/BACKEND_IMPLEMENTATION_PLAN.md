# EmailConnect Backend Implementation Plan

## Overview

This document outlines the backend changes needed to support the improved n8n node functionality. These changes should be implemented in the `/home/xander/webapps/mailwebhook` repository.

## Phase 2: Backend Enhancements

### 1. New Atomic Endpoint: `POST /api/webhooks/alias`

Create a new endpoint that handles webhook creation, alias creation, and verification in a single atomic operation.

#### Endpoint Specification

```typescript
// Route: POST /api/webhooks/alias
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

#### Implementation Location

**File**: `/home/xander/webapps/mailwebhook/src/backend/routes/user-webhooks.routes.ts`

Add new route:
```typescript
// Create webhook with alias in atomic operation
fastify.post('/webhooks/alias', {
  preHandler: [userOrApiKeyAuthMiddleware],
  schema: {
    tags: ['User Webhooks'],
    summary: 'Create webhook with alias (atomic operation)',
    description: 'Creates a webhook and alias in a single atomic operation with optional verification and domain sync.',
    body: webhookSchemas.CreateWebhookAliasRequest,
    response: {
      201: webhookSchemas.CreateWebhookAliasResponse,
      400: errorResponseSchema,
      401: { $ref: 'ErrorResponse#' },
      403: errorResponseSchema,
      404: errorResponseSchema,
      409: errorResponseSchema,
      500: errorResponseSchema
    },
  }
}, webhookController.createWebhookWithAlias.bind(webhookController));
```

### 2. Enhanced Email Validation

#### Problem
Current validation rejects `*@domain.com` due to `format: 'email'` constraint.

#### Solution
**File**: `/home/xander/webapps/mailwebhook/src/backend/schemas/user/alias.schemas.ts`

```typescript
// Update CreateAliasRequest schema
CreateAliasRequest: {
  type: 'object',
  properties: {
    email: { 
      type: 'string',
      // Remove format: 'email' constraint
      description: 'Full email address or catch-all pattern (e.g., support@domain.com or *@domain.com)' 
    },
    domainId: { 
      type: 'string', 
      description: 'ID of the domain to create alias for' 
    },
    webhookId: { 
      type: 'string', 
      description: 'ID of the webhook to use for this alias' 
    },
    active: { type: 'boolean', default: true }
  },
  required: ['email', 'domainId', 'webhookId']
}
```

**File**: `/home/xander/webapps/mailwebhook/src/backend/services/user/alias.service.ts`

```typescript
// Update validation function
function isValidEmailOrCatchAll(email: string): boolean {
  // Allow catch-all format
  if (email.match(/^\*@[^\s@]+\.[^\s@]+$/)) {
    return true;
  }
  // Standard email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Update createAlias method
async createAlias(data: CreateAliasData) {
  // Replace isValidEmail with isValidEmailOrCatchAll
  if (!isValidEmailOrCatchAll(data.email)) {
    throw new Error('Invalid email format');
  }
  // ... rest of method
}
```

### 3. Webhook Synchronization Logic

#### Problem
Catch-all aliases should synchronize webhooks with domain webhooks bidirectionally.

#### Solution
**File**: `/home/xander/webapps/mailwebhook/src/backend/services/user/webhook.service.ts`

```typescript
// Add new method for webhook synchronization
async createWebhookWithAlias(data: CreateWebhookAliasData, userId: string) {
  const transaction = await prisma.$transaction(async (tx) => {
    // 1. Create webhook
    const webhook = await this.createWebhook({
      name: data.webhookName,
      url: data.webhookUrl,
      description: data.webhookDescription,
      userId
    });

    // 2. Create alias
    const aliasEmail = data.aliasType === 'catchall' 
      ? `*@${domain.domain}` 
      : `${data.localPart}@${domain.domain}`;

    const alias = await this.aliasService.createAlias({
      email: aliasEmail,
      domainId: data.domainId,
      webhookId: webhook.webhook.id,
      userId
    });

    // 3. Handle catch-all synchronization
    if (data.aliasType === 'catchall' && data.syncWithDomain) {
      await this.setupWebhookSync(data.domainId, alias.alias.id, webhook.webhook.id);
    }

    // 4. Auto-verify if requested
    if (data.autoVerify) {
      const verificationToken = webhook.webhook.id.slice(-5);
      await this.completeWebhookVerification(webhook.webhook.id, userId, verificationToken);
    }

    return { webhook, alias };
  });

  return transaction;
}

async setupWebhookSync(domainId: string, catchAllAliasId: string, webhookId: string) {
  // Update domain webhook
  await this.domainService.updateDomainWebhook(domainId, webhookId);
  
  // Store sync relationship
  await prisma.webhookSync.create({
    data: {
      domainId,
      catchAllAliasId,
      webhookId,
      syncEnabled: true
    }
  });
}
```

### 4. Database Schema Updates

#### New Table for Webhook Synchronization
**File**: `/home/xander/webapps/mailwebhook/prisma/schema.prisma`

```prisma
model WebhookSync {
  id              String   @id @default(cuid())
  domainId        String
  catchAllAliasId String
  webhookId       String
  syncEnabled     Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  domain    Domain  @relation(fields: [domainId], references: [id], onDelete: Cascade)
  alias     Alias   @relation(fields: [catchAllAliasId], references: [id], onDelete: Cascade)
  webhook   Webhook @relation(fields: [webhookId], references: [id], onDelete: Cascade)

  @@unique([domainId, catchAllAliasId])
  @@map("webhook_syncs")
}
```

### 5. Controller Implementation

**File**: `/home/xander/webapps/mailwebhook/src/backend/controllers/user/webhooks.controller.ts`

```typescript
async createWebhookWithAlias(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = (request as any).user;
    const data = request.body as CreateWebhookAliasRequest;

    const result = await this.webhookService.createWebhookWithAlias(data, user.id);

    return reply.status(201).send({
      success: true,
      webhook: {
        id: result.webhook.webhook.id,
        url: result.webhook.webhook.url,
        verified: result.webhook.webhook.verified
      },
      alias: {
        id: result.alias.alias.id,
        email: result.alias.alias.email,
        active: result.alias.alias.active
      },
      message: 'Webhook and alias created successfully'
    });
  } catch (error) {
    return reply.status(400).send({
      statusCode: 400,
      error: 'Bad Request',
      message: error.message
    });
  }
}
```

## Implementation Steps

### Step 1: Schema Updates
1. Add new schemas to `webhook.schemas.ts`
2. Update alias validation in `alias.schemas.ts`
3. Create database migration for `WebhookSync` table

### Step 2: Service Layer
1. Update `alias.service.ts` with enhanced validation
2. Add atomic operation method to `webhook.service.ts`
3. Implement synchronization logic

### Step 3: Controller & Routes
1. Add new controller method
2. Register new route
3. Update OpenAPI documentation

### Step 4: Testing
1. Unit tests for new validation logic
2. Integration tests for atomic endpoint
3. E2E tests for synchronization

## Benefits

1. **Atomic Operations**: No partial state if something fails
2. **Simplified n8n Logic**: Single API call instead of multiple
3. **Better Error Handling**: Comprehensive rollback on failure
4. **Catch-all Support**: Proper validation for `*@domain.com`
5. **Webhook Sync**: Automatic bidirectional synchronization
6. **Auto-verification**: Streamlined setup process

## Next Steps

1. Review this implementation plan
2. Create feature branch in mailwebhook repository
3. Implement changes step by step
4. Test thoroughly with n8n node
5. Update n8n node to use new endpoint (Phase 3)
