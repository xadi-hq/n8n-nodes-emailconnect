# n8n-nodes-emailconnect

![n8n.io - Workflow Automation](https://raw.githubusercontent.com/n8n-io/n8n/master/assets/n8n-logo.png)

An n8n community node for [EmailConnect](https://emailconnect.eu) - enabling seamless email automation and webhook integration in your n8n workflows.

## Features

- **Domain Management**: List, get details, check status, and configure your EmailConnect domains
- **Alias Management**: Create, read, update, and delete email aliases under your domains
- **Webhook Configuration**: Set up and manage webhooks for email processing automation
- **Email Triggers**: Receive real-time notifications when emails are processed through EmailConnect
- **Filtering Options**: Filter triggers by domain, alias, or event type for precise workflow control

## Installation

### Community Nodes (Recommended)

1. Go to **Settings > Community Nodes** in your n8n instance
2. Click **Install a community node**
3. Enter `n8n-nodes-emailconnect`
4. Click **Install**

### Manual Installation

```bash
# In your n8n root directory
npm install n8n-nodes-emailconnect
```

### Docker

Add to your n8n Docker environment:

```dockerfile
# Add to your n8n Dockerfile or docker-compose
RUN npm install -g n8n-nodes-emailconnect
```

## Configuration

### 1. EmailConnect API Credentials

Before using the nodes, you need to configure your EmailConnect API credentials:

1. Go to **Credentials** in your n8n instance
2. Click **Create New Credential**
3. Search for **EmailConnect API**
4. Enter your EmailConnect API key (get it from [EmailConnect Dashboard](https://emailconnect.eu/settings))

### 2. EmailConnect Service Setup

Make sure you have:
- An active EmailConnect account at [emailconnect.eu](https://emailconnect.eu)
- At least one verified domain configured
- API access enabled in your account settings

## Nodes Overview

### EmailConnect Node

The main node for interacting with EmailConnect API operations.

**Resources:**
- **Domain**: Manage your email domains
- **Alias**: Manage email aliases under domains
- **Webhook**: Configure webhook endpoints for email processing

### EmailConnect Trigger Node

A trigger node that starts workflows when EmailConnect processes emails.

**Features:**
- Real-time email processing notifications
- Event filtering (received, processed, failed)
- Domain and alias filtering
- Webhook-based triggering

## Usage Examples

### Example 1: List All Domains

```json
{
  "nodes": [
    {
      "name": "Get Domains",
      "type": "n8n-nodes-emailconnect.emailConnect",
      "parameters": {
        "resource": "domain",
        "operation": "getAll"
      }
    }
  ]
}
```

### Example 2: Create Email Alias

```json
{
  "nodes": [
    {
      "name": "Create Alias",
      "type": "n8n-nodes-emailconnect.emailConnect",
      "parameters": {
        "resource": "alias",
        "operation": "create",
        "domainId": "your-domain-id",
        "aliasName": "support",
        "description": "Customer support emails"
      }
    }
  ]
}
```

### Example 3: Email Processing Trigger

```json
{
  "nodes": [
    {
      "name": "Email Received",
      "type": "n8n-nodes-emailconnect.emailConnectTrigger",
      "parameters": {
        "events": ["email.received"],
        "domainFilter": "example.com",
        "aliasFilter": "support@example.com"
      }
    }
  ]
}
```

## API Permissions

This n8n node requires an EmailConnect API key with **"API User"** scope, which provides:

✅ **Allowed Operations:**
- `GET /api/domains` - List your domains
- `GET /api/domains/{domainId}` - Get domain details
- `GET /api/domains/{domainId}/status` - Check verification status
- `PUT /api/domains/{domainId}` - Update domain configuration (allowAttachments & includeEnvelopeData only)
- Full CRUD access to aliases and webhooks

❌ **Blocked Operations:**
- `POST /api/domains` - Create domain (use EmailConnect dashboard)
- `DELETE /api/domains/{domain}` - Delete domain (use EmailConnect dashboard)

## Workflow Examples

### Complete Email Processing Workflow

```json
{
  "name": "EmailConnect Processing Workflow",
  "nodes": [
    {
      "name": "Email Received Trigger",
      "type": "n8n-nodes-emailconnect.emailConnectTrigger",
      "parameters": {
        "events": ["email.received"],
        "domainFilter": "support.example.com"
      }
    },
    {
      "name": "Process Email Content",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "// Extract email data\nconst email = items[0].json;\nreturn [{\n  json: {\n    sender: email.sender,\n    subject: email.subject,\n    content: email.textContent,\n    receivedAt: email.receivedAt\n  }\n}];"
      }
    },
    {
      "name": "Send to Slack",
      "type": "n8n-nodes-base.slack",
      "parameters": {
        "operation": "postMessage",
        "channel": "#support",
        "text": "New email from {{$node['Process Email Content'].json['sender']}}: {{$node['Process Email Content'].json['subject']}}"
      }
    }
  ]
}
```

### Domain Status Monitoring

```json
{
  "name": "Domain Status Monitor",
  "nodes": [
    {
      "name": "Get All Domains",
      "type": "n8n-nodes-emailconnect.emailConnect",
      "parameters": {
        "resource": "domain",
        "operation": "getAll"
      }
    },
    {
      "name": "Check Each Domain Status",
      "type": "n8n-nodes-emailconnect.emailConnect",
      "parameters": {
        "resource": "domain",
        "operation": "getStatus",
        "domainId": "={{$json.id}}"
      }
    },
    {
      "name": "Alert on Issues",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "string": [
            {
              "value1": "={{$json.status}}",
              "operation": "notEqual",
              "value2": "verified"
            }
          ]
        }
      }
    }
  ]
}
```

## Troubleshooting

### Common Issues

**"Invalid API Key" Error**
- Ensure your API key has "API User" scope
- Check that the API key is correctly entered in n8n credentials
- Verify your EmailConnect account is active

**"Domain not found" Error**
- Verify the domain exists in your EmailConnect account
- Check that you're using the correct domain ID
- Ensure the domain is verified and active

**Webhook not receiving data**
- Verify the webhook URL is accessible from EmailConnect servers
- Check that the webhook is properly configured in EmailConnect dashboard
- Ensure your n8n instance can receive external HTTP requests

**"Insufficient permissions" Error**
- Your API key may not have the required scope
- Contact EmailConnect support to upgrade your API key permissions

### Getting Help

- **EmailConnect Documentation**: [https://emailconnect.eu/docs](https://emailconnect.eu/docs)
- **EmailConnect Support**: [support@emailconnect.eu](mailto:support@emailconnect.eu)
- **n8n Community**: [https://community.n8n.io](https://community.n8n.io)

## Development

### Building from Source

```bash
git clone https://github.com/xadi-hq/n8n-nodes-emailconnect.git
cd n8n-nodes-emailconnect
npm install
npm run build
```

### Testing

```bash
npm test
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Changelog

### v0.1.0
- Initial release
- EmailConnect node with domain, alias, and webhook operations
- EmailConnect trigger node with event filtering
- Complete API integration with "API User" scope support

## Detailed Node Documentation

### EmailConnect Node Operations

#### Domain Operations

**Get All Domains**
- **Operation**: `getAll`
- **Description**: Retrieves all domains configured in your EmailConnect account
- **Output**: Array of domain objects with ID, name, status, and configuration

**Get Domain**
- **Operation**: `get`
- **Parameters**:
  - `domainId` (required): The ID of the domain to retrieve
- **Output**: Single domain object with detailed information

**Get Domain Status**
- **Operation**: `getStatus`
- **Parameters**:
  - `domainId` (required): The ID of the domain to check
- **Output**: Domain verification and DNS status information

**Update Domain Configuration**
- **Operation**: `updateConfig`
- **Parameters**:
  - `domainId` (required): The ID of the domain to update
  - `allowAttachments` (boolean): Whether to allow email attachments
  - `includeEnvelopeData` (boolean): Whether to include SMTP envelope data
- **Output**: Updated domain configuration

#### Alias Operations

**Get All Aliases**
- **Operation**: `getAll`
- **Parameters**:
  - `domainId` (required): The domain ID to list aliases for
- **Output**: Array of alias objects

**Get Alias**
- **Operation**: `get`
- **Parameters**:
  - `aliasId` (required): The ID of the alias to retrieve
- **Output**: Single alias object with details

**Create Alias**
- **Operation**: `create`
- **Parameters**:
  - `domainId` (required): The domain ID to create alias under
  - `aliasName` (required): The alias name (e.g., "support")
  - `description` (optional): Description of the alias
- **Output**: Created alias object with generated ID

**Update Alias**
- **Operation**: `update`
- **Parameters**:
  - `aliasId` (required): The ID of the alias to update
  - `aliasName` (optional): New alias name
  - `description` (optional): New description
- **Output**: Updated alias object

**Delete Alias**
- **Operation**: `delete`
- **Parameters**:
  - `aliasId` (required): The ID of the alias to delete
- **Output**: Success confirmation

#### Webhook Operations

**Get All Webhooks**
- **Operation**: `getAll`
- **Parameters**:
  - `domainId` (optional): Filter webhooks by domain
- **Output**: Array of webhook configurations

**Get Webhook**
- **Operation**: `get`
- **Parameters**:
  - `webhookId` (required): The ID of the webhook to retrieve
- **Output**: Single webhook object

**Create Webhook**
- **Operation**: `create`
- **Parameters**:
  - `domainId` (optional): Domain to associate webhook with
  - `aliasId` (optional): Alias to associate webhook with
  - `url` (required): Webhook endpoint URL
  - `description` (optional): Webhook description
- **Output**: Created webhook object

**Update Webhook**
- **Operation**: `update`
- **Parameters**:
  - `webhookId` (required): The ID of the webhook to update
  - `url` (optional): New webhook URL
  - `description` (optional): New description
- **Output**: Updated webhook object

**Delete Webhook**
- **Operation**: `delete`
- **Parameters**:
  - `webhookId` (required): The ID of the webhook to delete
- **Output**: Success confirmation

### EmailConnect Trigger Node

The trigger node receives webhook data from EmailConnect when emails are processed.

#### Configuration Options

**Events**
- `email.received`: Triggered when an email is received
- `email.processed`: Triggered when an email is successfully processed
- `email.failed`: Triggered when email processing fails

**Filters**
- **Domain Filter**: Only trigger for emails from specific domain
- **Alias Filter**: Only trigger for emails to specific alias

#### Webhook Data Structure

The trigger node outputs the following data structure:

```json
{
  "id": "email-processing-id",
  "domainId": "domain-id",
  "receivedAt": "2024-01-15T10:30:00Z",
  "sender": "user@example.com",
  "recipient": "support@yourdomain.com",
  "subject": "Email subject",
  "status": "email.received",
  "payload": {
    "headers": {},
    "text": "Plain text content",
    "html": "<p>HTML content</p>",
    "attachments": []
  },
  "envelope": {
    "from": "user@example.com",
    "to": ["support@yourdomain.com"]
  }
}
```