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
    try {
        if (Object.keys(body).length === 0) {
            delete options.body;
        }
        return await this.helpers.httpRequest(options);
    }
    catch (error) {
        throw new n8n_workflow_1.NodeApiError(this.getNode(), error);
    }
}
