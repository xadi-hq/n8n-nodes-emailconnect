import { IExecuteFunctions, ILoadOptionsFunctions, INodeExecutionData, INodePropertyOptions, INodeType, INodeTypeDescription } from 'n8n-workflow';
export declare class EmailConnect implements INodeType {
    description: INodeTypeDescription;
    methods: {
        loadOptions: {
            getDomains(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
            getAliases(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
            getWebhooks(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]>;
        };
    };
    execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]>;
}
