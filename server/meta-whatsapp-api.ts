/**
 * Cliente para a WhatsApp Cloud API da Meta
 * Documentação oficial: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import axios from 'axios';

export interface ConnectionResult {
  connected: boolean;
  phoneNumberId?: string;
  businessName?: string;
  businessPhoneNumber?: string;
  apiVersion?: string;
  error?: string;
  details?: any;
}

export class MetaWhatsAppAPI {
  private token: string;
  private businessId: string;
  private phoneNumberId: string;
  private apiVersion: string;
  private baseUrl: string;
  
  /**
   * Cria um novo cliente para a API do WhatsApp da Meta
   * @param token Token de acesso
   * @param businessId ID do negócio no WhatsApp Business
   * @param phoneNumberId ID do número de telefone (opcional para algumas operações)
   * @param apiVersion Versão da API (default: v18.0)
   */
  constructor(
    token: string,
    businessId: string,
    phoneNumberId: string = '',
    apiVersion: string = 'v18.0'
  ) {
    this.token = token;
    this.businessId = businessId;
    this.phoneNumberId = phoneNumberId;
    this.apiVersion = apiVersion;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }
  
  /**
   * Verifica a conexão com a API da Meta e valida o phoneNumberId
   * @param phoneNumberId ID do número de telefone
   */
  async connect(phoneNumberId: string = this.phoneNumberId): Promise<ConnectionResult> {
    try {
      // Configurar o número de telefone
      if (phoneNumberId) {
        this.phoneNumberId = phoneNumberId;
      }
      
      if (!this.phoneNumberId) {
        return {
          connected: false,
          error: 'ID do número de telefone não fornecido'
        };
      }
      
      // Obter informações sobre o número para validar a conexão
      const infoResult = await this.getPhoneNumberInfo();
      
      if (!infoResult.connected || infoResult.error) {
        return infoResult;
      }
      
      return {
        connected: true,
        phoneNumberId: this.phoneNumberId,
        businessName: infoResult.businessName,
        businessPhoneNumber: infoResult.businessPhoneNumber,
        apiVersion: this.apiVersion
      };
    } catch (error: any) {
      console.error('Erro ao conectar com API da Meta:', error);
      return {
        connected: false,
        error: error.message || 'Erro desconhecido ao conectar',
        details: error.response?.data
      };
    }
  }
  
  /**
   * Obtém informações sobre o número de telefone
   */
  async getPhoneNumberInfo(): Promise<ConnectionResult> {
    try {
      if (!this.phoneNumberId) {
        return {
          connected: false,
          error: 'ID do número de telefone não fornecido'
        };
      }
      
      const url = `${this.baseUrl}/${this.phoneNumberId}`;
      
      const response = await axios.get(url, {
        headers: this.getHeaders(),
        params: {
          fields: 'verified_name,display_phone_number,quality_rating,status'
        }
      });
      
      if (response.data && response.data.verified_name) {
        return {
          connected: true,
          phoneNumberId: this.phoneNumberId,
          businessName: response.data.verified_name,
          businessPhoneNumber: response.data.display_phone_number,
          apiVersion: this.apiVersion,
          details: response.data
        };
      } else {
        return {
          connected: false,
          error: 'Resposta da API não contém informações esperadas',
          details: response.data
        };
      }
    } catch (error: any) {
      console.error('Erro ao obter informações do número:', error);
      return {
        connected: false,
        error: error.message || 'Erro desconhecido',
        details: error.response?.data
      };
    }
  }
  
  /**
   * Verifica o status da conexão
   */
  async checkConnection(): Promise<ConnectionResult> {
    return this.getPhoneNumberInfo();
  }
  
  /**
   * Envia uma mensagem pelo WhatsApp
   * @param messageData Dados da mensagem (conforme especificação da API)
   */
  async sendMessage(messageData: any): Promise<any> {
    try {
      if (!this.phoneNumberId) {
        throw new Error('ID do número de telefone não configurado');
      }
      
      const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
      
      const response = await axios.post(url, messageData, {
        headers: this.getHeaders()
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      throw new Error(error.response?.data?.error?.message || error.message || 'Erro ao enviar mensagem');
    }
  }
  
  /**
   * Envia uma mensagem de texto simples
   * @param to Número de telefone de destino (formato internacional sem '+')
   * @param text Texto da mensagem
   */
  async sendTextMessage(to: string, text: string): Promise<any> {
    const messageData = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: text
      }
    };
    
    return this.sendMessage(messageData);
  }
  
  /**
   * Retorna os cabeçalhos HTTP para as requisições
   */
  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }
}