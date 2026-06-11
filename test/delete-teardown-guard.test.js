/**
 * Tests for delete() teardown.
 *
 * Preferred path: one atomic POST /api/webhooks/alias/teardown call. The
 * backend re-points/cascades aliases and deletes the webhook in a single
 * transaction, and honours expectedUrl as a CAS guard: when the webhook's URL
 * no longer matches this registration's URL (n8n test→prod handoff), nothing
 * is torn down — the other registration owns the webhook now.
 *
 * Fallback path (older backend without the endpoint): the legacy multi-call
 * sequence, protected by a client-side ownership probe with the same
 * URL-comparison semantics.
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

describe('EmailConnectTrigger delete()', () => {
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
      getNodeWebhookUrl: jest.fn().mockReturnValue(TEST_URL),
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

  describe('atomic teardown endpoint', () => {
    test('tears down via a single POST /api/webhooks/alias/teardown call', async () => {
      emailConnectApiRequest.mockResolvedValueOnce({ success: true, action: 'deleted' });

      const result = await triggerNode.webhookMethods.default.delete.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(1);
      expect(emailConnectApiRequest).toHaveBeenCalledWith(
        'POST',
        '/api/webhooks/alias/teardown',
        expect.objectContaining({ webhookId: WEBHOOK_ID, expectedUrl: TEST_URL }),
      );
      // Real teardown happened — registration state is gone.
      expect(mockStaticData.webhookId).toBeUndefined();
      expect(mockStaticData.aliasId).toBeUndefined();
    });

    test('keeps static data when the backend reports the registration as superseded', async () => {
      emailConnectApiRequest.mockResolvedValueOnce({
        success: true,
        action: 'skipped_superseded',
        webhook: { id: WEBHOOK_ID, url: PROD_URL },
      });

      const result = await triggerNode.webhookMethods.default.delete.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(1);
      // The live (prod) registration still relies on this state.
      expect(mockStaticData.webhookId).toBe(WEBHOOK_ID);
      expect(mockStaticData.aliasId).toBe('test-alias-id');
    });

    test('passes the previous catch-all webhook as restore target in catchall mode', async () => {
      mockStaticData.aliasMode = 'catchall';
      mockStaticData.previousCatchAllWebhookId = 'prev-catchall-webhook';
      delete mockStaticData.aliasLocalPart;
      emailConnectApiRequest.mockResolvedValueOnce({ success: true, action: 'restored_and_deleted' });

      const result = await triggerNode.webhookMethods.default.delete.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenCalledWith(
        'POST',
        '/api/webhooks/alias/teardown',
        expect.objectContaining({
          webhookId: WEBHOOK_ID,
          restoreWebhookId: 'prev-catchall-webhook',
        }),
      );
    });
  });

  describe('legacy fallback (backend without the teardown endpoint)', () => {
    test('skips teardown when the webhook URL was switched by another registration', async () => {
      // Teardown endpoint missing (older backend) …
      emailConnectApiRequest.mockRejectedValueOnce(new Error('404 Not Found'));
      // … ownership probe: webhook now carries the PROD URL.
      emailConnectApiRequest.mockResolvedValueOnce({ id: WEBHOOK_ID, url: PROD_URL, verified: true });

      const result = await triggerNode.webhookMethods.default.delete.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(2);
      expect(emailConnectApiRequest).toHaveBeenNthCalledWith(2, 'GET', `/api/webhooks/${WEBHOOK_ID}`);
      expect(mockStaticData.webhookId).toBe(WEBHOOK_ID);
    });

    test('proceeds with legacy teardown when the webhook still belongs to this registration', async () => {
      emailConnectApiRequest.mockRejectedValueOnce(new Error('404 Not Found'));
      emailConnectApiRequest.mockResolvedValueOnce({ id: WEBHOOK_ID, url: TEST_URL, verified: true });
      emailConnectApiRequest.mockResolvedValue({ success: true });

      const result = await triggerNode.webhookMethods.default.delete.call(mockContext);

      expect(result).toBe(true);
      const methods = emailConnectApiRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
      expect(methods).toContain(`DELETE /api/webhooks/${WEBHOOK_ID}`);
      expect(mockStaticData.webhookId).toBeUndefined();
    });

    test('cleans static data when the stored webhook no longer exists', async () => {
      emailConnectApiRequest.mockRejectedValueOnce(new Error('404 Not Found'));
      emailConnectApiRequest.mockRejectedValueOnce(new Error('404 Not Found'));

      const result = await triggerNode.webhookMethods.default.delete.call(mockContext);

      expect(result).toBe(true);
      expect(emailConnectApiRequest).toHaveBeenCalledTimes(2);
      expect(mockStaticData.webhookId).toBeUndefined();
      expect(mockStaticData.aliasId).toBeUndefined();
    });
  });
});
