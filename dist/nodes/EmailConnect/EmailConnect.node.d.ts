import { IExecuteFunctions, ILoadOptionsFunctions, INodeExecutionData, INodePropertyOptions, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { getDomainOptions, getAliasOptions } from './GenericFunctions';
export declare class EmailConnect implements INodeType {
    description: INodeTypeDescription;
    methods: {
        loadOptions: {
            getDomains: typeof getDomainOptions;
            getAliases: typeof getAliasOptions;
            getWebhooks(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
