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
   * Obtém o QR Code para conexão da instância
   * @returns URL do QR Code ou objeto de erro
   */
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

      // PASSO CRÍTICO: Primeiro criar a instância se não existir
      console.log("Verificando se precisamos criar a instância primeiro...");
      const createResult = await this.createInstance();
      if (createResult.success) {
        console.log("Instância criada ou já existente");
      } else {
        console.log("Aviso: Não foi possível criar a instância, mas continuaremos tentando obter o QR code");
      }

      // Verificação adicional da versão
      // A conexão é diferente dependendo da versão
      const isVersion2 = apiStatus.data && apiStatus.data.version && apiStatus.data.version.startsWith('2');
      console.log(`Versão da API: ${apiStatus.data?.version || 'desconhecida'}`);
      
      // Como a API retorna o manager URL, vamos tentar isso primeiro
      // mas também tentaremos outros endpoints conhecidos
      const managerUrl = apiStatus.data?.manager || null;
      
      // Corrigir protocolo - garantir https
      const secureManagerUrl = managerUrl ? managerUrl.replace(/^http:/, 'https:') : null;
      
      // Endpoints a tentar - reorganizados baseados em experiência e prioridade
      const endpoints = [];
      
      // SABEMOS QUE ESTES FUNCIONAM - Prioridade 1 - Adicionar primeiro os endpoints que sabemos que funcionam
      const knownWorkingEndpoint = `${this.baseUrl}/instance/connect/${this.instance}`;
      endpoints.push(knownWorkingEndpoint); // ESTE É O PRINCIPAL - funciona no Evolution API 2.2.3
      endpoints.push(`${this.baseUrl}/manager/instance/qrcode/${this.instance}`); // Este também funciona
      
      // Special handling - também tentaremos estes endpoints
      endpoints.push(`${this.baseUrl}/instance/fetchInstances`); // Lista todas as instâncias
      endpoints.push(`${this.baseUrl}/instance/connectionState/${this.instance}`); // Verifica o estado da conexão
      
      // Prioridade 2 - Endpoints relacionados a instâncias (para versão 2.x)
      if (isVersion2) {
        endpoints.push(`${this.baseUrl}/instance/qrcode/${this.instance}`);
        endpoints.push(`${this.baseUrl}/instance/qrcode`); // POST com instanceName
        endpoints.push(`${this.baseUrl}/instance/connect`); // POST com instanceName
        endpoints.push(`${this.baseUrl}/qrcode/${this.instance}`);
        endpoints.push(`${this.baseUrl}/client/qrcode/${this.instance}`);
      } 
      
      // Prioridade 3 - Endpoints via Manager URL (se disponível)
      if (secureManagerUrl) {
        endpoints.push(`${secureManagerUrl}/api/qrcode/${this.instance}`);
        endpoints.push(`${secureManagerUrl}/instance/connect/${this.instance}`);
        endpoints.push(`${secureManagerUrl}/instance/qrcode/${this.instance}`);
      }
      
      // Prioridade 4 - Endpoints legados ou alternativos
      endpoints.push(`${this.baseUrl}/start`); // POST com session
      endpoints.push(`${this.baseUrl}/api/session/start/${this.instance}`);
      endpoints.push(`${this.baseUrl}/api/session/qrcode/${this.instance}`);
      
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
                            postResponse.data?.code || // Novo formato presente na versão 2.2.3
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
                            postLegacyResponse.data?.code || // Novo formato presente na versão 2.2.3
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
              console.log("QR Code obtido com sucesso via GET em " + endpoint);
              
              // VERIFICAÇÃO IMPORTANTE: Se a resposta contiver HTML (<!DOCTYPE html> ou <html), é um erro
              const responseString = typeof getResponse.data === 'string' 
                ? getResponse.data 
                : JSON.stringify(getResponse.data);
                
              if (responseString && 
                 (responseString.includes('<!DOCTYPE html>') || 
                  responseString.includes('<html') || 
                  responseString.includes('<body'))) {
                console.log("QR Code contém HTML, enviando mensagem de erro");
                console.log("Detalhes do problema: A API Evolution está retornando HTML em vez de um QR code válido.");
                console.log("Isso geralmente acontece quando:");
                console.log("1. A instância já existe mas está em estado inválido");
                console.log("2. O token de autorização está incorreto ou não tem permissões suficientes");
                console.log("3. A URL do webhook configurada não está acessível");
                continue; // Pular para o próximo endpoint
              }
              
              // Logar a resposta para diagnóstico (limitando a 200 caracteres)
              if (typeof getResponse.data === 'string') {
                console.log("Dados da resposta (string):", getResponse.data.substring(0, 200) + "...");
              } else {
                console.log("Dados da resposta (objeto):", JSON.stringify(getResponse.data).substring(0, 200) + "...");
              }
              
              // Tratamento especial para o endpoint de conectar
              if (endpoint.includes('/instance/connect/')) {
                // Verificar se temos QR code na resposta do endpoint de conexão
                const qrCode = getResponse.data?.qrcode || 
                             getResponse.data?.qrCode || 
                             getResponse.data?.base64 || 
                             getResponse.data?.code;
                             
                if (qrCode) {
                  return {
                    success: true,
                    qrCode: qrCode,
                    base64: getResponse.data?.base64 || null,
                    data: getResponse.data,
                    endpoint: endpoint,
                    method: 'GET (via instance/connect)'
                  };
                } else if (typeof getResponse.data === 'object') {
                  // Este endpoint pode estar retornando informações de conexão
                  // sem QR code se já estiver conectado
                  
                  if (getResponse.data?.state === 'open' || 
                      getResponse.data?.state === 'connected' ||
                      getResponse.data?.connected === true) {
                    return {
                      success: true,
                      connected: true,
                      qrCode: null,
                      data: getResponse.data,
                      endpoint: endpoint,
                      method: 'GET (already connected)'
                    };
                  } else if (getResponse.data?.qr) {
                    // A qr pode estar em um formato específico
                    return {
                      success: true,
                      qrCode: getResponse.data.qr,
                      data: getResponse.data,
                      endpoint: endpoint,
                      method: 'GET (qr field)'
                    };
                  }
                }
              } else {
                // Checar se existe QR code na resposta para outros endpoints
                const qrCode = getResponse.data?.qrcode || 
                            getResponse.data?.qrCode || 
                            getResponse.data?.base64 || 
                            getResponse.data?.code || // Novo formato presente na versão 2.2.3
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
    // Testar diferentes tokens da mais alta para a mais baixa prioridade
    // 1. Token do ambiente (mais seguro)
    // 2. Token ligAi01 (token fixo específico para este sistema)
    // 3. Token fornecido pelo usuário
    // 4. Token de fallback
    const environmentToken = process.env.EVOLUTION_API_TOKEN;
    const ligAiToken = 'LigAi01'; // Token específico para esta aplicação
    const userToken = this.token;
    const fallbackToken = '4db623449606bcf2814521b73657dbc0';
    
    // Array de tokens para tentar
    const tokensToTry = [
      environmentToken, 
      ligAiToken,
      userToken,
      fallbackToken
    ].filter(Boolean); // Remover valores undefined/null/vazios
    
    // Se não temos nenhum token, usar o fallback
    const token = tokensToTry.length > 0 ? tokensToTry[0] : fallbackToken;
    
    // Para debug, mostrar qual token estamos usando
    const source = 
      token === environmentToken ? 'ambiente' :
      token === ligAiToken ? 'fixo LigAi01' :
      token === userToken ? 'usuário' :
      'fallback';
    
    console.log(`Usando token nos headers: ${token ? token.substring(0, 5) + '...' + token.substring(token.length - 5) : 'NENHUM TOKEN'} (origem: ${source})`);
    
    // Na configuração do Portainer.io, o formato é AUTHENTICATION_API_KEY
    // Vamos tentar usar ambos os formatos para garantir compatibilidade
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': token,
      'AUTHENTICATION_API_KEY': token
    };
  }
}