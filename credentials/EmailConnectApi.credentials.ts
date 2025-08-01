import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class EmailConnectApi implements ICredentialType {
	name = 'emailConnectApi';
	displayName = 'EmailConnect API';
	documentationUrl = 'https://emailconnect.eu/docs';
	properties: INodeProperties[] = [
		{
			displayName: 'Need an API Key?',
			name: 'apiKeyHelp',
			type: 'notice',
			default: '',
			typeOptions: {
				theme: 'info'
			},
			description: `
				<strong>Get your EmailConnect API key:</strong><br/>
				1. <a href="https://emailconnect.eu/register" target="_blank">Create account (free)</a><br/>
				2. <a href="https://emailconnect.eu/settings" target="_blank">Copy API key from settings</a><br/>
				<br/>
				<strong>🇪🇺 100% EU-operated • Free 50 emails/month</strong>
			`,
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			hint: 'Found in your EmailConnect account settings',
			description: 'Your EmailConnect API key from <a href="https://emailconnect.eu/settings" target="_blank">account settings</a>. The key starts with "ec_" and is used to authenticate all API requests.',
			required: true,
		},
	];

	// Use generic authentication
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-KEY': '={{$credentials.apiKey}}',
			},
		},
	};

	// Test the connection
	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://emailconnect.eu',
			url: '/api/domains',
			method: 'GET',
		},
	};
}
