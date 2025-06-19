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

	const hasBody = Object.keys(body).length > 0;

	const options: IHttpRequestOptions = {
		method,
		headers: {
			'X-API-KEY': credentials.apiKey,
			...(hasBody && { 'Content-Type': 'application/json' }),
			...headers,
		},
		...(hasBody && { body }),
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
	} catch (error) {
		console.error('EmailConnect API Error:', {
			url: options.url,
			error: error,
			errorMessage: error instanceof Error ? error.message : String(error),
			errorStack: error instanceof Error ? error.stack : 'No stack trace'
		});
		throw new NodeApiError(this.getNode(), error as any);
	}
}
