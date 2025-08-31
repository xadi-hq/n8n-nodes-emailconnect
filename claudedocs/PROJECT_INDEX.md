# n8n-nodes-emailconnect: Project Documentation Index

**Version**: 0.2.4 | **Last Updated**: 2025-08-31 | **Node.js**: >=20.0.0

## 📋 Project Overview

`n8n-nodes-emailconnect` is a community node package that integrates [EmailConnect](https://emailconnect.eu) - a 100% EU-operated email automation service - with n8n workflow automation platform.

### Key Statistics
- **Package Size**: ~2.1MB compiled
- **Core Implementation**: 2 main nodes (1,542 total lines)
- **Test Coverage**: 6 comprehensive test files
- **Dependencies**: TypeScript, n8n-workflow, Jest, ESLint
- **License**: MIT

### Project Purpose
Enable seamless email automation through webhook-based workflows with:
- Multi-alias email routing and management
- Real-time email processing triggers
- Comprehensive domain and webhook management
- EU-compliant email infrastructure integration

---

## 🏗️ Architecture Overview

```
EmailConnect API ↔ n8n Custom Nodes ↔ n8n Workflows
       ↑                    ↑
   EU Infrastructure    Webhook Triggers
```

**Design Philosophy**: Clean separation between EmailConnect service complexity and n8n automation logic with webhook-driven real-time processing.

---

## 📁 Project Structure

### **Root Level**
```
n8n-nodes-emailconnect/
├── 📋 package.json           # Project manifest & n8n node registration
├── 📋 README.md              # Comprehensive user documentation
├── 📋 CHANGELOG.md           # Version history (minimal)
├── 🔧 tsconfig.json          # TypeScript compilation config
├── 🔧 gulpfile.js           # Asset build pipeline (icons)
├── 🔧 jest.config.js        # Test configuration
├── 🔧 eslint.config.js      # Code quality rules
├── 📄 emailconnect-openapi.json  # API specification reference
├── 🔧 test-api.js           # Development API testing script
└── 📜 LICENSE               # MIT license
```

### **Source Code** (`/src`)
```
credentials/
└── EmailConnectApi.credentials.ts    # n8n credential definitions

nodes/
├── EmailConnect/
│   ├── EmailConnect.node.ts          # Main operations node (557 lines)
│   ├── GenericFunctions.ts           # Shared API client logic
│   └── emailconnect.svg              # Node icon
└── EmailConnectTrigger/
    ├── EmailConnectTrigger.node.ts   # Webhook trigger (985 lines)
    └── emailconnect.svg              # Node icon
```

### **Build & Assets**
```
dist/                    # Compiled TypeScript → JavaScript output
assets/                  # Brand assets and icons
├── logo-light.png
├── logo-dark.png
├── favicon.svg
└── og-image.png
```

### **Quality Assurance**
```
test/                    # Comprehensive test suite (6 files)
├── backend-api.test.js
├── n8n-node-integration.test.js
├── webhook-creation.test.js
├── webhook-url-switching.test.js
├── node-validation.test.js
└── domain-dropdown-fix.test.js

.github/workflows/       # CI/CD automation
├── deploy.yml           # Comprehensive CI/CD pipeline
├── docs.yml            # Documentation automation
└── automation.yml      # Additional automation
```

### **Documentation**
```
docs/                    # Technical documentation
├── 📋 TODO.md                        # Comprehensive analysis & roadmap
├── 📋 IMPLEMENTATION_SUMMARY.md      # Recent implementation details
├── 📋 BACKEND_IMPLEMENTATION_PLAN.md # Backend coordination plans
├── 📋 api-differences.md             # API specification gaps
├── 📋 debug-webhook-cleanup.md       # Webhook management
└── nodes/
    └── README.md                     # Node-specific documentation

claudedocs/              # AI-generated documentation (this directory)
└── PROJECT_INDEX.md     # This comprehensive index
```

---

## 🎯 Core Components Deep Dive

### **1. EmailConnectApi Credentials** 
**Location**: `/credentials/EmailConnectApi.credentials.ts`
- **Purpose**: API authentication configuration for n8n
- **Features**: Generic header-based auth (X-API-KEY), built-in testing, user guidance
- **Integration**: Links to registration/API key setup with contextual help

### **2. EmailConnect Main Node**
**Location**: `/nodes/EmailConnect/EmailConnect.node.ts` (557 lines)
- **Resources**: Domain (read-only + config), Alias (CRUD), Webhook (CRUD)
- **API Scope**: Uses "API User" scope with specific permission restrictions
- **Complexity**: Comprehensive parameter validation, dynamic load options

### **3. EmailConnect Trigger Node** 
**Location**: `/nodes/EmailConnectTrigger/EmailConnectTrigger.node.ts` (985 lines)
- **Purpose**: Webhook-based email processing triggers
- **Features**: Multi-mode alias handling, webhook synchronization, URL switching
- **Advanced Logic**: Domain/catch-all webhook bidirectional synchronization

### **4. Generic Functions**
**Location**: `/nodes/EmailConnect/GenericFunctions.ts`
- **Purpose**: Shared API client with comprehensive error handling
- **Features**: Debug logging, credential management, standardized error handling
- **Pattern**: Uses n8n's helpers.httpRequest with custom error wrapping

---

## 🛠️ Development Environment

### **Build Pipeline**
```
TypeScript Compilation → Gulp Icon Processing → Jest Testing → ESLint Validation
```

### **Key Commands**
- `npm run build`: TypeScript compilation + icon copying
- `npm run dev`: Watch mode for development
- `npm run test`: Jest test suite with coverage
- `npm run lint`: ESLint validation
- `npm run format`: Prettier formatting

### **Technology Stack**
- **Runtime**: n8n-workflow (peer dependency)
- **Language**: TypeScript (ES2019 target, CommonJS modules)
- **Testing**: Jest with coverage reporting to Codecov
- **Quality**: ESLint (n8n-nodes-base plugin), Prettier, cspell
- **Build**: Gulp for asset processing, TypeScript compiler

---

## 📊 Code Quality & Testing

### **Quality Standards**
- **ESLint**: n8n-nodes-base plugin with custom rule overrides
- **TypeScript**: Strict mode with full type safety and declaration generation
- **Coverage**: Jest with multiple formats (text, lcov, html)
- **Spell Check**: cspell with domain-specific word list

### **Test Coverage Analysis**
```
test/ (6 comprehensive test files)
├── backend-api.test.js              # API client validation
├── n8n-node-integration.test.js     # Node functionality tests
├── webhook-creation.test.js         # Webhook lifecycle tests
├── webhook-url-switching.test.js    # URL management tests
├── node-validation.test.js          # Parameter validation tests
└── domain-dropdown-fix.test.js      # UI component tests
```

**Test Patterns**:
- Mock-based testing with Jest
- n8n context simulation for node testing
- API response mocking for integration tests
- Coverage reporting with artifact retention

---

## 🚀 CI/CD & Automation

### **GitHub Actions Pipeline**
```
Quality Gates → Test Execution → Build Process → Release Automation
     ↓              ↓              ↓              ↓
  ESLint/Type     Jest Tests    TS Compile    NPM Publish
  Security Audit   Coverage      Asset Proc    Artifacts
```

### **Advanced Features**
- **Dependabot Integration**: Automated dependency updates
- **Security**: npm audit with moderate level threshold
- **Coverage**: Codecov integration with artifact retention
- **Release**: Conventional commits-based automation
- **Verification**: Automated package publishing validation

---

## 🔧 n8n Integration Patterns

### **n8n Framework Integration**
- **Node Registration**: Proper dist path registration in package.json
- **Credential System**: Generic authentication with test validation
- **Parameter System**: Dynamic parameter dependencies and load options
- **Webhook Integration**: Full webhook lifecycle with n8n's webhook system
- **Icon Management**: SVG icon integration with build pipeline

### **Advanced n8n Features**
- **Load Options**: Dynamic dropdown population from API
- **Webhook Management**: Complete create/update/delete/verify cycle
- **Static Data Storage**: Persistent webhook/alias ID storage
- **Parameter Dependencies**: Conditional parameter display logic
- **Custom Validation**: Real-time parameter validation

---

## 📈 Project Complexity Assessment

### **Complexity Metrics**
- **High Complexity Areas**:
  - Webhook lifecycle management (create/update/verify/delete/sync)
  - Multi-mode alias handling (create/existing/catch-all)
  - API permission boundary enforcement
  - Bidirectional webhook synchronization

- **Moderate Complexity**: 
  - API client error handling
  - Parameter validation
  - Dynamic load options

- **Low Complexity**: 
  - Credential management
  - Basic CRUD operations
  - Icon/asset management

### **Technical Debt Assessment**
- **Webhook Cleanup**: Limited by n8n framework changes (documented in Known Limitations)
- **API Schema Gaps**: Comprehensive analysis in `/docs/TODO.md`
- **Documentation**: Some referenced node docs missing but core docs comprehensive

---

## 🎯 Usage Patterns & API Integration

### **EmailConnect API Permissions**
**API User Scope** provides:

✅ **Allowed Operations**:
- `GET /api/domains*` - Domain listing and status
- `PUT /api/domains/{id}` - Limited config updates (attachments, envelope data)
- Full CRUD access to aliases and webhooks

❌ **Blocked Operations**:
- `POST /api/domains` - Domain creation (dashboard only)
- `DELETE /api/domains/{id}` - Domain deletion (dashboard only)

### **Workflow Integration Patterns**

**1. Complete Email Processing**:
```
Email Received Trigger → Process Content → External Integration
```

**2. Domain Status Monitoring**:
```
Get Domains → Check Status → Alert on Issues
```

**3. Alias Management**:
```
Create/Update Aliases → Configure Webhooks → Monitor Events
```

---

## 🔗 Cross-References & Related Files

### **Configuration Files**
- **TypeScript**: [`tsconfig.json`](../tsconfig.json)
- **Jest Testing**: [`jest.config.js`](../jest.config.js)
- **ESLint**: [`eslint.config.js`](../eslint.config.js)
- **Build Pipeline**: [`gulpfile.js`](../gulpfile.js)
- **Package Config**: [`package.json`](../package.json)

### **Documentation Files**
- **User Guide**: [`README.md`](../README.md) - Comprehensive user documentation
- **Technical Analysis**: [`docs/TODO.md`](../docs/TODO.md) - Implementation roadmap
- **API Issues**: [`docs/api-differences.md`](../docs/api-differences.md) - Schema discrepancies
- **Implementation**: [`docs/IMPLEMENTATION_SUMMARY.md`](../docs/IMPLEMENTATION_SUMMARY.md)
- **Webhook Debug**: [`docs/debug-webhook-cleanup.md`](../docs/debug-webhook-cleanup.md)

### **Source Code Files**
- **Main Node**: [`nodes/EmailConnect/EmailConnect.node.ts`](../nodes/EmailConnect/EmailConnect.node.ts)
- **Trigger Node**: [`nodes/EmailConnectTrigger/EmailConnectTrigger.node.ts`](../nodes/EmailConnectTrigger/EmailConnectTrigger.node.ts)
- **API Client**: [`nodes/EmailConnect/GenericFunctions.ts`](../nodes/EmailConnect/GenericFunctions.ts)
- **Credentials**: [`credentials/EmailConnectApi.credentials.ts`](../credentials/EmailConnectApi.credentials.ts)

### **External Resources**
- **EmailConnect Service**: [https://emailconnect.eu](https://emailconnect.eu)
- **API Documentation**: [https://emailconnect.eu/docs](https://emailconnect.eu/docs)
- **n8n Community**: [https://community.n8n.io](https://community.n8n.io)
- **GitHub Repository**: [https://github.com/xadi-hq/n8n-nodes-emailconnect](https://github.com/xadi-hq/n8n-nodes-emailconnect)

---

## 📝 Development Status & Roadmap

### **Current Version**: v0.2.4 (2025-06-21)
- **✅ Fixed**: Catch-all alias creation conflicts
- **✅ Fixed**: Webhook-alias unlinking during URL switching
- **✅ Enhanced**: Domain-catchall synchronization
- **✅ Improved**: Error handling and logging
- **✅ Added**: Comprehensive webhook lifecycle documentation

### **Implementation Phases** (from TODO.md)
- **Phase 1**: ✅ User Experience Improvements (v0.1.19 published)
- **Phase 2**: ✅ Backend Enhancements (All features implemented)
- **Phase 3**: 🔄 Frontend Updates (Step 1 completed)
- **Phase 4**: 📋 Documentation & Cleanup (In progress)

### **Key Achievements**
- Sophisticated n8n integration with webhook lifecycle management
- Comprehensive testing and CI/CD automation
- Production-ready error handling and validation
- EU-compliant email infrastructure integration
- Extensive technical documentation and analysis

---

## 💡 Getting Started Quick Reference

### **For Users**
1. Install via n8n Community Nodes: `n8n-nodes-emailconnect`
2. Register at [EmailConnect](https://emailconnect.eu/register)
3. Get API key from [EmailConnect Settings](https://emailconnect.eu/settings)
4. Configure credentials in n8n
5. Start building email automation workflows

### **For Developers**
1. Clone repository: `git clone https://github.com/xadi-hq/n8n-nodes-emailconnect.git`
2. Install dependencies: `npm install`
3. Build project: `npm run build`
4. Run tests: `npm test`
5. Refer to [`docs/TODO.md`](../docs/TODO.md) for technical analysis

---

*This documentation index provides comprehensive project navigation and cross-referencing. For specific implementation details, refer to the linked source files and technical documentation.*