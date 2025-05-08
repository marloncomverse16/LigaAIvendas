/**
 * Definições de tipos para o serviço da Meta API
 */

export interface ServerData {
  id: number;
  name: string; 
  ipAddress: string;
  apiUrl: string;
  apiToken: string;
  whatsappMetaToken?: string;
  whatsappMetaBusinessId?: string;
  whatsappMetaApiVersion?: string;
  [key: string]: any;
}

export interface UserServerData {
  id: number;
  userId: number;
  serverId: number;
  metaPhoneNumberId?: string | null;
  metaConnected: boolean;
  metaConnectedAt?: Date | null;
  [key: string]: any;
}

export interface MetaApiSuccess {
  success: true;
  phoneNumberId?: string;
  connected?: boolean;
  connectedAt?: Date | string;
  updatedServer?: any;
  server?: ServerData;
  userServer?: UserServerData;
}

export interface MetaApiError {
  success: false;
  error?: string;
  message?: string;
}

export type MetaApiResult = MetaApiSuccess | MetaApiError;

export function updateMetaPhoneNumberId(userId: number, phoneNumberId: string): Promise<MetaApiResult>;
export function resetMetaConnection(userId: number): Promise<MetaApiResult>;
export function getMetaPhoneNumberId(userId: number): Promise<MetaApiResult>;
export function getUserServer(userId: number): Promise<MetaApiResult>;
export function cleanupResources(): Promise<void>;