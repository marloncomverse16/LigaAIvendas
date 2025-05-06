import axios from "axios";
import { Request, Response } from "express";
import { storage } from "./storage";
import { EvolutionApiClient } from "./evolution-api";

// Status de conexão do WhatsApp por usuário
export const connectionStatus: Record<number, any> = {};

// Função para verificar o status da API Evolution
async function checkEvolutionApiStatus(apiUrl: string, apiToken: string) {
  try {
    // Formatar corretamente a URL da API
    const baseUrl = apiUrl.replace(/\/+$/, "");
    
    console.log(`Verificando API Evolution em: ${baseUrl}`);
    
    // Fazer requisição ao endpoint raiz da API
    const response = await axios.get(baseUrl, {
      headers: {
        Authorization: `Bearer ${apiToken}`
      }
    });
    
    if (response.status === 200) {
      console.log(`API Evolution respondeu com status 200`);
      console.log(`Versão da API: ${response.data.version || 'desconhecida'}`);
      return response.data;
    }
    
    console.log(`API Evolution respondeu com status ${response.status}`);
    return null;
  } catch (error) {
    console.error('Erro ao verificar status da API Evolution:', error);
    throw error;
  }
}

// Função para buscar informações do servidor associado ao usuário
async function fetchUserServer(userId: number) {
  try {
    // Buscar dados do servidor associado ao usuário
    const userServers = await storage.getUserServers(userId);
    if (userServers && userServers.length > 0) {
      return userServers[0]; // Retorna o primeiro servidor
    }
    return null;
  } catch (error) {
    console.error('Erro ao buscar servidor do usuário:', error);
    return null;
  }
}

// Rota para verificar o status da conexão
export async function checkConnectionStatus(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = (req.user as Express.User).id;
    
    // Se não tiver status, retorna desconectado
    if (!connectionStatus[userId]) {
      connectionStatus[userId] = {
        connected: false,
        lastUpdated: new Date()
      };
    }
    
    // Tentar obter status atualizado do webhook, se o usuário tiver configurado
    const user = await storage.getUser(userId);
    if (user?.whatsappWebhookUrl && connectionStatus[userId].connected) {
      try {
        // Verificar status real da conexão via webhook - usando GET conforme solicitado
        const statusResponse = await axios.get(user.whatsappWebhookUrl, {
          params: {
            action: "status",
            userId: userId,
            username: user.username,
            email: user.email,
            name: user.name,
            company: user.company,
            phone: user.phone
          }
        });
        
        if (statusResponse.data && statusResponse.data.connected !== undefined) {
          connectionStatus[userId] = {
            ...connectionStatus[userId],
            connected: statusResponse.data.connected,
            lastUpdated: new Date()
          };
          
          if (statusResponse.data.connected) {
            connectionStatus[userId].name = statusResponse.data.name || connectionStatus[userId].name;
            connectionStatus[userId].phone = statusResponse.data.phone || connectionStatus[userId].phone;
          }
        }
      } catch (error) {
        console.error("Erro ao verificar status via webhook:", error);
      }
    }
    
    res.json(connectionStatus[userId]);
  } catch (error) {
    console.error("Erro ao verificar status da conexão:", error);
    res.status(500).json({ message: "Erro ao verificar status da conexão" });
  }
}

// Rota para conectar o WhatsApp
export async function connectWhatsApp(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = (req.user as Express.User).id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    // Verificar se temos informações do servidor ou webhook
    const userServer = await fetchUserServer(userId);
    
    // Se temos um servidor configurado com Evolution API, tentar usar isso primeiro
    if (userServer && userServer.server && userServer.server.apiUrl && userServer.server.apiToken) {
      try {
        console.log(`Usando Evolution API do servidor configurado: ${userServer.server.apiUrl}`);
        
        // Criar cliente Evolution API com o nome do usuário como instância
        const evolutionClient = new EvolutionApiClient(
          userServer.server.apiUrl,
          userServer.server.apiToken,
          user.username // Nome do usuário como instância
        );
        
        // Verificar status da API
        const apiStatus = await evolutionClient.checkApiStatus();
        if (!apiStatus.online) {
          return res.status(503).json({
            message: "API Evolution indisponível",
            error: apiStatus.error || "Erro ao conectar à API",
            status: "error"
          });
        }
        
        // Solicitar QR code
        const qrResult = await evolutionClient.getQrCode();
        
        if (qrResult.success && qrResult.qrCode) {
          // Armazenar o QR code e outras informações
          connectionStatus[userId] = {
            connected: false,
            connecting: true,
            qrCode: qrResult.qrCode,
            source: 'evolution',
            apiVersion: apiStatus.data?.version || 'desconhecida',
            lastUpdated: new Date()
          };
          
          return res.json(connectionStatus[userId]);
        } else if (qrResult.testQrCode) {
          // Se estamos em teste, usar QR code de teste
          connectionStatus[userId] = {
            connected: false,
            connecting: true,
            qrCode: qrResult.testQrCode,
            source: 'evolution-test',
            error: qrResult.error,
            lastUpdated: new Date()
          };
          
          return res.json(connectionStatus[userId]);
        } else {
          console.error("Erro ao obter QR code da Evolution API:", qrResult.error);
        }
      } catch (evolutionError) {
        console.error("Erro ao usar Evolution API:", evolutionError);
        // Continuar e tentar usar webhook como fallback
      }
    }
    
    // Fallback para webhook existente
    if (!user.whatsappWebhookUrl) {
      return res.status(400).json({ 
        message: "Nenhuma conexão configurada. Configure um servidor com API Evolution ou uma URL de webhook.", 
        status: "error",
      });
    }
    
    // Verificar se já está conectado
    if (connectionStatus[userId] && connectionStatus[userId].connected) {
      return res.json(connectionStatus[userId]);
    }
    
    try {
      console.log(`Chamando webhook do WhatsApp: ${user.whatsappWebhookUrl}`);
      
      // Tentativa inicial com método POST para suportar dados maiores como QR code em base64
      // Incluindo informações completas do usuário
      try {
        console.log("Tentando webhook com método POST...");
        console.log("URL do webhook:", user.whatsappWebhookUrl);
        console.log("Dados enviados:", JSON.stringify({
          action: "connect",
          userId: userId,
          username: user.username,
          email: user.email,
          name: user.name,
          company: user.company,
          phone: user.phone
        }));
        
        const postResponse = await axios.post(user.whatsappWebhookUrl, {
          action: "connect",
          userId: userId,
          username: user.username,
          email: user.email,
          name: user.name,
          company: user.company,
          phone: user.phone
        });
        
        var webhookResponse = postResponse;
        console.log("Resposta POST bem-sucedida");
        console.log("Tipo de resposta:", typeof webhookResponse.data);
        console.log("Headers:", JSON.stringify(webhookResponse.headers));
      } catch (postError: any) {
        // Se POST falhar, tentar com GET
        console.log("POST falhou, tentando com GET...", postError.message);
        
        const getResponse = await axios.get(user.whatsappWebhookUrl, {
          params: {
            action: "connect",
            userId: userId,
            username: user.username,
            email: user.email,
            name: user.name,
            company: user.company,
            phone: user.phone
          }
        });
        
        var webhookResponse = getResponse;
        console.log("Resposta GET bem-sucedida");
      }
      
      // Log detalhado da resposta (evitando circular reference)
      console.log("Resposta do webhook - status:", webhookResponse.status);
      console.log("Resposta do webhook - headers:", JSON.stringify(webhookResponse.headers));
      if (webhookResponse && webhookResponse.data) {
        console.log("Resposta do webhook - tipo:", typeof webhookResponse.data);
        console.log("Resposta do webhook data:", JSON.stringify(webhookResponse.data));
        console.log("Resposta do webhook possui qrCode:", webhookResponse.data && webhookResponse.data.qrCode ? "Sim" : "Não");
        if (webhookResponse.data.qrCode) {
          console.log("Primeiros 100 caracteres do qrCode:", webhookResponse.data.qrCode.substring(0, 100) + "...");
        }
      } else {
        console.log("Resposta do webhook não contém dados ou é vazia");
      }
      
      // Se o webhook retornou dados, usar o QR code retornado
      if (webhookResponse.data) {
        // Verificação mais flexível para diferentes formatos possíveis de resposta
        let qrCodeData = null;
        
        // Diretamente no objeto principal
        if (webhookResponse.data.qrCode) {
          qrCodeData = webhookResponse.data.qrCode;
          console.log("QR Code encontrado diretamente no objeto principal");
        } 
        // Em um campo aninhado 'data'
        else if (webhookResponse.data.data && webhookResponse.data.data.qrCode) {
          qrCodeData = webhookResponse.data.data.qrCode;
          console.log("QR Code encontrado em data.qrCode");
        }
        // Em um campo 'qrcode' (com minúsculas)
        else if (webhookResponse.data.qrcode) {
          qrCodeData = webhookResponse.data.qrcode;
          console.log("QR Code encontrado em qrcode (minúsculo)");
        }
        // Em um campo aninhado com minúsculas
        else if (webhookResponse.data.data && webhookResponse.data.data.qrcode) {
          qrCodeData = webhookResponse.data.data.qrcode;
          console.log("QR Code encontrado em data.qrcode (minúsculo)");
        }
        // Procurar diretamente por qualquer string que pareça ser base64 (começando com data:image)
        else {
          const deepCheckQrCode = (obj, maxDepth = 3, depth = 0) => {
            if (depth > maxDepth || !obj || typeof obj !== 'object') return null;
            
            console.log(`Procurando QR code em profundidade ${depth}, chaves:`, Object.keys(obj).join(', '));
            
            for (const key in obj) {
              // Pular campos que podem causar loops ou são irrelevantes
              if (key === 'parent' || key === 'socket' || key === 'config') continue;
              
              // Verificar strings que podem conter QR code
              if (typeof obj[key] === 'string') {
                const val = obj[key];
                // Exibir parte do valor para debug
                if (val.length > 20) {
                  console.log(`String em ${key}:`, val.substring(0, 50) + '...');
                }
                
                if (val.startsWith('data:image') || 
                    val.includes('base64') || 
                    val.startsWith('https') && val.includes('qrcode')) {
                  console.log(`QR code encontrado na chave ${key}`);
                  return val;
                }
              } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                // Verificar objetos aninhados
                try {
                  const found = deepCheckQrCode(obj[key], maxDepth, depth + 1);
                  if (found) return found;
                } catch (err) {
                  console.log(`Erro ao verificar objeto em ${key}:`, err.message);
                }
              }
            }
            return null;
          };
          
          qrCodeData = deepCheckQrCode(webhookResponse.data);
          if (qrCodeData) {
            console.log("QR Code encontrado em busca profunda");
          }
        }
        
        if (qrCodeData) {
          connectionStatus[userId] = {
            connected: false,
            qrCode: qrCodeData,
            lastUpdated: new Date()
          };
          console.log("QR Code processado e armazenado no status");
        } else {
          // Como último recurso, tentar usar toda a resposta se for uma string
          if (typeof webhookResponse.data === 'string' && webhookResponse.data.startsWith('data:image')) {
            connectionStatus[userId] = {
              connected: false,
              qrCode: webhookResponse.data,
              lastUpdated: new Date()
            };
            console.log("Usando resposta direta como QR Code");
          } else {
            // Se não retornou um QR code específico
            return res.status(400).json({ 
              message: "Webhook não retornou QR code em formato reconhecível",
              status: "error",
              responseFormat: typeof webhookResponse.data
            });
          }
        }
      } else {
        // Se não retornou dados
        return res.status(400).json({ 
          message: "Webhook não retornou dados",
          status: "error" 
        });
      }
      
      // Verificar status após 30 segundos para dar tempo suficiente para escanear o QR Code
      setTimeout(async () => {
        if (connectionStatus[userId]) {
          try {
            // Primeiro, verificamos se temos um servidor Evolution API
            const userServer = await fetchUserServer(userId);
            
            // Se temos servidor Evolution API configurado, usar isso primeiro
            if (userServer && userServer.server && userServer.server.apiUrl && userServer.server.apiToken) {
              try {
                const evolutionClient = new EvolutionApiClient(
                  userServer.server.apiUrl,
                  userServer.server.apiToken,
                  user.username // Nome do usuário como instância
                );
                
                // Verificar status da conexão
                const connectionResult = await evolutionClient.checkConnectionStatus();
                
                if (connectionResult.success) {
                  console.log("Status de conexão via Evolution API:", connectionResult);
                  
                  if (connectionResult.connected) {
                    connectionStatus[userId] = {
                      connected: true,
                      source: 'evolution',
                      name: "WhatsApp Conectado via Evolution API",
                      phone: "N/A", // Em uma implementação futura, buscar número do telefone
                      lastUpdated: new Date()
                    };
                    console.log("Status atualizado: Conectado via Evolution API");
                    return; // Não continuar com o webhook
                  } else {
                    console.log("Evolution API indica que não está conectado ainda. Mantendo QR code visível.");
                  }
                }
              } catch (evolutionError) {
                console.error("Erro ao verificar status via Evolution API:", evolutionError);
                // Continuar com webhook como fallback
              }
            }
            
            // Fallback para webhook existente
            if (!user.whatsappWebhookUrl) {
              console.log("Nem Evolution API nem webhook disponíveis para verificar status.");
              return;
            }
            
            try {
              // Primeiro tentar com POST
              console.log("Verificando status via webhook POST...");
              const postStatusResponse = await axios.post(user.whatsappWebhookUrl, {
                action: "status",
                userId: userId,
                username: user.username,
                email: user.email,
                name: user.name,
                company: user.company,
                phone: user.phone
              });
              
              var statusResponse = postStatusResponse;
              console.log("Verificação de status via POST bem-sucedida");
            } catch (postError: any) {
              // Se POST falhar, tentar com GET
              console.log("POST para status falhou, tentando GET...", postError.message);
              
              const getStatusResponse = await axios.get(user.whatsappWebhookUrl, {
                params: {
                  action: "status",
                  userId: userId,
                  username: user.username,
                  email: user.email,
                  name: user.name,
                  company: user.company,
                  phone: user.phone
                }
              });
              
              var statusResponse = getStatusResponse;
              console.log("Verificação de status via GET bem-sucedida");
            }
            
            console.log("Resposta de status do webhook:", statusResponse.data);
            
            if (statusResponse.data && statusResponse.data.connected) {
              connectionStatus[userId] = {
                connected: true,
                source: 'webhook',
                name: statusResponse.data.name || "WhatsApp Conectado",
                phone: statusResponse.data.phone || "N/A",
                lastUpdated: new Date()
              };
              console.log("Status atualizado: Conectado via webhook");
            } else {
              // Se o webhook retornou resposta mas não indica que está conectado
              // Manter o status atual com o QR code até que o usuário escaneie
              console.log("Webhook não confirmou conexão, mantendo QR code visível");
            }
          } catch (webhookError: any) {
            console.error("Erro ao verificar status:", webhookError.message);
            // Não alteramos o status automaticamente em caso de erro
            // para manter o QR code visível
          }
        }
      }, 30000);
      
      return res.json(connectionStatus[userId]);
    } catch (webhookError: any) {
      console.error("Erro ao chamar webhook:", webhookError.message);
      
      // Verificar se o erro é relacionado ao código de status 404 (webhook não encontrado)
      // Neste caso, vamos fornecer um QR code padrão para debugging/testes
      if (webhookError.message && webhookError.message.includes("404")) {
        console.log("Webhook retornou 404, fornecendo QR code padrão para testes");
        
        // QR code padrão para testes (em produção, isso deve vir do webhook)
        const qrCodeSample = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAAAXNSR0IArs4c6QAADTpJREFUeF7tnVty47gOBds3y8w9Ms+yZm6W+TfJW7lxZFu0JBIEge6/L4lINNDAgyhZ+fPnz5+//A8EQOA/BEqC0AsIgMB/CZAg9AII3CFAgtAdIECCgA0QmCZAgjwfmz9//vwNh+TP14tUHnrO71HFN/Zv3UbmmrE+rq1ItR3FRcb+tRP5N9bnmQi5S/9e+1sBSPgkQd5LbRKEBPlY4J4kLQlCgpAgX4/TDU8Ow+1vT6+xP2cggz+j2o7iImOTvwnLJQjvILyD8A7iwqSgUcvEeJcgSIK4MIHBJUFcVKFQSRBDTCwDe94MbPSX9CpvvrZ6b+Eeb722Y3sR7S5vD8P/nL1+3LT3kN9Rn/Cx3O4fErDTMvYV/vEg9S5u2z9rEsSZIMroLm/kOsroZzKDOq84BdWRIIVyZr8zqaOrtx0ShAQZ7GBtdK03E2UGVWb0d5GXd5Dt7iH9BwZpSRAShAQZfIKMvl+o4J/5vUQZ3eXNetOY9ZWWBCFBxklOApMgY9QGRtdG13ozkTL6Ge1TRn+nbfLEOtJHSBAShAQJPnkGRtdu3m30O9qCA9vE7PVnBjX6cXX4h/y8A9YkTEe9aAAAAABJRU5ErkJggg==";
        
        connectionStatus[userId] = {
          connected: false,
          qrCode: qrCodeSample,
          lastUpdated: new Date()
        };
        
        return res.json(connectionStatus[userId]);
      }
      
      return res.status(500).json({ 
        message: "Erro ao chamar webhook de conexão",
        error: webhookError.message,
        status: "error"
      });
    }
  } catch (error) {
    console.error("Erro ao conectar:", error);
    res.status(500).json({ message: "Erro ao conectar" });
  }
}

// Rota para desconectar o WhatsApp
export async function disconnectWhatsApp(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = (req.user as Express.User).id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    // Primeiro, verificamos se temos um servidor Evolution API
    const userServer = await fetchUserServer(userId);
    let disconnectionSuccessful = false;
    
    // Se temos servidor Evolution API configurado, usar isso primeiro
    if (userServer && userServer.server && userServer.server.apiUrl && userServer.server.apiToken) {
      try {
        console.log("Tentando desconectar via Evolution API...");
        const evolutionClient = new EvolutionApiClient(
          userServer.server.apiUrl,
          userServer.server.apiToken,
          user.username // Nome do usuário como instância
        );
        
        // Tentar desconectar
        const disconnectResult = await evolutionClient.disconnect();
        
        if (disconnectResult.success) {
          console.log("Desconexão via Evolution API bem-sucedida:", disconnectResult);
          disconnectionSuccessful = true;
        } else {
          console.log("Falha na desconexão via Evolution API:", disconnectResult.error || "Erro desconhecido");
        }
      } catch (evolutionError) {
        console.error("Erro ao desconectar via Evolution API:", evolutionError);
        // Continuar com webhook como fallback
      }
    }
    
    // Se a desconexão com Evolution API não foi bem-sucedida, tentar webhook
    if (!disconnectionSuccessful && user.whatsappWebhookUrl) {
      try {
        // Tentar chamar o webhook para desconectar - tentar POST primeiro, depois GET
        try {
          // Primeiro tentar com POST
          console.log("Tentando desconectar via webhook POST...");
          await axios.post(user.whatsappWebhookUrl, {
            action: "disconnect",
            userId: userId,
            username: user.username,
            email: user.email,
            name: user.name,
            company: user.company,
            phone: user.phone
          });
          console.log("Desconexão via webhook POST bem-sucedida");
          disconnectionSuccessful = true;
        } catch (postError: any) {
          // Se POST falhar, tentar com GET
          console.log("POST para desconexão falhou, tentando GET...", postError.message);
          await axios.get(user.whatsappWebhookUrl, {
            params: {
              action: "disconnect",
              userId: userId,
              username: user.username,
              email: user.email,
              name: user.name,
              company: user.company,
              phone: user.phone
            }
          });
          console.log("Desconexão via webhook GET bem-sucedida");
          disconnectionSuccessful = true;
        }
      } catch (webhookError: any) {
        console.error("Erro ao chamar webhook para desconexão:", webhookError.message);
      }
    }
    
    // Atualizar status de desconexão
    connectionStatus[userId] = {
      connected: false,
      disconnectedAt: new Date(),
      lastUpdated: new Date()
    };
    
    if (disconnectionSuccessful) {
      connectionStatus[userId].disconnectionSuccessful = true;
    }
    
    res.json(connectionStatus[userId]);
  } catch (error) {
    console.error("Erro ao desconectar:", error);
    res.status(500).json({ message: "Erro ao desconectar" });
  }
}