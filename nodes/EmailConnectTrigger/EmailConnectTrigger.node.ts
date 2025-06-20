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
		description: 'Trigger workflows when emails are received via EmailConnect - 100% EU-operated email service with multi-alias support',
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
				displayName: '🇪🇺 Welcome to EmailConnect',
				name: 'gettingStarted',
				type: 'notice',
				default: '',
				typeOptions: {
					theme: 'info'
				},
				description: '<strong>🇪🇺 100% EU-operated email service</strong>• Multi-alias support for organized email routing• Free to start: 50 emails per month• Enterprise-grade security and compliance<strong>Quick Setup:</strong>1. <a href="https://emailconnect.eu/register" target="_blank">Register your account →</a>2. <a href="https://emailconnect.eu/settings" target="_blank">Get your API key →</a>3. Configure your domain and aliases below',
			},
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
						value: 'domain',
						description: 'Route ALL emails to this domain through this workflow (*@yourdomain.com)',
					},
					{
						name: 'Select Existing Alias',
						value: 'existing',
						description: 'Use an existing email alias (e.g., support@yourdomain.com)',
					},
					{
						name: 'Create New Alias',
						value: 'create',
						description: 'Create a new email alias for this workflow',
					},
				],
				default: 'existing',
				description: 'Choose how to configure email routing for this trigger. Each option determines which emails will activate this workflow.',
			},
			{
				displayName: 'Alias Name or ID',
				name: 'aliasId',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getAliasesForDomain',
				},
				displayOptions: {
					show: {
						aliasMode: ['existing'],
					},
				},
				default: '',
				hint: 'Only emails sent to this specific alias will trigger the workflow',
				description: 'Select a specific alias to configure. Only emails to this alias will trigger the workflow. If no aliases appear, create one in your EmailConnect dashboard first. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
			},
			{
				displayName: 'Local Part',
				name: 'newAliasLocalPart',
				type: 'string',
				displayOptions: {
					show: {
						aliasMode: ['create'],
					},
				},
				default: '',
				required: true,
				hint: 'This will create a new email alias automatically',
				description: 'The local part of the email address (before @). For example, "support" creates support@yourdomain.com. The alias will be created automatically and linked to this workflow.',
				placeholder: 'e.g. support',
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
						name: `${domain.domain} (${domain.id})`,
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
				const storedWebhookId = this.getWorkflowStaticData('node').webhookId as string;

				try {
					// If we have a stored webhook ID, check if it needs URL update
					if (storedWebhookId) {
						try {
							const webhook = await emailConnectApiRequest.call(this, 'GET', `/api/webhooks/${storedWebhookId}`);

							// If the stored webhook exists but has a different URL, update it
							if (webhook && webhook.url !== webhookUrl) {
								console.log('EmailConnect: Webhook URL changed, updating:', {
									webhookId: storedWebhookId,
									oldUrl: webhook.url,
									newUrl: webhookUrl
								});

								// Determine if this is switching to test or production
								const isTestUrl = webhookUrl?.includes('/webhook-test/') || false;
								const description = `Auto-created webhook for n8n trigger node: ${this.getNode().name} (${isTestUrl ? 'Test' : 'Production'})`;

								// Update the webhook URL and description
								await emailConnectApiRequest.call(this, 'PUT', `/api/webhooks/${storedWebhookId}`, {
									url: webhookUrl,
									description: description
								});

								console.log('EmailConnect: Successfully updated webhook URL');
								return true; // Webhook exists and has been updated
							}

							// If URL matches, webhook exists and is current
							if (webhook && webhook.url === webhookUrl) {
								return true;
							}
						} catch (webhookError) {
							// If the stored webhook doesn't exist anymore, fall through to create new one
							console.log('EmailConnect: Stored webhook not found, will create new one:', storedWebhookId);
							return false;
						}
					}

					// Check if a webhook with this URL already exists (original logic for new webhooks)
					const response = await emailConnectApiRequest.call(this, 'GET', '/api/webhooks');
					const webhooks = response?.webhooks || [];
					return webhooks.some((webhook: any) => webhook.url === webhookUrl);
				} catch (error) {
					console.error('EmailConnect: Error in checkExists:', error);
					return false;
				}
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const domainId = this.getNodeParameter('domainId') as string;
				const aliasMode = this.getNodeParameter('aliasMode') as string;
				let aliasId = '';

				// Handle different alias modes
				if (aliasMode === 'existing') {
					aliasId = this.getNodeParameter('aliasId') as string;
					if (!aliasId) {
						throw new NodeOperationError(this.getNode(), 'Alias ID is required when using existing alias mode');
					}
				}

				try {
					// Store previous webhook IDs for restoration on delete
					let previousWebhookId = '';
					let previousDomainWebhookId = '';
					let previousCatchAllWebhookId = '';

					if (aliasId) {
						// Get current alias webhook for restoration
						try {
							const alias = await emailConnectApiRequest.call(this, 'GET', `/api/aliases/${aliasId}`);
							previousWebhookId = alias.webhookId || '';

							// If this is a catch-all alias, also store domain webhook for restoration
							if (alias.email && alias.email.startsWith('*@')) {
								try {
									const domain = await emailConnectApiRequest.call(this, 'GET', `/api/domains/${domainId}`);
									previousDomainWebhookId = domain.webhookId || '';
								} catch (error) {
									console.warn('Failed to get current domain webhook:', error);
								}
							}
						} catch (error) {
							console.warn('Failed to get current alias webhook:', error);
						}
					} else {
						// Get current domain webhook for restoration
						try {
							const domain = await emailConnectApiRequest.call(this, 'GET', `/api/domains/${domainId}`);
							previousWebhookId = domain.webhookId || '';

							// Also get catch-all alias webhook for restoration
							try {
								const response = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
								const aliases = response?.aliases || [];
								const catchAllAlias = aliases.find((alias: any) => alias.email && alias.email.startsWith('*@'));
								if (catchAllAlias) {
									previousCatchAllWebhookId = catchAllAlias.webhookId || '';
								}
							} catch (error) {
								console.warn('Failed to get current catch-all alias webhook:', error);
							}
						} catch (error) {
							console.warn('Failed to get current domain webhook:', error);
						}
					}

					let webhookId: string;
					let createdAliasId: string | undefined;

					if (aliasMode === 'existing') {
						// For existing aliases, use the traditional approach
						// Step 1: Create webhook
						const webhookData = {
							name: `n8n trigger webhook - ${this.getNode().name}`,
							url: webhookUrl,
							description: `Auto-created webhook for n8n trigger node: ${this.getNode().name}`,
						};

						const createdWebhook = await emailConnectApiRequest.call(this, 'POST', '/api/webhooks', webhookData);
						webhookId = createdWebhook.webhook.id;

						// Step 2: Update existing alias webhook
						await emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}/webhook`, {
							webhookId: webhookId
						});

						// Step 3: Auto-verify webhook
						const verificationToken = webhookId.slice(-5);
						try {
							await emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${webhookId}/verify`);
							await emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${webhookId}/verify/complete`, {
								verificationToken: verificationToken
							});
						} catch (verificationError) {
							// Clean up on verification failure
							try {
								await emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookId}`);
							} catch (cleanupError) {
								console.warn('Failed to cleanup webhook after verification failure:', cleanupError);
							}
							throw new NodeOperationError(this.getNode(), `Webhook verification failed: ${verificationError}`);
						}
					} else {
						// For new alias creation (both 'create' and 'domain' modes), use the new atomic endpoint
						const webhookAliasData: any = {
							domainId,
							webhookUrl,
							webhookName: `n8n trigger webhook - ${this.getNode().name}`,
							webhookDescription: `Auto-created webhook for n8n trigger node: ${this.getNode().name}`,
							autoVerify: true, // Use auto-verification
						};

						if (aliasMode === 'create') {
							// Create specific alias
							const newAliasLocalPart = this.getNodeParameter('newAliasLocalPart') as string;
							webhookAliasData.aliasType = 'specific';
							webhookAliasData.localPart = newAliasLocalPart;
						} else if (aliasMode === 'domain') {
							// Create catch-all alias
							webhookAliasData.aliasType = 'catchall';
							webhookAliasData.syncWithDomain = true; // Enable domain synchronization
						}

						try {
							const result = await emailConnectApiRequest.call(this, 'POST', '/api/webhooks/alias', webhookAliasData);

							if (!result.success) {
								throw new NodeOperationError(this.getNode(), `Failed to create webhook and alias: ${result.error || 'Unknown error'}`);
							}

							webhookId = result.webhook.id;
							createdAliasId = result.alias.id;
							aliasId = createdAliasId || ''; // Set aliasId for storage

							console.log('EmailConnect Trigger - Successfully created webhook and alias:', {
								webhookId,
								aliasId: createdAliasId,
								aliasEmail: result.alias.email,
								webhookVerified: result.webhook.verified,
								domainSynced: result.domain?.webhookUpdated
							});
						} catch (error) {
							throw new NodeOperationError(this.getNode(), `Failed to create webhook and alias: ${error}`);
						}
					}



					// Store configuration for cleanup later
					console.log('EmailConnect Trigger Create - Storing configuration for cleanup:', {
						domainId,
						aliasId,
						webhookId,
						previousWebhookId,
						previousDomainWebhookId,
						previousCatchAllWebhookId
					});

					this.getWorkflowStaticData('node').domainId = domainId;
					this.getWorkflowStaticData('node').aliasId = aliasId;
					this.getWorkflowStaticData('node').webhookId = webhookId;
					this.getWorkflowStaticData('node').previousWebhookId = previousWebhookId;
					this.getWorkflowStaticData('node').previousDomainWebhookId = previousDomainWebhookId;
					this.getWorkflowStaticData('node').previousCatchAllWebhookId = previousCatchAllWebhookId;



					return true;
				} catch (error) {
					throw new NodeOperationError(this.getNode(), `Failed to configure webhook endpoint: ${error}`);
				}
			},


			async delete(this: IHookFunctions): Promise<boolean> {
				console.log('EmailConnect Trigger Delete - Method called!');
				try {
					// Get stored configuration
					const domainId = this.getWorkflowStaticData('node').domainId as string;
					const aliasId = this.getWorkflowStaticData('node').aliasId as string;
					const webhookId = this.getWorkflowStaticData('node').webhookId as string;
					const previousWebhookId = this.getWorkflowStaticData('node').previousWebhookId as string;
					const previousDomainWebhookId = this.getWorkflowStaticData('node').previousDomainWebhookId as string;
					const previousCatchAllWebhookId = this.getWorkflowStaticData('node').previousCatchAllWebhookId as string;

					console.log('EmailConnect Trigger Delete - Starting cleanup:', {
						domainId,
						aliasId,
						webhookId,
						previousWebhookId,
						previousDomainWebhookId,
						previousCatchAllWebhookId
					});

					if (domainId && webhookId) {
						// Step 1: Detach the webhook by setting to null (with synchronization)
						try {
							if (aliasId) {
								console.log('Detaching webhook from alias:', aliasId);
								await emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}/webhook`, {
									webhookId: null
								});

								// If this was a catch-all alias, also detach from domain
								if (previousDomainWebhookId !== undefined) {
									try {
										const alias = await emailConnectApiRequest.call(this, 'GET', `/api/aliases/${aliasId}`);
										if (alias.email && alias.email.startsWith('*@')) {
											console.log('Detaching webhook from domain for catch-all alias');
											await emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
												webhookId: null
											});
										}
									} catch (error) {
										console.warn('Failed to detach domain webhook for catch-all alias:', error);
									}
								}
							} else {
								console.log('Detaching webhook from domain:', domainId);
								await emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
									webhookId: null
								});

								// Also detach from catch-all alias if it was synchronized
								if (previousCatchAllWebhookId !== undefined) {
									try {
										const response = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
										const aliases = response?.aliases || [];
										const catchAllAlias = aliases.find((alias: any) => alias.email && alias.email.startsWith('*@'));
										if (catchAllAlias) {
											console.log('Detaching webhook from catch-all alias');
											await emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${catchAllAlias.id}/webhook`, {
												webhookId: null
											});
										}
									} catch (error) {
										console.warn('Failed to detach catch-all alias webhook:', error);
									}
								}
							}
						} catch (error) {
							console.warn('Failed to detach webhook:', error);
						}

						// Step 2: Delete the webhook
						try {
							console.log('Deleting webhook:', webhookId);
							await emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookId}`);
							console.log('Successfully deleted webhook:', webhookId);
						} catch (error) {
							console.error('Failed to delete webhook:', webhookId, error);
						}

						// Step 3: Restore previous webhooks (with synchronization)
						try {
							if (aliasId) {
								console.log('Restoring previous alias webhook:', previousWebhookId);
								await emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}/webhook`, {
									webhookId: previousWebhookId || null
								});

								// If this was a catch-all alias, also restore domain webhook
								if (previousDomainWebhookId !== undefined) {
									try {
										const alias = await emailConnectApiRequest.call(this, 'GET', `/api/aliases/${aliasId}`);
										if (alias.email && alias.email.startsWith('*@')) {
											console.log('Restoring previous domain webhook for catch-all alias:', previousDomainWebhookId);
											await emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
												webhookId: previousDomainWebhookId || null
											});
										}
									} catch (error) {
										console.warn('Failed to restore domain webhook for catch-all alias:', error);
									}
								}
							} else {
								console.log('Restoring previous domain webhook:', previousWebhookId);
								await emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
									webhookId: previousWebhookId || null
								});

								// Also restore catch-all alias webhook if it was synchronized
								if (previousCatchAllWebhookId !== undefined) {
									try {
										const response = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
										const aliases = response?.aliases || [];
										const catchAllAlias = aliases.find((alias: any) => alias.email && alias.email.startsWith('*@'));
										if (catchAllAlias) {
											console.log('Restoring previous catch-all alias webhook:', previousCatchAllWebhookId);
											await emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${catchAllAlias.id}/webhook`, {
												webhookId: previousCatchAllWebhookId || null
											});
										}
									} catch (error) {
										console.warn('Failed to restore catch-all alias webhook:', error);
									}
								}
							}
						} catch (error) {
							console.warn('Failed to restore previous webhook:', error);
						}

						// Clean up stored configuration
						delete this.getWorkflowStaticData('node').domainId;
						delete this.getWorkflowStaticData('node').aliasId;
						delete this.getWorkflowStaticData('node').webhookId;
						delete this.getWorkflowStaticData('node').previousWebhookId;
						delete this.getWorkflowStaticData('node').previousDomainWebhookId;
						delete this.getWorkflowStaticData('node').previousCatchAllWebhookId;
					}

					console.log('EmailConnect Trigger Delete - Cleanup completed');
					return true;
				} catch (error) {
					console.error('Failed to restore previous webhook configuration:', error);
					return true;
				}
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();
		const events = this.getNodeParameter('events') as string[];
		const domainId = this.getNodeParameter('domainId') as string;
		const aliasMode = this.getNodeParameter('aliasMode') as string;
		let aliasId = '';

		// Get aliasId based on mode
		if (aliasMode === 'existing') {
			aliasId = this.getNodeParameter('aliasId') as string;
		}
		// For 'create' and 'domain' modes, the aliasId is stored in static data after creation

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
