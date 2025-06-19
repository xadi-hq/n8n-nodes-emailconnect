import { IHookFunctions, ILoadOptionsFunctions, INodePropertyOptions, INodeType, INodeTypeDescription, IWebhookFunctions, IWebhookResponseData } from 'n8n-workflow';
export declare class EmailConnectTrigger implements INodeType {
    description: INodeTypeDescription;
    methods: {
        loadOptions: {
            getDomains(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
            getAliasesForDomain(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
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
