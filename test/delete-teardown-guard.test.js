/**
 * Test for the delete() teardown guard.
 *
 * n8n tears down the TEST webhook registration (delete()) even after the
 * workflow has been published — and test+prod share one EmailConnect
 * webhook/alias (firstOrCreate by email). Without a guard, the test-session
 * teardown re-points the alias back to the previous webhook and breaks the
 * freshly activated production registration.
 *
 * Guard: delete() must first GET the stored webhook and SKIP teardown when
 * the webhook's current URL no longer matches this registration's URL.
 */

const { EmailConnectTrigger } = require('../dist/nodes/EmailConnectTrigger/EmailConnectTrigger.node.js');

jest.mock('../dist/nodes/EmailConnect/GenericFunctions.js', () => ({
  emailConnectApiRequest: jest.fn(),
  getDomainOptions: jest.fn().mockResolvedValue([]),
}));

const { emailConnectApiRequest } = require('../dist/nodes/EmailConnect/GenericFunctions.js');

const TEST_URL = 'https://n8n.example.com/webhook-test/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
const PROD_URL = 'https://n8n.example.com/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
const WEBHOOK_ID = 'stored-webhook-id';

describe('EmailConnectTrigger delete() teardown guard', () => {
  let triggerNode;
  let mockContext;
  let mockStaticData;

  beforeEach(() => {
    triggerNode = new EmailConnectTrigger();
    emailConnectApiRequest.mockReset();

    mockStaticData = {
      domainId: 'test-domain-id',
      aliasId: 'test-alias-id',
      webhookId: WEBHOOK_ID,
      previousWebhookId: 'previous-webhook-id',
      previousDomainWebhookId: '',
      previousCatchAllWebhookId: '',
      aliasMode: 'specific',
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
      getCredentials: jest.fn().mockResolvedValue({ apiKey: 'test-api-key' }),
      logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
    };
  });

  test('skips teardown when the webhook URL was switched by another registration (test→prod handoff)', async () => {
    // This registration is the TEST one being torn down…
    mockContext.getNodeWebhookUrl.mockReturnValue(TEST_URL);
    // …but the webhook has since been re-pointed to the PROD URL by activation.
    emailConnectApiRequest.mockResolvedValueOnce({ id: WEBHOOK_ID, url: PROD_URL, verified: true });

    const result = await triggerNode.webhookMethods.default.delete.call(mockContext);

    expect(result).toBe(true);
    // Only the ownership probe — no detach/delete/restore calls.
    expect(emailConnectApiRequest).toHaveBeenCalledTimes(1);
    expect(emailConnectApiRequest).toHaveBeenCalledWith('GET', `/api/webhooks/${WEBHOOK_ID}`);
    // Static data must survive — the live (prod) registration still relies on it.
    expect(mockStaticData.webhookId).toBe(WEBHOOK_ID);
    expect(mockStaticData.aliasId).toBe('test-alias-id');
    expect(mockStaticData.domainId).toBe('test-domain-id');
  });

  test('proceeds with teardown when the webhook URL still belongs to this registration', async () => {
    mockContext.getNodeWebhookUrl.mockReturnValue(TEST_URL);
    // Ownership probe: URL matches → this registration still owns the webhook.
    emailConnectApiRequest.mockResolvedValueOnce({ id: WEBHOOK_ID, url: TEST_URL, verified: true });
    // Remaining teardown calls succeed.
    emailConnectApiRequest.mockResolvedValue({ success: true });

    const result = await triggerNode.webhookMethods.default.delete.call(mockContext);

    expect(result).toBe(true);
    const methods = emailConnectApiRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
    expect(methods).toContain(`DELETE /api/webhooks/${WEBHOOK_ID}`);
    // Static data cleaned up after a real teardown.
    expect(mockStaticData.webhookId).toBeUndefined();
    expect(mockStaticData.aliasId).toBeUndefined();
  });

  test('skips teardown and cleans static data when the stored webhook no longer exists', async () => {
    mockContext.getNodeWebhookUrl.mockReturnValue(TEST_URL);
    emailConnectApiRequest.mockRejectedValueOnce(new Error('404 Not Found'));

    const result = await triggerNode.webhookMethods.default.delete.call(mockContext);

    expect(result).toBe(true);
    expect(emailConnectApiRequest).toHaveBeenCalledTimes(1);
    const methods = emailConnectApiRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
    expect(methods).not.toContain(`DELETE /api/webhooks/${WEBHOOK_ID}`);
    // Nothing left to tear down later — clear the stale registration state.
    expect(mockStaticData.webhookId).toBeUndefined();
    expect(mockStaticData.aliasId).toBeUndefined();
  });
});
