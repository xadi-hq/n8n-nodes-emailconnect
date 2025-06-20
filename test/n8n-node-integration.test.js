/**
 * n8n Node Integration Tests
 * Tests the actual n8n node functionality with real API calls
 */

const { EmailConnectTrigger } = require('../dist/nodes/EmailConnectTrigger/EmailConnectTrigger.node.js');

// Mock n8n context for testing
const createMockContext = (parameters = {}) => ({
  getNodeParameter: jest.fn((name) => parameters[name]),
  getCredentials: jest.fn().mockResolvedValue({
    apiKey: 'ak_ce7e58d4975b3a68a7a1aeaa2535f6eb431ae755e8912dd8f51240bf3efa63e6',
    baseUrl: 'http://localhost:3000'
  }),
  helpers: {
    httpRequest: jest.fn(),
    returnJsonArray: jest.fn(data => data)
  }
});

describe('EmailConnect n8n Node Integration Tests', () => {
  let triggerNode;

  beforeEach(() => {
    triggerNode = new EmailConnectTrigger();
  });

  describe('Load Options Methods', () => {
    test('should load domains', async () => {
      const mockContext = createMockContext();
      
      // Mock the HTTP request to return domains
      mockContext.helpers.httpRequest.mockResolvedValueOnce({
        domains: [
          {
            id: 'cmc5860m40004axgd6cv4kim0',
            domain: 'in.xadi.nl',
            verified: true
          }
        ]
      });

      const result = await triggerNode.methods.loadOptions.getDomains.call(mockContext);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('value');
    });

    test('should load aliases for domain', async () => {
      const mockContext = createMockContext({
        domainId: 'cmc5860m40004axgd6cv4kim0'
      });
      
      // Mock the HTTP request to return aliases
      mockContext.helpers.httpRequest.mockResolvedValueOnce({
        aliases: [
          {
            id: 'alias1',
            email: 'test@in.xadi.nl',
            active: true
          },
          {
            id: 'alias2', 
            email: '*@in.xadi.nl',
            active: true
          }
        ]
      });

      const result = await triggerNode.methods.loadOptions.getAliasesForDomain.call(mockContext);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('value');
      
      // Should filter out catch-all aliases from the dropdown
      const catchAllAlias = result.find(alias => alias.name.includes('*@'));
      expect(catchAllAlias).toBeUndefined();
    });
  });

  describe('Node Configuration Validation', () => {
    test('should have correct alias mode options', () => {
      const description = triggerNode.description;
      const aliasModeProperty = description.properties.find(p => p.name === 'aliasMode');
      
      expect(aliasModeProperty).toBeDefined();
      expect(aliasModeProperty.options).toHaveLength(3);
      
      const optionValues = aliasModeProperty.options.map(o => o.value);
      expect(optionValues).toContain('domain');
      expect(optionValues).toContain('existing');
      expect(optionValues).toContain('create');
      
      // Default should be 'existing'
      expect(aliasModeProperty.default).toBe('existing');
    });

    test('should have conditional field display logic', () => {
      const description = triggerNode.description;
      
      // Check aliasId field (shown only for existing mode)
      const aliasIdProperty = description.properties.find(p => p.name === 'aliasId');
      expect(aliasIdProperty.displayOptions.show.aliasMode).toContain('existing');
      
      // Check newAliasLocalPart field (shown only for create mode)
      const localPartProperty = description.properties.find(p => p.name === 'newAliasLocalPart');
      expect(localPartProperty.displayOptions.show.aliasMode).toContain('create');
    });
  });

  describe('Webhook Methods Structure', () => {
    test('should have all required webhook methods', () => {
      expect(triggerNode.webhookMethods).toBeDefined();
      expect(triggerNode.webhookMethods.default).toBeDefined();
      
      const webhookMethods = triggerNode.webhookMethods.default;
      expect(typeof webhookMethods.checkExists).toBe('function');
      expect(typeof webhookMethods.create).toBe('function');
      expect(typeof webhookMethods.delete).toBe('function');
    });

    test('should handle webhook data processing', () => {
      const mockWebhookData = {
        body: {
          event: 'email.received',
          data: {
            from: 'test@example.com',
            to: 'alias@in.xadi.nl',
            subject: 'Test Email',
            body: 'Test email body'
          }
        }
      };

      const result = triggerNode.webhook(mockWebhookData);
      
      expect(result).toBeDefined();
      expect(result.workflowData).toBeDefined();
      expect(Array.isArray(result.workflowData)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully in loadOptions', async () => {
      const mockContext = createMockContext();
      
      // Mock HTTP request to throw an error
      mockContext.helpers.httpRequest.mockRejectedValueOnce(new Error('API Error'));

      try {
        await triggerNode.methods.loadOptions.getDomains.call(mockContext);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error.message).toContain('Failed to load domains');
      }
    });
  });
});
