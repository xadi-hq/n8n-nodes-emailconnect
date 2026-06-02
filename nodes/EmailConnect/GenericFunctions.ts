import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	IHttpRequestOptions,
	IHttpRequestMethods,
	INodePropertyOptions,
	NodeApiError,
} from 'n8n-workflow';

export const API_BASE_URL = 'https://app.emailconnect.eu';

export async function emailConnectApiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions | IWebhookFunctions,
	method: IHttpRequestMethods,
	resource: string,
	body: any = {},
	qs: any = {},
	uri?: string,
	headers: any = {},
): Promise<any> {
	const hasBody = Object.keys(body).length > 0;

	const options: IHttpRequestOptions = {
		method,
		headers: {
			...(hasBody && { 'Content-Type': 'application/json' }),
			...headers,
		},
		...(hasBody && { body }),
		qs,
		url: uri || `${API_BASE_URL}${resource}`,
		json: true,
	};

	try {
		// Authentication (the X-API-KEY header) is applied from the credential's
		// `authenticate` block by httpRequestWithAuthentication.
		return await this.helpers.httpRequestWithAuthentication.call(this, 'emailConnectApi', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as any);
	}
}

export async function getDomainOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	try {
		const response = await emailConnectApiRequest.call(this, 'GET', '/api/domains');
		const domains = response?.domains;
		if (!Array.isArray(domains)) return [];

		return domains.map((domain: any) => ({
			name: `${domain.domain} (${domain.id})`,
			value: domain.id,
		}));
	} catch {
		return [];
	}
}

export async function getAliasOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	try {
		const domainId = this.getCurrentNodeParameter('domainId') as string;
		if (!domainId) return [];

		const response = await emailConnectApiRequest.call(this, 'GET', `/api/aliases?domainId=${domainId}`);
		const aliases = response?.aliases;
		if (!Array.isArray(aliases)) return [];

		return aliases.map((alias: any) => ({
			name: `${alias.email} (${alias.id})`,
			value: alias.id,
		}));
	} catch {
		return [];
	}
}
