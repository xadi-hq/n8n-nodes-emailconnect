"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailConnectApiRequest = emailConnectApiRequest;
const n8n_workflow_1 = require("n8n-workflow");
async function emailConnectApiRequest(method, resource, body = {}, qs = {}, uri, headers = {}) {
    const credentials = await this.getCredentials('emailConnectApi');
    const options = {
        method,
        headers: {
            'X-API-KEY': credentials.apiKey,
            'Content-Type': 'application/json',
            ...headers,
        },
        body,
        qs,
        url: uri || `https://emailconnect.eu${resource}`,
        json: true,
    };
    // Debug logging
    console.log('EmailConnect API Request:', {
        method,
        url: options.url,
        hasApiKey: !!credentials.apiKey,
        apiKeyPrefix: credentials.apiKey ? `${String(credentials.apiKey).substring(0, 8)}...` : 'NONE',
        headers: { ...options.headers, 'X-API-KEY': credentials.apiKey ? '[REDACTED]' : 'NONE' },
        body: Object.keys(body).length > 0 ? body : 'EMPTY',
        qs: Object.keys(qs).length > 0 ? qs : 'EMPTY'
    });
    try {
        if (Object.keys(body).length === 0) {
            delete options.body;
        }
        const response = await this.helpers.httpRequest(options);
        // Debug logging for response
        console.log('EmailConnect API Response:', {
            url: options.url,
            responseType: typeof response,
            isArray: Array.isArray(response),
            responseLength: Array.isArray(response) ? response.length : 'N/A',
            response: response
        });
        return response;
    }
    catch (error) {
        console.error('EmailConnect API Error:', {
            url: options.url,
            error: error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : 'No stack trace'
        });
        throw new n8n_workflow_1.NodeApiError(this.getNode(), error);
    }
}
