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
                baseURL: 'https://emailconnect.eu',
                url: '/api/domains',
                method: 'GET',
            },
        };
    }
}
exports.EmailConnectApi = EmailConnectApi;
