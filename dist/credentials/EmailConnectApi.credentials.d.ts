import { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from 'n8n-workflow';
export declare class EmailConnectApi implements ICredentialType {
    name: string;
    displayName: string;
    icon: "file:../nodes/EmailConnect/emailconnect.svg";
    documentationUrl: string;
    properties: INodeProperties[];
    authenticate: IAuthenticateGeneric;
    test: ICredentialTestRequest;
}
