"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailConnect = void 0;
const GenericFunctions_1 = require("./GenericFunctions");
class EmailConnect {
    constructor() {
        this.description = {
            displayName: 'EmailConnect',
            name: 'emailConnect',
            icon: 'file:emailconnect.svg',
            group: ['transform'],
            version: 1,
            subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
            description: 'Interact with EmailConnect API for email automation',
            defaults: {
                name: 'EmailConnect',
            },
            inputs: ['main'],
            outputs: ['main'],
            credentials: [
                {
                    name: 'emailConnectApi',
                    required: true,
                },
            ],
            properties: [
                {
                    displayName: 'Resource',
                    name: 'resource',
                    type: 'options',
                    noDataExpression: true,
                    options: [
                        {
                            name: 'Domain',
                            value: 'domain',
                        },
                        {
                            name: 'Alias',
                            value: 'alias',
                        },
                        {
                            name: 'Webhook',
                            value: 'webhook',
                        },
                    ],
                    default: 'domain',
                },
                // Domain Operations
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: ['domain'],
                        },
                    },
                    options: [
                        {
                            name: 'Get Many',
                            value: 'getAll',
                            description: 'Get many domains',
                            action: 'Get many domains',
                        },
                        {
                            name: 'Get',
                            value: 'get',
                            description: 'Get a domain',
                            action: 'Get a domain',
                        },
                        {
                            name: 'Update Configuration',
                            value: 'updateConfig',
                            description: 'Update domain configuration',
                            action: 'Update domain configuration',
                        },
                    ],
                    default: 'getAll',
                },
                // Domain ID field
                {
                    displayName: 'Domain Name or ID',
                    name: 'domainId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getDomains',
                    },
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['domain'],
                            operation: ['get', 'updateConfig'],
                        },
                    },
                    default: '',
                    description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
                },
                // Domain Configuration fields
                {
                    displayName: 'Allow Attachments',
                    name: 'allowAttachments',
                    type: 'boolean',
                    displayOptions: {
                        show: {
                            resource: ['domain'],
                            operation: ['updateConfig'],
                        },
                    },
                    default: false,
                    description: 'Whether to include email attachments in webhook payload',
                },
                {
                    displayName: 'Include Envelope Data',
                    name: 'includeEnvelopeData',
                    type: 'boolean',
                    displayOptions: {
                        show: {
                            resource: ['domain'],
                            operation: ['updateConfig'],
                        },
                    },
                    default: false,
                    description: 'Whether to include SMTP envelope data in webhook payload',
                },
                // Alias Operations
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: ['alias'],
                        },
                    },
                    options: [
                        {
                            name: 'Create',
                            value: 'create',
                            description: 'Create a new alias',
                            action: 'Create an alias',
                        },
                        {
                            name: 'Delete',
                            value: 'delete',
                            description: 'Delete an alias',
                            action: 'Delete an alias',
                        },
                        {
                            name: 'Get',
                            value: 'get',
                            description: 'Get an alias',
                            action: 'Get an alias',
                        },
                        {
                            name: 'Get Many',
                            value: 'getAll',
                            description: 'Get many aliases for a domain',
                            action: 'Get many aliases',
                        },
                        {
                            name: 'Update',
                            value: 'update',
                            description: 'Update an alias',
                            action: 'Update an alias',
                        },
                    ],
                    default: 'getAll',
                },
                // Domain ID for aliases
                {
                    displayName: 'Domain Name or ID',
                    name: 'domainId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getDomains',
                    },
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['alias'],
                            operation: ['getAll', 'create'],
                        },
                    },
                    default: '',
                    description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
                },
                // Alias ID field
                {
                    displayName: 'Alias Name or ID',
                    name: 'aliasId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getAliases',
                        loadOptionsDependsOn: ['domainId'],
                    },
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['alias'],
                            operation: ['get', 'update', 'delete'],
                        },
                    },
                    default: '',
                    description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
                },
                // Alias creation/update fields
                {
                    displayName: 'Local Part',
                    name: 'localPart',
                    type: 'string',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['alias'],
                            operation: ['create'],
                        },
                    },
                    default: '',
                    description: 'The local part of the email address (before @)',
                    placeholder: 'support',
                },
                {
                    displayName: 'Destination Email',
                    name: 'destinationEmail',
                    type: 'string',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['alias'],
                            operation: ['create', 'update'],
                        },
                    },
                    default: '',
                    description: 'The email address to forward to',
                    placeholder: 'user@example.com',
                },
                // Webhook Operations
                {
                    displayName: 'Operation',
                    name: 'operation',
                    type: 'options',
                    noDataExpression: true,
                    displayOptions: {
                        show: {
                            resource: ['webhook'],
                        },
                    },
                    options: [
                        {
                            name: 'Create',
                            value: 'create',
                            description: 'Create a new webhook',
                            action: 'Create a webhook',
                        },
                        {
                            name: 'Delete',
                            value: 'delete',
                            description: 'Delete a webhook',
                            action: 'Delete a webhook',
                        },
                        {
                            name: 'Get',
                            value: 'get',
                            description: 'Get a webhook',
                            action: 'Get a webhook',
                        },
                        {
                            name: 'Get Many',
                            value: 'getAll',
                            description: 'Get many webhooks',
                            action: 'Get many webhooks',
                        },
                        {
                            name: 'Update',
                            value: 'update',
                            description: 'Update a webhook',
                            action: 'Update a webhook',
                        },
                    ],
                    default: 'getAll',
                },
                // Webhook ID field
                {
                    displayName: 'Webhook Name or ID',
                    name: 'webhookId',
                    type: 'options',
                    typeOptions: {
                        loadOptionsMethod: 'getWebhooks',
                    },
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['webhook'],
                            operation: ['get', 'update', 'delete'],
                        },
                    },
                    default: '',
                    description: 'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
                },
                // Webhook creation/update fields
                {
                    displayName: 'Name',
                    name: 'name',
                    type: 'string',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['webhook'],
                            operation: ['create', 'update'],
                        },
                    },
                    default: '',
                    description: 'A friendly name for the webhook',
                    placeholder: 'Main email webhook',
                },
                {
                    displayName: 'URL',
                    name: 'url',
                    type: 'string',
                    required: true,
                    displayOptions: {
                        show: {
                            resource: ['webhook'],
                            operation: ['create', 'update'],
                        },
                    },
                    default: '',
                    description: 'The webhook URL to receive email data',
                    placeholder: 'https://myapp.com/webhook/email',
                },
                {
                    displayName: 'Description',
                    name: 'description',
                    type: 'string',
                    displayOptions: {
                        show: {
                            resource: ['webhook'],
                            operation: ['create', 'update'],
                        },
                    },
                    default: '',
                    description: 'Optional description for the webhook',
                    placeholder: 'Main email processing webhook',
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
                async getAliases() {
                    try {
                        const domainId = this.getCurrentNodeParameter('domainId');
                        console.log('EmailConnect getAliases domainId:', domainId);
                        if (!domainId) {
                            console.log('EmailConnect getAliases: No domainId provided, returning empty array');
                            return [];
                        }
                        const response = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
                        console.log('EmailConnect getAliases response:', response);
                        // Extract aliases array from response object
                        const aliases = response === null || response === void 0 ? void 0 : response.aliases;
                        if (!Array.isArray(aliases)) {
                            console.error('EmailConnect getAliases: Expected aliases array, got:', typeof aliases, response);
                            return [];
                        }
                        return aliases.map((alias) => ({
                            name: `${alias.email} (${alias.id})`,
                            value: alias.id,
                        }));
                    }
                    catch (error) {
                        console.error('EmailConnect getAliases error:', error);
                        return [];
                    }
                },
                async getWebhooks() {
                    try {
                        const response = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', '/api/webhooks');
                        console.log('EmailConnect getWebhooks response:', response);
                        // Extract webhooks array from response object
                        const webhooks = response === null || response === void 0 ? void 0 : response.webhooks;
                        if (!Array.isArray(webhooks)) {
                            console.error('EmailConnect getWebhooks: Expected webhooks array, got:', typeof webhooks, response);
                            return [];
                        }
                        return webhooks.map((webhook) => ({
                            name: `${webhook.name || webhook.url} (${webhook.id})`,
                            value: webhook.id,
                        }));
                    }
                    catch (error) {
                        console.error('EmailConnect getWebhooks error:', error);
                        return [];
                    }
                },
            },
        };
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        const resource = this.getNodeParameter('resource', 0);
        const operation = this.getNodeParameter('operation', 0);
        for (let i = 0; i < items.length; i++) {
            try {
                if (resource === 'domain') {
                    if (operation === 'getAll') {
                        const response = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', '/api/domains');
                        const domains = (response === null || response === void 0 ? void 0 : response.domains) || [];
                        returnData.push(...domains.map((item) => ({ json: item })));
                    }
                    else if (operation === 'get') {
                        const domainId = this.getNodeParameter('domainId', i);
                        const responseData = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/domains/${domainId}`);
                        returnData.push({ json: responseData });
                    }
                    else if (operation === 'updateConfig') {
                        const domainId = this.getNodeParameter('domainId', i);
                        const allowAttachments = this.getNodeParameter('allowAttachments', i);
                        const includeEnvelopeData = this.getNodeParameter('includeEnvelopeData', i);
                        const body = {
                            configuration: {
                                allowAttachments,
                                includeEnvelopeData,
                            },
                        };
                        const responseData = await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}`, body);
                        returnData.push({ json: responseData });
                    }
                }
                else if (resource === 'alias') {
                    if (operation === 'getAll') {
                        const domainId = this.getNodeParameter('domainId', i);
                        const response = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
                        const aliases = (response === null || response === void 0 ? void 0 : response.aliases) || [];
                        returnData.push(...aliases.map((item) => ({ json: item })));
                    }
                    else if (operation === 'get') {
                        const aliasId = this.getNodeParameter('aliasId', i);
                        const responseData = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/aliases/${aliasId}`);
                        returnData.push({ json: responseData });
                    }
                    else if (operation === 'create') {
                        const domainId = this.getNodeParameter('domainId', i);
                        const localPart = this.getNodeParameter('localPart', i);
                        const destinationEmail = this.getNodeParameter('destinationEmail', i);
                        const body = { localPart, destinationEmail };
                        const responseData = await GenericFunctions_1.emailConnectApiRequest.call(this, 'POST', `/api/aliases?domainId=${domainId}`, body);
                        returnData.push({ json: responseData });
                    }
                    else if (operation === 'update') {
                        const aliasId = this.getNodeParameter('aliasId', i);
                        const destinationEmail = this.getNodeParameter('destinationEmail', i);
                        const body = { destinationEmail };
                        const responseData = await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}`, body);
                        returnData.push({ json: responseData });
                    }
                    else if (operation === 'delete') {
                        const aliasId = this.getNodeParameter('aliasId', i);
                        await GenericFunctions_1.emailConnectApiRequest.call(this, 'DELETE', `/api/aliases/${aliasId}`);
                        returnData.push({ json: { success: true, aliasId } });
                    }
                }
                else if (resource === 'webhook') {
                    if (operation === 'getAll') {
                        const response = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', '/api/webhooks');
                        const webhooks = (response === null || response === void 0 ? void 0 : response.webhooks) || [];
                        returnData.push(...webhooks.map((item) => ({ json: item })));
                    }
                    else if (operation === 'get') {
                        const webhookId = this.getNodeParameter('webhookId', i);
                        const responseData = await GenericFunctions_1.emailConnectApiRequest.call(this, 'GET', `/api/webhooks/${webhookId}`);
                        returnData.push({ json: responseData });
                    }
                    else if (operation === 'create') {
                        const name = this.getNodeParameter('name', i);
                        const url = this.getNodeParameter('url', i);
                        const description = this.getNodeParameter('description', i);
                        const body = { name, url };
                        if (description)
                            body.description = description;
                        const responseData = await GenericFunctions_1.emailConnectApiRequest.call(this, 'POST', '/api/webhooks', body);
                        returnData.push({ json: responseData });
                    }
                    else if (operation === 'update') {
                        const webhookId = this.getNodeParameter('webhookId', i);
                        const name = this.getNodeParameter('name', i);
                        const url = this.getNodeParameter('url', i);
                        const description = this.getNodeParameter('description', i);
                        const body = { name, url };
                        if (description)
                            body.description = description;
                        const responseData = await GenericFunctions_1.emailConnectApiRequest.call(this, 'PUT', `/api/webhooks/${webhookId}`, body);
                        returnData.push({ json: responseData });
                    }
                    else if (operation === 'delete') {
                        const webhookId = this.getNodeParameter('webhookId', i);
                        await GenericFunctions_1.emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookId}`);
                        returnData.push({ json: { success: true, webhookId } });
                    }
                }
            }
            catch (error) {
                if (this.continueOnFail()) {
                    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
                    returnData.push({ json: { error: errorMessage } });
                    continue;
                }
                throw error;
            }
        }
        return [returnData];
    }
}
exports.EmailConnect = EmailConnect;
