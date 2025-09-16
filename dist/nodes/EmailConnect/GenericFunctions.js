"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailConnectApiRequest = emailConnectApiRequest;
const n8n_workflow_1 = require("n8n-workflow");
async function emailConnectApiRequest(method, resource, body = {}, qs = {}, uri, headers = {}) {
    const credentials = await this.getCredentials('emailConnectApi');
    const hasBody = Object.keys(body).length > 0;
    const options = {
        method,
        headers: {
            'X-API-KEY': credentials.apiKey,
            ...(hasBody && { 'Content-Type': 'application/json' }),
            ...headers,
        },
        ...(hasBody && { body }),
        qs,
        url: uri || `https://app.emailconnect.eu${resource}`,
        json: true,
    };
    // Debug logging
    console.log('EmailConnect API Request:', {
        method,
        url: options.url,
        hasApiKey: !!credentials.apiKey,
        apiKeyPrefix: credentials.apiKey ? `${String(credentials.apiKey).substring(0, 8)}...` : 'NONE',
        headers: { ...options.headers, 'X-API-KEY': credentials.apiKey ? '[REDACTED]' : 'NONE' },
        body: hasBody ? body : 'EMPTY',
        qs: Object.keys(qs).length > 0 ? qs : 'EMPTY'
    });
    try {
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
