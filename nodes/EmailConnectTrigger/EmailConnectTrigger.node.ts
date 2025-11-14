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

/**
 * Helper function to ensure webhook-alias linkage is maintained
 * This is called after webhook URL updates to prevent orphaned webhooks
 */
async function ensureWebhookAliasLinkage(context: IHookFunctions, webhookId: string): Promise<void> {
	try {
		const domainId = context.getNodeParameter('domainId') as string;
		const aliasMode = context.getNodeParameter('aliasMode') as string;
		let aliasId = '';

		// Get aliasId from stored data (all modes now use the same storage pattern)
		aliasId = context.getWorkflowStaticData('node').aliasId as string;

		console.log('EmailConnect: Ensuring webhook-alias linkage:', {
			webhookId,
			aliasId,
			aliasMode,
			domainId
		});

		if (aliasId) {
			// Verify the alias is still linked to our webhook
			const alias = await emailConnectApiRequest.call(context, 'GET', `/api/aliases/${aliasId}`);

			if (alias.webhookId !== webhookId) {
				console.log('EmailConnect: Alias webhook linkage broken, restoring:', {
					aliasId,
					currentWebhookId: alias.webhookId,
					expectedWebhookId: webhookId
				});

				// Restore the linkage
				await emailConnectApiRequest.call(context, 'PUT', `/api/aliases/${aliasId}/webhook`, {
					webhookId: webhookId
				});

				console.log('EmailConnect: Successfully restored alias-webhook linkage');
			} else {
				console.log('EmailConnect: Alias-webhook linkage is correct');
			}
		} else if (aliasMode === 'catchall') {
			// For domain mode, ensure domain webhook is linked
			const domain = await emailConnectApiRequest.call(context, 'GET', `/api/domains/${domainId}`);

			if (domain.webhookId !== webhookId) {
				console.log('EmailConnect: Domain webhook linkage broken, restoring:', {
					domainId,
					currentWebhookId: domain.webhookId,
					expectedWebhookId: webhookId
				});

				// Restore the domain linkage
				await emailConnectApiRequest.call(context, 'PUT', `/api/domains/${domainId}/webhook`, {
					webhookId: webhookId
				});

				console.log('EmailConnect: Successfully restored domain-webhook linkage');
			} else {
				console.log('EmailConnect: Domain-webhook linkage is correct');
			}
		}
	} catch (error) {
		console.warn('EmailConnect: Failed to ensure webhook-alias linkage:', error);
		// Don't throw - this is a recovery operation
	}
}



export class EmailConnectTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'EmailConnect trigger Trigger',
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
				description: '<strong>🇪🇺 100% EU-operated email service</strong>• Multi-alias support for organized email routing• Free to start: 50 emails per month• Enterprise-grade security and compliance<strong>Quick Setup:</strong>1. <a href="https://app.emailconnect.eu/login" target="_blank">Start today →</a>2. <a href="https://app.emailconnect.eu/settings/api-keys" target="_blank">Get your API key →</a>3. Configure your domain and aliases below',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: [
					{
						name: 'Email received',
						value: 'email.received',
						description: 'Triggers when an email is received and processed',
					},
					{
						name: 'Email processed',
						value: 'email.processed',
						description: 'Triggers when an email has been successfully processed',
					},
					{
						name: 'Email failed',
						value: 'email.failed',
						description: 'Triggers when email processing fails',
					},
				],
				default: ['email.received'],
				description: 'The events to listen for',
			},
			{
				displayName: 'Domain name or ID',
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
				displayName: 'Alias configuration',
				name: 'aliasMode',
				type: 'options',
				options: [
					{
						name: 'Use domain catch-all',
						value: 'catchall',
						description: 'Route ALL emails to this domain through this workflow (*@yourdomain.com)',
					},
					{
						name: 'Use specific alias',
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
				displayName: 'Webhook name',
				name: 'webhookName',
				type: 'string',
				default: '',
				placeholder: 'Alias endpoint trigger',
				description: 'A descriptive name for this webhook configuration. If left empty, will default to the email address + "endpoint trigger".',
			},
			{
				displayName: 'Webhook description',
				name: 'webhookDescription',
				type: 'string',
				default: '',
				placeholder: 'Handles support emails via N8N workflow',
				description: 'Optional description for this webhook configuration',
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

				console.log('EmailConnect: checkExists called with:', {
					webhookUrl,
					storedWebhookId: storedWebhookId ? `${storedWebhookId.substring(0, 8)}...` : 'none',
					hasStoredId: !!storedWebhookId
				});

			// Check if alias configuration has changed - if so, force recreation
			const currentAliasMode = this.getNodeParameter('aliasMode') as string;
			const currentDomainId = this.getNodeParameter('domainId') as string;
			const currentAliasLocalPart = currentAliasMode === 'specific' ? (this.getNodeParameter('aliasLocalPart') as string) : '';

			// Get stored configuration
			const storedAliasMode = this.getWorkflowStaticData('node').aliasMode as string;
			const storedDomainId = this.getWorkflowStaticData('node').domainId as string;
			const storedAliasLocalPart = this.getWorkflowStaticData('node').aliasLocalPart as string || '';


			// If we have a stored webhook but no stored alias config, this is from old version
			// Force recreation to properly set up alias configuration tracking
			if (storedWebhookId && !storedAliasMode) {
				console.log('EmailConnect: Migrating from old version - no alias config stored, forcing recreation');
				delete this.getWorkflowStaticData('node').webhookId;
				delete this.getWorkflowStaticData('node').aliasId;
				return false;
			}
			// Detect configuration changes
			const configChanged =
				(storedAliasMode && storedAliasMode !== currentAliasMode) ||
				(storedDomainId && storedDomainId !== currentDomainId) ||
				(storedAliasLocalPart && storedAliasLocalPart !== currentAliasLocalPart);

			if (configChanged) {
				console.log('EmailConnect: Alias configuration changed, forcing recreation:', {
					oldConfig: { aliasMode: storedAliasMode, domainId: storedDomainId, localPart: storedAliasLocalPart },
					newConfig: { aliasMode: currentAliasMode, domainId: currentDomainId, localPart: currentAliasLocalPart }
				});
				// Clear stored data to force full recreation
				delete this.getWorkflowStaticData('node').webhookId;
				delete this.getWorkflowStaticData('node').aliasId;
				delete this.getWorkflowStaticData('node').aliasMode;
				delete this.getWorkflowStaticData('node').domainId;
				delete this.getWorkflowStaticData('node').aliasLocalPart;
				return false; // Force create() to be called
			}

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

								// Check if webhook is already verified (n8n webhooks are auto-verified)
								try {
									const webhookInfo = await emailConnectApiRequest.call(this, 'GET', `/api/webhooks/${storedWebhookId}`);
									console.log('EmailConnect: Webhook info after update:', {
										id: webhookInfo.id,
										verified: webhookInfo.verified,
										active: webhookInfo.active
									});

									if (webhookInfo.verified) {
										console.log('EmailConnect: Webhook is already verified (auto-verified), skipping manual verification');
									} else {
										console.log('EmailConnect: Webhook not verified, starting manual verification...');

										// Add a small delay to ensure webhook URL update is processed
										await new Promise(resolve => setTimeout(resolve, 1000));

										// Verify the updated webhook
										const verificationToken = storedWebhookId.slice(-5);
										try {
											console.log('EmailConnect: Starting webhook verification for webhook:', storedWebhookId);
											const verifyResponse = await emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${storedWebhookId}/verify`);
											console.log('EmailConnect: Verification request sent, response:', verifyResponse);

											const completeResponse = await emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${storedWebhookId}/verify/complete`, {
												verificationToken: verificationToken
											});
											console.log('EmailConnect: Verification completed, response:', completeResponse);
											console.log('EmailConnect: Successfully verified updated webhook');
										} catch (verificationError) {
											console.error('EmailConnect: Failed to verify updated webhook:', {
												error: verificationError,
												webhookId: storedWebhookId,
												verificationToken: verificationToken
											});
											// Don't fail the entire operation if verification fails
										}
									}
								} catch (infoError) {
									console.error('EmailConnect: Failed to get webhook info, skipping verification check:', infoError);
								}

								// Ensure webhook-alias linkage is maintained after URL update
								await ensureWebhookAliasLinkage(this, storedWebhookId);

								return true; // Webhook exists and has been updated
							}

							// If URL matches, webhook exists and is current
							if (webhook && webhook.url === webhookUrl) {
							// Ensure webhook-alias linkage is correct even if URL didn't change
							await ensureWebhookAliasLinkage(this, storedWebhookId);
								return true;
							}
						} catch (webhookError) {
							// Clear the invalid stored webhook ID
							delete this.getWorkflowStaticData('node').webhookId;
							// If the stored webhook doesn't exist anymore, fall through to create new one
							console.log('EmailConnect: Stored webhook not found, will create new one:', storedWebhookId);
							return false;
						}
					}

					// No stored webhook ID, check if a webhook with this URL already exists
					// This only runs for first-time setup or when stored webhook was invalid
					const response = await emailConnectApiRequest.call(this, 'GET', '/api/webhooks');
					const webhooks = response?.webhooks || [];

					// First check for exact URL match
					const exactMatch = webhooks.find((webhook: any) => webhook.url === webhookUrl);
					if (exactMatch) {
						console.log('EmailConnect: Found exact URL match, storing webhook ID:', exactMatch.id);
						// Store the webhook ID for future use
						this.getWorkflowStaticData('node').webhookId = exactMatch.id;
						return true;
					}

					// Extract UUID from current webhook URL to find matching webhooks
					// URL format: https://domain/webhook[-test]/UUID/emailconnect
					const uuidMatch = webhookUrl?.match(/\/webhook(?:-test)?\/([a-f0-9-]{36})\//);
					if (uuidMatch) {
						const currentUuid = uuidMatch[1];
						console.log('EmailConnect: Extracted UUID from webhook URL:', currentUuid);

						// Find webhooks that contain the same UUID (test/production variants)
						const uuidMatches = webhooks.filter((webhook: any) => {
							return webhook.url && webhook.url.includes(currentUuid);
						});

						if (uuidMatches.length > 0) {
							const matchingWebhook = uuidMatches[0];
							console.log('EmailConnect: Found webhook with same UUID but different URL, updating:', {
								webhookId: matchingWebhook.id,
								oldUrl: matchingWebhook.url,
								newUrl: webhookUrl,
								uuid: currentUuid
							});

							// Store the webhook ID and update its URL
							this.getWorkflowStaticData('node').webhookId = matchingWebhook.id;

							// Update the webhook URL
							const isTestUrl = webhookUrl?.includes('/webhook-test/') || false;
							const description = `Auto-created webhook for n8n trigger node: ${this.getNode().name} (${isTestUrl ? 'Test' : 'Production'})`;

							try {
								await emailConnectApiRequest.call(this, 'PUT', `/api/webhooks/${matchingWebhook.id}`, {
									url: webhookUrl,
									description: description
								});

								console.log('EmailConnect: Successfully updated webhook URL');

								// Check if webhook is already verified (n8n webhooks are auto-verified)
								try {
									const webhookInfo = await emailConnectApiRequest.call(this, 'GET', `/api/webhooks/${matchingWebhook.id}`);
									console.log('EmailConnect: Webhook info after update:', {
										id: webhookInfo.id,
										verified: webhookInfo.verified,
										active: webhookInfo.active
									});

									if (webhookInfo.verified) {
										console.log('EmailConnect: Webhook is already verified (auto-verified), skipping manual verification');
									} else {
										console.log('EmailConnect: Webhook not verified, starting manual verification...');

										// Add a small delay to ensure webhook URL update is processed
										await new Promise(resolve => setTimeout(resolve, 1000));

										// Verify the updated webhook
										const verificationToken = matchingWebhook.id.slice(-5);
										try {
											console.log('EmailConnect: Starting webhook verification for existing webhook:', matchingWebhook.id);
											const verifyResponse = await emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${matchingWebhook.id}/verify`);
											console.log('EmailConnect: Verification request sent, response:', verifyResponse);

											const completeResponse = await emailConnectApiRequest.call(this, 'POST', `/api/webhooks/${matchingWebhook.id}/verify/complete`, {
												verificationToken: verificationToken
											});
											console.log('EmailConnect: Verification completed, response:', completeResponse);
											console.log('EmailConnect: Successfully verified updated webhook');
										} catch (verificationError) {
											console.error('EmailConnect: Failed to verify updated webhook:', {
												error: verificationError,
												webhookId: matchingWebhook.id,
												verificationToken: verificationToken
											});
										}
									}
								} catch (infoError) {
									console.error('EmailConnect: Failed to get webhook info, skipping verification check:', infoError);
								}

								// Ensure webhook-alias linkage is maintained after URL update
								await ensureWebhookAliasLinkage(this, matchingWebhook.id);

								return true;
							} catch (updateError) {
								console.error('EmailConnect: Failed to update webhook URL:', updateError);
								// Fall through to create new webhook
							}
						}
					}

					console.log('EmailConnect: No matching webhooks found, will create new one');
					return false;
				} catch (error) {
					console.error('EmailConnect: Error in checkExists:', error);
					return false;
				}
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const domainId = this.getNodeParameter('domainId') as string;
				const aliasMode = this.getNodeParameter('aliasMode') as string;
				let webhookName = this.getNodeParameter('webhookName') as string;
				const webhookDescription = this.getNodeParameter('webhookDescription') as string;
				let aliasId = '';

				try {
					// Generate default webhook name if none provided
					if (!webhookName || webhookName.trim() === '') {
						// Get domain information to construct the email address
						const domain = await emailConnectApiRequest.call(this, 'GET', `/api/domains/${domainId}`);
						const domainName = domain.domain;
						
						if (aliasMode === 'catchall') {
							webhookName = `*@${domainName} endpoint trigger`;
						} else if (aliasMode === 'specific') {
							const aliasLocalPart = this.getNodeParameter('aliasLocalPart') as string;
							if (aliasLocalPart) {
								webhookName = `${aliasLocalPart}@${domainName} endpoint trigger`;
							} else {
								webhookName = `${domainName} endpoint trigger`;
							}
						}
					}
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

					// Use the new atomic endpoint for all modes
					const webhookAliasData: any = {
						domainId,
						webhookUrl,
						webhookName,
						webhookDescription,
						firstOrCreate: true, // Enable smart create/update logic
						updateWebhookData: true, // Update existing webhook data
						autoVerify: true, // Use auto-verification
					};

					if (aliasMode === 'catchall') {
						// Create catch-all alias with domain synchronization
						webhookAliasData.aliasType = 'catchall';
						webhookAliasData.syncWithDomain = true;
					} else if (aliasMode === 'specific') {
						// Create or update specific alias
						const aliasLocalPart = this.getNodeParameter('aliasLocalPart') as string;
						if (!aliasLocalPart) {
							throw new NodeOperationError(this.getNode(), 'Alias local part is required for specific alias mode');
						}
						webhookAliasData.aliasType = 'specific';
						webhookAliasData.localPart = aliasLocalPart;
					}

					try {
						const result = await emailConnectApiRequest.call(this, 'POST', '/api/webhooks/alias', webhookAliasData);

						if (!result.success) {
							throw new NodeOperationError(this.getNode(), `Failed to create/update webhook and alias: ${result.message || 'Unknown error'}`);
						}

						webhookId = result.webhook.id;
						createdAliasId = result.alias.id;
						aliasId = createdAliasId || '';

						console.log('EmailConnect Trigger - Successfully created/updated webhook and alias:', {
							action: result.action,
							webhookId,
							aliasId: createdAliasId,
							aliasEmail: result.alias.email,
							webhookVerified: result.webhook.verified,
							domainSynced: result.domain?.webhookUpdated,
							warning: result.warning
						});

						// Log user-friendly message about what happened
						const actionMessage = result.action === 'created' ? 'Created new' : 'Updated existing';
						console.log(`EmailConnect: ${actionMessage} alias ${result.alias.email} with webhook ${webhookId}`);

					} catch (error) {
						throw new NodeOperationError(this.getNode(), `Failed to create/update webhook and alias: ${error}`);
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
					this.getWorkflowStaticData('node').aliasMode = aliasMode;
					if (aliasMode === 'specific') {
						const aliasLocalPart = this.getNodeParameter('aliasLocalPart') as string;
						this.getWorkflowStaticData('node').aliasLocalPart = aliasLocalPart;
					}



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

		// For all modes, the aliasId is stored in static data after creation
		aliasId = this.getWorkflowStaticData('node').aliasId as string;

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

		// Check if this is a webhook verification payload
		if (emailData.type === 'webhook_verification') {
			console.log('EmailConnect: Received webhook verification payload:', {
				type: emailData.type,
				verification_token: emailData.verification_token,
				webhook_id: emailData.webhook?.id,
				timestamp: emailData.timestamp,
				currentTime: new Date().toISOString()
			});

			// For verification payloads, return a minimal response that doesn't trigger workflow execution
			// This prevents verification payloads from cluttering your workflow runs
			return {
				workflowData: [
					[
						{
							json: {
								__emailconnect_internal: true,
								type: 'webhook_verification',
								message: 'Webhook verification received - this should not trigger workflow logic',
								verification_token: emailData.verification_token,
								webhook_id: emailData.webhook?.id,
								receivedAt: new Date().toISOString(),
								note: 'This is an internal verification payload and should be ignored by your workflow'
							},
						},
					],
				],
			};
		}

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
