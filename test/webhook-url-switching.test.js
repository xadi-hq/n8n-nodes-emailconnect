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
    test('should re-upsert (URL + re-verify) when switching from production to test', async () => {
      const testUrl = 'https://n8n.axtg.mywire.org:5678/webhook-test/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
      const productionUrl = 'https://n8n.axtg.mywire.org:5678/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
      const webhookId = 'existing-webhook-id';

      // Setup: webhook exists with production URL, but current URL is test
      mockContext.getNodeWebhookUrl.mockReturnValue(testUrl);
      mockStaticData.webhookId = webhookId;
      mockStaticData.aliasId = 'test-alias-id';

      // 1. GET webhook (tryStoredWebhook) — URL differs
      // 2. POST /api/webhooks/alias (atomic upsert: update URL + autoVerify)
      emailConnectApiRequest
        .mockResolvedValueOnce({ id: webhookId, url: productionUrl, name: 'Test Webhook', verified: true })
        .mockResolvedValueOnce({ success: true, webhook: { id: webhookId }, alias: { id: 'test-alias-id' } });

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(1, 'GET', `/api/webhooks/${webhookId}`);
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(2, 'POST', '/api/webhooks/alias',
        expect.objectContaining({
          domainId: 'test-domain-id',
          webhookUrl: testUrl,
          aliasType: 'specific',
          localPart: 'support',
          autoVerify: true,
          webhookDescription: 'Auto-created webhook for n8n trigger node: Test EmailConnect Trigger (Test)',
        }),
      );
      // No PUT or /verify calls anymore
      const methods = emailConnectApiRequest.mock.calls.map(c => `${c[0]} ${c[1]}`);
      expect(methods.some(m => m.startsWith('PUT'))).toBe(false);
      expect(methods.some(m => m.includes('/verify'))).toBe(false);
    });

    test('should re-upsert when switching from test to production', async () => {
      const testUrl = 'https://n8n.axtg.mywire.org:5678/webhook-test/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
      const productionUrl = 'https://n8n.axtg.mywire.org:5678/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
      const webhookId = 'existing-webhook-id';

      mockContext.getNodeWebhookUrl.mockReturnValue(productionUrl);
      mockStaticData.webhookId = webhookId;
      mockStaticData.aliasId = 'test-alias-id';

      emailConnectApiRequest
        .mockResolvedValueOnce({ id: webhookId, url: testUrl, name: 'Test Webhook', verified: true })
        .mockResolvedValueOnce({ success: true, webhook: { id: webhookId }, alias: { id: 'test-alias-id' } });

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(2, 'POST', '/api/webhooks/alias',
        expect.objectContaining({
          webhookUrl: productionUrl,
          autoVerify: true,
          webhookDescription: 'Auto-created webhook for n8n trigger node: Test EmailConnect Trigger (Production)',
        }),
      );
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

      // 1. GET /api/webhooks (fallback list) — UUID match found
      // 2. POST /api/webhooks/alias (atomic upsert with the production URL)
      emailConnectApiRequest
        .mockResolvedValueOnce({
          webhooks: [
            { id: 'other-webhook', url: 'https://other.url/webhook/different-uuid/emailconnect' },
            { id: 'existing-webhook', url: existingUrl }
          ]
        })
        .mockResolvedValueOnce({ success: true, webhook: { id: 'existing-webhook' }, alias: { id: 'test-alias-id' } });

      const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(result).toBe(true);

      // Should store the matched webhook ID
      expect(mockStaticData.webhookId).toBe('existing-webhook');

      // Should re-upsert via the atomic endpoint with the current (production) URL
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(2, 'POST', '/api/webhooks/alias',
        expect.objectContaining({ webhookUrl: currentUrl, autoVerify: true }),
      );
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
    test('describes the webhook as Test mode for a /webhook-test/ URL', async () => {
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
        .mockResolvedValueOnce({ success: true, webhook: { id: webhookId }, alias: { id: 'test-alias-id' } });

      await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(2, 'POST', '/api/webhooks/alias',
        expect.objectContaining({
          webhookUrl: testUrl,
          webhookDescription: 'Auto-created webhook for n8n trigger node: Test EmailConnect Trigger (Test)',
        }),
      );
    });

    test('describes the webhook as Production mode for a /webhook/ URL', async () => {
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
        .mockResolvedValueOnce({ success: true, webhook: { id: webhookId }, alias: { id: 'test-alias-id' } });

      await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(2, 'POST', '/api/webhooks/alias',
        expect.objectContaining({
          webhookUrl: productionUrl,
          webhookDescription: 'Auto-created webhook for n8n trigger node: Test EmailConnect Trigger (Production)',
        }),
      );
    });

    test('uses the atomic upsert on URL change (no PUT or /verify calls)', async () => {
      const testUrl = 'https://n8n.axtg.mywire.org:5678/webhook-test/some-id/emailconnect';
      const webhookId = 'test-webhook-id';

      mockContext.getNodeWebhookUrl.mockReturnValue(testUrl);
      mockStaticData.webhookId = webhookId;
      mockStaticData.aliasId = 'test-alias-id';

      emailConnectApiRequest
        .mockResolvedValueOnce({ id: webhookId, url: 'https://other.url', name: 'Webhook' })
        .mockResolvedValueOnce({ success: true, webhook: { id: webhookId }, alias: { id: 'test-alias-id' } });

      await triggerNode.webhookMethods.default.checkExists.call(mockContext);

      // GET webhook + POST /api/webhooks/alias — exactly 2 calls, no PUT / verify
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(2);
      const calls = emailConnectApiRequest.mock.calls;
      expect(calls.some(c => c[0] === 'PUT')).toBe(false);
      expect(calls.some(c => typeof c[1] === 'string' && c[1].includes('/verify'))).toBe(false);
    });
  });
});
