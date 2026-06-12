"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_BASE_URL = void 0;
exports.emailConnectApiRequest = emailConnectApiRequest;
exports.getDomainOptions = getDomainOptions;
exports.getAliasOptions = getAliasOptions;
const n8n_workflow_1 = require("n8n-workflow");
exports.API_BASE_URL = 'https://app.emailconnect.eu';
async function emailConnectApiRequest(method, resource, body = {}, qs = {}, uri, headers = {}) {
    const hasBody = Object.keys(body).length > 0;
    const options = {
        method,
        headers: {
            ...(hasBody && { 'Content-Type': 'application/json' }),
            ...headers,
        },
        ...(hasBody && { body }),
        qs,
        url: uri || `${exports.API_BASE_URL}${resource}`,
        json: true,
    };
    try {
        // Authentication (the X-API-KEY header) is applied from the credential's
        // `authenticate` block by httpRequestWithAuthentication.
        return await this.helpers.httpRequestWithAuthentication.call(this, 'emailConnectApi', options);
    }
    catch (error) {
        throw new n8n_workflow_1.NodeApiError(this.getNode(), error);
    }
}
async function getDomainOptions() {
    try {
        const response = await emailConnectApiRequest.call(this, 'GET', '/api/domains');
        const domains = response === null || response === void 0 ? void 0 : response.domains;
        if (!Array.isArray(domains))
            return [];
        return domains.map((domain) => ({
            name: `${domain.domain} (${domain.id})`,
            value: domain.id,
        }));
    }
    catch (error) {
        // Dropdown load failed — degrade gracefully to an empty list so the UI
        // stays usable, but surface the cause in the n8n log.
        this.logger.warn(`EmailConnect: failed to load domain options: ${error.message}`);
        return [];
    }
}
async function getAliasOptions() {
    try {
        const domainId = this.getCurrentNodeParameter('domainId');
        if (!domainId)
            return [];
        const response = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
        const aliases = response === null || response === void 0 ? void 0 : response.aliases;
        if (!Array.isArray(aliases))
            return [];
        return aliases.map((alias) => ({
            name: `${alias.email} (${alias.id})`,
            value: alias.id,
        }));
    }
    catch (error) {
        // Dropdown load failed — degrade gracefully to an empty list so the UI
        // stays usable, but surface the cause in the n8n log.
        this.logger.warn(`EmailConnect: failed to load alias options: ${error.message}`);
        return [];
    }
}
