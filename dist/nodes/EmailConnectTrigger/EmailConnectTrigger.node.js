"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailConnectTrigger = void 0;
const n8n_workflow_1 = require("n8n-workflow");
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
                    displayName: 'Domain Filter',
                    name: 'domainFilter',
                    type: 'string',
                    default: '',
                    description: 'Optional: Only trigger for emails from specific domain (leave empty for all domains)',
                    placeholder: 'example.com',
                },
                {
                    displayName: 'Alias Filter',
                    name: 'aliasFilter',
                    type: 'string',
                    default: '',
                    description: 'Optional: Only trigger for emails to specific alias (leave empty for all aliases)',
                    placeholder: 'support@example.com',
                },
            ],
        };
        // @ts-ignore (because of request)
        this.webhookMethods = {
            default: {
                async checkExists() {
                    // For EmailConnect, we don't need to register webhooks via API
                    // The webhook URL is configured manually in EmailConnect dashboard
                    return false;
                },
                async create() {
                    // For EmailConnect, webhooks are configured manually in the dashboard
                    // We just return true to indicate the webhook is "created"
                    return true;
                },
                async delete() {
                    // For EmailConnect, webhooks are configured manually in the dashboard
                    // We just return true to indicate the webhook is "deleted"
                    return true;
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
