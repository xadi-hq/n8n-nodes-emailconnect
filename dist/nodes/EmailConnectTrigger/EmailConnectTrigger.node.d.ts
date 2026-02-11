import { IHookFunctions, INodeType, INodeTypeDescription, IWebhookFunctions, IWebhookResponseData } from 'n8n-workflow';
import { getDomainOptions } from '../EmailConnect/GenericFunctions';
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
