"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailConnectTrigger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
const GenericFunctions_1 = require("../EmailConnect/GenericFunctions");
// Helper functions for webhook management
async function verifyWebhook(webhookId) {
    // Step 1: Trigger verification (EmailConnect will POST to our webhook)
    await GenericFunctions_1.emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${webhookId}/verify`);
    // Step 2: Wait for verification POST to arrive and token to be stored
    let attempts = 0;
    const maxAttempts = 10;
    let verificationToken;
    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        verificationToken = this.getWorkflowStaticData('node').verificationToken;
        if (verificationToken) {
            break;
        }
        attempts++;
    }
    if (!verificationToken) {
        throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Webhook verification failed: No verification token received');
    }
    // Step 3: Submit verification token
    await GenericFunctions_1.emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${webhookId}/verify/complete`, {
        verificationToken: verificationToken
    });
    // Step 4: Clean up verification token
    delete this.getWorkflowStaticData('node').verificationToken;
}
async function findDomainId(domainName) {
    try {
        const domains = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', '/api/domains');
        const domain = domains.find((d) => d.domain === domainName);
        return domain ? domain.id : null;
    }
    catch (error) {
        return null;
    }
}
async function findAliasId(aliasEmail) {
    try {
        const domains = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', '/api/domains');
        for (const domain of domains) {
            try {
                const aliases = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domain.id}`);
                const alias = aliases.find((a) => a.email === aliasEmail);
                if (alias) {
                    return alias.id;
                }
            }
            catch (error) {
                // Continue to next domain
            }
        }
        return null;
    }
    catch (error) {
        return null;
    }
}
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
            outputs: ["main" /* NodeConnectionType.Main */],
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
                    path: 'webhook',
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
                    displayName: 'Domain Filter Name or ID',
                    name: 'domainFilter',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getDomains',
                    },
                    default: '',
                    description: 'Select domain for catchall webhook assignment. If alias filter is also specified, this will be ignored. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
                {
                    displayName: 'Alias Filter Name or ID',
                    name: 'aliasFilter',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getAllAliases',
                    },
                    default: '',
                    description: 'Select specific alias for webhook assignment (takes priority over domain filter). Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
                },
            ],
        };
        this.methods = {
            loadOptions: {
                async getDomains() {
                    try {
                        const domains = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', '/api/domains');
                        const options = domains.map((domain) => ({
                            name: domain.domain,
                            value: domain.domain,
                        }));
                        // Add "All domains" option
                        options.unshift({ name: 'All domains', value: '' });
                        return options;
                    }
                    catch (error) {
                        return [{ name: 'All Domains', value: '' }];
                    }
                },
                async getAllAliases() {
                    try {
                        const domains = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', '/api/domains');
                        const allAliases = [{ name: 'All Aliases', value: '' }];
                        for (const domain of domains) {
                            try {
                                const aliases = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domain.id}`);
                                aliases.forEach((alias) => {
                                    allAliases.push({
                                        name: alias.email,
                                        value: alias.email,
                                    });
                                });
                            }
                            catch (error) {
                                // Skip domain if aliases can't be loaded
                            }
                        }
                        return allAliases;
                    }
                    catch (error) {
                        return [{ name: 'All Aliases', value: '' }];
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
                        const webhooks = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', '/api/webhooks');
                        return webhooks.some((webhook) => webhook.url === webhookUrl);
                    }
                    catch (error) {
                        return false;
                    }
                },
                async create() {
                    const webhookUrl = this.getNodeWebhookUrl('default');
                    const domainFilter = this.getNodeParameter('domainFilter');
                    const aliasFilter = this.getNodeParameter('aliasFilter');
                    try {
                        // Step 1: Create webhook in EmailConnect
                        const webhookData = {
                            url: webhookUrl,
                            description: `n8n trigger webhook - ${this.getNode().name}`,
                        };
                        const createdWebhook = await GenericFunctions_1.emailConnectApiRequest.call(this, 'POST', '/api/webhooks', webhookData);
                        const webhookId = createdWebhook.id;
                        // Step 2: Verify webhook
                        await verifyWebhook.call(this, webhookId);
                        // Step 3: Assign webhook to domain/alias based on filters
                        if (aliasFilter) {
                            // Priority: Assign to specific alias if specified
                            const aliasId = await findAliasId.call(this, aliasFilter);
                            if (aliasId) {
                                await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}/webhook`, {
                                    webhookId: webhookId
                                });
                            }
                        }
                        else if (domainFilter) {
                            // Fallback: Assign to domain catchall if specified
                            const domainId = await findDomainId.call(this, domainFilter);
                            if (domainId) {
                                await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
                                    webhookId: webhookId
                                });
                            }
                        }
                        else {
                            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Either domain or alias filter must be specified for webhook assignment');
                        }
                        // Store webhook ID for cleanup later
                        this.getWorkflowStaticData('node').webhookId = webhookId;
                        return true;
                    }
                    catch (error) {
                        throw new n8n_workflow_1.NodeOperationError(this.getNode(), `Failed to create and configure webhook: ${error}`);
                    }
                },
                async delete() {
                    try {
                        // Get stored webhook ID
                        const webhookId = this.getWorkflowStaticData('node').webhookId;
                        if (webhookId) {
                            // Step 1: Remove webhook assignment from domain/alias
                            const domainFilter = this.getNodeParameter('domainFilter');
                            const aliasFilter = this.getNodeParameter('aliasFilter');
                            if (aliasFilter) {
                                const aliasId = await findAliasId.call(this, aliasFilter);
                                if (aliasId) {
                                    // Remove webhook from alias (set to null/empty)
                                    await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}/webhook`, {
                                        webhookId: null
                                    });
                                }
                            }
                            else if (domainFilter) {
                                const domainId = await findDomainId.call(this, domainFilter);
                                if (domainId) {
                                    // Remove webhook from domain (set to null/empty)
                                    await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
                                        webhookId: null
                                    });
                                }
                            }
                            // Step 2: Delete the webhook itself
                            await GenericFunctions_1.emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookId}`);
                            // Step 3: Clean up stored webhook ID
                            delete this.getWorkflowStaticData('node').webhookId;
                        }
                        return true;
                    }
                    catch (error) {
                        // Don't throw error on delete failure - just log and continue
                        console.warn('Failed to clean up webhook:', error);
                        return true;
                    }
                },
            },
        };
    }
    async webhook() {
        var _a, _b, _c, _d, _e;
        const bodyData = this.getBodyData();
        const events = this.getNodeParameter('events');
        const domainFilter = this.getNodeParameter('domainFilter');
        const aliasFilter = this.getNodeParameter('aliasFilter');
        // Validate that we have the expected EmailConnect webhook data
        if (!bodyData || typeof bodyData !== 'object') {
            throw new n8n_workflow_1.NodeOperationError(this.getNode(), 'Invalid webhook payload received');
        }
        const emailData = bodyData;
        // Handle webhook verification if this is a verification request
        if (emailData.verification_token) {
            // Store verification token for later use
            this.getWorkflowStaticData('node').verificationToken = emailData.verification_token;
            // Return success response for verification
            return {
                webhookResponse: {
                    status: 200,
                    body: { verified: true },
                },
            };
        }
        // Check if this event type should trigger the workflow
        const eventType = emailData.status || 'email.received';
        if (!events.includes(eventType)) {
            return {
                noWebhookResponse: true,
            };
        }
        // Apply domain filter if specified
        if (domainFilter && emailData.recipient) {
            const recipientDomain = emailData.recipient.split('@')[1];
            if (recipientDomain !== domainFilter) {
                return {
                    noWebhookResponse: true,
                };
            }
        }
        // Apply alias filter if specified
        if (aliasFilter && emailData.recipient !== aliasFilter) {
            return {
                noWebhookResponse: true,
            };
        }
        // Process the email data and structure it for n8n
        const processedData = {
            id: emailData.id,
            domainId: emailData.domainId,
            receivedAt: emailData.receivedAt,
            sender: emailData.sender,
            recipient: emailData.recipient,
            subject: emailData.subject,
            status: emailData.status,
            payload: emailData.payload,
            errorMessage: emailData.errorMessage,
            // Additional structured data if available
            headers: ((_a = emailData.payload) === null || _a === void 0 ? void 0 : _a.headers) || {},
            textContent: ((_b = emailData.payload) === null || _b === void 0 ? void 0 : _b.text) || '',
            htmlContent: ((_c = emailData.payload) === null || _c === void 0 ? void 0 : _c.html) || '',
            attachments: ((_d = emailData.payload) === null || _d === void 0 ? void 0 : _d.attachments) || [],
            // Envelope data if included
            envelope: ((_e = emailData.payload) === null || _e === void 0 ? void 0 : _e.envelope) || {},
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
}
exports.EmailConnectTrigger = EmailConnectTrigger;
