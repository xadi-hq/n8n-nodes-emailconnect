import {
	IHookFunctions,
	ILoadOptionsFunctions,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeOperationError,
	type NodeConnectionType,
} from 'n8n-workflow';

import { emailConnectApiRequest } from '../EmailConnect/GenericFunctions';

// Helper functions for webhook management
// Note: Verification is now handled automatically during webhook creation
// using the webhook ID's last 5 characters as the verification token



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
		outputs: ['main' as NodeConnectionType],
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

	methods = {
		loadOptions: {
			async getDomains(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const response = await emailConnectApiRequest.call(this, 'GET', '/api/domains');
					console.log('EmailConnect getDomains response:', response);

					// Extract domains array from response object
					const domains = response?.domains;
					if (!Array.isArray(domains)) {
						console.error('EmailConnect getDomains: Expected domains array, got:', typeof domains, response);
						return [];
					}

					return domains.map((domain: any) => ({
						name: `${domain.domainName} (${domain.id})`,
						value: domain.id,
					}));
				} catch (error) {
					console.error('EmailConnect getDomains error:', error);
					return [];
				}
			},

			async getAliasesForDomain(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const domainId = this.getCurrentNodeParameter('domainId') as string;
					console.log('EmailConnect getAliasesForDomain domainId:', domainId);

					if (!domainId) {
						console.log('EmailConnect getAliasesForDomain: No domainId provided, returning empty array');
						return [];
					}

					const response = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
					console.log('EmailConnect getAliasesForDomain response:', response);

					// Extract aliases array from response object
					const aliases = response?.aliases;
					if (!Array.isArray(aliases)) {
						console.error('EmailConnect getAliasesForDomain: Expected aliases array, got:', typeof aliases, response);
						return [];
					}

					return aliases.map((alias: any) => ({
						name: `${alias.email} (${alias.id})`,
						value: alias.id,
					}));
				} catch (error) {
					console.error('EmailConnect getAliasesForDomain error:', error);
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
					const response = await emailConnectApiRequest.call(this, 'GET', '/api/webhooks');
					const webhooks = response?.webhooks || [];
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

					// Step 3: Automatically verify the webhook
					// Verification token is always the last 5 characters of the webhook ID
					const verificationToken = webhookId.slice(-5);

					try {
						// Trigger verification process
						await emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${webhookId}/verify`);

						// Complete verification with the token
						await emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${webhookId}/verify/complete`, {
							verificationToken: verificationToken
						});
					} catch (verificationError) {
						// If verification fails, clean up the webhook we created
						try {
							await emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookId}`);
						} catch (cleanupError) {
							// Log cleanup failure but don't throw
							console.warn('Failed to cleanup webhook after verification failure:', cleanupError);
						}
						throw new NodeOperationError(this.getNode(), `Webhook verification failed: ${verificationError}`);
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

		const emailData = bodyData as any;

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
				headers: emailData.payload?.headers || emailData.envelope?.headers || {},
				textContent: emailData.payload?.text || emailData.message?.content?.text || '',
				htmlContent: emailData.payload?.html || emailData.message?.content?.html || '',
				attachments: emailData.payload?.attachments || emailData.message?.attachments || [],
				// Envelope data if included
				envelope: emailData.payload?.envelope || emailData.envelope || {},
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
		} else {
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
