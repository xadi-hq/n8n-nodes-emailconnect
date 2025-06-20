/**
 * Integration tests for EmailConnect webhook creation functionality
 * Tests the actual webhook creation logic with mocked API calls
 */

// Mock the emailConnectApiRequest function
jest.mock('../dist/nodes/EmailConnect/GenericFunctions.js', () => ({
  emailConnectApiRequest: jest.fn()
}));

const { EmailConnectTrigger } = require('../dist/nodes/EmailConnectTrigger/EmailConnectTrigger.node.js');
const { emailConnectApiRequest } = require('../dist/nodes/EmailConnect/GenericFunctions.js');

describe('EmailConnect Trigger Webhook Creation', () => {
  let triggerNode;
  let mockContext;

  beforeEach(() => {
    triggerNode = new EmailConnectTrigger();

    // Reset mocks
    emailConnectApiRequest.mockReset();
    
    // Mock n8n context
    mockContext = {
      getNodeWebhookUrl: jest.fn().mockReturnValue('https://test.n8n.webhook/emailconnect'),
      getNodeParameter: jest.fn(),
      getNode: jest.fn().mockReturnValue({ name: 'Test EmailConnect Trigger' }),
      getWorkflowStaticData: jest.fn().mockReturnValue({}),
      helpers: {
        returnJsonArray: jest.fn(data => data)
      }
    };
  });

  describe('Existing Alias Mode', () => {
    test('should create webhook and update existing alias', async () => {
      // Setup parameters
      mockContext.getNodeParameter
        .mockReturnValueOnce('test-domain-id') // domainId
        .mockReturnValueOnce('existing') // aliasMode
        .mockReturnValueOnce('test-alias-id'); // aliasId

      // Mock API responses
      emailConnectApiRequest
        .mockResolvedValueOnce({ // Create webhook
          webhook: { id: 'new-webhook-id' }
        })
        .mockResolvedValueOnce({}); // Update alias webhook

      // Execute webhook creation
      const result = await triggerNode.webhookMethods.default.create.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(2);

      // Verify webhook creation call
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(1, 'POST', '/api/webhooks', {
        name: 'n8n trigger webhook - Test EmailConnect Trigger',
        url: 'https://test.n8n.webhook/emailconnect',
        description: 'Auto-created webhook for n8n trigger node: Test EmailConnect Trigger'
      });

      // Verify alias webhook update call
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(2, 'PUT', '/api/aliases/test-alias-id/webhook', {
        webhookId: 'new-webhook-id'
      });
    });
  });

  describe('New Alias Creation Mode', () => {
    test('should create webhook and new specific alias atomically', async () => {
      // Setup parameters
      mockContext.getNodeParameter
        .mockReturnValueOnce('test-domain-id') // domainId
        .mockReturnValueOnce('create') // aliasMode
        .mockReturnValueOnce('testalias'); // newAliasLocalPart

      // Mock API response for atomic creation
      emailConnectApiRequest.mockResolvedValueOnce({
        success: true,
        webhook: { id: 'new-webhook-id', verified: true },
        alias: { id: 'new-alias-id', email: 'testalias@domain.com' }
      });

      // Execute webhook creation
      const result = await triggerNode.webhookMethods.default.create.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(1);

      // Verify atomic creation call
      expect(emailConnectApiRequest).toHaveBeenCalledWith('POST', '/api/webhooks/alias', {
        domainId: 'test-domain-id',
        webhookUrl: 'https://test.n8n.webhook/emailconnect',
        webhookName: 'n8n trigger webhook - Test EmailConnect Trigger',
        webhookDescription: 'Auto-created webhook for n8n trigger node: Test EmailConnect Trigger',
        autoVerify: true,
        aliasType: 'specific',
        localPart: 'testalias'
      });
    });
  });

  describe('Domain Catch-All Mode', () => {
    test('should create webhook and catch-all alias with domain sync', async () => {
      // Setup parameters
      mockContext.getNodeParameter
        .mockReturnValueOnce('test-domain-id') // domainId
        .mockReturnValueOnce('domain'); // aliasMode

      // Mock API response for catch-all creation
      emailConnectApiRequest.mockResolvedValueOnce({
        success: true,
        webhook: { id: 'new-webhook-id', verified: true },
        alias: { id: 'catchall-alias-id', email: '*@domain.com' },
        domain: { webhookUpdated: true }
      });

      // Execute webhook creation
      const result = await triggerNode.webhookMethods.default.create.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(1);

      // Verify catch-all creation call
      expect(emailConnectApiRequest).toHaveBeenCalledWith('POST', '/api/webhooks/alias', {
        domainId: 'test-domain-id',
        webhookUrl: 'https://test.n8n.webhook/emailconnect',
        webhookName: 'n8n trigger webhook - Test EmailConnect Trigger',
        webhookDescription: 'Auto-created webhook for n8n trigger node: Test EmailConnect Trigger',
        autoVerify: true,
        aliasType: 'catchall',
        syncWithDomain: true
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle API errors gracefully', async () => {
      // Setup parameters
      mockContext.getNodeParameter
        .mockReturnValueOnce('test-domain-id')
        .mockReturnValueOnce('existing')
        .mockReturnValueOnce('test-alias-id');

      // Mock API error
      emailConnectApiRequest.mockRejectedValueOnce(new Error('API Error: Domain not found'));

      // Execute and expect error
      await expect(triggerNode.webhookMethods.default.create.call(mockContext))
        .rejects.toThrow('API Error: Domain not found');
    });

    test('should handle atomic creation failures', async () => {
      // Setup parameters
      mockContext.getNodeParameter
        .mockReturnValueOnce('test-domain-id')
        .mockReturnValueOnce('create')
        .mockReturnValueOnce('testalias');

      // Mock failed atomic creation
      emailConnectApiRequest.mockResolvedValueOnce({
        success: false,
        error: 'Alias already exists'
      });

      // Execute and expect error
      await expect(triggerNode.webhookMethods.default.create.call(mockContext))
        .rejects.toThrow('Failed to create webhook and alias: Alias already exists');
    });
  });
});
