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
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Your EmailConnect API key. You can find this in your account settings at https://emailconnect.eu/settings',
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
