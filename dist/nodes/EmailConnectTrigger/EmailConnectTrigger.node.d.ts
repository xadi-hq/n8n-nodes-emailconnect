import { ICredentialTestFunctions, ICredentialsDecrypted, IHookFunctions, INodeType, INodeTypeDescription, IWebhookFunctions, IWebhookResponseData, INodeCredentialTestResult } from 'n8n-workflow';
import { getDomainOptions } from '../EmailConnect/GenericFunctions';
type IncomingHttpHeaders = Record<string, string | string[] | undefined>;
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
        credentialTest: {
            emailConnectWebhookSigningApiTest(this: ICredentialTestFunctions, credential: ICredentialsDecrypted): Promise<INodeCredentialTestResult>;
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
export {};
