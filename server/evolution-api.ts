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
   * @param instance Nome da instância (deve ser igual ao nome do usuário)
   */
  constructor(baseUrl: string, token: string, instance: string) {
    // Remove barras finais da URL
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.token = token;
    this.instance = instance;
    
    console.log(`Inicializando Evolution API Client:
      URL Base: ${this.baseUrl}
      Instance: ${this.instance}
      Token: ${this.token.substring(0, 5)}...${this.token.substring(this.token.length - 5)}
      Token de ambiente presente: ${process.env.EVOLUTION_API_TOKEN ? 'Sim' : 'Não'}
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
   * Cria a instância para o usuário
   * CRÍTICO: Esta etapa é necessária antes de qualquer operação com a instância
   * @returns Resultado da criação da instância
   */
  async createInstance(): Promise<any> {
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

      console.log("API Evolution online. Tentando criar a instância...");
      
      // Formatar o corpo da requisição baseado na versão 2.2.3 da Evolution API
      const createInstanceBody = {
        instanceName: this.instance,
        token: this.token,
        webhook: null, // Podemos deixar webhook nulo por enquanto
        webhookByEvents: false, // Podemos adicionar eventos específicos mais tarde
        integration: "WHATSAPP-BAILEYS", // Este parâmetro é CRÍTICO para a versão 2.x da API
        language: "pt-BR",
        qrcode: true,
        qrcodeImage: true,
        // Parâmetros adicionais
        reject_call: false,
        events_message: false,
        ignore_group: false,
        ignore_broadcast: false,
        save_message: true,
        webhook_base64: true
      };
      
      // Na versão 2.x, o endpoint para criar instância é /instance/create
      // ou /instance/create/instance_name
      try {
        console.log(`Tentando criar instância no endpoint: ${this.baseUrl}/instance/create`);
        console.log(`Dados enviados:`, JSON.stringify(createInstanceBody));
        
        const response = await axios.post(
          `${this.baseUrl}/instance/create`,
          createInstanceBody,
          { headers: this.getHeaders() }
        );
        
        console.log(`Resposta da criação de instância:`, response.data);
        
        if (response.status === 201 || response.status === 200) {
          return {
            success: true,
            data: response.data
          };
        }
      } catch (error) {
        console.error(`Erro ao criar instância:`, error.message);
        
        // Tentar endpoint alternativo
        try {
          console.log(`Tentando endpoint alternativo: ${this.baseUrl}/instance/create/${this.instance}`);
          
          const response = await axios.post(
            `${this.baseUrl}/instance/create/${this.instance}`,
            createInstanceBody,
            { headers: this.getHeaders() }
          );
          
          console.log(`Resposta da criação de instância (alternativo):`, response.data);
          
          if (response.status === 201 || response.status === 200) {
            return {
              success: true,
              data: response.data
            };
          }
        } catch (altError) {
          console.error(`Erro no endpoint alternativo:`, altError.message);
        }
      }
      
      return {
        success: false,
        error: "Não foi possível criar a instância após múltiplas tentativas"
      };
    } catch (error) {
      console.error(`Erro geral ao criar instância:`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Obtém o QR Code para conexão da instância
   * MÉTODO SIMPLIFICADO: Usa apenas o endpoint GET de /instance/connect/
   * que demonstramos funcionar nos testes
   * @returns QR code ou objeto de erro
   */
  async getQrCode(): Promise<any> {
    try {
      // Verificar se a API está online primeiro
      const apiStatus = await this.checkApiStatus();
      if (!apiStatus.online) {
        return {
          success: false,
          error: 'API Evolution indisponível',
          details: apiStatus
        };
      }

      console.log("API Evolution online. Tentando obter QR code diretamente...");
      
      // MODO SIMPLIFICADO: Usar apenas o endpoint que sabemos que funciona
      // Nossos testes confirmaram que este endpoint funciona com GET:
      // GET /instance/connect/{nome_da_instancia}
      const connectEndpoint = `${this.baseUrl}/instance/connect/${this.instance}`;
      console.log(`Usando exclusivamente o endpoint: ${connectEndpoint}`);
      
      try {
        // Fazer a requisição GET para o endpoint que confirmamos funcionar
        const response = await axios.get(connectEndpoint, {
          headers: this.getHeaders(),
          timeout: 10000 // Timeout adequado de 10 segundos
        });
        
        console.log(`Resposta do endpoint: Status ${response.status}`);
        
        if (response.status === 200 || response.status === 201) {
          // Verificar se a resposta contém HTML (erro comum)
          const responseStr = typeof response.data === 'string' 
            ? response.data 
            : JSON.stringify(response.data);
            
          if (responseStr.includes('<!DOCTYPE html>') || 
              responseStr.includes('<html') || 
              responseStr.includes('<body')) {
            console.log("Resposta contém HTML, isso indica um erro de autenticação ou permissão");
            return {
              success: false,
              error: 'A API Evolution está retornando HTML em vez de um QR code válido. Verifique as credenciais e permissões.'
            };
          }
          
          // Extrair o QR code da resposta (como string ou em um campo específico)
          const qrCode = response.data?.qrcode || 
                      response.data?.qrCode || 
                      response.data?.base64 || 
                      response.data?.code ||
                      (typeof response.data === 'string' ? response.data : null);
          
          if (qrCode) {
            console.log("QR Code obtido com sucesso!");
            return {
              success: true,
              qrCode: qrCode,
              endpoint: connectEndpoint,
              method: 'GET'
            };
          } else if (response.data?.state === 'open' || 
                    response.data?.state === 'connected' ||
                    response.data?.connected === true) {
            // Já está conectado
            console.log("Instância já está conectada!");
            return {
              success: true,
              connected: true,
              qrCode: null,
              data: response.data
            };
          }
          
          // Resposta sem QR code reconhecível
          console.log("Resposta não contém QR code reconhecível");
          return {
            success: false,
            error: 'Não foi possível identificar um QR code na resposta da API'
          };
        }
        
        // Status inesperado
        return {
          success: false,
          error: `Resposta com status inesperado: ${response.status}`
        };
      } catch (error) {
        console.error(`Erro ao tentar obter QR code: ${error.message}`);
        
        // Em caso de erro, podemos tentar verificar o estado da conexão
        console.log("Verificando status da conexão como alternativa...");
        try {
          const connectionState = await this.checkConnectionStatus();
          if (connectionState.success && connectionState.connected) {
            return {
              success: true,
              connected: true,
              qrCode: null,
              data: connectionState.data
            };
          }
        } catch (stateError) {
          console.log(`Erro ao verificar estado da conexão: ${stateError.message}`);
        }
        
        return {
          success: false,
          error: `Falha ao obter QR code: ${error.message}`
        };
      }
    } catch (error) {
      console.error("Erro geral ao obter QR code:", error);
      return {
        success: false,
        error: error.message
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
      
      // Verificação adicional da versão e manager URL
      const isVersion2 = apiStatus.data && apiStatus.data.version && apiStatus.data.version.startsWith('2');
      const managerUrl = apiStatus.data?.manager || null;
      const secureManagerUrl = managerUrl ? managerUrl.replace(/^http:/, 'https:') : null;
      
      // Listar endpoints possíveis em ordem de prioridade
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
          console.log(`Verificando status de conexão em: ${endpoint}`);
          
          const response = await axios.get(endpoint, {
            headers: this.getHeaders()
          });
          
          if (response.status === 200) {
            console.log(`Status obtido com sucesso: ${JSON.stringify(response.data)}`);
            
            // Determinar se está conectado com base nos campos retornados
            const isConnected = response.data.state === 'open' || 
                                response.data.state === 'connected' ||
                                response.data.connected === true;
            
            return {
              success: true,
              connected: isConnected,
              data: response.data,
              endpoint: endpoint
            };
          }
        } catch (error) {
          console.log(`Erro ao verificar status em ${endpoint}: ${error.message}`);
        }
      }
      
      // Se chegamos aqui, não conseguimos verificar o status
      return {
        success: false,
        error: "Não foi possível verificar o status da conexão"
      };
    } catch (error) {
      console.error(`Erro geral ao verificar status da conexão:`, error.message);
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
      
      // Verificação adicional da versão e manager URL
      const managerUrl = apiStatus.data?.manager || null;
      const secureManagerUrl = managerUrl ? managerUrl.replace(/^http:/, 'https:') : null;
      
      // Listar endpoints possíveis em ordem de prioridade
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
          console.log(`Tentando desconectar em: ${endpoint}`);
          
          const response = await axios.post(endpoint, {}, {
            headers: this.getHeaders()
          });
          
          if (response.status === 200) {
            console.log(`Desconexão realizada com sucesso: ${JSON.stringify(response.data)}`);
            
            // Determinar se a desconexão foi bem-sucedida
            const success = response.data.success === true || 
                           response.data.disconnected === true ||
                           response.data.state === 'close';
            
            return {
              success: success,
              data: response.data,
              endpoint: endpoint
            };
          }
        } catch (error) {
          console.log(`Erro ao desconectar em ${endpoint}: ${error.message}`);
        }
      }
      
      // Se chegamos aqui, não conseguimos desconectar
      return {
        success: false,
        error: "Não foi possível desconectar a instância"
      };
    } catch (error) {
      console.error(`Erro geral ao desconectar:`, error.message);
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
      
      // Verificação adicional da versão e manager URL
      const managerUrl = apiStatus.data?.manager || null;
      const secureManagerUrl = managerUrl ? managerUrl.replace(/^http:/, 'https:') : null;
      
      // Listar endpoints possíveis em ordem de prioridade
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
      
      // Dados para envio da mensagem
      const messageData = {
        number: cleanPhone,
        options: {
          delay: 1200
        },
        textMessage: {
          text: message
        }
      };
      
      // Tentar cada endpoint
      for (const endpoint of endpoints) {
        try {
          console.log(`Tentando enviar mensagem em: ${endpoint}`);
          console.log(`Dados: ${JSON.stringify(messageData)}`);
          
          const response = await axios.post(endpoint, messageData, {
            headers: this.getHeaders()
          });
          
          if (response.status === 200 || response.status === 201) {
            console.log(`Mensagem enviada com sucesso: ${JSON.stringify(response.data)}`);
            
            return {
              success: true,
              data: response.data,
              endpoint: endpoint
            };
          }
        } catch (error) {
          console.log(`Erro ao enviar mensagem em ${endpoint}: ${error.message}`);
        }
      }
      
      // Se chegamos aqui, não conseguimos enviar a mensagem
      return {
        success: false,
        error: "Não foi possível enviar a mensagem"
      };
    } catch (error) {
      console.error(`Erro geral ao enviar mensagem:`, error.message);
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
    // Priorizar token do ambiente, depois o token do construtor
    const token = process.env.EVOLUTION_API_TOKEN || 
      this.token || 
      '4db623449606bcf2814521b73657dbc0'; // default fallback conhecido por funcionar
    
    // Registrar a fonte do token para diagnóstico
    const source = process.env.EVOLUTION_API_TOKEN ? 'ambiente' : 
      this.token ? 'construtor' : 
      'fallback';
    
    console.log(`Usando token nos headers: ${token ? token.substring(0, 5) + '...' + token.substring(token.length - 5) : 'NENHUM TOKEN'} (origem: ${source})`);
    
    // De acordo com a documentação da Evolution API (v2.2.3),
    // o cabeçalho correto é 'apikey', mas vamos manter os outros para compatibilidade
    const headers = {
      'Content-Type': 'application/json',
      'apikey': token, // Este é o formato correto documentado para v2.2.3
      'Authorization': `Bearer ${token}`,  // Para versões anteriores
      'AUTHENTICATION_API_KEY': token      // Para algumas instalações em Portainer.io
    };
    
    console.log('Headers de autenticação configurados:', Object.keys(headers).join(', '));
    return headers;
  }
}