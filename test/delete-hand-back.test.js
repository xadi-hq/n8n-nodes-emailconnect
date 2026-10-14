/**
 * Tests for handing a registration back instead of deleting what is not ours.
 *
 * The incident (2026-10-14): "listen for test event" on an ACTIVE workflow
 * re-pointed the shared EmailConnect webhook at the test URL; when the test
 * session ended, teardown deleted the webhook and the cascade deleted the
 * production alias with it. Since 1.4.1:
 *  - a re-pointed webhook is pointed back where it was;
 *  - a test session that did not create() its own registration hands the
 *    webhook to the production URL;
 *  - an alias the trigger did not create (or cannot tell) is switched off on
 *    deactivation, never deleted;
 *  - only an alias create() made, for this registration's URL, is deleted.
 */

const { EmailConnectTrigger } = require('../dist/nodes/EmailConnectTrigger/EmailConnectTrigger.node.js');

jest.mock('../dist/nodes/EmailConnect/GenericFunctions.js', () => ({
  emailConnectApiRequest: jest.fn(),
  getDomainOptions: jest.fn().mockResolvedValue([]),
}));

const { emailConnectApiRequest } = require('../dist/nodes/EmailConnect/GenericFunctions.js');

const TEST_URL = 'https://n8n.example.com/webhook-test/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
const PROD_URL = 'https://n8n.example.com/webhook/d88abf53-c967-462c-b371-ddd8230e7939/emailconnect';
const TRUSTED = { 'X-EmailConnect-Source': 'n8n-node' };

function notFound() {
  return Object.assign(new Error('The resource you are requesting could not be found'), { httpCode: '404' });
}

/** Route mocked API calls by "METHOD path" so the tests read as a script of the exchange. */
function routeApi(routes) {
  emailConnectApiRequest.mockImplementation(async (method, path) => {
    const handler = routes[`${method} ${path}`];
    if (!handler) return { success: true };
    return typeof handler === 'function' ? handler() : handler;
  });
}

function calls() {
  return emailConnectApiRequest.mock.calls.map((c) => `${c[0]} ${c[1]}`);
}

describe('EmailConnectTrigger: hand back instead of delete', () => {
  let triggerNode;
  let staticData;
  let context;

  beforeEach(() => {
    triggerNode = new EmailConnectTrigger();
    emailConnectApiRequest.mockReset();
    // What an activated 1.4.1 production registration stores.
    staticData = {
      domainId: 'dom-1',
      aliasId: 'al-1',
      webhookId: 'wh-1',
      webhookName: 'hello endpoint',
      previousWebhookId: '',
      previousDomainWebhookId: '',
      previousCatchAllWebhookId: '',
      aliasMode: 'specific',
      aliasLocalPart: 'hello',
      aliasCreated: true,
      createdUrl: PROD_URL,
    };
    context = {
      getNodeWebhookUrl: jest.fn().mockReturnValue(PROD_URL),
      getWorkflowStaticData: jest.fn().mockReturnValue(staticData),
      getNode: jest.fn().mockReturnValue({ name: 'EmailConnect Trigger' }),
      getNodeParameter: jest.fn((name) => ({ aliasMode: 'specific', domainId: 'dom-1', aliasLocalPart: 'hello' })[name] ?? ''),
      getCredentials: jest.fn().mockResolvedValue({ apiKey: 'ec_test' }),
      logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
    };
  });

  const checkExists = () => triggerNode.webhookMethods.default.checkExists.call(context);
  const remove = () => triggerNode.webhookMethods.default.delete.call(context);

  describe('test session on an active workflow (the incident)', () => {
    test('re-points to the test URL, then hands the webhook back to production; nothing is deleted', async () => {
      context.getNodeWebhookUrl.mockReturnValue(TEST_URL);
      let webhookUrl = PROD_URL;
      routeApi({
        'GET /api/webhooks/wh-1': () => ({ id: 'wh-1', name: 'hello endpoint', url: webhookUrl }),
        'GET /api/aliases/al-1': { id: 'al-1', active: true },
        'POST /api/webhooks/alias': () => {
          webhookUrl = TEST_URL;
          return { success: true, action: 'updated', webhook: { id: 'wh-1' }, alias: { id: 'al-1' } };
        },
      });

      expect(await checkExists()).toBe(true);
      expect(staticData.restoreUrl).toBe(PROD_URL);

      emailConnectApiRequest.mockClear();
      expect(await remove()).toBe(true);

      expect(emailConnectApiRequest).toHaveBeenCalledWith(
        'PUT', '/api/webhooks/wh-1', { name: 'hello endpoint', url: PROD_URL }, {}, undefined, TRUSTED,
      );
      expect(calls()).not.toContain('POST /api/webhooks/alias/teardown');
      expect(calls().some((c) => c.startsWith('DELETE'))).toBe(false);
      expect(calls()).not.toContain('PUT /api/aliases/al-1');
      expect(staticData.webhookId).toBeUndefined();
    });

    test('hands back to production even when the session lost its notes', async () => {
      // Static data is the production copy: no restoreUrl, and create() never ran for the test URL.
      context.getNodeWebhookUrl.mockReturnValue(TEST_URL);
      routeApi({ 'GET /api/webhooks/wh-1': { id: 'wh-1', name: 'hello endpoint', url: TEST_URL } });

      await remove();

      expect(emailConnectApiRequest).toHaveBeenCalledWith(
        'PUT', '/api/webhooks/wh-1', { name: 'hello endpoint', url: PROD_URL }, {}, undefined, TRUSTED,
      );
      expect(calls()).not.toContain('POST /api/webhooks/alias/teardown');
    });

    test('switches the alias off again when it was off before the session', async () => {
      context.getNodeWebhookUrl.mockReturnValue(TEST_URL);
      Object.assign(staticData, { restoreUrl: PROD_URL, restoreAliasInactive: true });
      routeApi({ 'GET /api/webhooks/wh-1': { id: 'wh-1', name: 'hello endpoint', url: TEST_URL } });

      await remove();

      expect(calls()).toEqual(['GET /api/webhooks/wh-1', 'PUT /api/webhooks/wh-1', 'PUT /api/aliases/al-1']);
      expect(emailConnectApiRequest).toHaveBeenLastCalledWith('PUT', '/api/aliases/al-1', { active: false });
    });

    test('remembers the alias was off before re-pointing it', async () => {
      context.getNodeWebhookUrl.mockReturnValue(TEST_URL);
      routeApi({
        'GET /api/webhooks/wh-1': { id: 'wh-1', name: 'hello endpoint', url: PROD_URL },
        'GET /api/aliases/al-1': { id: 'al-1', active: false },
        'POST /api/webhooks/alias': { success: true, action: 'updated', webhook: { id: 'wh-1' }, alias: { id: 'al-1' } },
      });

      await checkExists();

      expect(staticData.restoreAliasInactive).toBe(true);
    });

    test('a test session that created its own alias still deletes it', async () => {
      context.getNodeWebhookUrl.mockReturnValue(TEST_URL);
      Object.assign(staticData, { aliasCreated: true, createdUrl: TEST_URL });
      routeApi({ 'POST /api/webhooks/alias/teardown': { success: true, action: 'deleted' } });

      await remove();

      expect(calls()).toEqual(['POST /api/webhooks/alias/teardown']);
    });

    test('catch-all: the session hands back to production instead of re-pointing the catch-all', async () => {
      context.getNodeWebhookUrl.mockReturnValue(TEST_URL);
      Object.assign(staticData, { aliasMode: 'catchall', aliasCreated: false, previousCatchAllWebhookId: 'wh-old' });
      routeApi({ 'GET /api/webhooks/wh-1': { id: 'wh-1', name: '*@ endpoint', url: TEST_URL } });

      await remove();

      expect(calls()).toEqual(['GET /api/webhooks/wh-1', 'PUT /api/webhooks/wh-1']);
    });
  });

  describe('workflow deactivation (production)', () => {
    test('deletes an alias this registration created', async () => {
      routeApi({ 'POST /api/webhooks/alias/teardown': { success: true, action: 'deleted' } });

      await remove();

      expect(calls()).toEqual(['POST /api/webhooks/alias/teardown']);
      expect(staticData.webhookId).toBeUndefined();
    });

    test('switches off an alias that existed before; keeps the ids for reactivation', async () => {
      staticData.aliasCreated = false;
      routeApi({ 'GET /api/webhooks/wh-1': { id: 'wh-1', name: 'hello endpoint', url: PROD_URL } });

      await remove();

      expect(calls()).toEqual(['GET /api/webhooks/wh-1', 'PUT /api/aliases/al-1']);
      expect(emailConnectApiRequest).toHaveBeenLastCalledWith('PUT', '/api/aliases/al-1', { active: false });
      expect(staticData.webhookId).toBe('wh-1');
      expect(staticData.aliasId).toBe('al-1');
    });

    test('switches off the alias of a registration from before 1.4.1 (ownership unknown)', async () => {
      delete staticData.aliasCreated;
      delete staticData.createdUrl;
      routeApi({ 'GET /api/webhooks/wh-1': { id: 'wh-1', name: 'hello endpoint', url: PROD_URL } });

      await remove();

      expect(calls()).toEqual(['GET /api/webhooks/wh-1', 'PUT /api/aliases/al-1']);
    });

    test('catch-all from before 1.4.1 keeps the restore-previous-webhook teardown', async () => {
      Object.assign(staticData, { aliasMode: 'catchall', previousCatchAllWebhookId: 'wh-old' });
      delete staticData.aliasCreated;
      delete staticData.createdUrl;
      routeApi({ 'POST /api/webhooks/alias/teardown': { success: true, action: 'restored_and_deleted' } });

      await remove();

      expect(emailConnectApiRequest).toHaveBeenCalledWith(
        'POST', '/api/webhooks/alias/teardown', expect.objectContaining({ restoreWebhookId: 'wh-old' }),
      );
    });

    test('changes nothing when another registration now owns the webhook', async () => {
      staticData.aliasCreated = false;
      routeApi({ 'GET /api/webhooks/wh-1': { id: 'wh-1', name: 'x', url: 'https://elsewhere.example/hook' } });

      await remove();

      expect(calls()).toEqual(['GET /api/webhooks/wh-1']);
      expect(staticData.webhookId).toBe('wh-1');
    });

    test('forgets the registration when the webhook is already gone', async () => {
      staticData.aliasCreated = false;
      routeApi({ 'GET /api/webhooks/wh-1': () => { throw notFound(); } });

      await remove();

      expect(calls()).toEqual(['GET /api/webhooks/wh-1']);
      expect(staticData.webhookId).toBeUndefined();
    });

    test('keeps the registration when pointing the webhook back fails', async () => {
      context.getNodeWebhookUrl.mockReturnValue(TEST_URL);
      staticData.restoreUrl = PROD_URL;
      routeApi({
        'GET /api/webhooks/wh-1': { id: 'wh-1', name: 'hello endpoint', url: TEST_URL },
        'PUT /api/webhooks/wh-1': () => { throw Object.assign(new Error('Bad gateway'), { httpCode: '502' }); },
      });

      expect(await remove()).toBe(true);

      expect(calls()).not.toContain('POST /api/webhooks/alias/teardown');
      expect(staticData.webhookId).toBe('wh-1');
      expect(context.logger.warn).toHaveBeenCalled();
    });

    test('leaves everything as it is when the webhook cannot be read', async () => {
      staticData.aliasCreated = false;
      routeApi({ 'GET /api/webhooks/wh-1': () => { throw Object.assign(new Error('socket hang up'), { httpCode: '502' }); } });

      await remove();

      expect(calls()).toEqual(['GET /api/webhooks/wh-1']);
      expect(staticData.webhookId).toBe('wh-1');
    });
  });

  describe('activation', () => {
    test('a stored registration whose alias was switched off runs create() again', async () => {
      routeApi({
        'GET /api/webhooks/wh-1': { id: 'wh-1', name: 'hello endpoint', url: PROD_URL },
        'GET /api/aliases/al-1': { id: 'al-1', active: false },
      });

      expect(await checkExists()).toBe(false);
      expect(staticData.webhookId).toBe('wh-1');
    });

    test('a current registration with its alias switched on stays as it is', async () => {
      routeApi({
        'GET /api/webhooks/wh-1': { id: 'wh-1', name: 'hello endpoint', url: PROD_URL },
        'GET /api/aliases/al-1': { id: 'al-1', active: true },
      });

      expect(await checkExists()).toBe(true);
      expect(calls()).toEqual(['GET /api/webhooks/wh-1', 'GET /api/aliases/al-1']);
    });

    test('production never remembers a stale test URL as the one to restore', async () => {
      routeApi({
        'GET /api/webhooks/wh-1': { id: 'wh-1', name: 'hello endpoint', url: TEST_URL },
        'POST /api/webhooks/alias': { success: true, action: 'updated', webhook: { id: 'wh-1' }, alias: { id: 'al-1' } },
      });

      await checkExists();

      expect(staticData.restoreUrl).toBeUndefined();
    });

    test.each([
      ['created', true],
      ['updated', false],
      ['webhook_added', false],
      ['cross_domain_update', false],
    ])('create() with upsert action %s records aliasCreated=%s for its own URL', async (action, owned) => {
      for (const key of Object.keys(staticData)) delete staticData[key];
      routeApi({
        'GET /api/domains/dom-1': { id: 'dom-1', domain: 'example.com', webhookId: null },
        'POST /api/webhooks/alias': { success: true, action, webhook: { id: 'wh-9' }, alias: { id: 'al-9' } },
      });

      expect(await triggerNode.webhookMethods.default.create.call(context)).toBe(true);

      expect(staticData.aliasCreated).toBe(owned);
      expect(staticData.createdUrl).toBe(PROD_URL);
    });
  });
});
