"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailConnectTrigger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const GenericFunctions_1 = require("../EmailConnect/GenericFunctions");
// ---------------------------------------------------------------------------
// Helper: build the body for the atomic POST /api/webhooks/alias upsert.
// Shared by create() and the URL-change path so both use the one mechanism
// that reliably (re)verifies the webhook server-side (autoVerify).
// ---------------------------------------------------------------------------
function buildWebhookAliasBody(context, webhookUrl, webhookName, webhookDescription) {
    const aliasMode = context.getNodeParameter('aliasMode');
    const body = {
        domainId: context.getNodeParameter('domainId'),
        webhookUrl,
        webhookName,
        webhookDescription,
        firstOrCreate: true,
        updateWebhookData: true,
        autoVerify: true,
    };
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
// Helper: the webhook URL changed (e.g. n8n test↔production). Re-run the
// atomic upsert so the URL is updated AND re-verified in one call.
//
// A plain PUT /api/webhooks/{id} resets `verified` to false for any non-test
// URL, and the standalone /verify flow uses a server-generated token the node
// cannot reproduce — so autoVerify via /api/webhooks/alias is the only path
// that keeps the production webhook verified.
// ---------------------------------------------------------------------------
async function updateWebhookUrlAndVerify(context, webhookUrl) {
    var _a, _b;
    const staticData = context.getWorkflowStaticData('node');
    const isTestUrl = (webhookUrl !== null && webhookUrl !== void 0 ? webhookUrl : '').includes('/webhook-test/');
    const webhookName = staticData.webhookName
        || `n8n trigger (${context.getNode().name})`;
    const webhookDescription = `Auto-created webhook for n8n trigger node: ${context.getNode().name} (${isTestUrl ? 'Test' : 'Production'})`;
    const body = buildWebhookAliasBody(context, webhookUrl, webhookName, webhookDescription);
    const result = await GenericFunctions_1.emailConnectApiRequest.call(context, 'POST', '/api/webhooks/alias', body);
    if ((_a = result === null || result === void 0 ? void 0 : result.webhook) === null || _a === void 0 ? void 0 : _a.id)
        staticData.webhookId = result.webhook.id;
    if ((_b = result === null || result === void 0 ? void 0 : result.alias) === null || _b === void 0 ? void 0 : _b.id)
        staticData.aliasId = result.alias.id;
}
// ---------------------------------------------------------------------------
// Helper: detect whether alias/domain config changed since last save.
// Returns true if the caller should force recreation.
// ---------------------------------------------------------------------------
function detectConfigChange(context) {
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
    const changed = (storedAliasMode && storedAliasMode !== currentAliasMode) ||
        (storedDomainId && storedDomainId !== currentDomainId) ||
        (storedAliasLocalPart && storedAliasLocalPart !== currentAliasLocalPart);
    if (changed) {
        delete staticData.webhookId;
        delete staticData.aliasId;
        delete staticData.aliasMode;
        delete staticData.domainId;
        delete staticData.aliasLocalPart;
    }
    return !!changed;
}
// ---------------------------------------------------------------------------
// Helper: try to reuse the stored webhook ID.
//  - Returns true   → webhook exists & URL matches (or was updated)
//  - Returns false  → stored webhook gone, static data cleaned up
//  - Returns undefined → no stored webhook ID
// ---------------------------------------------------------------------------
async function tryStoredWebhook(context, webhookUrl) {
    const staticData = context.getWorkflowStaticData('node');
    const storedWebhookId = staticData.webhookId;
    if (!storedWebhookId)
        return undefined;
    try {
        const webhook = await GenericFunctions_1.emailConnectApiRequest.call(context, 'GET', `/api/webhooks/${storedWebhookId}`);
        if (webhook.url !== webhookUrl) {
            // URL changed (e.g. test↔prod) — re-upsert to update URL & re-verify
            await updateWebhookUrlAndVerify(context, webhookUrl);
            return true;
        }
        // URL matches — nothing changed
        return true;
    }
    catch {
        // Stored webhook no longer exists
        delete staticData.webhookId;
        delete staticData.aliasId;
        return false;
    }
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
                    if (detectConfigChange(this))
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
                            return true;
                        }
                        // UUID match (test↔prod URL variant)
                        const uuidMatch = webhookUrl.match(/\/webhook(?:-test)?\/([a-f0-9-]{36})\//);
                        if (uuidMatch) {
                            const currentUuid = uuidMatch[1];
                            const uuidHit = webhooks.find((wh) => { var _a; return (_a = wh.url) === null || _a === void 0 ? void 0 : _a.includes(currentUuid); });
                            if (uuidHit) {
                                this.getWorkflowStaticData('node').webhookId = uuidHit.id;
                                await updateWebhookUrlAndVerify(this, webhookUrl);
                                return true;
                            }
                        }
                        return false;
                    }
                    catch {
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
                        const webhookAliasData = buildWebhookAliasBody(this, webhookUrl, webhookName, webhookDescription);
                        const result = await GenericFunctions_1.emailConnectApiRequest.call(this, 'POST', '/api/webhooks/alias', webhookAliasData);
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
                        return true;
                    }
                    catch (error) {
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
                            delete staticData.domainId;
                            delete staticData.aliasId;
                            delete staticData.webhookId;
                            delete staticData.previousWebhookId;
                            delete staticData.previousDomainWebhookId;
                            delete staticData.previousCatchAllWebhookId;
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
