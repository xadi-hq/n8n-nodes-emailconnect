import { IHookFunctions, INodeType, INodeTypeDescription, IWebhookFunctions, IWebhookResponseData } from 'n8n-workflow';
import type { IncomingHttpHeaders } from 'http';
import { getDomainOptions } from '../EmailConnect/GenericFunctions';
/**
 * Verify a Standard Webhooks signature against the exact bytes received.
 * `webhook-signature` may list several space-separated `v1,<base64>` entries
 * (secret rotation); any one matching is enough.
 */
export declare function verifyWebhookSignature(secret: string, headers: IncomingHttpHeaders, rawBody: Buffer | undefined, nowSeconds?: number): boolean;
export declare class EmailConnectTrigger implements INodeType {
    description: INodeTypeDescription;
    methods: {
        loadOptions: {
            getDomains: typeof getDomainOptions;
        };
    };
    webhookMethods: {
        default: {
            checkExists(this: IHookFunctions): Promise<boolean>;
            create(this: IHookFunctions): Promise<boolean>;
            delete(this: IHookFunctions): Promise<boolean>;
        };
    };
    webhook(this: IWebhookFunctions): Promise<IWebhookResponseData>;
}
