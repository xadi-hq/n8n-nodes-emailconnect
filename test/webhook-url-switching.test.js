/**
 * Test for webhook URL switching between Test and Production modes
 * Verifies that the checkExists method properly handles URL changes
 */

const { EmailConnectTrigger } = require('../dist/nodes/EmailConnectTrigger/EmailConnectTrigger.node.js');

// Mock the emailConnectApiRequest function
jest.mock('../dist/nodes/EmailConnect/GenericFunctions.js', () => ({
  emailConnectApiRequest: jest.fn(),
  getDomainOptions: jest.fn().mockResolvedValue([]),
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
    mockStaticData = {
      aliasMode: 'specific',
      domainId: 'test-domain-id',
      aliasLocalPart: 'support',
    };

    mockContext = {
      getNodeWebhookUrl: jest.fn(),
      getWorkflowStaticData: jest.fn().mockReturnValue(mockStaticData),
      getNode: jest.fn().mockReturnValue({ name: 'Test EmailConnect Trigger' }),
      getNodeParameter: jest.fn((param) => {
        const params = {
          aliasMode: 'specific',
          domainId: 'test-domain-id',
          aliasLocalPart: 'support',
        };
        return params[param] || '';
      }),
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
      mockStaticData.aliasId = 'test-alias-id';

      // Mock API responses:
      // 1. GET webhook (tryStoredWebhook)
      // 2. PUT webhook URL (updateWebhookUrlAndVerify)
      // 3. POST verify (not verified)
      // 4. POST verify/complete
      // 5. GET alias (ensureWebhookAliasLinkage)
      emailConnectApiRequest
        .mockResolvedValueOnce({ id: webhookId, url: productionUrl, name: 'Test Webhook', verified: true })
        .mockResolvedValueOnce({ verified: false }) // PUT response — not verified
        .mockResolvedValueOnce({}) // POST verify
        .mockResolvedValueOnce({}) // POST verify/complete
        .mockResolvedValueOnce({ webhookId: webhookId }); // GET alias — linkage OK

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(true);

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
      mockStaticData.aliasId = 'test-alias-id';

      emailConnectApiRequest
        .mockResolvedValueOnce({ id: webhookId, url: testUrl, name: 'Test Webhook', verified: true })
        .mockResolvedValueOnce({ verified: false })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ webhookId: webhookId });

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(true);

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

      // Mock API response — URL matches, so only 1 call
      emailConnectApiRequest.mockResolvedValueOnce({
        id: webhookId,
        url: currentUrl,
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

      expect(result).toBe(false);
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(1);
      expect(emailConnectApiRequest).toHaveBeenCalledWith('GET', `/api/webhooks/${webhookId}`);
    });

    test('should fall back to webhook list when no stored webhook ID', async () => {
      const currentUrl = 'https://n8n.axtg.mywire.org:5678/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';

      // Setup: no stored webhook ID (new webhook)
      mockContext.getNodeWebhookUrl.mockReturnValue(currentUrl);
      delete mockStaticData.webhookId;

      // Mock API response for webhook list
      emailConnectApiRequest.mockResolvedValueOnce({
        webhooks: [
          { id: 'other-webhook', url: 'https://other.url/webhook' },
          { id: 'matching-webhook', url: currentUrl }
        ]
      });

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(true);
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
      delete mockStaticData.webhookId;
      mockStaticData.aliasId = 'test-alias-id';

      // Mock API responses:
      // 1. GET /api/webhooks (fallback list)
      // 2. PUT webhook (updateWebhookUrlAndVerify)
      // 3. POST verify
      // 4. POST verify/complete
      // 5. GET alias (ensureWebhookAliasLinkage)
      emailConnectApiRequest
        .mockResolvedValueOnce({
          webhooks: [
            { id: 'other-webhook', url: 'https://other.url/webhook/different-uuid/emailconnect' },
            { id: 'existing-webhook', url: existingUrl }
          ]
        })
        .mockResolvedValueOnce({ verified: false })
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ webhookId: 'existing-webhook' });

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(true);

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
      delete mockStaticData.webhookId;

      // Mock API error
      emailConnectApiRequest.mockRejectedValueOnce(new Error('API Error'));

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(false);
    });

    test('should force recreation when alias config changed', async () => {
      const currentUrl = 'https://n8n.axtg.mywire.org:5678/webhook/some-id/emailconnect';

      mockContext.getNodeWebhookUrl.mockReturnValue(currentUrl);
      mockStaticData.webhookId = 'some-webhook-id';
      mockStaticData.aliasMode = 'catchall'; // stored as catchall

      // Current node param is 'specific' — config changed
      mockContext.getNodeParameter.mockImplementation((param) => {
        const params = { aliasMode: 'specific', domainId: 'test-domain-id', aliasLocalPart: 'support' };
        return params[param] || '';
      });

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(false);
      // Should not make any API calls — detected change before trying webhook
      expect(emailConnectApiRequest).not.toHaveBeenCalled();
    });

    test('should force recreation when migrating from old version (no stored aliasMode)', async () => {
      const currentUrl = 'https://n8n.axtg.mywire.org:5678/webhook/some-id/emailconnect';

      mockContext.getNodeWebhookUrl.mockReturnValue(currentUrl);
      mockStaticData.webhookId = 'some-webhook-id';
      delete mockStaticData.aliasMode; // old version didn't store this

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(false);
      expect(emailConnectApiRequest).not.toHaveBeenCalled();
    });
  });

  describe('URL Pattern Detection', () => {
    test('should correctly identify test URLs', async () => {
      const testUrl = 'https://n8n.axtg.mywire.org:5678/webhook-test/some-id/emailconnect';
      const webhookId = 'test-webhook-id';

      mockContext.getNodeWebhookUrl.mockReturnValue(testUrl);
      mockStaticData.webhookId = webhookId;
      mockStaticData.aliasId = 'test-alias-id';

      emailConnectApiRequest
        .mockResolvedValueOnce({
          id: webhookId,
          url: 'https://n8n.axtg.mywire.org:5678/webhook/some-id/emailconnect',
          name: 'Test Webhook'
        })
        .mockResolvedValueOnce({ verified: true }) // PUT response — already verified
        .mockResolvedValueOnce({ webhookId: webhookId }); // GET alias (ensureWebhookAliasLinkage)

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
      mockStaticData.aliasId = 'test-alias-id';

      emailConnectApiRequest
        .mockResolvedValueOnce({
          id: webhookId,
          url: 'https://n8n.axtg.mywire.org:5678/webhook-test/some-id/emailconnect',
          name: 'Test Webhook'
        })
        .mockResolvedValueOnce({ verified: true })
        .mockResolvedValueOnce({ webhookId: webhookId });

      await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      // Verify the description indicates Production mode
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(2, 'PUT', `/api/webhooks/${webhookId}`, {
        url: productionUrl,
        description: 'Auto-created webhook for n8n trigger node: Test EmailConnect Trigger (Production)'
      });
    });

    test('should skip verification when PUT response shows verified', async () => {
      const testUrl = 'https://n8n.axtg.mywire.org:5678/webhook-test/some-id/emailconnect';
      const webhookId = 'test-webhook-id';

      mockContext.getNodeWebhookUrl.mockReturnValue(testUrl);
      mockStaticData.webhookId = webhookId;
      mockStaticData.aliasId = 'test-alias-id';

      emailConnectApiRequest
        .mockResolvedValueOnce({ id: webhookId, url: 'https://other.url', name: 'Webhook' })
        .mockResolvedValueOnce({ verified: true }) // PUT response says verified
        .mockResolvedValueOnce({ webhookId: webhookId }); // ensureWebhookAliasLinkage

      await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      // Should be: GET webhook, PUT webhook, GET alias — no verify calls
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(3);
      // No POST verify calls
      const calls = emailConnectApiRequest.mock.calls;
      expect(calls.every(c => c[0] !== 'POST')).toBe(true);
    });
  });
});
