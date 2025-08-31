# EmailConnect n8n Node: Developer Guide

**Project**: n8n-nodes-emailconnect | **Version**: 0.2.4 | **Updated**: 2025-08-31

## 🎯 Overview

Complete developer guide for extending, modifying, and contributing to the EmailConnect n8n community node. This guide covers the technical architecture, development patterns, and implementation details needed for advanced customization.

---

## 🏗️ Architecture Deep Dive

### **Component Architecture**
```
┌─────────────────────────────────────────────┐
│                 n8n Runtime                 │
├─────────────────────────────────────────────┤
│  EmailConnect Nodes                         │
├─────────────────┬───────────────────────────┤
│ EmailConnect    │ EmailConnectTrigger       │
│ Main Node       │ Trigger Node              │
│ (Operations)    │ (Webhook Events)          │
├─────────────────┼───────────────────────────┤
│       EmailConnectApi Credentials          │
├─────────────────────────────────────────────┤
│         Generic Functions                   │
│         (Shared API Client)                 │
├─────────────────────────────────────────────┤
│              EmailConnect API               │
│              (EU Infrastructure)            │
└─────────────────────────────────────────────┘
```

### **Data Flow Pattern**
```
n8n Workflow → Node Parameters → API Client → EmailConnect API
                     ↓                              ↓
           Parameter Validation            Response Processing
                     ↓                              ↓
            Load Options (Dynamic)         Error Handling
                     ↓                              ↓
              UI Updates                  n8n Output Format
```

---

## 📁 File Structure Analysis

### **Core Node Files**
```
nodes/
├── EmailConnect/
│   ├── EmailConnect.node.ts          # Main operations node (557 lines)
│   │   ├── Node Definition            # n8n node metadata & properties
│   │   ├── Execute Method             # Main execution logic
│   │   ├── Resource Operations        # Domain/Alias/Webhook operations
│   │   └── Load Options Methods       # Dynamic UI population
│   │
│   ├── GenericFunctions.ts            # Shared API client utilities
│   │   ├── emailConnectApiRequest()   # Core API request function
│   │   ├── Error Handling             # Custom error wrapping
│   │   └── Credential Management      # API key handling
│   │
│   └── emailconnect.svg               # Node icon (16x16px SVG)
│
└── EmailConnectTrigger/
    ├── EmailConnectTrigger.node.ts    # Webhook trigger node (985 lines)
    │   ├── Webhook Lifecycle          # Create/Update/Delete webhooks
    │   ├── Alias Management           # Multi-mode alias handling
    │   ├── URL Synchronization        # Test/Production URL switching
    │   └── Domain Synchronization     # Bidirectional webhook sync
    │
    └── emailconnect.svg               # Trigger node icon
```

### **Supporting Infrastructure**
```
credentials/
└── EmailConnectApi.credentials.ts     # n8n credential definition

test/                                  # Test suite (6 files)
├── backend-api.test.js                # API integration tests
├── n8n-node-integration.test.js       # Node functionality tests
└── webhook-*.test.js                  # Webhook lifecycle tests

.github/workflows/                     # CI/CD automation
├── deploy.yml                         # Main deployment pipeline
├── docs.yml                           # Documentation automation
└── automation.yml                     # Additional CI tasks
```

---

## 🔧 Development Environment Setup

### **Prerequisites**
- Node.js ≥20.0.0
- npm ≥8.0.0
- TypeScript knowledge
- n8n development experience (recommended)

### **Installation**
```bash
# Clone the repository
git clone https://github.com/xadi-hq/n8n-nodes-emailconnect.git
cd n8n-nodes-emailconnect

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test

# Start development mode
npm run dev
```

### **Development Scripts**
```bash
# Development & Building
npm run dev          # TypeScript watch mode
npm run build        # Full build (TS + icons)

# Code Quality
npm run lint         # ESLint validation
npm run lintfix      # Auto-fix ESLint issues
npm run format       # Prettier formatting

# Testing
npm run test         # Jest test suite
npm run test:watch   # Watch mode testing

# Publishing
npm run prepublishOnly  # Pre-publish validation
```

---

## 🎨 n8n Node Development Patterns

### **Node Definition Structure**
```typescript
export class EmailConnect implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'EmailConnect',
    name: 'emailConnect',
    icon: 'file:emailconnect.svg',
    group: ['communication'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with EmailConnect API',
    defaults: {
      name: 'EmailConnect',
    },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [
      {
        name: 'emailConnectApi',
        required: true,
      },
    ],
    properties: [
      // Resource selection
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Domain',
            value: 'domain',
          },
          // ... other resources
        ],
        default: 'domain',
      },
      // ... operation and parameter definitions
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    // Implementation logic
  }
}
```

### **Parameter Definition Patterns**

#### **Resource & Operation Selection**
```typescript
// Resource selector (top-level)
{
  displayName: 'Resource',
  name: 'resource',
  type: 'options',
  noDataExpression: true,
  options: [
    { name: 'Domain', value: 'domain' },
    { name: 'Alias', value: 'alias' },
    { name: 'Webhook', value: 'webhook' }
  ],
  default: 'domain'
}

// Operation selector (depends on resource)
{
  displayName: 'Operation',
  name: 'operation',
  type: 'options',
  noDataExpression: true,
  displayOptions: {
    show: {
      resource: ['domain']
    }
  },
  options: [
    { name: 'Get All', value: 'getAll' },
    { name: 'Get', value: 'get' },
    // ... other operations
  ],
  default: 'getAll'
}
```

#### **Dynamic Load Options**
```typescript
// Domain dropdown with dynamic loading
{
  displayName: 'Domain',
  name: 'domainId',
  type: 'options',
  required: true,
  typeOptions: {
    loadOptionsMethod: 'getDomains'
  },
  displayOptions: {
    show: {
      resource: ['alias'],
      operation: ['create', 'getAll']
    }
  }
}

// Load options method implementation
methods = {
  loadOptions: {
    async getDomains(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
      const domains = await emailConnectApiRequest.call(this, 'GET', '/api/domains');
      return domains.domains.map((domain: any) => ({
        name: `${domain.domainName || domain.domain} (${domain.status || 'unknown'})`,
        value: domain.id,
      }));
    }
  }
}
```

#### **Conditional Parameter Display**
```typescript
// Parameter shown only for specific operations
{
  displayName: 'Alias Name',
  name: 'aliasName',
  type: 'string',
  required: true,
  placeholder: 'support',
  displayOptions: {
    show: {
      resource: ['alias'],
      operation: ['create', 'update']
    }
  },
  description: 'The local part of the email alias (before @)'
}
```

### **Load Options Dependencies**
```typescript
// Dependent dropdown (aliases depend on domain)
{
  displayName: 'Alias',
  name: 'aliasId',
  type: 'options',
  required: true,
  typeOptions: {
    loadOptionsMethod: 'getAliases',
    loadOptionsDependsOn: ['domainId']  // Reloads when domainId changes
  }
}

// Implementation with dependency handling
async getAliases(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
  const domainId = this.getCurrentNodeParameter('domainId') as string;
  if (!domainId) {
    return [];
  }
  
  const aliases = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
  return aliases.aliases.map((alias: any) => ({
    name: alias.email || `${alias.localPart}@${alias.domain}`,
    value: alias.id,
  }));
}
```

---

## 🔌 API Client Implementation

### **Generic Functions Pattern**
**File**: [`nodes/EmailConnect/GenericFunctions.ts`](../nodes/EmailConnect/GenericFunctions.ts)

```typescript
import {
  ICredentialDataDecryptedObject,
  IExecuteFunctions,
  IHttpRequestOptions,
  ILoadOptionsFunctions,
  NodeApiError,
} from 'n8n-workflow';

export async function emailConnectApiRequest(
  this: IExecuteFunctions | ILoadOptionsFunctions,
  method: string,
  resource: string,
  body: any = {},
  query: IDataObject = {},
): Promise<any> {
  const credentials = await this.getCredentials('emailConnectApi');
  
  const options: IHttpRequestOptions = {
    method,
    body,
    qs: query,
    uri: `https://emailconnect.eu${resource}`,
    headers: {
      'X-API-KEY': credentials.apiKey,
      'Content-Type': 'application/json',
    },
    json: true,
  };

  try {
    // Add debug logging in development
    if (process.env.NODE_ENV === 'development') {
      console.log('EmailConnect API Request:', {
        method,
        resource,
        body: JSON.stringify(body, null, 2),
        query
      });
    }

    const response = await this.helpers.httpRequest(options);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('EmailConnect API Response:', JSON.stringify(response, null, 2));
    }
    
    return response;
  } catch (error) {
    // Enhanced error handling
    if (error.response?.body) {
      const errorBody = error.response.body;
      throw new NodeApiError(this.getNode(), {
        message: errorBody.message || 'Unknown API error',
        description: `EmailConnect API error: ${errorBody.error || error.message}`,
        httpCode: error.response.statusCode?.toString(),
      });
    }
    
    throw new NodeApiError(this.getNode(), error);
  }
}
```

### **Error Handling Best Practices**
```typescript
// Specific error handling for different scenarios
try {
  const result = await emailConnectApiRequest.call(this, 'POST', '/api/aliases', aliasData);
  return result;
} catch (error) {
  // Handle known error cases
  if (error.httpCode === '409') {
    throw new NodeApiError(this.getNode(), {
      message: 'Alias already exists',
      description: 'An alias with this email address already exists. Use a different email or update the existing alias.',
    });
  } else if (error.httpCode === '422') {
    throw new NodeApiError(this.getNode(), {
      message: 'Invalid alias data',
      description: `Validation failed: ${error.message}. Please check your input parameters.`,
    });
  }
  
  // Re-throw other errors
  throw error;
}
```

---

## 🎣 Webhook Trigger Implementation

### **Trigger Node Structure**
**File**: [`nodes/EmailConnectTrigger/EmailConnectTrigger.node.ts`](../nodes/EmailConnectTrigger/EmailConnectTrigger.node.ts)

```typescript
export class EmailConnectTrigger implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'EmailConnect Trigger',
    name: 'emailConnectTrigger',
    icon: 'file:emailconnect.svg',
    group: ['trigger'],
    version: 1,
    description: 'Starts the workflow when EmailConnect receives an email',
    defaults: {
      name: 'EmailConnect Trigger',
    },
    inputs: [],
    outputs: ['main'],
    credentials: [
      {
        name: 'emailConnectApi',
        required: true,
      },
    ],
    webhooks: [
      {
        name: 'default',
        httpMethod: 'POST',
        responseMode: 'onReceived',
        path: 'emailconnect',
      },
    ],
    properties: [
      // ... trigger-specific parameters
    ],
  };
}
```

### **Webhook Lifecycle Management**
```typescript
// Webhook creation method
async create(this: IHookFunctions): Promise<boolean> {
  const webhookUrl = this.getNodeWebhookUrl('default');
  const aliasMode = this.getNodeParameter('aliasMode') as string;
  
  try {
    if (aliasMode === 'create') {
      // Use new atomic endpoint for creating alias + webhook
      const response = await emailConnectApiRequest.call(this, 'POST', '/api/webhooks/alias', {
        domainId: this.getNodeParameter('domainId'),
        webhookUrl: webhookUrl,
        webhookName: this.getNodeParameter('webhookName'),
        aliasType: 'specific',
        localPart: this.getNodeParameter('newAliasLocalPart'),
        autoVerify: true
      });
      
      // Store IDs for cleanup
      const webhookData = {
        webhookId: response.webhook.id,
        aliasId: response.alias.id,
        domainId: response.domain?.id
      };
      
      await this.saveStaticData(webhookData);
      return true;
      
    } else if (aliasMode === 'catchall') {
      // Create catch-all alias with domain synchronization
      const response = await emailConnectApiRequest.call(this, 'POST', '/api/webhooks/alias', {
        domainId: this.getNodeParameter('domainId'),
        webhookUrl: webhookUrl,
        webhookName: this.getNodeParameter('webhookName'),
        aliasType: 'catchall',
        syncWithDomain: true,
        autoVerify: true
      });
      
      await this.saveStaticData({
        webhookId: response.webhook.id,
        aliasId: response.alias.id,
        domainId: response.domain?.id,
        catchAllSync: true
      });
      return true;
      
    } else {
      // Existing alias mode - traditional approach
      // ... existing implementation
    }
  } catch (error) {
    console.error('Webhook creation failed:', error);
    throw error;
  }
}

// Webhook cleanup method
async delete(this: IHookFunctions): Promise<boolean> {
  const staticData = this.getStaticData();
  const { webhookId, aliasId, domainId, catchAllSync } = staticData;
  
  try {
    // Clean up webhook
    if (webhookId) {
      await emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookId}`);
    }
    
    // Clean up alias (if created by this node)
    if (aliasId && this.getNodeParameter('aliasMode') === 'create') {
      await emailConnectApiRequest.call(this, 'DELETE', `/api/aliases/${aliasId}`);
    }
    
    // Restore domain webhook if catch-all sync was used
    if (catchAllSync && domainId) {
      await emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}`, {
        webhookUrl: null // Reset domain webhook
      });
    }
    
    // Clear static data
    this.saveStaticData({});
    return true;
    
  } catch (error) {
    console.error('Webhook cleanup failed:', error);
    // Don't throw - cleanup is best-effort
    return true;
  }
}

// Webhook data processing
async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
  const bodyData = this.getBodyData();
  
  // Process and validate webhook data
  const processedData = {
    ...bodyData,
    // Add any additional processing
    receivedAt: new Date().toISOString(),
    nodeId: this.getNode().id
  };
  
  return {
    workflowData: [
      [
        {
          json: processedData,
        },
      ],
    ],
  };
}
```

### **URL Switching for Test/Production**
```typescript
// Update webhook URL when switching between test and production
async update(this: IHookFunctions): Promise<boolean> {
  const staticData = this.getStaticData();
  const newWebhookUrl = this.getNodeWebhookUrl('default');
  
  if (staticData.webhookId) {
    try {
      await emailConnectApiRequest.call(this, 'PUT', `/api/webhooks/${staticData.webhookId}`, {
        url: newWebhookUrl
      });
      
      // Update domain webhook if synchronized
      if (staticData.catchAllSync && staticData.domainId) {
        await emailConnectApiRequest.call(this, 'PUT', `/api/domains/${staticData.domainId}`, {
          webhookUrl: newWebhookUrl
        });
      }
      
      return true;
    } catch (error) {
      console.error('Webhook update failed:', error);
      return false;
    }
  }
  
  return true;
}
```

---

## 🔐 Credential Implementation

### **Credential Definition**
**File**: [`credentials/EmailConnectApi.credentials.ts`](../credentials/EmailConnectApi.credentials.ts)

```typescript
import {
  IAuthenticateGeneric,
  ICredentialDataDecryptedObject,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

export class EmailConnectApi implements ICredentialType {
  name = 'emailConnectApi';
  displayName = 'EmailConnect API';
  properties: INodeProperties[] = [
    {
      displayName: 'Getting Started',
      name: 'gettingStarted',
      type: 'notice',
      default: '',
      typeOptions: {
        theme: 'info',
      },
      description: `
        <strong>🇪🇺 100% EU-operated email service</strong><br/>
        • Multi-alias support for organized email routing<br/>
        • Free to start: 50 emails per month<br/>
        <br/>
        <strong>Quick Setup:</strong><br/>
        1. <a href="https://emailconnect.eu/register" target="_blank">Register your account</a><br/>
        2. <a href="https://emailconnect.eu/settings" target="_blank">Get your API key</a><br/>
        3. Enter your API key below
      `,
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      placeholder: 'your-api-key-here',
      description: 'Your EmailConnect API key with "API User" scope',
      hint: 'You can find your API key in the <a href="https://emailconnect.eu/settings" target="_blank">EmailConnect Settings</a>',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        'X-API-KEY': '={{$credentials.apiKey}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: 'https://emailconnect.eu',
      url: '/api/domains',
      method: 'GET',
    },
    rules: [
      {
        type: 'responseSuccessBody',
        properties: {
          key: 'domains',
          value: 'array',
        },
      },
    ],
  };
}
```

### **Custom Credential Testing**
```typescript
// Advanced credential testing with better error messages
test: ICredentialTestRequest = {
  request: {
    baseURL: 'https://emailconnect.eu',
    url: '/api/domains',
    method: 'GET',
  },
  rules: [
    {
      type: 'responseCode',
      properties: {
        value: 200,
        message: 'Authorization failed. Please check your API key and ensure it has "API User" scope.',
      },
    },
    {
      type: 'responseSuccessBody',
      properties: {
        key: 'domains',
        value: 'array',
        message: 'API key is valid but response format is unexpected. Please contact support.',
      },
    },
  ],
};
```

---

## 🧪 Testing Strategy

### **Test Structure**
```
test/
├── backend-api.test.js              # API client integration tests
├── n8n-node-integration.test.js     # Node execution tests
├── webhook-creation.test.js         # Webhook lifecycle tests
├── webhook-url-switching.test.js    # URL management tests
├── node-validation.test.js          # Parameter validation tests
└── domain-dropdown-fix.test.js      # UI component tests
```

### **Node Testing Pattern**
```javascript
// Example node test structure
describe('EmailConnect Node', () => {
  let mockExecuteFunctions;
  
  beforeEach(() => {
    mockExecuteFunctions = {
      getCredentials: jest.fn().mockResolvedValue({
        apiKey: 'test-api-key'
      }),
      getNodeParameter: jest.fn(),
      helpers: {
        httpRequest: jest.fn()
      },
      getNode: jest.fn().mockReturnValue({
        id: 'test-node-id',
        name: 'Test Node'
      })
    };
  });
  
  describe('Domain Operations', () => {
    it('should get all domains', async () => {
      // Mock API response
      mockExecuteFunctions.helpers.httpRequest.mockResolvedValue({
        domains: [
          { id: 'domain-1', domainName: 'example.com', status: 'verified' }
        ]
      });
      
      mockExecuteFunctions.getNodeParameter.mockImplementation((param) => {
        if (param === 'resource') return 'domain';
        if (param === 'operation') return 'getAll';
        return null;
      });
      
      const node = new EmailConnect();
      const result = await node.execute.call(mockExecuteFunctions);
      
      expect(result[0]).toHaveLength(1);
      expect(result[0][0].json).toEqual(expect.objectContaining({
        id: 'domain-1',
        domainName: 'example.com'
      }));
    });
  });
  
  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockExecuteFunctions.helpers.httpRequest.mockRejectedValue({
        response: {
          statusCode: 401,
          body: { error: 'Unauthorized', message: 'Invalid API key' }
        }
      });
      
      const node = new EmailConnect();
      
      await expect(node.execute.call(mockExecuteFunctions))
        .rejects
        .toThrow('Invalid API key');
    });
  });
});
```

### **Webhook Testing**
```javascript
describe('EmailConnect Trigger', () => {
  let mockHookFunctions;
  
  beforeEach(() => {
    mockHookFunctions = {
      getNodeWebhookUrl: jest.fn().mockReturnValue('https://test.n8n.io/webhook/test'),
      getNodeParameter: jest.fn(),
      saveStaticData: jest.fn(),
      getStaticData: jest.fn().mockReturnValue({}),
      helpers: {
        httpRequest: jest.fn()
      }
    };
  });
  
  it('should create webhook with new alias', async () => {
    mockHookFunctions.getNodeParameter.mockImplementation((param) => {
      switch (param) {
        case 'aliasMode': return 'create';
        case 'domainId': return 'domain-uuid';
        case 'newAliasLocalPart': return 'support';
        case 'webhookName': return 'Test Webhook';
        default: return null;
      }
    });
    
    mockHookFunctions.helpers.httpRequest.mockResolvedValue({
      webhook: { id: 'webhook-id', verified: true },
      alias: { id: 'alias-id', email: 'support@example.com' }
    });
    
    const trigger = new EmailConnectTrigger();
    const result = await trigger.create.call(mockHookFunctions);
    
    expect(result).toBe(true);
    expect(mockHookFunctions.saveStaticData).toHaveBeenCalledWith(
      expect.objectContaining({
        webhookId: 'webhook-id',
        aliasId: 'alias-id'
      })
    );
  });
});
```

---

## 📦 Build & Distribution

### **Build Configuration**
**TypeScript Config** (`tsconfig.json`):
```json
{
  "compilerOptions": {
    "target": "ES2019",
    "module": "commonjs",
    "lib": ["ES2019"],
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["credentials", "nodes"],
  "exclude": ["dist", "node_modules", "test"]
}
```

**Gulp Build** (`gulpfile.js`):
```javascript
const gulp = require('gulp');

gulp.task('build:icons', () => {
  return gulp.src('nodes/**/*.{png,svg}')
    .pipe(gulp.dest('dist/nodes'));
});

gulp.task('default', gulp.series('build:icons'));
```

### **Package Configuration**
```json
{
  "name": "n8n-nodes-emailconnect",
  "main": "index.js",
  "files": ["dist"],
  "n8n": {
    "n8nNodesApiVersion": 1,
    "credentials": [
      "dist/credentials/EmailConnectApi.credentials.js"
    ],
    "nodes": [
      "dist/nodes/EmailConnect/EmailConnect.node.js",
      "dist/nodes/EmailConnectTrigger/EmailConnectTrigger.node.js"
    ]
  },
  "scripts": {
    "build": "tsc && gulp build:icons",
    "prepublishOnly": "npm run build && npm run lint -s"
  }
}
```

---

## 🚀 Publishing & Distribution

### **Pre-publication Checklist**
1. **Code Quality**: `npm run lint` passes
2. **Tests**: `npm test` passes with good coverage
3. **Build**: `npm run build` completes successfully
4. **Version**: Update version in `package.json`
5. **Changelog**: Update `CHANGELOG.md` with changes
6. **Documentation**: Update README and docs as needed

### **Publishing Process**
```bash
# Version bump (patch/minor/major)
npm version patch

# Build and validate
npm run prepublishOnly

# Publish to npm
npm publish

# Create GitHub release
gh release create v0.2.5 --title "v0.2.5" --notes "Release notes here"
```

### **CI/CD Pipeline**
The project uses GitHub Actions for automated publishing:
- **Quality Gates**: ESLint, TypeScript, security audit
- **Test Execution**: Jest with coverage reporting
- **Build Process**: TypeScript compilation and asset processing
- **Release Automation**: Conventional commits-based versioning
- **NPM Publishing**: Automated with artifact verification

---

## 🔍 Debugging & Troubleshooting

### **Development Debugging**
```typescript
// Add debug logging in GenericFunctions.ts
if (process.env.NODE_ENV === 'development') {
  console.log('API Request:', { method, resource, body, query });
  console.log('API Response:', response);
}

// Enable in n8n development
export NODE_ENV=development
```

### **Common Issues & Solutions**

#### **1. Load Options Not Working**
```typescript
// Ensure method is properly defined
methods = {
  loadOptions: {
    async getDomains(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
      // Implementation must return INodePropertyOptions[]
      return domains.map(domain => ({
        name: domain.name,
        value: domain.id
      }));
    }
  }
}
```

#### **2. Webhook Not Receiving Data**
- Check webhook URL accessibility from external services
- Verify n8n instance can receive HTTP requests
- Test webhook endpoint manually with curl/Postman
- Check EmailConnect webhook logs in dashboard

#### **3. Parameter Dependencies Not Working**
```typescript
// Ensure loadOptionsDependsOn matches parameter names exactly
{
  typeOptions: {
    loadOptionsMethod: 'getAliases',
    loadOptionsDependsOn: ['domainId']  // Must match parameter name
  }
}
```

#### **4. Icon Not Displaying**
- Ensure SVG is in correct location relative to node file
- Check Gulp build includes icons in dist/ folder
- Verify SVG is valid and properly formatted (16x16px recommended)

---

## 🔗 Extension Points

### **Adding New Resources**
1. **Add Resource Option**: Update resource dropdown in node properties
2. **Add Operations**: Define operations for the new resource
3. **Add Parameters**: Create parameter definitions for each operation
4. **Implement Logic**: Add execution logic in the main execute method
5. **Add Load Options**: If needed for dynamic dropdowns
6. **Add Tests**: Create comprehensive tests for the new resource

### **Custom API Endpoints**
```typescript
// Example: Adding support for a new endpoint
case 'customResource':
  if (operation === 'customOperation') {
    const customData = {
      field1: this.getNodeParameter('field1', i) as string,
      field2: this.getNodeParameter('field2', i) as number,
    };
    
    responseData = await emailConnectApiRequest.call(
      this,
      'POST',
      '/api/custom-endpoint',
      customData,
    );
  }
  break;
```

### **Advanced Webhook Features**
- **Custom Event Filtering**: Add event type selection
- **Data Transformation**: Process webhook data before output
- **Multiple Webhook Support**: Handle multiple webhook configurations
- **Retry Logic**: Implement webhook retry mechanisms

---

## 📚 Additional Resources

### **n8n Development**
- [n8n Node Development](https://docs.n8n.io/integrations/creating-nodes/)
- [n8n Community Nodes](https://docs.n8n.io/integrations/community-nodes/)
- [n8n TypeScript Definitions](https://github.com/n8n-io/n8n/tree/master/packages/workflow/src)

### **EmailConnect API**
- [EmailConnect Documentation](https://emailconnect.eu/docs)
- [API Reference](../emailconnect-openapi.json)
- [Dashboard](https://emailconnect.eu)

### **Project Documentation**
- [User Guide](../README.md)
- [API Reference](./API_REFERENCE.md)
- [Technical Analysis](../docs/TODO.md)
- [Project Index](./PROJECT_INDEX.md)

---

*This developer guide provides comprehensive technical documentation for extending and contributing to the EmailConnect n8n node. For user-focused documentation, refer to the [README.md](../README.md).*