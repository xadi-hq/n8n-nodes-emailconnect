import {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	NodeOperationError,
	type NodeConnectionType,
} from 'n8n-workflow';

import { emailConnectApiRequest, getDomainOptions } from '../EmailConnect/GenericFunctions';

// Sanctioned trusted-source header: the backend auto-verifies webhooks
// created/updated by known integrations (n8n-node, zapier, make). Sent on
// every atomic upsert as belt-and-braces alongside the autoVerify body flag.
const TRUSTED_SOURCE_HEADERS = { 'X-EmailConnect-Source': 'n8n-node' };

// ---------------------------------------------------------------------------
// Helper: build the body for the atomic POST /api/webhooks/alias upsert.
// Shared by create() and the URL-change path so both use the one mechanism
// that reliably (re)verifies the webhook server-side (autoVerify).
// ---------------------------------------------------------------------------
function buildWebhookAliasBody(
	context: IHookFunctions,
	webhookUrl: string | undefined,
	webhookName: string,
	webhookDescription: string,
): IDataObject {
	const aliasMode = context.getNodeParameter('aliasMode') as string;

	const body: IDataObject = {
		domainId: context.getNodeParameter('domainId') as string,
		webhookUrl,
		webhookName,
		webhookDescription,
		firstOrCreate: true,
		updateWebhookData: true,
		autoVerify: true,
	};

	if (aliasMode === 'catchall') {
		body.aliasType = 'catchall';
		body.syncWithDomain = true;
	} else {
		const localPart = context.getNodeParameter('aliasLocalPart') as string;
		if (!localPart) {
			throw new NodeOperationError(context.getNode(), 'Alias local part is required for specific alias mode');
		}
		body.aliasType = 'specific';
		body.localPart = localPart;
	}

	return body;
}

// ---------------------------------------------------------------------------
// Helper: the webhook URL changed (e.g. n8n test↔production). Re-run the
// atomic upsert so the URL is updated AND re-verified in one call.
//
// A plain PUT /api/webhooks/{id} resets `verified` to false for any non-test
// URL, and the standalone /verify flow uses a server-generated token the node
// cannot reproduce — so autoVerify via /api/webhooks/alias is the only path
// that keeps the production webhook verified.
// ---------------------------------------------------------------------------
async function updateWebhookUrlAndVerify(
	context: IHookFunctions,
	webhookUrl: string,
): Promise<void> {
	const staticData = context.getWorkflowStaticData('node');
	const isTestUrl = (webhookUrl ?? '').includes('/webhook-test/');
	const webhookName = (staticData.webhookName as string)
		|| `n8n trigger (${context.getNode().name})`;
	const webhookDescription = `Auto-created webhook for n8n trigger node: ${context.getNode().name} (${isTestUrl ? 'Test' : 'Production'})`;

	const body = buildWebhookAliasBody(context, webhookUrl, webhookName, webhookDescription);
	const result = await emailConnectApiRequest.call(
		context,
		'POST',
		'/api/webhooks/alias',
		body,
		{},
		undefined,
		TRUSTED_SOURCE_HEADERS,
	);

	if (result?.webhook?.id) staticData.webhookId = result.webhook.id;
	if (result?.alias?.id) staticData.aliasId = result.alias.id;
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
			// URL changed (e.g. test↔prod) — re-upsert to update URL & re-verify
			await updateWebhookUrlAndVerify(context, webhookUrl);
			return true;
		}

		// URL matches — nothing changed
		return true;
	} catch {
		// Stored webhook no longer exists
		delete staticData.webhookId;
		delete staticData.aliasId;
		return false;
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
		outputs: ['main'] as NodeConnectionType[],
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
						value: 'catchall',
						description: 'Route ALL emails to this domain through this workflow (*@yourdomain.com)',
					},
					{
						name: 'Use Specific Alias',
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
				displayName: 'Webhook Name',
				name: 'webhookName',
				type: 'string',
				default: '',
				placeholder: 'Alias endpoint trigger',
				description: 'A descriptive name for this webhook configuration. If left empty, will default to the email address + "endpoint trigger".',
			},
			{
				displayName: 'Webhook Description',
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
							await updateWebhookUrlAndVerify(this, webhookUrl);
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
					// Fetch the domain (for name + previousWebhookId restoration) and,
					// only in catch-all mode, the existing aliases (to restore the
					// previous catch-all webhook on delete) — concurrently.
					const [domain, aliasesResponse] = await Promise.all([
						emailConnectApiRequest.call(this, 'GET', `/api/domains/${domainId}`),
						aliasMode === 'catchall'
							? emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`).catch(() => null)
							: Promise.resolve(null),
					]);

					const previousWebhookId = domain.webhookId || '';

					let previousCatchAllWebhookId = '';
					if (aliasesResponse) {
						const catchAllAlias = (aliasesResponse.aliases || []).find((a: any) => a.email?.startsWith('*@'));
						if (catchAllAlias) {
							previousCatchAllWebhookId = catchAllAlias.webhookId || '';
						}
					}

					// Generate a default webhook name if none provided
					if (!webhookName || webhookName.trim() === '') {
						const domainName = domain.domain;
						if (aliasMode === 'catchall') {
							webhookName = `*@${domainName} endpoint trigger`;
						} else {
							const aliasLocalPart = this.getNodeParameter('aliasLocalPart') as string;
							webhookName = aliasLocalPart
								? `${aliasLocalPart}@${domainName} endpoint trigger`
								: `${domainName} endpoint trigger`;
						}
					}

					// Atomic upsert: creates/updates webhook + alias and auto-verifies.
					const webhookAliasData = buildWebhookAliasBody(this, webhookUrl, webhookName, webhookDescription);
					const result = await emailConnectApiRequest.call(
						this,
						'POST',
						'/api/webhooks/alias',
						webhookAliasData,
						{},
						undefined,
						TRUSTED_SOURCE_HEADERS,
					);

					if (!result.success) {
						throw new NodeOperationError(this.getNode(), `Failed to create/update webhook and alias: ${result.message || 'Unknown error'}`);
					}

					// Store configuration for cleanup later
					const staticData = this.getWorkflowStaticData('node');
					staticData.domainId = domainId;
					staticData.aliasId = result.alias?.id || '';
					staticData.webhookId = result.webhook.id;
					staticData.webhookName = webhookName;
					staticData.previousWebhookId = previousWebhookId;
					staticData.previousDomainWebhookId = '';
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
						// Ownership probe: n8n also tears down the TEST registration after a
						// workflow is published, and test+prod share one EmailConnect webhook
						// (firstOrCreate by alias email). If the webhook's URL no longer
						// matches this registration's URL, the other registration owns it
						// now — tearing down here would silently break the live workflow.
						const ownUrl = this.getNodeWebhookUrl('default') as string;
						try {
							const currentWebhook = await emailConnectApiRequest.call(this, 'GET', `/api/webhooks/${webhookId}`);
							if (currentWebhook?.url && ownUrl && currentWebhook.url !== ownUrl) {
								// Superseded — keep static data; the live registration relies on it.
								return true;
							}
						} catch {
							// Webhook already gone — nothing to tear down; drop stale state.
							delete staticData.domainId;
							delete staticData.aliasId;
							delete staticData.webhookId;
							delete staticData.previousWebhookId;
							delete staticData.previousDomainWebhookId;
							delete staticData.previousCatchAllWebhookId;
							return true;
						}

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
							this.logger.warn(`EmailConnect: failed to detach webhook: ${error}`);
						}

						// Step 2: Delete the webhook
						try {
							await emailConnectApiRequest.call(this, 'DELETE', `/api/webhooks/${webhookId}`);
						} catch (error) {
							this.logger.warn(`EmailConnect: failed to delete webhook ${webhookId}: ${error}`);
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
							this.logger.warn(`EmailConnect: failed to restore previous webhook: ${error}`);
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
					this.logger.warn(`EmailConnect: error during webhook cleanup: ${error}`);
					return true;
				}
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData();

		// No / invalid body — typically the n8n "listen for test event" probe.
		if (!bodyData || typeof bodyData !== 'object') {
			return {
				workflowData: [
					[
						{
							json: {
								test: true,
								message: 'EmailConnect trigger webhook is working!',
								receivedAt: new Date().toISOString(),
								note: 'Send JSON data to see it processed',
							},
						},
					],
				],
			};
		}

		const emailData = bodyData as IDataObject;

		// Webhook verification handshake — acknowledge with 200 but don't start
		// the workflow with an internal verification payload.
		if (emailData.type === 'webhook_verification') {
			return { workflowData: [[]] };
		}

		// Emit the EmailConnect payload exactly as received. Delivery is already
		// scoped to this alias/domain server-side, so no client-side domain/alias
		// or event filtering is applied. Email content is under `message.*`,
		// routing/headers under `envelope.*`, plus top-level `domainId`/`aliasId`.
		return {
			workflowData: [[{ json: emailData }]],
		};
	}
}
