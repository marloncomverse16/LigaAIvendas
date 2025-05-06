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
   * @param instance Nome da instância (padrão: 'liguia')
   */
  constructor(baseUrl: string, token: string, instance: string = 'liguia') {
    // Remove barras finais da URL
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
    this.instance = instance;
    
    console.log(`Inicializando Evolution API Client:
      URL Base: ${this.baseUrl}
      Instance: ${this.instance}
      Token: ${this.token.substring(0, 5)}...${this.token.substring(this.token.length - 5)}
    `);
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

      console.log("API Evolution online. Tentando obter QR code...");
      console.log("Informações da API:", apiStatus);

      // Verificação adicional da versão
      // A conexão é diferente dependendo da versão
      const isVersion2 = apiStatus.data && apiStatus.data.version && apiStatus.data.version.startsWith('2');
      console.log(`Versão da API: ${apiStatus.data?.version || 'desconhecida'}`);
      
      // Como a API retorna o manager URL, vamos tentar isso primeiro
      // mas também tentaremos outros endpoints conhecidos
      const managerUrl = apiStatus.data?.manager || null;
      
      // Corrigir protocolo - garantir https
      const secureManagerUrl = managerUrl ? managerUrl.replace(/^http:/, 'https:') : null;
      
      // Endpoints a tentar - adaptados para versão 2.x da Evolution API
      const endpoints = [];
      
      // Se temos a URL do Manager, adicioná-la primeiro
      if (secureManagerUrl) {
        // Endpoints via manager (interface web)
        endpoints.push(`${secureManagerUrl}api/qrcode/${this.instance}`);
        endpoints.push(`${secureManagerUrl}instance/qrcode/${this.instance}`);
      }
      
      // Endpoints diretos na API
      if (isVersion2) {
        // Endpoints da versão 2.x
        endpoints.push(`${this.baseUrl}/instance/qrcode`); // POST com instanceName
        endpoints.push(`${this.baseUrl}/qrcode/${this.instance}`);
        endpoints.push(`${this.baseUrl}/client/qrcode/${this.instance}`);
      } else {
        // Endpoints de versões anteriores ou alternativas
        endpoints.push(`${this.baseUrl}/start`); // POST com session
        endpoints.push(`${this.baseUrl}/api/session/start/${this.instance}`);
        endpoints.push(`${this.baseUrl}/api/session/qrcode/${this.instance}`);
      }
      
      // Adicionar endpoints comuns ou de teste
      endpoints.push(`${this.baseUrl}/instance/qrcode/${this.instance}`);
      endpoints.push(`${this.baseUrl}/manager/qrcode/${this.instance}`);
      
      // Metadados para a requisição
      const postBodyV2 = { instanceName: this.instance };
      const postBodyLegacy = { session: this.instance };
      
      console.log(`Tentando ${endpoints.length} endpoints possíveis...`);
      
      // Tentar cada endpoint
      for (const endpoint of endpoints) {
        try {
          console.log(`Tentando obter QR code em: ${endpoint}`);
          
          // Tentar com POST primeiro (v2)
          try {
            console.log(`POST com payload V2: ${JSON.stringify(postBodyV2)}`);
            const postResponse = await axios.post(
              endpoint, 
              postBodyV2,
              { headers: this.getHeaders() }
            );
            
            console.log(`Resposta POST (V2): Status ${postResponse.status}`);
            
            if (postResponse.status === 200 || postResponse.status === 201) {
              console.log("QR Code obtido com sucesso via POST (V2)");
              // Logar a resposta para diagnóstico
              console.log("Dados da resposta:", JSON.stringify(postResponse.data).substring(0, 200) + "...");
              
              // Checar se existe QR code na resposta
              const qrCode = postResponse.data?.qrcode || 
                            postResponse.data?.qrCode || 
                            postResponse.data?.base64 || 
                            (typeof postResponse.data === 'string' ? postResponse.data : null);
              
              if (qrCode) {
                return {
                  success: true,
                  qrCode: qrCode,
                  base64: postResponse.data?.base64 || null,
                  data: postResponse.data,
                  endpoint: endpoint,
                  method: 'POST (V2)'
                };
              } else {
                console.log("Resposta sem QR code");
              }
            }
          } catch (postError) {
            console.log(`POST (V2) falhou em ${endpoint}: ${postError.message}`);
          }
          
          // Tentar com POST (legacy)
          try {
            console.log(`POST com payload Legacy: ${JSON.stringify(postBodyLegacy)}`);
            const postLegacyResponse = await axios.post(
              endpoint, 
              postBodyLegacy,
              { headers: this.getHeaders() }
            );
            
            console.log(`Resposta POST (Legacy): Status ${postLegacyResponse.status}`);
            
            if (postLegacyResponse.status === 200 || postLegacyResponse.status === 201) {
              console.log("QR Code obtido com sucesso via POST (Legacy)");
              // Logar a resposta para diagnóstico
              console.log("Dados da resposta:", JSON.stringify(postLegacyResponse.data).substring(0, 200) + "...");
              
              // Checar se existe QR code na resposta
              const qrCode = postLegacyResponse.data?.qrcode || 
                            postLegacyResponse.data?.qrCode || 
                            postLegacyResponse.data?.base64 || 
                            (typeof postLegacyResponse.data === 'string' ? postLegacyResponse.data : null);
              
              if (qrCode) {
                return {
                  success: true,
                  qrCode: qrCode,
                  base64: postLegacyResponse.data?.base64 || null,
                  data: postLegacyResponse.data,
                  endpoint: endpoint,
                  method: 'POST (Legacy)'
                };
              } else {
                console.log("Resposta sem QR code");
              }
            }
          } catch (postLegacyError) {
            console.log(`POST (Legacy) falhou em ${endpoint}: ${postLegacyError.message}`);
          }
          
          // Se POST falhar, tentar com GET
          try {
            console.log(`GET para ${endpoint}`);
            const getResponse = await axios.get(endpoint, {
              headers: this.getHeaders()
            });
            
            console.log(`Resposta GET: Status ${getResponse.status}`);
            
            if (getResponse.status === 200 || getResponse.status === 201) {
              console.log("QR Code obtido com sucesso via GET");
              // Logar a resposta para diagnóstico
              console.log("Dados da resposta:", JSON.stringify(getResponse.data).substring(0, 200) + "...");
              
              // Checar se existe QR code na resposta
              const qrCode = getResponse.data?.qrcode || 
                            getResponse.data?.qrCode || 
                            getResponse.data?.base64 || 
                            (typeof getResponse.data === 'string' ? getResponse.data : null);
              
              if (qrCode) {
                return {
                  success: true,
                  qrCode: qrCode,
                  base64: getResponse.data?.base64 || null,
                  data: getResponse.data,
                  endpoint: endpoint,
                  method: 'GET'
                };
              } else {
                console.log("Resposta sem QR code");
              }
            }
          } catch (getError) {
            console.log(`GET falhou em ${endpoint}: ${getError.message}`);
          }
        } catch (endpointError) {
          console.log(`Falha no endpoint ${endpoint}: ${endpointError.message}`);
        }
      }
      
      // Se chegamos aqui, todos os endpoints falharam
      console.log("Todos os endpoints falharam. Retornando QR code alternativo");
      
      // Fornecer um QR code alternativo
      const testQrCode = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=WhatsAppConnectionTest-Evolution';
      
      return {
        success: false,
        error: 'Não foi possível obter QR Code da API Evolution após testar múltiplos endpoints',
        testQrCode: testQrCode,
        apiStatus: apiStatus,
        tried_endpoints: endpoints
      };
    } catch (error) {
      console.error('Erro ao obter QR Code:', error);
      
      // Fornecer um QR code alternativo
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
      // Primeiro, verificamos se a API está online
      const apiStatus = await this.checkApiStatus();
      if (!apiStatus.online) {
        return {
          success: false,
          error: 'API Evolution indisponível',
          details: apiStatus
        };
      }
      
      // Como a API retorna o manager URL, vamos usá-lo
      const managerUrl = apiStatus.data.manager || null;
      
      if (managerUrl) {
        // Corrigir protocolo - garantir https
        const secureManagerUrl = managerUrl.replace(/^http:/, 'https:');
        
        // Diferentes tentativas de endpoints baseados na documentação da API
        const endpoints = [
          // Baseado no manager URL retornado pela API
          `${secureManagerUrl}/instance/connectionState/${this.instance}`,
          `${secureManagerUrl}/connection/status/${this.instance}`,
          `${secureManagerUrl}/status/${this.instance}`,
          // Endpoints alternativos
          `${this.baseUrl}/instance/connectionState/${this.instance}`,
          `${this.baseUrl}/manager/instance/connectionState/${this.instance}`
        ];
        
        // Tentar cada endpoint
        for (const endpoint of endpoints) {
          try {
            console.log(`Tentando verificar status de conexão em: ${endpoint}`);
            
            const response = await axios.get(endpoint, {
              headers: this.getHeaders()
            });
            
            if (response.status === 200) {
              console.log(`Status de conexão obtido com sucesso em ${endpoint}`);
              return {
                success: true,
                connected: response.data?.state === 'open' || response.data?.connected === true,
                state: response.data?.state || 'unknown',
                data: response.data,
                endpoint: endpoint
              };
            }
          } catch (endpointError) {
            console.log(`Falha ao verificar status em ${endpoint}: ${endpointError.message}`);
          }
        }
      }
      
      // Se chegamos aqui, todos os endpoints falharam
      return {
        success: false,
        error: 'Não foi possível obter status de conexão após múltiplas tentativas',
        apiStatus: apiStatus
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
      // Primeiro, verificamos se a API está online
      const apiStatus = await this.checkApiStatus();
      if (!apiStatus.online) {
        return {
          success: false,
          error: 'API Evolution indisponível',
          details: apiStatus
        };
      }
      
      // Como a API retorna o manager URL, vamos usá-lo
      const managerUrl = apiStatus.data.manager || null;
      
      if (managerUrl) {
        // Corrigir protocolo - garantir https
        const secureManagerUrl = managerUrl.replace(/^http:/, 'https:');
        
        // Diferentes tentativas de endpoints baseados na documentação da API
        const endpoints = [
          // Baseado no manager URL
          `${secureManagerUrl}/instance/logout/${this.instance}`,
          `${secureManagerUrl}/disconnect/${this.instance}`,
          // Endpoints alternativos
          `${this.baseUrl}/instance/logout/${this.instance}`,
          `${this.baseUrl}/manager/instance/logout/${this.instance}`
        ];
        
        // Tentar cada endpoint
        for (const endpoint of endpoints) {
          try {
            console.log(`Tentando desconectar instância em: ${endpoint}`);
            
            const response = await axios.post(endpoint, {}, {
              headers: this.getHeaders()
            });
            
            if (response.status === 200 || response.status === 201) {
              console.log(`Instância desconectada com sucesso em ${endpoint}`);
              return {
                success: true,
                data: response.data,
                endpoint: endpoint
              };
            }
          } catch (endpointError) {
            console.log(`Falha ao desconectar em ${endpoint}: ${endpointError.message}`);
          }
        }
      }
      
      // Se chegamos aqui, todos os endpoints falharam
      return {
        success: false,
        error: 'Não foi possível desconectar a instância após múltiplas tentativas',
        apiStatus: apiStatus
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
      // Primeiro, verificamos se a API está online
      const apiStatus = await this.checkApiStatus();
      if (!apiStatus.online) {
        return {
          success: false,
          error: 'API Evolution indisponível',
          details: apiStatus
        };
      }
      
      // Como a API retorna o manager URL, vamos usá-lo
      const managerUrl = apiStatus.data.manager || null;
      
      if (managerUrl) {
        // Corrigir protocolo - garantir https
        const secureManagerUrl = managerUrl.replace(/^http:/, 'https:');
        
        // Diferentes tentativas de endpoints baseados na documentação da API
        const endpoints = [
          // Baseado no manager URL
          `${secureManagerUrl}/message/text/${this.instance}`,
          `${secureManagerUrl}/send/text/${this.instance}`,
          // Endpoints alternativos
          `${this.baseUrl}/message/text/${this.instance}`,
          `${this.baseUrl}/manager/message/text/${this.instance}`
        ];
        
        // Formatar o telefone para garantir que está no formato correto
        const cleanPhone = phone.replace(/\D/g, '');
        
        // Tentar cada endpoint
        for (const endpoint of endpoints) {
          try {
            console.log(`Tentando enviar mensagem para ${cleanPhone} em: ${endpoint}`);
            
            const payload = {
              number: cleanPhone,
              options: {
                delay: 1200,
                presence: "composing"
              },
              textMessage: {
                text: message
              }
            };
            
            console.log("Payload da mensagem:", JSON.stringify(payload));
            
            const response = await axios.post(endpoint, payload, {
              headers: this.getHeaders()
            });
            
            if (response.status === 201 || response.status === 200) {
              console.log(`Mensagem enviada com sucesso em ${endpoint}`);
              return {
                success: true,
                data: response.data,
                endpoint: endpoint
              };
            }
          } catch (endpointError) {
            console.log(`Falha ao enviar mensagem em ${endpoint}: ${endpointError.message}`);
          }
        }
      }
      
      // Se chegamos aqui, todos os endpoints falharam
      return {
        success: false,
        error: 'Não foi possível enviar a mensagem após múltiplas tentativas',
        apiStatus: apiStatus
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