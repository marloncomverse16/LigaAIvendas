/**
 * Módulo para integração com a Evolution API
 * Baseado na documentação: https://doc.evolution-api.com
 */

import axios from 'axios';

/**
 * Representa o cliente para a Evolution API
 */
export class EvolutionApiClient {
  private baseUrl: string;
  private token: string;
  private instance: string;

  /**
   * Cria um novo cliente para a Evolution API
   * @param baseUrl URL base da API (ex: https://api.primerastreadores.com)
   * @param token Token de autorização
   * @param instance Nome da instância (padrão: 'admin')
   */
  constructor(baseUrl: string, token: string, instance: string = 'admin') {
    // Remove barras finais da URL
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
    this.instance = instance;
  }

  /**
   * Verifica se a API está acessível
   * @returns Informações básicas da API
   */
  async checkApiStatus(): Promise<any> {
    try {
      const response = await axios.get(this.baseUrl, {
        headers: this.getHeaders()
      });
      
      return {
        online: response.status === 200,
        data: response.data,
        status: response.status
      };
    } catch (error) {
      console.error('Erro ao verificar status da API Evolution:', error);
      return {
        online: false,
        error: error.message
      };
    }
  }

  /**
   * Obtém o QR Code para conexão da instância
   * @returns URL do QR Code ou objeto de erro
   */
  async getQrCode(): Promise<any> {
    try {
      // Primeiro, verificamos se a API está online
      const apiStatus = await this.checkApiStatus();
      if (!apiStatus.online) {
        return {
          success: false,
          error: 'API Evolution indisponível',
          details: apiStatus
        };
      }

      // A partir da versão 2.0, o endpoint para QR code é:
      const endpoint = `${this.baseUrl}/instance/qrcode`;
      
      console.log(`Solicitando QR code em: ${endpoint}`);
      
      const response = await axios.post(endpoint, {
        instanceName: this.instance
      }, {
        headers: this.getHeaders()
      });
      
      if (response.status === 200 && response.data) {
        return {
          success: true,
          qrCode: response.data.qrcode || response.data.qrCode || null,
          base64: response.data.base64 || null,
          data: response.data
        };
      }
      
      return {
        success: false,
        error: 'QR Code não encontrado na resposta',
        data: response.data
      };
    } catch (error) {
      console.error('Erro ao obter QR Code:', error);
      
      // Fornecer um QR code de teste para desenvolvimento da interface
      const testQrCode = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=WhatsAppConnectionTest-Evolution';
      
      return {
        success: false,
        error: error.message,
        testQrCode: testQrCode
      };
    }
  }

  /**
   * Verifica o status da conexão da instância
   * @returns Status da conexão
   */
  async checkConnectionStatus(): Promise<any> {
    try {
      const endpoint = `${this.baseUrl}/instance/connectionState/${this.instance}`;
      
      console.log(`Verificando status de conexão em: ${endpoint}`);
      
      const response = await axios.get(endpoint, {
        headers: this.getHeaders()
      });
      
      if (response.status === 200) {
        return {
          success: true,
          connected: response.data?.state === 'open' || response.data?.connected === true,
          state: response.data?.state || 'unknown',
          data: response.data
        };
      }
      
      return {
        success: false,
        error: 'Resposta inválida da API',
        data: response.data
      };
    } catch (error) {
      console.error('Erro ao verificar status de conexão:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Desconecta a instância
   * @returns Resultado da operação
   */
  async disconnect(): Promise<any> {
    try {
      const endpoint = `${this.baseUrl}/instance/logout/${this.instance}`;
      
      console.log(`Desconectando instância em: ${endpoint}`);
      
      const response = await axios.post(endpoint, {}, {
        headers: this.getHeaders()
      });
      
      return {
        success: response.status === 200,
        data: response.data
      };
    } catch (error) {
      console.error('Erro ao desconectar instância:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Envia uma mensagem de texto para um contato
   * @param phone Número de telefone no formato internacional (ex: 5511999998888)
   * @param message Texto da mensagem
   * @returns Resultado da operação
   */
  async sendTextMessage(phone: string, message: string): Promise<any> {
    try {
      const endpoint = `${this.baseUrl}/message/text/${this.instance}`;
      
      console.log(`Enviando mensagem de texto para ${phone} em: ${endpoint}`);
      
      const response = await axios.post(endpoint, {
        number: phone,
        options: {
          delay: 1200
        },
        textMessage: {
          text: message
        }
      }, {
        headers: this.getHeaders()
      });
      
      return {
        success: response.status === 201 || response.status === 200,
        data: response.data
      };
    } catch (error) {
      console.error(`Erro ao enviar mensagem para ${phone}:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retorna os cabeçalhos HTTP padrão com token de autorização
   */
  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`
    };
  }
}