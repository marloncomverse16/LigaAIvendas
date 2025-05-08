/**
 * Definições de tipos para o serviço da Meta API
 */

export interface MetaApiSuccess {
  success: true;
  phoneNumberId?: string;
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
export function cleanupResources(): Promise<void>;

export default {
  updateMetaPhoneNumberId,
  resetMetaConnection,
  getMetaPhoneNumberId,
  cleanupResources
};