import { ICredentialType, INodeProperties } from 'n8n-workflow';

/**
 * The signing secret of ONE EmailConnect webhook. Selected per EmailConnect
 * Trigger (Verify Signatures on), so each trigger, and so each webhook, can
 * have its own secret. The trigger registers it on its webhook at activation.
 *
 * Holds no API access: it is never sent anywhere except in the alias upsert
 * that stores it on the webhook.
 */
export class EmailConnectWebhookSigningApi implements ICredentialType {
	name = 'emailConnectWebhookSigningApi';
	displayName = 'EmailConnect Webhook Signing API';
	// Relative to the compiled file too: gulp copies node icons to dist/nodes.
	icon = 'file:../nodes/EmailConnect/emailconnect.svg' as const;
	documentationUrl = 'https://emailconnect.eu/docs/';
	properties: INodeProperties[] = [
		{
			displayName: 'Signing Secret',
			name: 'secret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			placeholder: 'whsec_...',
			hint: 'Use one secret per trigger. Requires an EmailConnect Maker plan or higher.',
			description: 'A secret in "whsec_" + base64 format. Generate one with <code>echo "whsec_$(openssl rand -base64 24)"</code>, or copy the one EmailConnect generated for the webhook. The trigger stores it on its webhook when the workflow is activated, replacing any secret the webhook had. After changing it, deactivate and reactivate the workflow.',
		},
	];
}
