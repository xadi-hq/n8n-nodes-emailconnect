/**
 * The X-EmailConnect-Source trusted-source header must be sent on every
 * POST /api/webhooks/alias upsert. The backend auto-verifies webhooks
 * created/updated by known integrations (n8n-node, zapier, make) based on
 * this header — the sole verification mechanism now that the autoVerify
 * body flag is deprecated and ignored server-side.
 */

const { EmailConnectTrigger } = require('../dist/nodes/EmailConnectTrigger/EmailConnectTrigger.node.js');

jest.mock('../dist/nodes/EmailConnect/GenericFunctions.js', () => ({
  emailConnectApiRequest: jest.fn(),
  getDomainOptions: jest.fn().mockResolvedValue([]),
}));

const { emailConnectApiRequest } = require('../dist/nodes/EmailConnect/GenericFunctions.js');

const TRUSTED_HEADERS = { 'X-EmailConnect-Source': 'n8n-node' };

describe('Trusted-source header on webhook/alias upsert', () => {
  let triggerNode;
  let mockContext;
  let mockStaticData;

  beforeEach(() => {
    triggerNode = new EmailConnectTrigger();
    emailConnectApiRequest.mockReset();

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
          webhookName: 'My webhook',
          webhookDescription: 'My description',
        };
        return params[param] || '';
      }),
      getCredentials: jest.fn().mockResolvedValue({ apiKey: 'test-api-key' }),
    };
  });

  test('create() sends the trusted-source header on the atomic upsert', async () => {
    const webhookUrl =
      'https://n8n.example.com/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
    mockContext.getNodeWebhookUrl.mockReturnValue(webhookUrl);

    emailConnectApiRequest
      // GET /api/domains/{id}
      .mockResolvedValueOnce({ id: 'test-domain-id', domain: 'example.com', webhookId: '' })
      // POST /api/webhooks/alias
      .mockResolvedValueOnce({
        success: true,
        webhook: { id: 'webhook-1' },
        alias: { id: 'alias-1' },
      });

    const result = await triggerNode.webhookMethods.default.create.call(mockContext);

    expect(result).toBe(true);
    expect(emailConnectApiRequest).toHaveBeenNthCalledWith(
      2,
      'POST',
      '/api/webhooks/alias',
      expect.objectContaining({
        domainId: 'test-domain-id',
        webhookUrl,
      }),
      {},
      undefined,
      expect.objectContaining(TRUSTED_HEADERS),
    );
  });

  test('checkExists() URL-switch re-upsert sends the trusted-source header', async () => {
    const storedUrl =
      'https://n8n.example.com/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
    const currentUrl =
      'https://n8n.example.com/webhook-test/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
    mockContext.getNodeWebhookUrl.mockReturnValue(currentUrl);
    mockStaticData.webhookId = 'existing-webhook-id';
    mockStaticData.aliasId = 'test-alias-id';

    emailConnectApiRequest
      // GET /api/webhooks/{id} — URL differs from current
      .mockResolvedValueOnce({ id: 'existing-webhook-id', url: storedUrl, verified: true })
      // POST /api/webhooks/alias (re-upsert)
      .mockResolvedValueOnce({
        success: true,
        webhook: { id: 'existing-webhook-id' },
        alias: { id: 'test-alias-id' },
      });

    const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

    expect(result).toBe(true);
    expect(emailConnectApiRequest).toHaveBeenNthCalledWith(
      2,
      'POST',
      '/api/webhooks/alias',
      expect.objectContaining({ webhookUrl: currentUrl }),
      {},
      undefined,
      expect.objectContaining(TRUSTED_HEADERS),
    );
  });
});
