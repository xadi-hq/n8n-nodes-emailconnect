import {
	IHookFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

import { emailConnectApiRequest } from '../EmailConnect/GenericFunctions';

export class EmailConnectTrigger implements INodeType {
	description: INodeTypeDescription = {
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
		outputs: [NodeConnectionType.Main],
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
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getDomains',
				},
				default: '',
				description: 'Optional: Only trigger for emails from specific domain (leave empty for all domains)',
			},
			{
				displayName: 'Alias Filter',
				name: 'aliasFilter',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getAllAliases',
				},
				default: '',
				description: 'Optional: Only trigger for emails to specific alias (leave empty for all aliases)',
			},
		],
	};

	methods = {
		loadOptions: {
			async getDomains(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const domains = await emailConnectApiRequest.call(this, 'GET', '/api/domains');
					const options = domains.map((domain: any) => ({
						name: domain.domain,
						value: domain.domain,
					}));
					// Add "All domains" option
					options.unshift({ name: 'All domains', value: '' });
					return options;
				} catch (error) {
					return [{ name: 'All domains', value: '' }];
				}
			},

			async getAllAliases(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const domains = await emailConnectApiRequest.call(this, 'GET', '/api/domains');
					const allAliases: INodePropertyOptions[] = [{ name: 'All aliases', value: '' }];

					for (const domain of domains) {
						try {
							const aliases = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domain.id}`);
							aliases.forEach((alias: any) => {
								allAliases.push({
									name: alias.email,
									value: alias.email,
								});
							});
						} catch (error) {
							// Skip domain if aliases can't be loaded
						}
					}

					return allAliases;
				} catch (error) {
					return [{ name: 'All aliases', value: '' }];
				}
			},
		},
	};

	// @ts-ignore (because of request)
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				try {
					// Check if a webhook with this URL already exists
					const webhooks = await emailConnectApiRequest.call(this, 'GET', '/api/webhooks');
					return webhooks.some((webhook: any) => webhook.url === webhookUrl);
				} catch (error) {
					return false;
				}
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const domainFilter = this.getNodeParameter('domainFilter') as string;
				const aliasFilter = this.getNodeParameter('aliasFilter') as string;

				try {
					// Create webhook in EmailConnect
					const webhookData: any = {
						url: webhookUrl,
						description: `n8n trigger webhook - ${this.getNode().name}`,
					};

					// If domain filter is specified, associate webhook with that domain
					if (domainFilter) {
						const domains = await emailConnectApiRequest.call(this, 'GET', '/api/domains');
						const domain = domains.find((d: any) => d.domain === domainFilter);
						if (domain) {
							webhookData.domainId = domain.id;
						}
					}

					// If alias filter is specified, associate webhook with that alias
					if (aliasFilter) {
						const domains = await emailConnectApiRequest.call(this, 'GET', '/api/domains');
						for (const domain of domains) {
							try {
								const aliases = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domain.id}`);
								const alias = aliases.find((a: any) => a.email === aliasFilter);
								if (alias) {
									webhookData.aliasId = alias.id;
									break;
								}
							} catch (error) {
								// Continue to next domain
							}
						}
					}

					await emailConnectApiRequest.call(this, 'POST', '/api/webhooks', webhookData);
					return true;
				} catch (error) {
					throw new NodeOperationError(this.getNode(), `Failed to create webhook: ${error}`);
				}
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				try {
					// Find and delete the webhook
					const webhooks = await emailConnectApiRequest.call(this, 'GET', '/api/webhooks');
					const webhook = webhooks.find((w: any) => w.url === webhookUrl);

					if (webhook) {
						await emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhook.id}`);
					}
					return true;
				} catch (error) {
					// Don't throw error on delete failure
					return true;
				}
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();
		const events = this.getNodeParameter('events') as string[];
		const domainFilter = this.getNodeParameter('domainFilter') as string;
		const aliasFilter = this.getNodeParameter('aliasFilter') as string;

		// Validate that we have the expected EmailConnect webhook data
		if (!bodyData || typeof bodyData !== 'object') {
			throw new NodeOperationError(this.getNode(), 'Invalid webhook payload received');
		}

		const emailData = bodyData as any;

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
			headers: emailData.payload?.headers || {},
			textContent: emailData.payload?.text || '',
			htmlContent: emailData.payload?.html || '',
			attachments: emailData.payload?.attachments || [],
			// Envelope data if included
			envelope: emailData.payload?.envelope || {},
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
