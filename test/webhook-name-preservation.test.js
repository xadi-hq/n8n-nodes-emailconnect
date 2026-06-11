/**
 * The test→prod URL switch must not clobber the user's webhook name.
 *
 * Observed: a user names their webhook "debug-flow-webhook" (node parameter),
 * tests, then publishes. The production activation runs with empty static
 * data, so updateWebhookUrlAndVerify fell back to "n8n trigger (<node>)" and
 * the upsert (updateWebhookData: true) renamed the webhook — looking like the
 * original webhook vanished and a new one appeared.
 *
 * Name/description precedence on URL switch:
 *   node parameter → staticData → the webhook's current values → generated.
 */

const { EmailConnectTrigger } = require('../dist/nodes/EmailConnectTrigger/EmailConnectTrigger.node.js');

jest.mock('../dist/nodes/EmailConnect/GenericFunctions.js', () => ({
  emailConnectApiRequest: jest.fn(),
  getDomainOptions: jest.fn().mockResolvedValue([]),
}));

const { emailConnectApiRequest } = require('../dist/nodes/EmailConnect/GenericFunctions.js');

const TEST_URL = 'https://n8n.example.com/webhook-test/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
const PROD_URL = 'https://n8n.example.com/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
const WEBHOOK_ID = 'existing-webhook-id';

describe('webhook name preservation on URL switch', () => {
  let triggerNode;
  let mockContext;
  let mockStaticData;
  let nodeParams;

  beforeEach(() => {
    triggerNode = new EmailConnectTrigger();
    emailConnectApiRequest.mockReset();

    // Activation context: static data did NOT survive the test session.
    mockStaticData = {};
    nodeParams = {
      aliasMode: 'specific',
      domainId: 'test-domain-id',
      aliasLocalPart: 'debug-flow-alias',
      webhookName: '',
      webhookDescription: '',
    };

    mockContext = {
      getNodeWebhookUrl: jest.fn().mockReturnValue(PROD_URL),
      getWorkflowStaticData: jest.fn().mockReturnValue(mockStaticData),
      getNode: jest.fn().mockReturnValue({ name: 'EmailConnect Trigger' }),
      getNodeParameter: jest.fn((param) => nodeParams[param] ?? ''),
      getCredentials: jest.fn().mockResolvedValue({ apiKey: 'test-api-key' }),
      logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
    };
  });

  test('keeps the webhook\'s current name and description when no parameter is set (UUID-match path)', async () => {
    // checkExists fallback: list lookup finds the test-URL webhook by UUID.
    emailConnectApiRequest
      .mockResolvedValueOnce({
        webhooks: [
          {
            id: WEBHOOK_ID,
            url: TEST_URL,
            name: 'debug-flow-webhook',
            description: 'My own description',
          },
        ],
      })
      .mockResolvedValueOnce({ success: true, webhook: { id: WEBHOOK_ID }, alias: { id: 'alias-id' } });

    const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

    expect(result).toBe(true);
    expect(emailConnectApiRequest).toHaveBeenNthCalledWith(
      2,
      'POST',
      '/api/webhooks/alias',
      expect.objectContaining({
        webhookUrl: PROD_URL,
        webhookName: 'debug-flow-webhook',
        webhookDescription: 'My own description',
      }),
      {},
      undefined,
      { 'X-EmailConnect-Source': 'n8n-node' },
    );
  });

  test('keeps the webhook\'s current name on the stored-webhook path too', async () => {
    mockStaticData.webhookId = WEBHOOK_ID;
    mockStaticData.aliasMode = 'specific';
    mockStaticData.domainId = 'test-domain-id';
    mockStaticData.aliasLocalPart = 'debug-flow-alias';

    emailConnectApiRequest
      .mockResolvedValueOnce({
        id: WEBHOOK_ID,
        url: TEST_URL,
        name: 'debug-flow-webhook',
        description: 'My own description',
      })
      .mockResolvedValueOnce({ success: true, webhook: { id: WEBHOOK_ID }, alias: { id: 'alias-id' } });

    const result = await triggerNode.webhookMethods.default.checkExists.call(mockContext);

    expect(result).toBe(true);
    expect(emailConnectApiRequest).toHaveBeenNthCalledWith(
      2,
      'POST',
      '/api/webhooks/alias',
      expect.objectContaining({
        webhookName: 'debug-flow-webhook',
        webhookDescription: 'My own description',
      }),
      {},
      undefined,
      { 'X-EmailConnect-Source': 'n8n-node' },
    );
  });

  test('an explicit webhookName parameter wins over the current name', async () => {
    nodeParams.webhookName = 'param-name';
    mockStaticData.webhookId = WEBHOOK_ID;
    mockStaticData.aliasMode = 'specific';
    mockStaticData.domainId = 'test-domain-id';
    mockStaticData.aliasLocalPart = 'debug-flow-alias';

    emailConnectApiRequest
      .mockResolvedValueOnce({ id: WEBHOOK_ID, url: TEST_URL, name: 'debug-flow-webhook' })
      .mockResolvedValueOnce({ success: true, webhook: { id: WEBHOOK_ID }, alias: { id: 'alias-id' } });

    await triggerNode.webhookMethods.default.checkExists.call(mockContext);

    expect(emailConnectApiRequest).toHaveBeenNthCalledWith(
      2,
      'POST',
      '/api/webhooks/alias',
      expect.objectContaining({ webhookName: 'param-name' }),
      {},
      undefined,
      { 'X-EmailConnect-Source': 'n8n-node' },
    );
  });
});
