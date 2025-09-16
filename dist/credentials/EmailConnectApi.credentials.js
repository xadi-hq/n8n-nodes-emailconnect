"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailConnectApi = void 0;
class EmailConnectApi {
    constructor() {
        this.name = 'emailConnectApi';
        this.displayName = 'EmailConnect API';
        this.documentationUrl = 'https://emailconnect.eu/docs';
        this.properties = [
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
				1. <a href="https://app.emailconnect.eu/login" target="_blank">Create account (free)</a><br/>
				2. <a href="https://app.emailconnect.eu/settings/api-keys" target="_blank">Copy API key from settings</a><br/>
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
                description: 'Your EmailConnect API key from <a href="https://app.emailconnect.eu/settings/api-keys" target="_blank">account settings</a>. The key starts with "ec_" and is used to authenticate all API requests.',
                required: true,
            },
        ];
        // Use generic authentication
        this.authenticate = {
            type: 'generic',
            properties: {
                headers: {
                    'X-API-KEY': '={{$credentials.apiKey}}',
                },
            },
        };
        // Test the connection
        this.test = {
            request: {
                baseURL: 'https://app.emailconnect.eu',
                url: '/api/domains',
                method: 'GET',
            },
        };
    }
}
exports.EmailConnectApi = EmailConnectApi;
