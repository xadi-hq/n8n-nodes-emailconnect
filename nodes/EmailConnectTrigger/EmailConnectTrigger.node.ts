import {
	IHookFunctions,
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

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
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				// For EmailConnect, we don't need to register webhooks via API
				// The webhook URL is configured manually in EmailConnect dashboard
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				// For EmailConnect, webhooks are configured manually in the dashboard
				// We just return true to indicate the webhook is "created"
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				// For EmailConnect, webhooks are configured manually in the dashboard
				// We just return true to indicate the webhook is "deleted"
				return true;
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
