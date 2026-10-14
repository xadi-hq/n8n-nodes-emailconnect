"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailConnectTrigger = void 0;
exports.verifyWebhookSignature = verifyWebhookSignature;
const n8n_workflow_1 = require("n8n-workflow");
const crypto_1 = require("crypto");
const GenericFunctions_1 = require("../EmailConnect/GenericFunctions");
// Sanctioned trusted-source header: the backend auto-verifies webhooks
// created/updated by known integrations (n8n-node, zapier, make). This header
// is the sole auto-verification mechanism — the old autoVerify body flag is
// deprecated and ignored server-side.
const TRUSTED_SOURCE_HEADERS = { 'X-EmailConnect-Source': 'n8n-node' };
// ---------------------------------------------------------------------------
// Webhook signing (Standard Webhooks, https://www.standardwebhooks.com).
// EmailConnect signs every delivery with HMAC-SHA256 over
// `${webhook-id}.${webhook-timestamp}.${raw body}`, keyed with the base64-decoded
// part of a `whsec_` secret. The secret is a per-trigger credential
// (emailConnectWebhookSigningApi, selected when Verify Signatures is on), so
// each webhook can have its own; the test and production registrations of one
// trigger share it, as they share one EmailConnect webhook. The node sends it
// with the upsert. Hand-rolled: verified community nodes may not have runtime
// dependencies.
// ---------------------------------------------------------------------------
const WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9+/]+={0,2}$/;
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;
const ROTATION_HINT = 'If you just changed the signing secret, deactivate and reactivate the workflow.';
const SIGNING_CREDENTIAL = 'emailConnectWebhookSigningApi';
/**
 * This trigger's signing secret, trimmed; undefined when Verify Signatures is
 * off. Read the switch first: getCredentials throws when no signing
 * credential is selected.
 */
async function readWebhookSecret(context) {
    if (!context.getNodeParameter('verifySignatures', false))
        return undefined;
    const credentials = await context.getCredentials(SIGNING_CREDENTIAL);
    const secret = typeof (credentials === null || credentials === void 0 ? void 0 : credentials.secret) === 'string' ? credentials.secret.trim() : '';
    return secret || undefined;
}
/**
 * The secret to register at activation. A value outside the `whsec_` format
 * would never verify — EmailConnect keys a non-`whsec_` secret differently — so
 * refuse it here instead of producing a trigger that rejects every delivery.
 */
async function getWebhookSecretForActivation(context) {
    const secret = await readWebhookSecret(context);
    if (secret && !WEBHOOK_SECRET_PATTERN.test(secret)) {
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), 'The EmailConnect webhook signing secret must be in "whsec_" + base64 format', { description: 'Generate one with: echo "whsec_$(openssl rand -base64 24)"' });
    }
    return secret;
}
function hashWebhookSecret(secret) {
    return secret ? (0, crypto_1.createHash)('sha256').update(secret, 'utf8').digest('hex') : undefined;
}
function firstHeader(value) {
    return Array.isArray(value) ? value[0] : value;
}
/**
 * Verify a Standard Webhooks signature against the exact bytes received.
 * `webhook-signature` may list several space-separated `v1,<base64>` entries
 * (secret rotation); any one matching is enough.
 */
function verifyWebhookSignature(secret, headers, rawBody, nowSeconds = Math.floor(Date.now() / 1000)) {
    if (!WEBHOOK_SECRET_PATTERN.test(secret) || !rawBody)
        return false;
    const id = firstHeader(headers['webhook-id']);
    const timestamp = firstHeader(headers['webhook-timestamp']);
    const signatures = firstHeader(headers['webhook-signature']);
    if (!id || !timestamp || !signatures || !/^\d+$/.test(timestamp))
        return false;
    if (Math.abs(nowSeconds - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS)
        return false;
    // HMAC over the raw bytes, never a re-serialisation of the parsed body: key
    // order and non-ASCII escaping would differ from what was signed.
    const expected = (0, crypto_1.createHmac)('sha256', Buffer.from(secret.slice('whsec_'.length), 'base64'))
        .update(`${id}.${timestamp}.`, 'utf8')
        .update(rawBody)
        .digest();
    return signatures.split(' ').some((entry) => {
        if (!entry.startsWith('v1,'))
            return false;
        const candidate = Buffer.from(entry.slice('v1,'.length), 'base64');
        // timingSafeEqual throws on a length mismatch.
        return candidate.length === expected.length && (0, crypto_1.timingSafeEqual)(candidate, expected);
    });
}
// ---------------------------------------------------------------------------
// Helper: build the body for the atomic POST /api/webhooks/alias upsert.
// Shared by create() and the URL-change path so both use the one mechanism
// that reliably (re)verifies the webhook server-side (the trusted-source
// header sent alongside this body).
// ---------------------------------------------------------------------------
function buildWebhookAliasBody(context, webhookUrl, webhookName, webhookDescription, webhookSecret) {
    const aliasMode = context.getNodeParameter('aliasMode');
    const body = {
        domainId: context.getNodeParameter('domainId'),
        webhookUrl,
        webhookName,
        webhookDescription,
        firstOrCreate: true,
        updateWebhookData: true,
    };
    // Only the client-supplied secret, never `generateSecret`: the app returns a
    // generated plaintext only on creation, so on an update it would be lost.
    if (webhookSecret)
        body.webhookSecret = webhookSecret;
    if (aliasMode === 'catchall') {
        body.aliasType = 'catchall';
        body.syncWithDomain = true;
    }
    else {
        const localPart = context.getNodeParameter('aliasLocalPart');
        if (!localPart) {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), 'Alias local part is required for specific alias mode');
        }
        body.aliasType = 'specific';
        body.localPart = localPart;
    }
    return body;
}
// ---------------------------------------------------------------------------
// Helper: run the atomic POST /api/webhooks/alias upsert. With a signing secret
// configured, turn a plan rejection into an actionable error, and refuse a
// webhook the backend reports as unsigned — the trigger would reject every
// delivery to it.
// ---------------------------------------------------------------------------
async function upsertWebhookAlias(context, body) {
    var _a;
    let result;
    try {
        result = await GenericFunctions_1.emailConnectApiRequest.call(context, 'POST', '/api/webhooks/alias', body, {}, undefined, TRUSTED_SOURCE_HEADERS);
    }
    catch (error) {
        if (body.webhookSecret && String(error.httpCode) === '402') {
            throw new n8n_workflow_1.NodeOperationError(context.getNode(), 'Webhook signing requires an EmailConnect Maker plan or higher', { description: 'Upgrade your plan, or turn off Verify Signatures on the trigger.' });
        }
        throw error;
    }
    if (body.webhookSecret && ((_a = result === null || result === void 0 ? void 0 : result.webhook) === null || _a === void 0 ? void 0 : _a.hasSecret) === false) {
        throw new n8n_workflow_1.NodeOperationError(context.getNode(), 'EmailConnect did not store the webhook signing secret', { description: 'The trigger would reject every delivery. Turn off Verify Signatures on the trigger, or contact EmailConnect support.' });
    }
    return result;
}
// ---------------------------------------------------------------------------
// Helper: the webhook URL changed (e.g. n8n test↔production). Re-run the
// atomic upsert so the URL is updated AND re-verified in one call.
//
// A plain PUT /api/webhooks/{id} resets `verified` to false for any non-test
// URL unless the trusted-source header is sent, and the standalone /verify
// flow uses a server-generated token the node cannot reproduce — so the
// trusted upsert via /api/webhooks/alias is the path that keeps the
// production webhook verified.
// ---------------------------------------------------------------------------
async function updateWebhookUrlAndVerify(context, webhookUrl, existing) {
    var _a, _b;
    const staticData = context.getWorkflowStaticData('node');
    const isTestUrl = isTestWebhookUrl(webhookUrl);
    await rememberReplacedRegistration(context, webhookUrl, existing === null || existing === void 0 ? void 0 : existing.url);
    // The upsert (updateWebhookData) overwrites name/description, and static
    // data from the test session is not available at activation — so prefer
    // the node parameter, then static data, then whatever the webhook already
    // carries. Only generate a name/description when none of those exist.
    const webhookName = context.getNodeParameter('webhookName')
        || staticData.webhookName
        || (existing === null || existing === void 0 ? void 0 : existing.name)
        || `n8n trigger (${context.getNode().name})`;
    const webhookDescription = context.getNodeParameter('webhookDescription')
        || (existing === null || existing === void 0 ? void 0 : existing.description)
        || `Auto-created webhook for n8n trigger node: ${context.getNode().name} (${isTestUrl ? 'Test' : 'Production'})`;
    const webhookSecret = await getWebhookSecretForActivation(context);
    const body = buildWebhookAliasBody(context, webhookUrl, webhookName, webhookDescription, webhookSecret);
    const result = await upsertWebhookAlias(context, body);
    if ((_a = result === null || result === void 0 ? void 0 : result.webhook) === null || _a === void 0 ? void 0 : _a.id)
        staticData.webhookId = result.webhook.id;
    if ((_b = result === null || result === void 0 ? void 0 : result.alias) === null || _b === void 0 ? void 0 : _b.id)
        staticData.aliasId = result.alias.id;
    setStoredSecretHash(staticData, webhookSecret);
}
function isTestWebhookUrl(url) {
    return (url !== null && url !== void 0 ? url : '').includes('/webhook-test/');
}
// ---------------------------------------------------------------------------
// Helper: before re-pointing an existing webhook at this registration's URL,
// remember where it pointed (and whether its alias was switched off), so
// delete() can hand it back instead of tearing it down.
//
// The case this exists for: "listen for test event" on an ACTIVE workflow.
// Test and production share one EmailConnect webhook, so the test session
// re-points it at the test URL; tearing it down when the session ends deleted
// the production alias with it (cascade). Only the first URL is kept, so
// repeated re-points within one registration restore the original.
//
// A production registration never records a /webhook-test/ URL: that is a
// stale test session, and "restoring" it on deactivation would point the
// webhook at a URL nothing listens on.
// ---------------------------------------------------------------------------
async function rememberReplacedRegistration(context, webhookUrl, previousUrl) {
    const staticData = context.getWorkflowStaticData('node');
    if (!previousUrl || previousUrl === webhookUrl || staticData.restoreUrl)
        return;
    if (!isTestWebhookUrl(webhookUrl) && isTestWebhookUrl(previousUrl))
        return;
    staticData.restoreUrl = previousUrl;
    // The upsert switches an inactive alias back on; a hand-back must switch it off again.
    const aliasId = staticData.aliasId;
    if (aliasId && staticData.aliasMode !== 'catchall') {
        try {
            const alias = await GenericFunctions_1.emailConnectApiRequest.call(context, 'GET', `/api/aliases/${aliasId}`);
            if ((alias === null || alias === void 0 ? void 0 : alias.active) === false)
                staticData.restoreAliasInactive = true;
        }
        catch (error) {
            context.logger.warn(`EmailConnect: could not read alias ${aliasId} before re-pointing it: ${error.message}`);
        }
    }
}
function setStoredSecretHash(staticData, webhookSecret) {
    const hash = hashWebhookSecret(webhookSecret);
    if (hash)
        staticData.webhookSecretHash = hash;
    else
        delete staticData.webhookSecretHash;
}
// ---------------------------------------------------------------------------
// Helper: forget everything stored about the current registration.
// ---------------------------------------------------------------------------
function clearRegistrationState(staticData) {
    delete staticData.domainId;
    delete staticData.aliasId;
    delete staticData.webhookId;
    delete staticData.previousWebhookId;
    delete staticData.previousDomainWebhookId;
    delete staticData.previousCatchAllWebhookId;
    delete staticData.webhookSecretHash;
    delete staticData.restoreUrl;
    delete staticData.restoreAliasInactive;
    delete staticData.aliasCreated;
    delete staticData.createdUrl;
}
// ---------------------------------------------------------------------------
// Helper: detect whether alias/domain config — or the credential's signing
// secret — changed since last save. Returns true if the caller should force
// recreation. Without the secret check, adding or rotating a secret on an
// existing trigger would be a silent no-op: checkExists would keep reporting
// the stored webhook as current and create() would never run.
// ---------------------------------------------------------------------------
async function detectConfigChange(context) {
    const staticData = context.getWorkflowStaticData('node');
    const storedWebhookId = staticData.webhookId;
    const storedAliasMode = staticData.aliasMode;
    // Migration: old version had no stored aliasMode → force recreation
    if (storedWebhookId && !storedAliasMode) {
        delete staticData.webhookId;
        delete staticData.aliasId;
        return true;
    }
    const currentAliasMode = context.getNodeParameter('aliasMode');
    const currentDomainId = context.getNodeParameter('domainId');
    const currentAliasLocalPart = currentAliasMode === 'specific'
        ? context.getNodeParameter('aliasLocalPart')
        : '';
    const storedDomainId = staticData.domainId;
    const storedAliasLocalPart = staticData.aliasLocalPart || '';
    // Undefined on both sides is "no change": every trigger registered before
    // signing existed has no stored hash, and must not force-recreate on upgrade.
    const currentSecretHash = hashWebhookSecret(await getWebhookSecretForActivation(context));
    const storedSecretHash = staticData.webhookSecretHash;
    const changed = (storedAliasMode && storedAliasMode !== currentAliasMode) ||
        (storedDomainId && storedDomainId !== currentDomainId) ||
        (storedAliasLocalPart && storedAliasLocalPart !== currentAliasLocalPart) ||
        (storedSecretHash !== null && storedSecretHash !== void 0 ? storedSecretHash : '') !== (currentSecretHash !== null && currentSecretHash !== void 0 ? currentSecretHash : '');
    if (changed) {
        delete staticData.webhookId;
        delete staticData.aliasId;
        delete staticData.aliasMode;
        delete staticData.domainId;
        delete staticData.aliasLocalPart;
        delete staticData.webhookSecretHash;
        delete staticData.restoreUrl;
        delete staticData.restoreAliasInactive;
        delete staticData.aliasCreated;
        delete staticData.createdUrl;
    }
    return !!changed;
}
// ---------------------------------------------------------------------------
// Helper: try to reuse the stored webhook ID.
//  - Returns true   → webhook exists & URL matches (or was updated)
//  - Returns false  → stored webhook gone (static data cleaned up), or its
//                     alias was switched off by a deactivation (ids kept), so
//                     create() runs and its upsert switches the alias back on
//  - Returns undefined → no stored webhook ID
// ---------------------------------------------------------------------------
async function tryStoredWebhook(context, webhookUrl) {
    const staticData = context.getWorkflowStaticData('node');
    const storedWebhookId = staticData.webhookId;
    if (!storedWebhookId)
        return undefined;
    try {
        const webhook = await GenericFunctions_1.emailConnectApiRequest.call(context, 'GET', `/api/webhooks/${storedWebhookId}`);
        if (webhook.url !== webhookUrl || (staticData.webhookSecretHash && webhook.hasSecret === false)) {
            // URL changed (e.g. test↔prod) — re-upsert to update URL & re-verify.
            // Also re-upsert when a secret is configured but the webhook carries
            // none (signing removed in the app): the hash only sees credential-side
            // changes, and this trigger would otherwise reject every delivery.
            await updateWebhookUrlAndVerify(context, webhookUrl, webhook);
            return true;
        }
        // URL matches. A deactivated workflow switched its alias off (see
        // handBackRegistration); have create() switch it back on.
        if (await storedAliasInactive(context))
            return false;
        return true;
    }
    catch (error) {
        // Stored webhook lookup failed — most commonly because it no longer
        // exists. We drop the stale IDs and return false so checkExists falls
        // through to its search/create path (create() is an idempotent upsert,
        // so a transient failure here won't orphan or duplicate webhooks). Log a
        // warning so the failure still surfaces in the n8n execution log.
        context.logger.warn(`EmailConnect: stored webhook ${storedWebhookId} lookup failed during checkExists; ` +
            `clearing stale state and re-resolving. Error: ${error.message}`);
        delete staticData.webhookId;
        delete staticData.aliasId;
        return false;
    }
}
// ---------------------------------------------------------------------------
// Helper: is the stored (specific) alias switched off? Errors read as "no", so
// a lookup failure never blocks activation.
// ---------------------------------------------------------------------------
async function storedAliasInactive(context) {
    const staticData = context.getWorkflowStaticData('node');
    const aliasId = staticData.aliasId;
    if (!aliasId || staticData.aliasMode === 'catchall')
        return false;
    try {
        const alias = await GenericFunctions_1.emailConnectApiRequest.call(context, 'GET', `/api/aliases/${aliasId}`);
        return (alias === null || alias === void 0 ? void 0 : alias.active) === false;
    }
    catch {
        return false;
    }
}
function isNotFoundError(error) {
    var _a;
    const e = error;
    return String(e === null || e === void 0 ? void 0 : e.httpCode) === '404' || /\b404\b/.test(String((_a = e === null || e === void 0 ? void 0 : e.message) !== null && _a !== void 0 ? _a : ''));
}
// ---------------------------------------------------------------------------
// Helper: release a registration without deleting anything that is not ours.
// Returns true when handled; false when the caller should tear down (an alias
// this registration created, or catch-all mode, whose teardown re-points the
// catch-all to its previous webhook).
//
//  1. A webhook this registration re-pointed is pointed back (restoreUrl).
//  2. A test session that did not run create() for its own URL hands the
//     webhook to the workflow's production URL. n8n is expected to keep a test
//     session's static data until it ends; if it ever does not, this keeps
//     the incident (a deleted production alias) from coming back.
//  3. A specific alias the trigger did not create, or cannot tell (every
//     registration from before 1.4.1), is switched off, not deleted: the alias
//     and its settings stay, mail to it is rejected as alias_inactive, and
//     reactivating the workflow switches it back on.
// Every write is guarded by the webhook still pointing at this registration's
// URL; otherwise another registration owns it and nothing changes.
// ---------------------------------------------------------------------------
async function handBackRegistration(context, staticData, ownUrl) {
    const createdHere = staticData.createdUrl === ownUrl;
    const ownsAlias = createdHere && staticData.aliasCreated === true;
    const catchAll = staticData.aliasMode === 'catchall';
    let restoreUrl = staticData.restoreUrl;
    if (!restoreUrl && !createdHere && isTestWebhookUrl(ownUrl)) {
        restoreUrl = ownUrl.replace('/webhook-test/', '/webhook/');
    }
    const deactivate = !restoreUrl && !ownsAlias && !catchAll;
    if (!restoreUrl && !deactivate)
        return false;
    const webhookId = staticData.webhookId;
    let webhook;
    try {
        webhook = await GenericFunctions_1.emailConnectApiRequest.call(context, 'GET', `/api/webhooks/${webhookId}`);
    }
    catch (error) {
        if (isNotFoundError(error)) {
            clearRegistrationState(staticData);
        }
        else {
            context.logger.warn(`EmailConnect: could not read webhook ${webhookId} during cleanup; left unchanged: ${error.message}`);
        }
        return true;
    }
    // Superseded: keep static data, the live registration relies on it.
    if ((webhook === null || webhook === void 0 ? void 0 : webhook.url) !== ownUrl)
        return true;
    const aliasId = staticData.aliasId;
    if (restoreUrl) {
        await GenericFunctions_1.emailConnectApiRequest.call(context, 'PUT', `/api/webhooks/${webhookId}`, { name: webhook.name, url: restoreUrl }, {}, undefined, TRUSTED_SOURCE_HEADERS);
        if (staticData.restoreAliasInactive && aliasId) {
            await GenericFunctions_1.emailConnectApiRequest.call(context, 'PUT', `/api/aliases/${aliasId}`, { active: false });
        }
        clearRegistrationState(staticData);
        return true;
    }
    // Keep the ids: the next activation finds the alias switched off and re-runs create().
    if (aliasId) {
        await GenericFunctions_1.emailConnectApiRequest.call(context, 'PUT', `/api/aliases/${aliasId}`, { active: false });
    }
    return true;
}
// ===========================================================================
class EmailConnectTrigger {
    constructor() {
        this.description = {
            displayName: 'EmailConnect Trigger',
            name: 'emailConnectTrigger',
            icon: 'file:emailconnect.svg',
            group: ['trigger'],
            version: 1,
            description: 'Trigger workflows when emails are received via EmailConnect - 100% EU-operated email service with multi-alias support',
            defaults: {
                name: 'EmailConnect Trigger',
            },
            inputs: [],
            outputs: ['main'],
            credentials: [
                {
                    name: 'emailConnectApi',
                    required: true,
                },
                {
                    name: SIGNING_CREDENTIAL,
                    required: true,
                    displayOptions: {
                        show: {
                            verifySignatures: [true],
                        },
                    },
                },
            ],
            webhooks: [
                {
                    name: 'default',
                    httpMethod: 'POST',
                    responseMode: 'onReceived',
                    path: 'emailconnect',
                },
            ],
            properties: [
                {
                    displayName: '🇪🇺 Welcome to EmailConnect',
                    name: 'gettingStarted',
                    type: 'notice',
                    default: '',
                    typeOptions: {
                        theme: 'info'
                    },
                    description: '<strong>🇪🇺 100% EU-operated email service</strong>• Multi-alias support for organized email routing• Free to start: 50 emails per month• Enterprise-grade security and compliance<strong>Quick Setup:</strong>1. <a href="https://app.emailconnect.eu/login" target="_blank">Start today →</a>2. <a href="https://app.emailconnect.eu/settings/api-keys" target="_blank">Get your API key →</a>3. Configure your domain and aliases below',
                },
                {
                    displayName: 'Domain Name or ID',
                    name: 'domainId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getDomains',
                    },
                    required: true,
                    default: '',
                    hint: 'Domain must be verified in EmailConnect before use',
                    description: 'Select the domain to configure for this trigger. The domain\'s webhook endpoint will be automatically updated to point to this n8n workflow. <strong>Note:</strong> Domain must be verified in your EmailConnect account first. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Alias Configuration',
                    name: 'aliasMode',
                    type: 'options',
                    options: [
                        {
                            name: 'Use Domain Catch-All',
                            value: 'catchall',
                            description: 'Route ALL emails to this domain through this workflow (*@yourdomain.com)',
                        },
                        {
                            name: 'Use Specific Alias',
                            value: 'specific',
                            description: 'Route specific email address to this webhook (will create if doesn\'t exist, update if exists)',
                        },
                    ],
                    default: 'specific',
                    description: 'Choose how to configure email routing for this trigger. Each option determines which emails will activate this workflow.',
                },
                {
                    displayName: 'Alias',
                    name: 'aliasLocalPart',
                    type: 'string',
                    displayOptions: {
                        show: {
                            aliasMode: ['specific'],
                        },
                    },
                    default: '',
                    required: true,
                    placeholder: 'support',
                    hint: 'Smart create/update: will use existing alias or create new one if it doesn\'t exist',
                    description: 'The local part of the email address (before @). For example, "support" creates support@yourdomain.com. If the alias already exists, its webhook will be updated. If it doesn\'t exist, a new alias will be created.',
                },
                {
                    displayName: 'Webhook Name',
                    name: 'webhookName',
                    type: 'string',
                    default: '',
                    placeholder: 'Alias endpoint trigger',
                    description: 'A descriptive name for this webhook configuration. If left empty, will default to the email address + "endpoint trigger".',
                },
                {
                    displayName: 'Webhook Description',
                    name: 'webhookDescription',
                    type: 'string',
                    default: '',
                    placeholder: 'Handles support emails via N8N workflow',
                    description: 'Optional description for this webhook configuration',
                },
                {
                    displayName: 'Verify Signatures',
                    name: 'verifySignatures',
                    type: 'boolean',
                    default: false,
                    description: 'Whether to reject any request without a valid EmailConnect signature (HTTP 401). Select an EmailConnect Webhook Signing API credential, one per trigger; the trigger stores it on its webhook when the workflow is activated. Requires an EmailConnect Maker plan or higher.',
                },
            ],
        };
        this.methods = {
            loadOptions: {
                getDomains: GenericFunctions_1.getDomainOptions,
            },
        };
        this.webhookMethods = {
            default: {
                // ------------------------------------------------------------------
                // checkExists — short orchestrator (~35 lines)
                // ------------------------------------------------------------------
                async checkExists() {
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    // 1. Config change → force recreation
                    if (await detectConfigChange(this))
                        return false;
                    // 2. Try the stored webhook ID
                    const storedResult = await tryStoredWebhook(this, webhookUrl);
                    if (storedResult !== undefined)
                        return storedResult;
                    // 3. Fallback: search all webhooks for URL or UUID match
                    try {
                        const response = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', '/api/webhooks');
                        const webhooks = (response === null || response === void 0 ? void 0 : response.webhooks) || [];
                        // Exact URL match
                        const exactMatch = webhooks.find((wh) => wh.url === webhookUrl);
                        if (exactMatch) {
                            this.getWorkflowStaticData('node').webhookId = exactMatch.id;
                            // Adopting a webhook found by URL skips create(), so a configured
                            // secret is registered only if the webhook already carries one.
                            if (await readWebhookSecret(this))
                                return false;
                            return true;
                        }
                        // UUID match (test↔prod URL variant)
                        const uuidMatch = webhookUrl.match(/\/webhook(?:-test)?\/([a-f0-9-]{36})\//);
                        if (uuidMatch) {
                            const currentUuid = uuidMatch[1];
                            const uuidHit = webhooks.find((wh) => { var _a; return (_a = wh.url) === null || _a === void 0 ? void 0 : _a.includes(currentUuid); });
                            if (uuidHit) {
                                this.getWorkflowStaticData('node').webhookId = uuidHit.id;
                                await updateWebhookUrlAndVerify(this, webhookUrl, uuidHit);
                                return true;
                            }
                        }
                        return false;
                    }
                    catch (error) {
                        // The webhook-search API call failed (network/auth/5xx). We return
                        // false so n8n proceeds to create(), which is itself idempotent:
                        // it reuses an existing alias/webhook rather than blindly creating a
                        // duplicate. We log a warning so the transient failure still surfaces
                        // in the n8n execution log for diagnosis.
                        this.logger.warn(`EmailConnect: failed to look up existing webhooks during checkExists; ` +
                            `assuming it does not exist and falling through to create(). ` +
                            `Error: ${error.message}`);
                        return false;
                    }
                },
                // ------------------------------------------------------------------
                // create — cleaned up, dead code removed
                // ------------------------------------------------------------------
                async create() {
                    var _a;
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    const domainId = this.getNodeParameter('domainId');
                    const aliasMode = this.getNodeParameter('aliasMode');
                    let webhookName = this.getNodeParameter('webhookName');
                    const webhookDescription = this.getNodeParameter('webhookDescription');
                    try {
                        // Validate the signing secret before touching the API.
                        const webhookSecret = await getWebhookSecretForActivation(this);
                        // Fetch the domain (for name + previousWebhookId restoration) and,
                        // only in catch-all mode, the existing aliases (to restore the
                        // previous catch-all webhook on delete) — concurrently.
                        const [domain, aliasesResponse] = await Promise.all([
                            GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/domains/${domainId}`),
                            aliasMode === 'catchall'
                                ? GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`).catch(() => null)
                                : Promise.resolve(null),
                        ]);
                        const previousWebhookId = domain.webhookId || '';
                        let previousCatchAllWebhookId = '';
                        if (aliasesResponse) {
                            const catchAllAlias = (aliasesResponse.aliases || []).find((a) => { var _a; return (_a = a.email) === null || _a === void 0 ? void 0 : _a.startsWith('*@'); });
                            if (catchAllAlias) {
                                previousCatchAllWebhookId = catchAllAlias.webhookId || '';
                            }
                        }
                        // Generate a default webhook name if none provided
                        if (!webhookName || webhookName.trim() === '') {
                            const domainName = domain.domain;
                            if (aliasMode === 'catchall') {
                                webhookName = `*@${domainName} endpoint trigger`;
                            }
                            else {
                                const aliasLocalPart = this.getNodeParameter('aliasLocalPart');
                                webhookName = aliasLocalPart
                                    ? `${aliasLocalPart}@${domainName} endpoint trigger`
                                    : `${domainName} endpoint trigger`;
                            }
                        }
                        // Atomic upsert: creates/updates webhook + alias and auto-verifies.
                        const webhookAliasData = buildWebhookAliasBody(this, webhookUrl, webhookName, webhookDescription, webhookSecret);
                        const result = await upsertWebhookAlias(this, webhookAliasData);
                        if (!result.success) {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Failed to create/update webhook and alias: ${result.message || 'Unknown error'}`);
                        }
                        // Store configuration for cleanup later
                        const staticData = this.getWorkflowStaticData('node');
                        staticData.domainId = domainId;
                        staticData.aliasId = ((_a = result.alias) === null || _a === void 0 ? void 0 : _a.id) || '';
                        staticData.webhookId = result.webhook.id;
                        staticData.webhookName = webhookName;
                        staticData.previousWebhookId = previousWebhookId;
                        staticData.previousDomainWebhookId = '';
                        staticData.previousCatchAllWebhookId = previousCatchAllWebhookId;
                        staticData.aliasMode = aliasMode;
                        if (aliasMode === 'specific') {
                            staticData.aliasLocalPart = this.getNodeParameter('aliasLocalPart');
                        }
                        // Only an alias this registration created may be deleted on teardown.
                        // Any other action means it existed before (made by hand, by another
                        // workflow, or by an earlier registration of this one).
                        staticData.aliasCreated = result.action === 'created';
                        // Ownership holds for the URL create() registered, nothing else: a
                        // test session starts from a copy of the production static data,
                        // and must not inherit production's right to delete.
                        staticData.createdUrl = webhookUrl;
                        setStoredSecretHash(staticData, webhookSecret);
                        return true;
                    }
                    catch (error) {
                        // Our own errors already say what to do — don't bury them in a prefix.
                        if (error instanceof n8n_workflow_1.NodeOperationError)
                            throw error;
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Failed to configure webhook endpoint: ${error}`);
                    }
                },
                // ------------------------------------------------------------------
                // delete — cleaned up logging
                // ------------------------------------------------------------------
                async delete() {
                    var _a, _b;
                    try {
                        const staticData = this.getWorkflowStaticData('node');
                        const domainId = staticData.domainId;
                        const aliasId = staticData.aliasId;
                        const webhookId = staticData.webhookId;
                        const previousWebhookId = staticData.previousWebhookId;
                        const previousDomainWebhookId = staticData.previousDomainWebhookId;
                        const previousCatchAllWebhookId = staticData.previousCatchAllWebhookId;
                        if (domainId && webhookId) {
                            const ownUrl = this.getNodeWebhookUrl('default');
                            if (await handBackRegistration(this, staticData, ownUrl))
                                return true;
                            // Preferred: one atomic backend call. It re-points/cascades the
                            // aliases and deletes the webhook in a single transaction, and
                            // honours expectedUrl as a CAS guard: n8n also tears down the TEST
                            // registration after a workflow is published, and test+prod share
                            // one EmailConnect webhook (firstOrCreate by alias email) — when
                            // the URL no longer matches, the other registration owns it now
                            // and nothing is torn down.
                            try {
                                const teardownBody = { webhookId, expectedUrl: ownUrl };
                                if (staticData.aliasMode === 'catchall') {
                                    const restoreWebhookId = previousCatchAllWebhookId || previousWebhookId;
                                    if (restoreWebhookId)
                                        teardownBody.restoreWebhookId = restoreWebhookId;
                                }
                                const teardown = await GenericFunctions_1.emailConnectApiRequest.call(this, 'POST', '/api/webhooks/alias/teardown', teardownBody);
                                if (teardown === null || teardown === void 0 ? void 0 : teardown.success) {
                                    if (teardown.action !== 'skipped_superseded') {
                                        clearRegistrationState(staticData);
                                    }
                                    return true;
                                }
                            }
                            catch (error) {
                                // Older backend without the endpoint — fall back to the legacy
                                // multi-call sequence below.
                                this.logger.warn(`EmailConnect: atomic teardown unavailable, falling back: ${error}`);
                            }
                            // Ownership probe (legacy fallback) — same semantics as the
                            // expectedUrl guard above, enforced client-side.
                            try {
                                const currentWebhook = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/webhooks/${webhookId}`);
                                if ((currentWebhook === null || currentWebhook === void 0 ? void 0 : currentWebhook.url) && ownUrl && currentWebhook.url !== ownUrl) {
                                    // Superseded — keep static data; the live registration relies on it.
                                    return true;
                                }
                            }
                            catch {
                                // Webhook already gone — nothing to tear down; drop stale state.
                                clearRegistrationState(staticData);
                                return true;
                            }
                            // Step 1: Detach the webhook
                            try {
                                if (aliasId) {
                                    await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}/webhook`, {
                                        webhookId: null,
                                    });
                                    // If catch-all, also detach from domain
                                    if (previousDomainWebhookId !== undefined) {
                                        try {
                                            const alias = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/aliases/${aliasId}`);
                                            if ((_a = alias.email) === null || _a === void 0 ? void 0 : _a.startsWith('*@')) {
                                                await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
                                                    webhookId: null,
                                                });
                                            }
                                        }
                                        catch {
                                            // non-critical
                                        }
                                    }
                                }
                                else {
                                    await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
                                        webhookId: null,
                                    });
                                    // Also detach catch-all alias if synchronized
                                    if (previousCatchAllWebhookId !== undefined) {
                                        try {
                                            const response = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
                                            const aliases = (response === null || response === void 0 ? void 0 : response.aliases) || [];
                                            const catchAllAlias = aliases.find((a) => { var _a; return (_a = a.email) === null || _a === void 0 ? void 0 : _a.startsWith('*@'); });
                                            if (catchAllAlias) {
                                                await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${catchAllAlias.id}/webhook`, {
                                                    webhookId: null,
                                                });
                                            }
                                        }
                                        catch {
                                            // non-critical
                                        }
                                    }
                                }
                            }
                            catch (error) {
                                this.logger.warn(`EmailConnect: failed to detach webhook: ${error}`);
                            }
                            // Step 2: Delete the webhook
                            try {
                                await GenericFunctions_1.emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookId}`);
                            }
                            catch (error) {
                                this.logger.warn(`EmailConnect: failed to delete webhook ${webhookId}: ${error}`);
                            }
                            // Step 3: Restore previous webhooks
                            try {
                                if (aliasId) {
                                    await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}/webhook`, {
                                        webhookId: previousWebhookId || null,
                                    });
                                    if (previousDomainWebhookId !== undefined) {
                                        try {
                                            const alias = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/aliases/${aliasId}`);
                                            if ((_b = alias.email) === null || _b === void 0 ? void 0 : _b.startsWith('*@')) {
                                                await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
                                                    webhookId: previousDomainWebhookId || null,
                                                });
                                            }
                                        }
                                        catch {
                                            // non-critical
                                        }
                                    }
                                }
                                else {
                                    await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
                                        webhookId: previousWebhookId || null,
                                    });
                                    if (previousCatchAllWebhookId !== undefined) {
                                        try {
                                            const response = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
                                            const aliases = (response === null || response === void 0 ? void 0 : response.aliases) || [];
                                            const catchAllAlias = aliases.find((a) => { var _a; return (_a = a.email) === null || _a === void 0 ? void 0 : _a.startsWith('*@'); });
                                            if (catchAllAlias) {
                                                await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${catchAllAlias.id}/webhook`, {
                                                    webhookId: previousCatchAllWebhookId || null,
                                                });
                                            }
                                        }
                                        catch {
                                            // non-critical
                                        }
                                    }
                                }
                            }
                            catch (error) {
                                this.logger.warn(`EmailConnect: failed to restore previous webhook: ${error}`);
                            }
                            // Clean up stored configuration
                            clearRegistrationState(staticData);
                        }
                        return true;
                    }
                    catch (error) {
                        this.logger.warn(`EmailConnect: error during webhook cleanup: ${error}`);
                        return true;
                    }
                },
            },
        };
    }
    async webhook() {
        // With a signing secret configured, every request must carry a valid
        // signature — checked first, so not even the no-body branch below can
        // start a run unsigned. Fail closed. `noWebhookResponse` tells n8n to send
        // nothing, so end the response here or the sender hangs until it times out.
        const webhookSecret = await readWebhookSecret(this);
        if (webhookSecret) {
            const request = this.getRequestObject();
            if (!verifyWebhookSignature(webhookSecret, request.headers, request.rawBody)) {
                this.logger.warn(`EmailConnect: rejected a request with a missing or invalid webhook signature` +
                    `${request.rawBody ? '' : ' (n8n provided no raw request body to verify)'}. ${ROTATION_HINT}`);
                this.getResponseObject().status(401).json({ error: 'Invalid webhook signature' });
                return { noWebhookResponse: true };
            }
        }
        const bodyData = this.getBodyData();
        // No / invalid body — typically the n8n "listen for test event" probe.
        if (!bodyData || typeof bodyData !== 'object') {
            return {
                workflowData: [
                    [
                        {
                            json: {
                                test: true,
                                message: 'EmailConnect trigger webhook is working!',
                                receivedAt: new Date().toISOString(),
                                note: 'Send JSON data to see it processed',
                            },
                        },
                    ],
                ],
            };
        }
        const emailData = bodyData;
        // Webhook verification handshake — acknowledge with 200 but don't start
        // the workflow with an internal verification payload.
        if (emailData.type === 'webhook_verification') {
            return { workflowData: [[]] };
        }
        // Emit the EmailConnect payload exactly as received. Delivery is already
        // scoped to this alias/domain server-side, so no client-side domain/alias
        // or event filtering is applied. Email content is under `message.*`,
        // routing/headers under `envelope.*`, plus top-level `domainId`/`aliasId`.
        return {
            workflowData: [[{ json: emailData }]],
        };
    }
}
exports.EmailConnectTrigger = EmailConnectTrigger;
