import {
	IExecuteFunctions,
	IHookFunctions,
	ILoadOptionsFunctions,
	IWebhookFunctions,
	IHttpRequestOptions,
	IHttpRequestMethods,
	NodeApiError,
} from 'n8n-workflow';

export async function emailConnectApiRequest(
	this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions | IWebhookFunctions,
	method: IHttpRequestMethods,
	resource: string,
	body: any = {},
	qs: any = {},
	uri?: string,
	headers: any = {},
): Promise<any> {
	const credentials = await this.getCredentials('emailConnectApi');

	const options: IHttpRequestOptions = {
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
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as any);
	}
}
