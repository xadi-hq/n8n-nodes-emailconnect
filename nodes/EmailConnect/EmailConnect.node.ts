import {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
	type NodeConnectionType,
} from 'n8n-workflow';

import { emailConnectApiRequest, getDomainOptions, getAliasOptions } from './GenericFunctions';

export class EmailConnect implements INodeType {
	description: INodeTypeDescription = {
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
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],
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
				displayName: 'Webhook Name or ID',
				name: 'aliasWebhookId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getWebhooks',
				},
				required: true,
				displayOptions: {
					show: {
						resource: ['alias'],
						operation: ['create'],
					},
				},
				default: '',
				description: 'The webhook that receives emails sent to this alias. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Additional Fields',
				name: 'aliasAdditionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['alias'],
						operation: ['create'],
					},
				},
				options: [
					{
						displayName: 'Active',
						name: 'active',
						type: 'boolean',
						default: true,
						description: 'Whether the alias is active and routes incoming email',
					},
					{
						displayName: 'Allow Attachments',
						name: 'allowAttachments',
						type: 'boolean',
						default: false,
						description: 'Whether to include email attachments in the webhook payload',
					},
					{
						displayName: 'Include Envelope',
						name: 'includeEnvelope',
						type: 'boolean',
						default: false,
						description: 'Whether to include SMTP envelope data in the webhook payload',
					},
					{
						displayName: 'Include HTML',
						name: 'includeHtml',
						type: 'boolean',
						default: true,
						description: 'Whether to include the HTML body in the webhook payload',
					},
					{
						displayName: 'Include Text',
						name: 'includeText',
						type: 'boolean',
						default: true,
						description: 'Whether to include the plain-text body in the webhook payload',
					},
				],
			},
			{
				displayName: 'Update Fields',
				name: 'aliasUpdateFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: {
					show: {
						resource: ['alias'],
						operation: ['update'],
					},
				},
				options: [
					{
						displayName: 'Active',
						name: 'active',
						type: 'boolean',
						default: true,
						description: 'Whether the alias is active and routes incoming email',
					},
					{
						displayName: 'Allow Attachments',
						name: 'allowAttachments',
						type: 'boolean',
						default: false,
						description: 'Whether to include email attachments in the webhook payload',
					},
					{
						displayName: 'Email',
						name: 'email',
						type: 'string',
						default: '',
						placeholder: 'support@example.com',
						description: 'Full email address, or a catch-all pattern such as *@example.com',
					},
					{
						displayName: 'Include Envelope',
						name: 'includeEnvelope',
						type: 'boolean',
						default: false,
						description: 'Whether to include SMTP envelope data in the webhook payload',
					},
					{
						displayName: 'Include HTML',
						name: 'includeHtml',
						type: 'boolean',
						default: true,
						description: 'Whether to include the HTML body in the webhook payload',
					},
					{
						displayName: 'Include Text',
						name: 'includeText',
						type: 'boolean',
						default: true,
						description: 'Whether to include the plain-text body in the webhook payload',
					},
					{
						displayName: 'Webhook Name or ID',
						name: 'webhookId',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getWebhooks',
						},
						default: '',
						description: 'The webhook that receives emails sent to this alias. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
					},
				],
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

			// Shared "Get Many" pagination controls (all resources)
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				displayOptions: {
					show: {
						operation: ['getAll'],
					},
				},
				default: false,
				description: 'Whether to return all results or only up to a given limit',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				displayOptions: {
					show: {
						operation: ['getAll'],
						returnAll: [false],
					},
				},
				typeOptions: {
					minValue: 1,
				},
				default: 50,
				description: 'Max number of results to return',
			},
		],
	};

	methods = {
		loadOptions: {
			getDomains: getDomainOptions,
			getAliases: getAliasOptions,

			async getWebhooks(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const response = await emailConnectApiRequest.call(this, 'GET', '/api/webhooks');
					const webhooks = response?.webhooks;
					if (!Array.isArray(webhooks)) return [];

					return webhooks.map((webhook: any) => ({
						name: `${webhook.name || webhook.url} (${webhook.id})`,
						value: webhook.id,
					}));
				} catch {
					return [];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0);
		const operation = this.getNodeParameter('operation', 0);

		// Client-side pagination: the API returns the full list, so honour the
		// node's Return All / Limit controls here.
		const limitItems = (list: any, itemIndex: number): any[] => {
			const all = Array.isArray(list) ? list : [];
			if (this.getNodeParameter('returnAll', itemIndex) as boolean) return all;
			const limit = this.getNodeParameter('limit', itemIndex) as number;
			return all.slice(0, limit);
		};

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'domain') {
					if (operation === 'getAll') {
						const response = await emailConnectApiRequest.call(this, 'GET', '/api/domains');
						const domains = limitItems(response?.domains, i);
						returnData.push(...domains.map((item: any) => ({ json: item })));
					} else if (operation === 'get') {
						const domainId = this.getNodeParameter('domainId', i) as string;
						const responseData = await emailConnectApiRequest.call(this, 'GET', `/api/domains/${domainId}`);
						returnData.push({ json: responseData });
					} else if (operation === 'updateConfig') {
						const domainId = this.getNodeParameter('domainId', i) as string;
						const allowAttachments = this.getNodeParameter('allowAttachments', i) as boolean;
						const includeEnvelopeData = this.getNodeParameter('includeEnvelopeData', i) as boolean;

						const body = {
							allowAttachments,
							includeEnvelope: includeEnvelopeData,
						};

						const responseData = await emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}`, body);
						returnData.push({ json: responseData });
					}
				} else if (resource === 'alias') {
					if (operation === 'getAll') {
						const domainId = this.getNodeParameter('domainId', i) as string;
						const response = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
						const aliases = limitItems(response?.aliases, i);
						returnData.push(...aliases.map((item: any) => ({ json: item })));
					} else if (operation === 'get') {
						const aliasId = this.getNodeParameter('aliasId', i) as string;
						const responseData = await emailConnectApiRequest.call(this, 'GET', `/api/aliases/${aliasId}`);
						returnData.push({ json: responseData });
					} else if (operation === 'create') {
						const domainId = this.getNodeParameter('domainId', i) as string;
						const localPart = this.getNodeParameter('localPart', i) as string;
						const webhookId = this.getNodeParameter('aliasWebhookId', i) as string;
						const additionalFields = this.getNodeParameter('aliasAdditionalFields', i, {}) as IDataObject;

						const body = { localPart, domainId, webhookId, ...additionalFields };
						const responseData = await emailConnectApiRequest.call(this, 'POST', '/api/aliases', body);
						returnData.push({ json: responseData });
					} else if (operation === 'update') {
						const aliasId = this.getNodeParameter('aliasId', i) as string;
						const updateFields = this.getNodeParameter('aliasUpdateFields', i, {}) as IDataObject;

						if (Object.keys(updateFields).length === 0) {
							throw new NodeOperationError(this.getNode(), 'Select at least one field to update', { itemIndex: i });
						}

						const responseData = await emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}`, updateFields);
						returnData.push({ json: responseData });
					} else if (operation === 'delete') {
						const aliasId = this.getNodeParameter('aliasId', i) as string;
						await emailConnectApiRequest.call(this, 'DELETE', `/api/aliases/${aliasId}`);
						returnData.push({ json: { success: true, aliasId } });
					}
				} else if (resource === 'webhook') {
					if (operation === 'getAll') {
						const response = await emailConnectApiRequest.call(this, 'GET', '/api/webhooks');
						const webhooks = limitItems(response?.webhooks, i);
						returnData.push(...webhooks.map((item: any) => ({ json: item })));
					} else if (operation === 'get') {
						const webhookId = this.getNodeParameter('webhookId', i) as string;
						const responseData = await emailConnectApiRequest.call(this, 'GET', `/api/webhooks/${webhookId}`);
						returnData.push({ json: responseData });
					} else if (operation === 'create') {
						const name = this.getNodeParameter('name', i) as string;
						const url = this.getNodeParameter('url', i) as string;
						const description = this.getNodeParameter('description', i) as string;

						const body: any = { name, url };
						if (description) body.description = description;

						const responseData = await emailConnectApiRequest.call(this, 'POST', '/api/webhooks', body, {}, undefined, {
							'X-EmailConnect-Source': 'n8n-node',
						});
						returnData.push({ json: responseData });
					} else if (operation === 'update') {
						const webhookId = this.getNodeParameter('webhookId', i) as string;
						const name = this.getNodeParameter('name', i) as string;
						const url = this.getNodeParameter('url', i) as string;
						const description = this.getNodeParameter('description', i) as string;

						const body: any = { name, url };
						if (description) body.description = description;

						// Trusted-source header keeps the webhook verified on URL change —
						// without it the backend resets `verified` for any non-test URL.
						const responseData = await emailConnectApiRequest.call(this, 'PUT', `/api/webhooks/${webhookId}`, body, {}, undefined, {
							'X-EmailConnect-Source': 'n8n-node',
						});
						returnData.push({ json: responseData });
					} else if (operation === 'delete') {
						const webhookId = this.getNodeParameter('webhookId', i) as string;
						await emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookId}`);
						returnData.push({ json: { success: true, webhookId } });
					}
				}
			} catch (error) {
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
