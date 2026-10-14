/**
 * HMAC signature verification (Standard Webhooks) in the EmailConnect Trigger.
 *
 * Requests are signed by the reference `standardwebhooks` library (dev-only) —
 * an implementation independent of the node's verifier — and, for one case, by
 * a verbatim copy of EmailConnect's own signer. A verifier tested only against
 * signatures it computed itself would pass any bug symmetric across both sides.
 *
 * Also covers the activation side: the secret travels in the upsert body, a
 * changed secret forces re-registration, and existing triggers without a
 * secret are not disturbed by the upgrade.
 */

const crypto = require('crypto');
const { Webhook } = require('standardwebhooks');
const {
  EmailConnectTrigger,
  verifyWebhookSignature,
} = require('../dist/nodes/EmailConnectTrigger/EmailConnectTrigger.node.js');

jest.mock('../dist/nodes/EmailConnect/GenericFunctions.js', () => ({
  emailConnectApiRequest: jest.fn(),
  getDomainOptions: jest.fn().mockResolvedValue([]),
}));

const { emailConnectApiRequest } = require('../dist/nodes/EmailConnect/GenericFunctions.js');

const SECRET = `whsec_${crypto.randomBytes(24).toString('base64')}`;
const OTHER_SECRET = `whsec_${crypto.randomBytes(24).toString('base64')}`;
const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

/** Verbatim port of `buildStandardWebhookHeaders` (emailconnect-app, webhook-secret-crypto.ts). */
function buildStandardWebhookHeaders(webhookId, payload, secret, timestampSeconds = Math.floor(Date.now() / 1000)) {
  const key = secret.startsWith('whsec_') ? Buffer.from(secret.slice(6), 'base64') : Buffer.from(secret, 'utf8');
  const timestamp = timestampSeconds.toString();
  const signature = crypto
    .createHmac('sha256', key)
    .update(`${webhookId}.${timestamp}.${payload}`, 'utf8')
    .digest('base64');
  return {
    'webhook-id': webhookId,
    'webhook-timestamp': timestamp,
    'webhook-signature': `v1,${signature}`,
  };
}

/** Sign with the reference library, as a Standard Webhooks sender would. */
function signedHeaders(payload, { secret = SECRET, id = 'msg_email123', at = new Date() } = {}) {
  return {
    'webhook-id': id,
    'webhook-timestamp': Math.floor(at.getTime() / 1000).toString(),
    'webhook-signature': new Webhook(secret).sign(id, at, payload),
  };
}

const EMAIL_PAYLOAD = JSON.stringify({
  message: { subject: 'Invoice 42', from: { address: 'billing@example.com' } },
  envelope: {},
  domainId: 'test-domain-id',
});

describe('verifyWebhookSignature', () => {
  const body = Buffer.from(EMAIL_PAYLOAD, 'utf8');

  test('accepts a signature from the reference library', () => {
    expect(verifyWebhookSignature(SECRET, signedHeaders(EMAIL_PAYLOAD), body)).toBe(true);
  });

  test("accepts a signature from EmailConnect's own signer", () => {
    const headers = buildStandardWebhookHeaders('msg_email123', EMAIL_PAYLOAD, SECRET);
    expect(verifyWebhookSignature(SECRET, headers, body)).toBe(true);
  });

  test('verifies the raw bytes of a non-ASCII body', () => {
    // Re-serialising the parsed body would escape or reorder this differently.
    // Literal non-ASCII, an escaped code point and whitespace: bytes that
    // JSON.stringify(JSON.parse(...)) does not reproduce.
    const payload = '{"message": {"subject":"Rechnung für März — 5 €","to":"Zo\\u00eb"}, "b":1.0,"a":2}';
    expect(JSON.stringify(JSON.parse(payload))).not.toBe(payload);
    expect(verifyWebhookSignature(SECRET, signedHeaders(payload), Buffer.from(payload, 'utf8'))).toBe(true);
  });

  test('rejects a tampered body', () => {
    const headers = signedHeaders(EMAIL_PAYLOAD);
    const tampered = Buffer.from(EMAIL_PAYLOAD.replace('Invoice 42', 'Invoice 43'), 'utf8');
    expect(verifyWebhookSignature(SECRET, headers, tampered)).toBe(false);
  });

  test('rejects a tampered timestamp', () => {
    const headers = signedHeaders(EMAIL_PAYLOAD);
    headers['webhook-timestamp'] = String(Number(headers['webhook-timestamp']) - 1);
    expect(verifyWebhookSignature(SECRET, headers, body)).toBe(false);
  });

  test('rejects a tampered webhook-id', () => {
    const headers = signedHeaders(EMAIL_PAYLOAD);
    headers['webhook-id'] = 'msg_other';
    expect(verifyWebhookSignature(SECRET, headers, body)).toBe(false);
  });

  test('rejects a signature made with a different secret', () => {
    expect(verifyWebhookSignature(SECRET, signedHeaders(EMAIL_PAYLOAD, { secret: OTHER_SECRET }), body)).toBe(false);
  });

  test('rejects a timestamp more than 5 minutes old or ahead', () => {
    const now = Date.now();
    const old = signedHeaders(EMAIL_PAYLOAD, { at: new Date(now - 6 * 60 * 1000) });
    const ahead = signedHeaders(EMAIL_PAYLOAD, { at: new Date(now + 6 * 60 * 1000) });
    expect(verifyWebhookSignature(SECRET, old, body)).toBe(false);
    expect(verifyWebhookSignature(SECRET, ahead, body)).toBe(false);
  });

  test('accepts a timestamp within the 5 minute window', () => {
    const recent = signedHeaders(EMAIL_PAYLOAD, { at: new Date(Date.now() - 4 * 60 * 1000) });
    expect(verifyWebhookSignature(SECRET, recent, body)).toBe(true);
  });

  test('rejects when any signature header is missing', () => {
    for (const name of ['webhook-id', 'webhook-timestamp', 'webhook-signature']) {
      const headers = signedHeaders(EMAIL_PAYLOAD);
      delete headers[name];
      expect(verifyWebhookSignature(SECRET, headers, body)).toBe(false);
    }
  });

  test('accepts when only a later one of several space-separated signatures matches', () => {
    const headers = signedHeaders(EMAIL_PAYLOAD);
    const stale = signedHeaders(EMAIL_PAYLOAD, { secret: OTHER_SECRET })['webhook-signature'];
    headers['webhook-signature'] = `${stale} ${headers['webhook-signature']}`;
    expect(verifyWebhookSignature(SECRET, headers, body)).toBe(true);
  });

  test('ignores entries that are not v1 and signatures of the wrong length', () => {
    const headers = signedHeaders(EMAIL_PAYLOAD);
    const valid = headers['webhook-signature'].slice('v1,'.length);
    headers['webhook-signature'] = `v2,${valid} v1,c2hvcnQ=`;
    expect(verifyWebhookSignature(SECRET, headers, body)).toBe(false);
  });

  test('rejects when there is no raw body to verify', () => {
    expect(verifyWebhookSignature(SECRET, signedHeaders(EMAIL_PAYLOAD), undefined)).toBe(false);
  });

  test('rejects a legacy non-whsec_ secret', () => {
    const legacy = 'a3f1c9e2b7d4a6f8c1e3b5d7f9a2c4e6';
    const headers = buildStandardWebhookHeaders('msg_email123', EMAIL_PAYLOAD, legacy);
    expect(verifyWebhookSignature(legacy, headers, body)).toBe(false);
  });
});

describe('webhook() with a signing secret', () => {
  let triggerNode;

  const makeContext = (options) => {
    const { headers = {}, rawBody, bodyData } = options;
    // `secret: undefined` must mean "not configured", not "use the default".
    const secret = 'secret' in options ? options.secret : SECRET;
    const response = { status: jest.fn(), json: jest.fn() };
    response.status.mockReturnValue(response);
    return {
      response,
      context: {
        // Verify Signatures is on exactly when a signing secret is configured.
        getNodeParameter: jest.fn((param) => (param === 'verifySignatures' ? secret !== undefined : '')),
        getCredentials: jest.fn(async (name) =>
          name === 'emailConnectWebhookSigningApi' ? { secret } : { apiKey: 'test-api-key' }),
        getRequestObject: jest.fn().mockReturnValue({ headers, rawBody }),
        getResponseObject: jest.fn().mockReturnValue(response),
        getBodyData: jest.fn().mockReturnValue(bodyData),
        logger: { warn: jest.fn(), debug: jest.fn(), info: jest.fn(), error: jest.fn() },
      },
    };
  };

  beforeEach(() => {
    triggerNode = new EmailConnectTrigger();
  });

  test('emits a correctly signed email', async () => {
    const { context, response } = makeContext({
      headers: signedHeaders(EMAIL_PAYLOAD),
      rawBody: Buffer.from(EMAIL_PAYLOAD, 'utf8'),
      bodyData: JSON.parse(EMAIL_PAYLOAD),
    });

    const result = await triggerNode.webhook.call(context);

    expect(result.workflowData[0][0].json.message.subject).toBe('Invoice 42');
    expect(response.status).not.toHaveBeenCalled();
  });

  test('rejects an unsigned email with 401 and ends the response', async () => {
    const { context, response } = makeContext({
      rawBody: Buffer.from(EMAIL_PAYLOAD, 'utf8'),
      bodyData: JSON.parse(EMAIL_PAYLOAD),
    });

    const result = await triggerNode.webhook.call(context);

    expect(result).toEqual({ noWebhookResponse: true });
    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith({ error: 'Invalid webhook signature' });
    expect(context.logger.warn).toHaveBeenCalledWith(expect.stringContaining('reactivate the workflow'));
  });

  test('rejects an unsigned request with no body instead of emitting the test item', async () => {
    const { context, response } = makeContext({ rawBody: Buffer.alloc(0), bodyData: undefined });

    const result = await triggerNode.webhook.call(context);

    expect(result).toEqual({ noWebhookResponse: true });
    expect(response.status).toHaveBeenCalledWith(401);
  });

  test('a signed verification ping is acknowledged without starting the workflow', async () => {
    const ping = JSON.stringify({ type: 'webhook_verification', token: 'abcde' });
    const { context } = makeContext({
      headers: signedHeaders(ping, { id: 'msg_ping' }),
      rawBody: Buffer.from(ping, 'utf8'),
      bodyData: JSON.parse(ping),
    });

    expect(await triggerNode.webhook.call(context)).toEqual({ workflowData: [[]] });
  });

  test('a malformed secret in the credential fails closed', async () => {
    const { context, response } = makeContext({
      secret: 'not-a-whsec-secret',
      headers: signedHeaders(EMAIL_PAYLOAD),
      rawBody: Buffer.from(EMAIL_PAYLOAD, 'utf8'),
      bodyData: JSON.parse(EMAIL_PAYLOAD),
    });

    await triggerNode.webhook.call(context);

    expect(response.status).toHaveBeenCalledWith(401);
  });

  test('without a secret configured, unsigned requests still pass (backward compatible)', async () => {
    for (const secret of [undefined, '']) {
      const { context, response } = makeContext({
        secret,
        rawBody: Buffer.from(EMAIL_PAYLOAD, 'utf8'),
        bodyData: JSON.parse(EMAIL_PAYLOAD),
      });

      const result = await triggerNode.webhook.call(context);

      expect(result.workflowData[0][0].json.domainId).toBe('test-domain-id');
      expect(response.status).not.toHaveBeenCalled();
    }
  });
});

describe('Activation with a signing secret', () => {
  const productionUrl = 'https://n8n.example.com/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
  const testUrl = 'https://n8n.example.com/webhook-test/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
  let triggerNode;
  let staticData;
  let credentials;
  let context;

  beforeEach(() => {
    triggerNode = new EmailConnectTrigger();
    emailConnectApiRequest.mockReset();
    staticData = { aliasMode: 'specific', domainId: 'test-domain-id', aliasLocalPart: 'support' };
    credentials = { apiKey: 'test-api-key', webhookSecret: SECRET };
    context = {
      getNodeWebhookUrl: jest.fn().mockReturnValue(productionUrl),
      getWorkflowStaticData: jest.fn().mockReturnValue(staticData),
      getNode: jest.fn().mockReturnValue({ name: 'EmailConnect Trigger' }),
      getNodeParameter: jest.fn((param) => ({
        aliasMode: 'specific',
        domainId: 'test-domain-id',
        aliasLocalPart: 'support',
        // `credentials.webhookSecret` stands for this trigger's signing credential.
        verifySignatures: credentials.webhookSecret !== undefined,
      })[param] || ''),
      getCredentials: jest.fn(async (name) =>
        name === 'emailConnectWebhookSigningApi' ? { secret: credentials.webhookSecret } : { apiKey: credentials.apiKey }),
      logger: { warn: jest.fn(), debug: jest.fn(), info: jest.fn(), error: jest.fn() },
    };
  });

  const upsertBody = () => {
    const call = emailConnectApiRequest.mock.calls.find((c) => c[1] === '/api/webhooks/alias');
    return call && call[2];
  };

  test('create() sends the secret, never generateSecret, and stores only its hash', async () => {
    emailConnectApiRequest
      .mockResolvedValueOnce({ id: 'test-domain-id', domain: 'example.com', webhookId: '' })
      .mockResolvedValueOnce({ success: true, webhook: { id: 'wh-1', hasSecret: true }, alias: { id: 'al-1' } });

    await triggerNode.webhookMethods.default.create.call(context);

    expect(upsertBody().webhookSecret).toBe(SECRET);
    expect(upsertBody()).not.toHaveProperty('generateSecret');
    expect(staticData.webhookSecretHash).toBe(sha256(SECRET));
    expect(JSON.stringify(staticData)).not.toContain(SECRET);
  });

  test('create() without a secret sends none and stores no hash', async () => {
    credentials = { apiKey: 'test-api-key' };
    emailConnectApiRequest
      .mockResolvedValueOnce({ id: 'test-domain-id', domain: 'example.com', webhookId: '' })
      .mockResolvedValueOnce({ success: true, webhook: { id: 'wh-1' }, alias: { id: 'al-1' } });

    await triggerNode.webhookMethods.default.create.call(context);

    expect(upsertBody()).not.toHaveProperty('webhookSecret');
    expect(staticData).not.toHaveProperty('webhookSecretHash');
  });

  test('create() names the plan requirement when EmailConnect answers 402', async () => {
    const planError = Object.assign(new Error('Payment required'), { httpCode: '402' });
    emailConnectApiRequest
      .mockResolvedValueOnce({ id: 'test-domain-id', domain: 'example.com', webhookId: '' })
      .mockRejectedValueOnce(planError);

    await expect(triggerNode.webhookMethods.default.create.call(context)).rejects.toThrow(
      'Webhook signing requires an EmailConnect Maker plan or higher',
    );
  });

  test('create() refuses a webhook the backend reports as unsigned', async () => {
    emailConnectApiRequest
      .mockResolvedValueOnce({ id: 'test-domain-id', domain: 'example.com', webhookId: '' })
      .mockResolvedValueOnce({ success: true, webhook: { id: 'wh-1', hasSecret: false }, alias: { id: 'al-1' } });

    await expect(triggerNode.webhookMethods.default.create.call(context)).rejects.toThrow(
      'EmailConnect did not store the webhook signing secret',
    );
  });

  test('create() rejects a non-whsec_ secret before calling the API', async () => {
    credentials = { apiKey: 'test-api-key', webhookSecret: 'my-plain-password-1234' };

    await expect(triggerNode.webhookMethods.default.create.call(context)).rejects.toThrow(/whsec_/);
    expect(emailConnectApiRequest).not.toHaveBeenCalledWith('POST', '/api/webhooks/alias', expect.anything(),
      expect.anything(), undefined, expect.anything());
  });

  test('checkExists() forces re-registration when a secret is added to an existing trigger', async () => {
    Object.assign(staticData, { webhookId: 'wh-1', aliasId: 'al-1' }); // registered before signing

    const result = await triggerNode.webhookMethods.default.checkExists.call(context);

    expect(result).toBe(false);
    expect(staticData).not.toHaveProperty('webhookId');
    expect(emailConnectApiRequest).not.toHaveBeenCalled();
  });

  test('checkExists() forces re-registration when the secret is rotated', async () => {
    Object.assign(staticData, { webhookId: 'wh-1', aliasId: 'al-1', webhookSecretHash: sha256(OTHER_SECRET) });

    expect(await triggerNode.webhookMethods.default.checkExists.call(context)).toBe(false);
    expect(staticData).not.toHaveProperty('webhookSecretHash');
  });

  test('checkExists() keeps an existing trigger when neither side has a secret (upgrade path)', async () => {
    credentials = { apiKey: 'test-api-key' };
    Object.assign(staticData, { webhookId: 'wh-1', aliasId: 'al-1' });
    emailConnectApiRequest.mockResolvedValueOnce({ id: 'wh-1', url: productionUrl });

    expect(await triggerNode.webhookMethods.default.checkExists.call(context)).toBe(true);
    expect(staticData.webhookId).toBe('wh-1');
  });

  test('checkExists() keeps the trigger when the secret is unchanged', async () => {
    Object.assign(staticData, { webhookId: 'wh-1', aliasId: 'al-1', webhookSecretHash: sha256(SECRET) });
    emailConnectApiRequest
      .mockResolvedValueOnce({ id: 'wh-1', url: productionUrl, hasSecret: true })
      .mockResolvedValueOnce({ id: 'al-1', active: true });

    expect(await triggerNode.webhookMethods.default.checkExists.call(context)).toBe(true);
    // GET webhook + GET alias (still switched on), no upsert
    expect(emailConnectApiRequest).toHaveBeenCalledTimes(2);
  });

  test('checkExists() re-registers the secret when the webhook lost it in the app', async () => {
    Object.assign(staticData, { webhookId: 'wh-1', aliasId: 'al-1', webhookSecretHash: sha256(SECRET) });
    emailConnectApiRequest
      .mockResolvedValueOnce({ id: 'wh-1', url: productionUrl, hasSecret: false })
      .mockResolvedValueOnce({ success: true, webhook: { id: 'wh-1', hasSecret: true }, alias: { id: 'al-1' } });

    expect(await triggerNode.webhookMethods.default.checkExists.call(context)).toBe(true);
    expect(upsertBody().webhookSecret).toBe(SECRET);
  });

  test('the test↔production URL switch carries the secret', async () => {
    context.getNodeWebhookUrl.mockReturnValue(testUrl);
    Object.assign(staticData, { webhookId: 'wh-1', aliasId: 'al-1', webhookSecretHash: sha256(SECRET) });
    emailConnectApiRequest
      .mockResolvedValueOnce({ id: 'wh-1', url: productionUrl, hasSecret: true })
      .mockResolvedValueOnce({ id: 'al-1', active: true })
      .mockResolvedValueOnce({ success: true, webhook: { id: 'wh-1', hasSecret: true }, alias: { id: 'al-1' } });

    expect(await triggerNode.webhookMethods.default.checkExists.call(context)).toBe(true);
    expect(upsertBody()).toEqual(expect.objectContaining({ webhookUrl: testUrl, webhookSecret: SECRET }));
  });

  test('with Verify Signatures off, the signing credential is never read', async () => {
    credentials = { apiKey: 'test-api-key' };
    emailConnectApiRequest
      .mockResolvedValueOnce({ id: 'test-domain-id', domain: 'example.com', webhookId: '' })
      .mockResolvedValueOnce({ success: true, webhook: { id: 'wh-1' }, alias: { id: 'al-1' } });

    await triggerNode.webhookMethods.default.create.call(context);

    expect(context.getCredentials).not.toHaveBeenCalledWith('emailConnectWebhookSigningApi');
    expect(upsertBody()).not.toHaveProperty('webhookSecret');
  });

  test('activation refuses while a 1.4.0 secret is left on the account credential', async () => {
    context.getNodeParameter.mockImplementation((param) => ({
      aliasMode: 'specific', domainId: 'test-domain-id', aliasLocalPart: 'support', verifySignatures: false,
    })[param] || '');
    context.getCredentials.mockImplementation(async (name) =>
      name === 'emailConnectApi' ? { apiKey: 'test-api-key', webhookSecret: SECRET } : undefined);

    await expect(triggerNode.webhookMethods.default.create.call(context)).rejects.toThrow(
      'The webhook signing secret has moved from the EmailConnect API credential to the trigger',
    );
    await expect(triggerNode.webhookMethods.default.checkExists.call(context)).rejects.toThrow(/has moved/);
    expect(emailConnectApiRequest).not.toHaveBeenCalled();
  });

  test('with Verify Signatures on, the trigger secret wins over a leftover account value', async () => {
    context.getCredentials.mockImplementation(async (name) =>
      name === 'emailConnectApi' ? { apiKey: 'test-api-key', webhookSecret: 'whsec_bGVmdG92ZXI=' } : { secret: SECRET });
    emailConnectApiRequest
      .mockResolvedValueOnce({ id: 'test-domain-id', domain: 'example.com', webhookId: '' })
      .mockResolvedValueOnce({ success: true, webhook: { id: 'wh-1', hasSecret: true }, alias: { id: 'al-1' } });

    await triggerNode.webhookMethods.default.create.call(context);

    expect(upsertBody().webhookSecret).toBe(SECRET);
  });
});
