"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailConnectTrigger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const GenericFunctions_1 = require("../EmailConnect/GenericFunctions");
// Helper functions for webhook management
// Note: Verification is now handled automatically during webhook creation
// using the webhook ID's last 5 characters as the verification token
class EmailConnectTrigger {
    constructor() {
        this.description = {
            displayName: 'EmailConnect Trigger',
            name: 'emailConnectTrigger',
            icon: 'file:emailconnect.svg',
            group: ['trigger'],
            version: 1,
            description: 'Starts the workflow when EmailConnect receives an email',
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
                    displayName: 'Events',
                    name: 'events',
                    type: 'multiOptions',
                    options: [
                        {
                            name: 'Email Received',
                            value: 'email.received',
                            description: 'Triggers when an email is received and processed',
                        },
                        {
                            name: 'Email Processed',
                            value: 'email.processed',
                            description: 'Triggers when an email has been successfully processed',
                        },
                        {
                            name: 'Email Failed',
                            value: 'email.failed',
                            description: 'Triggers when email processing fails',
                        },
                    ],
                    default: ['email.received'],
                    description: 'The events to listen for',
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
                    description: 'Select the domain to configure for this trigger. The domain\'s webhook endpoint will be automatically updated to point to this n8n workflow. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Alias Name or ID',
                    name: 'aliasId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getAliasesForDomain',
                    },
                    default: '',
                    description: 'Optionally select a specific alias to configure instead of the domain catch-all. If selected, only emails to this alias will trigger the workflow. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getDomains() {
                    try {
                        const response = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', '/api/domains');
                        console.log('EmailConnect getDomains response:', response);
                        // Extract domains array from response object
                        const domains = response === null || response === void 0 ? void 0 : response.domains;
                        if (!Array.isArray(domains)) {
                            console.error('EmailConnect getDomains: Expected domains array, got:', typeof domains, response);
                            return [];
                        }
                        return domains.map((domain) => ({
                            name: `${domain.domainName} (${domain.id})`,
                            value: domain.id,
                        }));
                    }
                    catch (error) {
                        console.error('EmailConnect getDomains error:', error);
                        return [];
                    }
                },
                async getAliasesForDomain() {
                    try {
                        const domainId = this.getCurrentNodeParameter('domainId');
                        console.log('EmailConnect getAliasesForDomain domainId:', domainId);
                        if (!domainId) {
                            console.log('EmailConnect getAliasesForDomain: No domainId provided, returning empty array');
                            return [];
                        }
                        const response = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
                        console.log('EmailConnect getAliasesForDomain response:', response);
                        // Extract aliases array from response object
                        const aliases = response === null || response === void 0 ? void 0 : response.aliases;
                        if (!Array.isArray(aliases)) {
                            console.error('EmailConnect getAliasesForDomain: Expected aliases array, got:', typeof aliases, response);
                            return [];
                        }
                        return aliases.map((alias) => ({
                            name: `${alias.email} (${alias.id})`,
                            value: alias.id,
                        }));
                    }
                    catch (error) {
                        console.error('EmailConnect getAliasesForDomain error:', error);
                        return [];
                    }
                },
            },
        };
        // @ts-ignore (because of request)
        this.webhookMethods = {
            default: {
                async checkExists() {
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    try {
                        // Check if a webhook with this URL already exists
                        const response = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', '/api/webhooks');
                        const webhooks = (response === null || response === void 0 ? void 0 : response.webhooks) || [];
                        return webhooks.some((webhook) => webhook.url === webhookUrl);
                    }
                    catch (error) {
                        return false;
                    }
                },
                async create() {
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    const domainId = this.getNodeParameter('domainId');
                    const aliasId = this.getNodeParameter('aliasId');
                    try {
                        // Store previous webhook ID for restoration on delete
                        let previousWebhookId = '';
                        if (aliasId) {
                            // Get current alias webhook for restoration
                            try {
                                const alias = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/aliases/${aliasId}`);
                                previousWebhookId = alias.webhookId || '';
                            }
                            catch (error) {
                                // Ignore error, continue with empty previous webhook ID
                            }
                        }
                        else {
                            // Get current domain webhook for restoration
                            try {
                                const domain = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/domains/${domainId}`);
                                previousWebhookId = domain.webhookId || '';
                            }
                            catch (error) {
                                // Ignore error, continue with empty previous webhook ID
                            }
                        }
                        // Step 1: Create webhook in EmailConnect
                        const webhookData = {
                            name: `n8n trigger webhook - ${this.getNode().name}`,
                            url: webhookUrl,
                            description: `Auto-created webhook for n8n trigger node: ${this.getNode().name}`,
                        };
                        const createdWebhook = await GenericFunctions_1.emailConnectApiRequest.call(this, 'POST', '/api/webhooks', webhookData);
                        const webhookId = createdWebhook.webhook.id;
                        // Step 2: Assign webhook to domain or alias
                        if (aliasId) {
                            // Update specific alias webhook endpoint
                            await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}/webhook`, {
                                webhookId: webhookId
                            });
                        }
                        else {
                            // Update domain catch-all webhook endpoint
                            await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
                                webhookId: webhookId
                            });
                        }
                        // Step 3: Automatically verify the webhook
                        // Verification token is always the last 5 characters of the webhook ID
                        const verificationToken = webhookId.slice(-5);
                        try {
                            // Trigger verification process
                            await GenericFunctions_1.emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${webhookId}/verify`);
                            // Complete verification with the token
                            await GenericFunctions_1.emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${webhookId}/verify/complete`, {
                                verificationToken: verificationToken
                            });
                        }
                        catch (verificationError) {
                            // If verification fails, clean up the webhook we created
                            try {
                                await GenericFunctions_1.emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookId}`);
                            }
                            catch (cleanupError) {
                                // Log cleanup failure but don't throw
                                console.warn('Failed to cleanup webhook after verification failure:', cleanupError);
                            }
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Webhook verification failed: ${verificationError}`);
                        }
                        // Store configuration for cleanup later
                        this.getWorkflowStaticData('node').domainId = domainId;
                        this.getWorkflowStaticData('node').aliasId = aliasId;
                        this.getWorkflowStaticData('node').webhookId = webhookId;
                        this.getWorkflowStaticData('node').previousWebhookId = previousWebhookId;
                        return true;
                    }
                    catch (error) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Failed to configure webhook endpoint: ${error}`);
                    }
                },
                async delete() {
                    try {
                        // Get stored configuration
                        const domainId = this.getWorkflowStaticData('node').domainId;
                        const aliasId = this.getWorkflowStaticData('node').aliasId;
                        const webhookId = this.getWorkflowStaticData('node').webhookId;
                        const previousWebhookId = this.getWorkflowStaticData('node').previousWebhookId;
                        if (domainId) {
                            // Restore previous webhook ID
                            if (aliasId) {
                                // Restore alias webhook
                                await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}/webhook`, {
                                    webhookId: previousWebhookId || null
                                });
                            }
                            else {
                                // Restore domain webhook
                                await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
                                    webhookId: previousWebhookId || null
                                });
                            }
                            // Delete the webhook we created
                            if (webhookId) {
                                try {
                                    await GenericFunctions_1.emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookId}`);
                                }
                                catch (error) {
                                    // Log but don't fail if webhook deletion fails
                                    console.warn('Failed to delete webhook:', error);
                                }
                            }
                            // Clean up stored configuration
                            delete this.getWorkflowStaticData('node').domainId;
                            delete this.getWorkflowStaticData('node').aliasId;
                            delete this.getWorkflowStaticData('node').webhookId;
                            delete this.getWorkflowStaticData('node').previousWebhookId;
                        }
                        return true;
                    }
                    catch (error) {
                        // Don't throw error on delete failure - just log and continue
                        console.warn('Failed to restore previous webhook configuration:', error);
                        return true;
                    }
                },
            },
        };
    }
    async webhook() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        const bodyData = this.getBodyData();
        const events = this.getNodeParameter('events');
        const domainId = this.getNodeParameter('domainId');
        const aliasId = this.getNodeParameter('aliasId');
        // Always accept and process any data - return 200 with the received data
        if (!bodyData || typeof bodyData !== 'object') {
            // Return test response for empty/invalid data
            return {
                workflowData: [
                    [
                        {
                            json: {
                                test: true,
                                message: 'EmailConnect trigger webhook is working!',
                                receivedAt: new Date().toISOString(),
                                note: 'Send JSON data to see it processed'
                            },
                        },
                    ],
                ],
            };
        }
        const emailData = bodyData;
        // For any data (including EmailConnect test payloads), pass it through
        // This ensures users can test with your UI and see the exact payload structure
        // For EmailConnect production data, apply filters
        // But for test data or other payloads, always process them
        const isEmailConnectData = emailData.message || emailData.envelope || emailData.status;
        if (isEmailConnectData) {
            // Check if this event type should trigger the workflow
            const eventType = emailData.status || 'email.received';
            if (!events.includes(eventType)) {
                // Still return 200 but don't trigger workflow
                return {
                    workflowData: [
                        [
                            {
                                json: {
                                    filtered: true,
                                    reason: `Event type '${eventType}' not in configured events: ${events.join(', ')}`,
                                    receivedData: emailData,
                                    receivedAt: new Date().toISOString(),
                                },
                            },
                        ],
                    ],
                };
            }
            // Apply domain filter - check if email is for the configured domain
            if (domainId && emailData.domainId !== domainId) {
                return {
                    workflowData: [
                        [
                            {
                                json: {
                                    filtered: true,
                                    reason: `Domain ID '${emailData.domainId}' does not match configured domain '${domainId}'`,
                                    receivedData: emailData,
                                    receivedAt: new Date().toISOString(),
                                },
                            },
                        ],
                    ],
                };
            }
            // Apply alias filter if specified - check if email is for the configured alias
            if (aliasId && emailData.aliasId !== aliasId) {
                return {
                    workflowData: [
                        [
                            {
                                json: {
                                    filtered: true,
                                    reason: `Alias ID '${emailData.aliasId}' does not match configured alias '${aliasId}'`,
                                    receivedData: emailData,
                                    receivedAt: new Date().toISOString(),
                                },
                            },
                        ],
                    ],
                };
            }
        }
        // Process the data - handle both EmailConnect format and test payloads
        if (isEmailConnectData) {
            // Process EmailConnect data with proper structure
            const processedData = {
                id: emailData.id,
                domainId: emailData.domainId,
                receivedAt: emailData.receivedAt || new Date().toISOString(),
                sender: emailData.sender,
                recipient: emailData.recipient,
                subject: emailData.subject,
                status: emailData.status,
                payload: emailData.payload,
                errorMessage: emailData.errorMessage,
                // Additional structured data if available
                headers: ((_a = emailData.payload) === null || _a === void 0 ? void 0 : _a.headers) || ((_b = emailData.envelope) === null || _b === void 0 ? void 0 : _b.headers) || {},
                textContent: ((_c = emailData.payload) === null || _c === void 0 ? void 0 : _c.text) || ((_e = (_d = emailData.message) === null || _d === void 0 ? void 0 : _d.content) === null || _e === void 0 ? void 0 : _e.text) || '',
                htmlContent: ((_f = emailData.payload) === null || _f === void 0 ? void 0 : _f.html) || ((_h = (_g = emailData.message) === null || _g === void 0 ? void 0 : _g.content) === null || _h === void 0 ? void 0 : _h.html) || '',
                attachments: ((_j = emailData.payload) === null || _j === void 0 ? void 0 : _j.attachments) || ((_k = emailData.message) === null || _k === void 0 ? void 0 : _k.attachments) || [],
                // Envelope data if included
                envelope: ((_l = emailData.payload) === null || _l === void 0 ? void 0 : _l.envelope) || emailData.envelope || {},
                // Include original message structure for test payloads
                message: emailData.message,
            };
            return {
                workflowData: [
                    [
                        {
                            json: processedData,
                        },
                    ],
                ],
            };
        }
        else {
            // For any other data (test payloads, manual tests), pass through as-is
            return {
                workflowData: [
                    [
                        {
                            json: {
                                ...emailData,
                                receivedAt: new Date().toISOString(),
                                note: 'Non-EmailConnect data received and processed',
                            },
                        },
                    ],
                ],
            };
        }
    }
}
exports.EmailConnectTrigger = EmailConnectTrigger;
