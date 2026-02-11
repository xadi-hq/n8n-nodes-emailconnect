import {
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeOperationError,
	type NodeConnectionType,
} from 'n8n-workflow';

import { emailConnectApiRequest, getDomainOptions } from '../EmailConnect/GenericFunctions';

// ---------------------------------------------------------------------------
// Helper: update a webhook's URL + description, verify if needed, then
// ensure the alias/domain linkage is still intact.
// Uses PUT response `verified` field to skip redundant GET.
// ---------------------------------------------------------------------------
async function updateWebhookUrlAndVerify(
	context: IHookFunctions,
	webhookId: string,
	webhookUrl: string,
): Promise<void> {
	const isTestUrl = webhookUrl.includes('/webhook-test/');
	const description = `Auto-created webhook for n8n trigger node: ${context.getNode().name} (${isTestUrl ? 'Test' : 'Production'})`;

	const putResponse = await emailConnectApiRequest.call(context, 'PUT', `/api/webhooks/${webhookId}`, {
		url: webhookUrl,
		description,
	});

	// Use PUT response to decide if manual verification is needed
	if (!putResponse?.verified) {
		const verificationToken = webhookId.slice(-5);
		try {
			await emailConnectApiRequest.call(context, 'POST', `/api/webhooks/${webhookId}/verify`);
			await emailConnectApiRequest.call(context, 'POST', `/api/webhooks/${webhookId}/verify/complete`, {
				verificationToken,
			});
		} catch (verificationError) {
			console.warn('EmailConnect: webhook verification failed after URL update:', webhookId);
		}
	}

	await ensureWebhookAliasLinkage(context, webhookId);
}

// ---------------------------------------------------------------------------
// Helper: detect whether alias/domain config changed since last save.
// Returns true if the caller should force recreation.
// ---------------------------------------------------------------------------
function detectConfigChange(context: IHookFunctions): boolean {
	const staticData = context.getWorkflowStaticData('node');
	const storedWebhookId = staticData.webhookId as string;
	const storedAliasMode = staticData.aliasMode as string;

	// Migration: old version had no stored aliasMode → force recreation
	if (storedWebhookId && !storedAliasMode) {
		delete staticData.webhookId;
		delete staticData.aliasId;
		return true;
	}

	const currentAliasMode = context.getNodeParameter('aliasMode') as string;
	const currentDomainId = context.getNodeParameter('domainId') as string;
	const currentAliasLocalPart = currentAliasMode === 'specific'
		? (context.getNodeParameter('aliasLocalPart') as string)
		: '';

	const storedDomainId = staticData.domainId as string;
	const storedAliasLocalPart = (staticData.aliasLocalPart as string) || '';

	const changed =
		(storedAliasMode && storedAliasMode !== currentAliasMode) ||
		(storedDomainId && storedDomainId !== currentDomainId) ||
		(storedAliasLocalPart && storedAliasLocalPart !== currentAliasLocalPart);

	if (changed) {
		delete staticData.webhookId;
		delete staticData.aliasId;
		delete staticData.aliasMode;
		delete staticData.domainId;
		delete staticData.aliasLocalPart;
	}

	return !!changed;
}

// ---------------------------------------------------------------------------
// Helper: try to reuse the stored webhook ID.
//  - Returns true   → webhook exists & URL matches (or was updated)
//  - Returns false  → stored webhook gone, static data cleaned up
//  - Returns undefined → no stored webhook ID
// ---------------------------------------------------------------------------
async function tryStoredWebhook(
	context: IHookFunctions,
	webhookUrl: string,
): Promise<boolean | undefined> {
	const staticData = context.getWorkflowStaticData('node');
	const storedWebhookId = staticData.webhookId as string;
	if (!storedWebhookId) return undefined;

	try {
		const webhook = await emailConnectApiRequest.call(context, 'GET', `/api/webhooks/${storedWebhookId}`);

		if (webhook.url !== webhookUrl) {
			// URL changed (e.g. test↔prod) — update & verify
			await updateWebhookUrlAndVerify(context, storedWebhookId, webhookUrl);
			return true;
		}

		// URL matches — nothing changed, skip ensureWebhookAliasLinkage
		return true;
	} catch {
		// Stored webhook no longer exists
		delete staticData.webhookId;
		delete staticData.aliasId;
		return false;
	}
}

// ---------------------------------------------------------------------------
// Helper: ensure webhook-alias linkage is maintained.
// Only called after actual URL changes to prevent orphaned webhooks.
// ---------------------------------------------------------------------------
async function ensureWebhookAliasLinkage(context: IHookFunctions, webhookId: string): Promise<void> {
	try {
		const domainId = context.getNodeParameter('domainId') as string;
		const aliasMode = context.getNodeParameter('aliasMode') as string;
		const aliasId = context.getWorkflowStaticData('node').aliasId as string;

		if (aliasId) {
			const alias = await emailConnectApiRequest.call(context, 'GET', `/api/aliases/${aliasId}`);
			if (alias.webhookId !== webhookId) {
				await emailConnectApiRequest.call(context, 'PUT', `/api/aliases/${aliasId}/webhook`, {
					webhookId,
				});
			}
		} else if (aliasMode === 'catchall') {
			const domain = await emailConnectApiRequest.call(context, 'GET', `/api/domains/${domainId}`);
			if (domain.webhookId !== webhookId) {
				await emailConnectApiRequest.call(context, 'PUT', `/api/domains/${domainId}/webhook`, {
					webhookId,
				});
			}
		}
	} catch (error) {
		console.warn('EmailConnect: failed to ensure webhook-alias linkage:', error);
	}
}

// ===========================================================================

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
			getDomains: getDomainOptions,
		},
	};

	// @ts-ignore (because of request)
	webhookMethods = {
		default: {
			// ------------------------------------------------------------------
			// checkExists — short orchestrator (~35 lines)
			// ------------------------------------------------------------------
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;

				// 1. Config change → force recreation
				if (detectConfigChange(this)) return false;

				// 2. Try the stored webhook ID
				const storedResult = await tryStoredWebhook(this, webhookUrl);
				if (storedResult !== undefined) return storedResult;

				// 3. Fallback: search all webhooks for URL or UUID match
				try {
					const response = await emailConnectApiRequest.call(this, 'GET', '/api/webhooks');
					const webhooks = response?.webhooks || [];

					// Exact URL match
					const exactMatch = webhooks.find((wh: any) => wh.url === webhookUrl);
					if (exactMatch) {
						this.getWorkflowStaticData('node').webhookId = exactMatch.id;
						return true;
					}

					// UUID match (test↔prod URL variant)
					const uuidMatch = webhookUrl.match(/\/webhook(?:-test)?\/([a-f0-9-]{36})\//);
					if (uuidMatch) {
						const currentUuid = uuidMatch[1];
						const uuidHit = webhooks.find((wh: any) => wh.url?.includes(currentUuid));
						if (uuidHit) {
							this.getWorkflowStaticData('node').webhookId = uuidHit.id;
							await updateWebhookUrlAndVerify(this, uuidHit.id, webhookUrl);
							return true;
						}
					}

					return false;
				} catch {
					return false;
				}
			},

			// ------------------------------------------------------------------
			// create — cleaned up, dead code removed
			// ------------------------------------------------------------------
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const domainId = this.getNodeParameter('domainId') as string;
				const aliasMode = this.getNodeParameter('aliasMode') as string;
				let webhookName = this.getNodeParameter('webhookName') as string;
				const webhookDescription = this.getNodeParameter('webhookDescription') as string;

				try {
					// Fetch domain info (needed for name generation and previousWebhookId)
					const domain = await emailConnectApiRequest.call(this, 'GET', `/api/domains/${domainId}`);
					const previousWebhookId = domain.webhookId || '';

					// Generate default webhook name if none provided
					if (!webhookName || webhookName.trim() === '') {
						const domainName = domain.domain;

						if (aliasMode === 'catchall') {
							webhookName = `*@${domainName} endpoint trigger`;
						} else if (aliasMode === 'specific') {
							const aliasLocalPart = this.getNodeParameter('aliasLocalPart') as string;
							webhookName = aliasLocalPart
								? `${aliasLocalPart}@${domainName} endpoint trigger`
								: `${domainName} endpoint trigger`;
						}
					}

					// Store previous IDs for restoration on delete
					let previousDomainWebhookId = '';
					let previousCatchAllWebhookId = '';

					// Get catch-all alias webhook for restoration
					try {
						const response = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
						const aliases = response?.aliases || [];
						const catchAllAlias = aliases.find((alias: any) => alias.email?.startsWith('*@'));
						if (catchAllAlias) {
							previousCatchAllWebhookId = catchAllAlias.webhookId || '';
						}
					} catch {
						// non-critical
					}

					// Use the atomic endpoint for all modes
					const webhookAliasData: any = {
						domainId,
						webhookUrl,
						webhookName,
						webhookDescription,
						firstOrCreate: true,
						updateWebhookData: true,
						autoVerify: true,
					};

					if (aliasMode === 'catchall') {
						webhookAliasData.aliasType = 'catchall';
						webhookAliasData.syncWithDomain = true;
					} else if (aliasMode === 'specific') {
						const aliasLocalPart = this.getNodeParameter('aliasLocalPart') as string;
						if (!aliasLocalPart) {
							throw new NodeOperationError(this.getNode(), 'Alias local part is required for specific alias mode');
						}
						webhookAliasData.aliasType = 'specific';
						webhookAliasData.localPart = aliasLocalPart;
					}

					const result = await emailConnectApiRequest.call(this, 'POST', '/api/webhooks/alias', webhookAliasData);

					if (!result.success) {
						throw new NodeOperationError(this.getNode(), `Failed to create/update webhook and alias: ${result.message || 'Unknown error'}`);
					}

					const webhookId = result.webhook.id;
					const aliasId = result.alias?.id || '';

					// Store configuration for cleanup later
					const staticData = this.getWorkflowStaticData('node');
					staticData.domainId = domainId;
					staticData.aliasId = aliasId;
					staticData.webhookId = webhookId;
					staticData.previousWebhookId = previousWebhookId;
					staticData.previousDomainWebhookId = previousDomainWebhookId;
					staticData.previousCatchAllWebhookId = previousCatchAllWebhookId;
					staticData.aliasMode = aliasMode;
					if (aliasMode === 'specific') {
						staticData.aliasLocalPart = this.getNodeParameter('aliasLocalPart') as string;
					}

					return true;
				} catch (error) {
					throw new NodeOperationError(this.getNode(), `Failed to configure webhook endpoint: ${error}`);
				}
			},

			// ------------------------------------------------------------------
			// delete — cleaned up logging
			// ------------------------------------------------------------------
			async delete(this: IHookFunctions): Promise<boolean> {
				try {
					const staticData = this.getWorkflowStaticData('node');
					const domainId = staticData.domainId as string;
					const aliasId = staticData.aliasId as string;
					const webhookId = staticData.webhookId as string;
					const previousWebhookId = staticData.previousWebhookId as string;
					const previousDomainWebhookId = staticData.previousDomainWebhookId as string;
					const previousCatchAllWebhookId = staticData.previousCatchAllWebhookId as string;

					if (domainId && webhookId) {
						// Step 1: Detach the webhook
						try {
							if (aliasId) {
								await emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}/webhook`, {
									webhookId: null,
								});

								// If catch-all, also detach from domain
								if (previousDomainWebhookId !== undefined) {
									try {
										const alias = await emailConnectApiRequest.call(this, 'GET', `/api/aliases/${aliasId}`);
										if (alias.email?.startsWith('*@')) {
											await emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
												webhookId: null,
											});
										}
									} catch {
										// non-critical
									}
								}
							} else {
								await emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
									webhookId: null,
								});

								// Also detach catch-all alias if synchronized
								if (previousCatchAllWebhookId !== undefined) {
									try {
										const response = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
										const aliases = response?.aliases || [];
										const catchAllAlias = aliases.find((a: any) => a.email?.startsWith('*@'));
										if (catchAllAlias) {
											await emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${catchAllAlias.id}/webhook`, {
												webhookId: null,
											});
										}
									} catch {
										// non-critical
									}
								}
							}
						} catch (error) {
							console.warn('EmailConnect: failed to detach webhook:', error);
						}

						// Step 2: Delete the webhook
						try {
							await emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookId}`);
						} catch (error) {
							console.warn('EmailConnect: failed to delete webhook:', webhookId, error);
						}

						// Step 3: Restore previous webhooks
						try {
							if (aliasId) {
								await emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${aliasId}/webhook`, {
									webhookId: previousWebhookId || null,
								});

								if (previousDomainWebhookId !== undefined) {
									try {
										const alias = await emailConnectApiRequest.call(this, 'GET', `/api/aliases/${aliasId}`);
										if (alias.email?.startsWith('*@')) {
											await emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
												webhookId: previousDomainWebhookId || null,
											});
										}
									} catch {
										// non-critical
									}
								}
							} else {
								await emailConnectApiRequest.call(this, 'PUT', `/api/domains/${domainId}/webhook`, {
									webhookId: previousWebhookId || null,
								});

								if (previousCatchAllWebhookId !== undefined) {
									try {
										const response = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
										const aliases = response?.aliases || [];
										const catchAllAlias = aliases.find((a: any) => a.email?.startsWith('*@'));
										if (catchAllAlias) {
											await emailConnectApiRequest.call(this, 'PUT', `/api/aliases/${catchAllAlias.id}/webhook`, {
												webhookId: previousCatchAllWebhookId || null,
											});
										}
									} catch {
										// non-critical
									}
								}
							}
						} catch (error) {
							console.warn('EmailConnect: failed to restore previous webhook:', error);
						}

						// Clean up stored configuration
						delete staticData.domainId;
						delete staticData.aliasId;
						delete staticData.webhookId;
						delete staticData.previousWebhookId;
						delete staticData.previousDomainWebhookId;
						delete staticData.previousCatchAllWebhookId;
					}

					return true;
				} catch (error) {
					console.warn('EmailConnect: error during webhook cleanup:', error);
					return true;
				}
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();
		const events = this.getNodeParameter('events') as string[];
		const domainId = this.getNodeParameter('domainId') as string;
		const aliasId = this.getWorkflowStaticData('node').aliasId as string;

		// Always accept and process any data - return 200 with the received data
		if (!bodyData || typeof bodyData !== 'object') {
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

		// For EmailConnect production data, apply filters
		const isEmailConnectData = emailData.message || emailData.envelope || emailData.status;

		if (isEmailConnectData) {
			const eventType = emailData.status || 'email.received';
			if (!events.includes(eventType)) {
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
				headers: emailData.payload?.headers || emailData.envelope?.headers || {},
				textContent: emailData.payload?.text || emailData.message?.content?.text || '',
				htmlContent: emailData.payload?.html || emailData.message?.content?.html || '',
				attachments: emailData.payload?.attachments || emailData.message?.attachments || [],
				envelope: emailData.payload?.envelope || emailData.envelope || {},
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
