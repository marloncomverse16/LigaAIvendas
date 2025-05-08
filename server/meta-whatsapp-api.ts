/**
 * Módulo para integração direta com a API do Facebook/Meta para WhatsApp Cloud API
 * Documentação oficial: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

import axios from 'axios';

/**
 * Cliente para interagir com a API do WhatsApp Business Cloud da Meta
 */
export class MetaWhatsAppClient {
  private baseUrl: string;
  private accessToken: string;
  private phoneNumberId: string;
  
  /**
   * Cria um novo cliente para a API do WhatsApp da Meta
   * @param accessToken Token de acesso para a API do WhatsApp Business
   * @param phoneNumberId ID do número de telefone no WhatsApp Business
   * @param version Versão da API (default: v18.0)
   */
  constructor(accessToken: string, phoneNumberId: string, version: string = 'v18.0') {
    this.baseUrl = `https://graph.facebook.com/${version}`;
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
  }

  /**
   * Verifica se a API está acessível e se o token é válido
   * @returns Informações sobre o número de telefone
   */
  async verifyConnection(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.phoneNumberId}`,
        { headers: this.getHeaders() }
      );
      
      return {
        success: true,
        connected: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        connected: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

  /**
   * Envia uma mensagem de texto simples
   * @param to Número de telefone do destinatário (com código do país, ex: 5511999998888)
   * @param message Texto da mensagem
   * @returns Resposta da API
   */
  async sendTextMessage(to: string, message: string): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'text',
          text: { body: message }
        },
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id || null,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

  /**
   * Envia uma mensagem de modelo (template)
   * @param to Número de telefone do destinatário (com código do país)
   * @param templateName Nome do template
   * @param language Código do idioma (ex: pt_BR)
   * @param components Componentes do template (header, body, buttons)
   * @returns Resposta da API
   */
  async sendTemplateMessage(
    to: string,
    templateName: string, 
    language: string = 'pt_BR',
    components: any[] = []
  ): Promise<any> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: to,
          type: 'template',
          template: {
            name: templateName,
            language: { code: language },
            components: components
          }
        },
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        messageId: response.data.messages?.[0]?.id || null,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

  /**
   * Obtém informações sobre o número de telefone
   * @returns Detalhes do número no WhatsApp Business
   */
  async getPhoneNumberInfo(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.phoneNumberId}`,
        { headers: this.getHeaders() }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        details: error.response?.data || null
      };
    }
  }

  /**
   * Retorna os cabeçalhos HTTP padrão com token de autorização
   * @returns Headers para requisições
   */
  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json'
    };
  }
}