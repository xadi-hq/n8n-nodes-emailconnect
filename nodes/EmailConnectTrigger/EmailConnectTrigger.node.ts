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

// Helper functions for webhook management
async function verifyWebhook(this: IHookFunctions, webhookId: string): Promise<void> {
	// Step 1: Trigger verification (EmailConnect will POST to our webhook)
	await emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${webhookId}/verify`);

	// Step 2: Wait for verification POST to arrive and token to be stored
	let attempts = 0;
	const maxAttempts = 10;
	let verificationToken: string | undefined;

	while (attempts < maxAttempts) {
		await new Promise(resolve => setTimeout(resolve, 1000));
		verificationToken = this.getWorkflowStaticData('node').verificationToken as string;
		if (verificationToken) {
			break;
		}
		attempts++;
	}

	if (!verificationToken) {
		throw new NodeOperationError(this.getNode(), 'Webhook verification failed: No verification token received');
	}

	// Step 3: Submit verification token
	await emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${webhookId}/verify/complete`, {
		verificationToken: verificationToken
	});

	// Step 4: Clean up verification token
	delete this.getWorkflowStaticData('node').verificationToken;
}



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
				displayName: 'Domain',
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
				displayName: 'Alias (Optional)',
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

	methods = {
		loadOptions: {
			async getDomains(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const domains = await emailConnectApiRequest.call(this, 'GET', '/api/domains');
					return domains.map((domain: any) => ({
						name: `${domain.domain} (${domain.id})`,
						value: domain.id,
					}));
				} catch (error) {
					return [];
				}
			},

			async getAliasesForDomain(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const domainId = this.getCurrentNodeParameter('domainId') as string;
					if (!domainId) {
						return [];
					}

					const aliases = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
					return aliases.map((alias: any) => ({
						name: `${alias.email} (${alias.id})`,
						value: alias.id,
					}));
				} catch (error) {
					return [];
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
				const domainId = this.getNodeParameter('domainId') as string;
				const aliasId = this.getNodeParameter('aliasId') as string;

				try {
					// Store previous webhook ID for restoration on delete
					let previousWebhookId = '';

					if (aliasId) {
						// Get current alias webhook for restoration
						try {
							const alias = await emailConnectApiRequest.call(this, 'GET', `/api/aliases/${aliasId}`);
							previousWebhookId = alias.webhookId || '';
						} catch (error) {
							// Ignore error, continue with empty previous webhook ID
						}
					} else {
						// Get current domain webhook for restoration
						try {
							const domain = await emailConnectApiRequest.call(this, 'GET', `/api/domains/${domainId}`);
							previousWebhookId = domain.webhookId || '';
						} catch (error) {
							// Ignore error, continue with empty previous webhook ID
						}
					}

					// Step 1: Create webhook in EmailConnect
					const webhookData = {
						name: `n8n trigger webhook - ${this.getNode().name}`,
						url: webhookUrl,
						description: `Auto-created webhook for n8n trigger node: ${this.getNode().name}`,
					};

					const createdWebhook = await emailConnectApiRequest.call(this, 'POST', '/api/webhooks', webhookData);
					const webhookId = createdWebhook.webhook.id;

					// Step 2: Assign webhook to domain or alias
					if (aliasId) {
						// Update specific alias webhook endpoint
						await emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}/webhook`, {
							webhookId: webhookId
						});
					} else {
						// Update domain catch-all webhook endpoint
						await emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
							webhookId: webhookId
						});
					}

					// Store configuration for cleanup later
					this.getWorkflowStaticData('node').domainId = domainId;
					this.getWorkflowStaticData('node').aliasId = aliasId;
					this.getWorkflowStaticData('node').webhookId = webhookId;
					this.getWorkflowStaticData('node').previousWebhookId = previousWebhookId;

					return true;
				} catch (error) {
					throw new NodeOperationError(this.getNode(), `Failed to configure webhook endpoint: ${error}`);
				}
			},


			async delete(this: IHookFunctions): Promise<boolean> {
				try {
					// Get stored configuration
					const domainId = this.getWorkflowStaticData('node').domainId as string;
					const aliasId = this.getWorkflowStaticData('node').aliasId as string;
					const webhookId = this.getWorkflowStaticData('node').webhookId as string;
					const previousWebhookId = this.getWorkflowStaticData('node').previousWebhookId as string;

					if (domainId) {
						// Restore previous webhook ID
						if (aliasId) {
							// Restore alias webhook
							await emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}/webhook`, {
								webhookId: previousWebhookId || null
							});
						} else {
							// Restore domain webhook
							await emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
								webhookId: previousWebhookId || null
							});
						}

						// Delete the webhook we created
						if (webhookId) {
							try {
								await emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookId}`);
							} catch (error) {
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
				} catch (error) {
					// Don't throw error on delete failure - just log and continue
					console.warn('Failed to restore previous webhook configuration:', error);
					return true;
				}
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();
		const events = this.getNodeParameter('events') as string[];
		const domainId = this.getNodeParameter('domainId') as string;
		const aliasId = this.getNodeParameter('aliasId') as string;

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

		// Apply domain filter - check if email is for the configured domain
		if (domainId && emailData.domainId !== domainId) {
			return {
				noWebhookResponse: true,
			};
		}

		// Apply alias filter if specified - check if email is for the configured alias
		if (aliasId && emailData.aliasId !== aliasId) {
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
