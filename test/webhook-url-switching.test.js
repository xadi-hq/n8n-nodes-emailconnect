/**
 * Test for webhook URL switching between Test and Production modes
 * Verifies that the checkExists method properly handles URL changes
 */

const { EmailConnectTrigger } = require('../dist/nodes/EmailConnectTrigger/EmailConnectTrigger.node.js');

// Mock the emailConnectApiRequest function
jest.mock('../dist/nodes/EmailConnect/GenericFunctions.js', () => ({
  emailConnectApiRequest: jest.fn()
}));

const { emailConnectApiRequest } = require('../dist/nodes/EmailConnect/GenericFunctions.js');

describe('EmailConnect Webhook URL Switching', () => {
  let triggerNode;
  let mockContext;
  let mockStaticData;

  beforeEach(() => {
    triggerNode = new EmailConnectTrigger();
    emailConnectApiRequest.mockReset();
    
    // Mock static data storage
    mockStaticData = {};
    
    mockContext = {
      getNodeWebhookUrl: jest.fn(),
      getWorkflowStaticData: jest.fn().mockReturnValue(mockStaticData),
      getNode: jest.fn().mockReturnValue({ name: 'Test EmailConnect Trigger' }),
      getCredentials: jest.fn().mockResolvedValue({
        apiKey: 'test-api-key',
        baseUrl: 'http://localhost:3000'
      })
    };
  });

  describe('URL Change Detection and Update', () => {
    test('should update webhook URL when switching from production to test', async () => {
      const testUrl = 'https://n8n.axtg.mywire.org:5678/webhook-test/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
      const productionUrl = 'https://n8n.axtg.mywire.org:5678/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
      const webhookId = 'existing-webhook-id';

      // Setup: webhook exists with production URL, but current URL is test
      mockContext.getNodeWebhookUrl.mockReturnValue(testUrl);
      mockStaticData.webhookId = webhookId;

      // Mock API responses
      emailConnectApiRequest
        .mockResolvedValueOnce({ // GET /api/webhooks/{id}
          id: webhookId,
          url: productionUrl, // Current webhook has production URL
          name: 'Test Webhook',
          verified: true
        })
        .mockResolvedValueOnce({}) // PUT /api/webhooks/{id} - update response
        .mockResolvedValueOnce({}) // POST /api/webhooks/{id}/verify
        .mockResolvedValueOnce({}); // POST /api/webhooks/{id}/verify/complete

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(4);
      
      // Verify webhook lookup
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(1, 'GET', `/api/webhooks/${webhookId}`);
      
      // Verify webhook update with test URL and description
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(2, 'PUT', `/api/webhooks/${webhookId}`, {
        url: testUrl,
        description: 'Auto-created webhook for n8n trigger node: Test EmailConnect Trigger (Test)'
      });

      // Verify webhook verification calls
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(3, 'POST', `/api/webhooks/${webhookId}/verify`);
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(4, 'POST', `/api/webhooks/${webhookId}/verify/complete`, {
        verificationToken: webhookId.slice(-5)
      });
    });

    test('should update webhook URL when switching from test to production', async () => {
      const testUrl = 'https://n8n.axtg.mywire.org:5678/webhook-test/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
      const productionUrl = 'https://n8n.axtg.mywire.org:5678/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
      const webhookId = 'existing-webhook-id';

      // Setup: webhook exists with test URL, but current URL is production
      mockContext.getNodeWebhookUrl.mockReturnValue(productionUrl);
      mockStaticData.webhookId = webhookId;

      // Mock API responses
      emailConnectApiRequest
        .mockResolvedValueOnce({ // GET /api/webhooks/{id}
          id: webhookId,
          url: testUrl, // Current webhook has test URL
          name: 'Test Webhook',
          verified: true
        })
        .mockResolvedValueOnce({}) // PUT /api/webhooks/{id} - update response
        .mockResolvedValueOnce({}) // POST /api/webhooks/{id}/verify
        .mockResolvedValueOnce({}); // POST /api/webhooks/{id}/verify/complete

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(4);

      // Verify webhook update with production URL and description
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(2, 'PUT', `/api/webhooks/${webhookId}`, {
        url: productionUrl,
        description: 'Auto-created webhook for n8n trigger node: Test EmailConnect Trigger (Production)'
      });

      // Verify webhook verification calls
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(3, 'POST', `/api/webhooks/${webhookId}/verify`);
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(4, 'POST', `/api/webhooks/${webhookId}/verify/complete`, {
        verificationToken: webhookId.slice(-5)
      });
    });

    test('should return true when webhook URL matches (no update needed)', async () => {
      const currentUrl = 'https://n8n.axtg.mywire.org:5678/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
      const webhookId = 'existing-webhook-id';

      // Setup: webhook exists with same URL as current
      mockContext.getNodeWebhookUrl.mockReturnValue(currentUrl);
      mockStaticData.webhookId = webhookId;

      // Mock API response
      emailConnectApiRequest.mockResolvedValueOnce({ // GET /api/webhooks/{id}
        id: webhookId,
        url: currentUrl, // Same URL - no update needed
        name: 'Test Webhook',
        verified: true
      });

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(1);
      
      // Should only check webhook, not update it
      expect(emailConnectApiRequest).toHaveBeenCalledWith('GET', `/api/webhooks/${webhookId}`);
    });

    test('should handle stored webhook not found (return false to trigger recreation)', async () => {
      const currentUrl = 'https://n8n.axtg.mywire.org:5678/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
      const webhookId = 'non-existent-webhook-id';

      // Setup: stored webhook ID but webhook doesn't exist
      mockContext.getNodeWebhookUrl.mockReturnValue(currentUrl);
      mockStaticData.webhookId = webhookId;

      // Mock API error (webhook not found)
      emailConnectApiRequest.mockRejectedValueOnce(new Error('Webhook not found'));

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(false); // Should return false to trigger recreation
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(1);
      expect(emailConnectApiRequest).toHaveBeenCalledWith('GET', `/api/webhooks/${webhookId}`);
    });

    test('should fall back to original logic when no stored webhook ID', async () => {
      const currentUrl = 'https://n8n.axtg.mywire.org:5678/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';

      // Setup: no stored webhook ID (new webhook)
      mockContext.getNodeWebhookUrl.mockReturnValue(currentUrl);
      // mockStaticData.webhookId is undefined

      // Mock API response for webhook list
      emailConnectApiRequest.mockResolvedValueOnce({
        webhooks: [
          { id: 'other-webhook', url: 'https://other.url/webhook' },
          { id: 'matching-webhook', url: currentUrl }
        ]
      });

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(true); // Found matching webhook in list
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(1);
      expect(emailConnectApiRequest).toHaveBeenCalledWith('GET', '/api/webhooks');

      // Should store the webhook ID for future use
      expect(mockStaticData.webhookId).toBe('matching-webhook');
    });

    test('should find and update webhook using UUID matching when no stored ID', async () => {
      const uuid = '20ac1a5c-f665-4984-8bb7-36ba51d0c28a';
      const currentUrl = `https://n8n.axtg.mywire.org:5678/webhook/${uuid}/emailconnect`;
      const existingUrl = `https://n8n.axtg.mywire.org:5678/webhook-test/${uuid}/emailconnect`;

      // Setup: no stored webhook ID but webhook exists with same UUID, different test/prod mode
      mockContext.getNodeWebhookUrl.mockReturnValue(currentUrl);
      mockContext.getNode.mockReturnValue({ id: 'some-node-id', name: 'Test EmailConnect Trigger' });
      // mockStaticData.webhookId is undefined

      // Mock API responses
      emailConnectApiRequest
        .mockResolvedValueOnce({ // GET /api/webhooks
          webhooks: [
            { id: 'other-webhook', url: 'https://other.url/webhook/different-uuid/emailconnect' },
            { id: 'existing-webhook', url: existingUrl } // Same UUID, different test/prod mode
          ]
        })
        .mockResolvedValueOnce({}) // PUT /api/webhooks/{id} - update response
        .mockResolvedValueOnce({}) // POST /api/webhooks/{id}/verify
        .mockResolvedValueOnce({}); // POST /api/webhooks/{id}/verify/complete

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(4);

      // Should store the webhook ID
      expect(mockStaticData.webhookId).toBe('existing-webhook');

      // Should update the webhook URL from test to production
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(2, 'PUT', '/api/webhooks/existing-webhook', {
        url: currentUrl,
        description: 'Auto-created webhook for n8n trigger node: Test EmailConnect Trigger (Production)'
      });

      // Should verify the webhook
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(3, 'POST', '/api/webhooks/existing-webhook/verify');
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(4, 'POST', '/api/webhooks/existing-webhook/verify/complete', {
        verificationToken: 'bhook' // last 5 chars of 'existing-webhook'
      });
    });



    test('should handle API errors gracefully', async () => {
      const currentUrl = 'https://n8n.axtg.mywire.org:5678/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';

      mockContext.getNodeWebhookUrl.mockReturnValue(currentUrl);

      // Mock API error
      emailConnectApiRequest.mockRejectedValueOnce(new Error('API Error'));

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(false); // Should return false on error
    });
  });

  describe('URL Pattern Detection', () => {
    test('should correctly identify test URLs', async () => {
      const testUrl = 'https://n8n.axtg.mywire.org:5678/webhook-test/some-id/emailconnect';
      const webhookId = 'test-webhook-id';

      mockContext.getNodeWebhookUrl.mockReturnValue(testUrl);
      mockStaticData.webhookId = webhookId;

      emailConnectApiRequest
        .mockResolvedValueOnce({
          id: webhookId,
          url: 'https://n8n.axtg.mywire.org:5678/webhook/some-id/emailconnect', // Production URL
          name: 'Test Webhook'
        })
        .mockResolvedValueOnce({});

      await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      // Verify the description indicates Test mode
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(2, 'PUT', `/api/webhooks/${webhookId}`, {
        url: testUrl,
        description: 'Auto-created webhook for n8n trigger node: Test EmailConnect Trigger (Test)'
      });
    });

    test('should correctly identify production URLs', async () => {
      const productionUrl = 'https://n8n.axtg.mywire.org:5678/webhook/some-id/emailconnect';
      const webhookId = 'prod-webhook-id';

      mockContext.getNodeWebhookUrl.mockReturnValue(productionUrl);
      mockStaticData.webhookId = webhookId;

      emailConnectApiRequest
        .mockResolvedValueOnce({
          id: webhookId,
          url: 'https://n8n.axtg.mywire.org:5678/webhook-test/some-id/emailconnect', // Test URL
          name: 'Test Webhook'
        })
        .mockResolvedValueOnce({});

      await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      // Verify the description indicates Production mode
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(2, 'PUT', `/api/webhooks/${webhookId}`, {
        url: productionUrl,
        description: 'Auto-created webhook for n8n trigger node: Test EmailConnect Trigger (Production)'
      });
    });
  });
});
