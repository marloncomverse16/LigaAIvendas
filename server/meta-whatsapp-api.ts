/**
 * Implementação direta com a Meta API para WhatsApp Cloud API
 * 
 * Documentação oficial: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import axios from 'axios';
import { Server } from '@shared/schema';

// Interface para mensagem do WhatsApp
interface WhatsAppMessage {
  to: string;           // Número de telefone do destinatário (com código do país)
  type: string;         // Tipo da mensagem: text, template, media, etc.
  text?: {              // Conteúdo da mensagem de texto
    body: string;
  };
  template?: {          // Conteúdo do template
    name: string;
    language: {
      code: string;     // Código do idioma (ex: pt_BR)
    };
    components?: any[]; // Componentes do template
  };
  media?: {             // Conteúdo de mídia
    id?: string;        // ID da mídia (se já foi enviada)
    link?: string;      // URL da mídia
    caption?: string;   // Legenda da mídia
    filename?: string;  // Nome do arquivo
  };
}

// Interface para resposta de conexão
interface WhatsAppConnectionResponse {
  connected: boolean;
  phoneNumberId?: string;
  businessName?: string;
  businessPhoneNumber?: string;
  apiVersion?: string;
  error?: string;
}

// Classe para comunicação direta com a API da Meta
export class MetaWhatsAppAPI {
  private baseUrl: string;
  private token: string;
  private businessId: string;
  private apiVersion: string;
  private phoneNumberId: string | null;

  constructor(token: string, businessId: string, phoneNumberId: string | null = null, apiVersion: string = 'v18.0') {
    this.token = token;
    this.businessId = businessId;
    this.apiVersion = apiVersion;
    this.phoneNumberId = phoneNumberId;
    this.baseUrl = `https://graph.facebook.com/${this.apiVersion}`;
  }

  // Método para obter cabeçalhos padrão com autenticação
  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  // Verifica se a conexão está ativa
  async checkConnection(): Promise<WhatsAppConnectionResponse> {
    try {
      if (!this.phoneNumberId) {
        return { connected: false, error: 'ID do número de telefone não configurado' };
      }

      // Obter informações do número de telefone
      const response = await axios.get(
        `${this.baseUrl}/${this.phoneNumberId}`,
        { headers: this.getHeaders() }
      );

      if (response.status === 200 && response.data) {
        return {
          connected: true,
          phoneNumberId: this.phoneNumberId,
          businessName: response.data.display_phone_number || response.data.name,
          businessPhoneNumber: response.data.verified_name || response.data.display_phone_number,
          apiVersion: this.apiVersion
        };
      }
      
      return { connected: false, error: 'Não foi possível verificar a conexão' };
    } catch (error: any) {
      console.error('Erro ao verificar conexão com Meta API:', error.response?.data || error.message);
      return { 
        connected: false, 
        error: error.response?.data?.error?.message || error.message || 'Erro ao verificar conexão' 
      };
    }
  }

  // Método para criar uma conexão (apenas validação de parâmetros)
  async connect(newPhoneNumberId: string): Promise<WhatsAppConnectionResponse> {
    try {
      this.phoneNumberId = newPhoneNumberId;
      
      // Verificar se o número existe e está disponível
      return await this.checkConnection();
    } catch (error: any) {
      console.error('Erro ao conectar com Meta API:', error.response?.data || error.message);
      return { 
        connected: false, 
        error: error.response?.data?.error?.message || error.message || 'Erro ao conectar' 
      };
    }
  }

  // Método para enviar mensagem
  async sendMessage(message: WhatsAppMessage): Promise<any> {
    try {
      if (!this.phoneNumberId) {
        throw new Error('ID do número de telefone não configurado');
      }

      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        message,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || error.message || 'Erro ao enviar mensagem');
    }
  }

  // Método para obter o status do webhook
  async getWebhookStatus(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.businessId}/message_webhooks`,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error: any) {
      console.error('Erro ao obter status do webhook:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || error.message || 'Erro ao obter status do webhook');
    }
  }

  // Método estático para criar instância a partir dos dados do servidor
  static fromServer(server: Server, phoneNumberId: string | null = null): MetaWhatsAppAPI | null {
    // Verificar se o servidor tem as configurações necessárias
    if (!server.whatsappMetaToken || !server.whatsappMetaBusinessId) {
      console.error('Servidor não possui configurações para Meta API');
      return null;
    }

    return new MetaWhatsAppAPI(
      server.whatsappMetaToken,
      server.whatsappMetaBusinessId,
      phoneNumberId,
      server.whatsappMetaApiVersion || 'v18.0'
    );
  }
}

export default MetaWhatsAppAPI;