import { IExecuteFunctions, IHookFunctions, ILoadOptionsFunctions, IWebhookFunctions, IHttpRequestMethods, INodePropertyOptions } from 'n8n-workflow';
export declare const API_BASE_URL = "https://app.emailconnect.eu";
export declare function emailConnectApiRequest(this: IHookFunctions | IExecuteFunctions | ILoadOptionsFunctions | IWebhookFunctions, method: IHttpRequestMethods, resource: string, body?: any, qs?: any, uri?: string, headers?: any): Promise<any>;
export declare function getDomainOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
export declare function getAliasOptions(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
