/**
 * Módulo para gerenciar conexões com a Evolution API
 */

import { Request, Response } from "express";
import axios from "axios";
import { storage } from "../storage";

/**
 * Verifica o status da conexão com a Evolution API
 */
export async function checkConnectionStatus(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = (req.user as Express.User).id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    // Obter informações do servidor atual
    const userServer = await storage.getUserServers(userId);
    if (!userServer || userServer.length === 0 || !userServer[0].server) {
      return res.status(400).json({ message: "Servidor não configurado para este usuário" });
    }
    
    const server = userServer[0].server;
    const instanceName = user.username; // Usa o nome do usuário como instância
    
    // Verificar se temos as informações necessárias
    if (!server.apiUrl || !server.apiToken) {
      return res.status(400).json({ 
        message: "Configuração de API incompleta", 
        details: "URL da API ou token não configurados"
      });
    }
    
    // Configurar headers para a requisição usando o token do servidor
    const headers = {
      'Content-Type': 'application/json',
      'apikey': server.apiToken
    };
    
    console.log(`Verificando status de conexão em: ${server.apiUrl}/instance/connectionState/${instanceName}`);
    
    try {
      const statusResponse = await axios.get(
        `${server.apiUrl}/instance/connectionState/${instanceName}`,
        { headers }
      );
      
      console.log(`Status obtido com sucesso: ${JSON.stringify(statusResponse.data).substring(0, 100)}...`);
      
      const status = {
        success: true,
        connected: statusResponse.data?.state === 'open' || statusResponse.data?.connected,
        data: statusResponse.data,
        endpoint: `${server.apiUrl}/instance/connectionState/${instanceName}`
      };
      
      // Se recebermos HTML em vez de JSON (comum em algumas versões da Evolution API)
      if (typeof statusResponse.data === 'string' && statusResponse.data.includes('<!doctype html>')) {
        console.log("Recebemos HTML em vez de JSON, tentando endpoint alternativo");
        
        // Tentar endpoint alternativo
        try {
          const directResponse = await axios.get(
            `${server.apiUrl}/instance/connect/${instanceName}`,
            { headers }
          );
          
          console.log(`Resposta do endpoint direto: ${JSON.stringify(directResponse.data)}`);
          
          const isConnected = directResponse.data?.instance?.state === 'open' || 
                             directResponse.data?.state === 'open' || 
                             directResponse.data?.connected;
          
          if (isConnected) {
            console.log("🟢 CONECTADO: Estado 'open' na instância detectado");
            console.log("Estado final da conexão: ✅ CONECTADO");
            
            return res.status(200).json({
              connected: true,
              qrCode: req.query.includeQr === 'true' ? await getQrCodeForInstance(server, instanceName, headers) : null,
              lastUpdated: new Date()
            });
          }
        } catch (directError) {
          console.log(`Erro ao verificar status direto: ${directError.message}`);
        }
      } 
      else if (statusResponse.data?.state === 'open' || statusResponse.data?.connected) {
        console.log("🟢 CONECTADO: Estado 'open' na resposta JSON");
        console.log("Estado final da conexão: ✅ CONECTADO");
        
        return res.status(200).json({
          connected: true,
          qrCode: req.query.includeQr === 'true' ? await getQrCodeForInstance(server, instanceName, headers) : null,
          lastUpdated: new Date()
        });
      }
      
      // Forçar conexão para desenvolvimento, comentar em produção
      // return res.status(200).json({
      //   connected: true,
      //   qrCode: null,
      //   lastUpdated: new Date()
      // });
      
      // Se chegou aqui, não está conectado
      console.log("Estado final da conexão: ❌ DESCONECTADO");
      return res.status(200).json({
        connected: false,
        qrCode: req.query.includeQr === 'true' ? await getQrCodeForInstance(server, instanceName, headers) : null,
        lastUpdated: new Date()
      });
      
    } catch (statusError: any) {
      console.error(`Erro ao verificar status: ${statusError.message}`);
      
      // Mesmo com erro, tentamos alternativas antes de desistir
      try {
        // Tentar endpoint alternativo
        const directResponse = await axios.get(
          `${server.apiUrl}/instance/connect/${instanceName}`,
          { headers }
        );
        
        console.log(`Resposta do endpoint alternativo: ${JSON.stringify(directResponse.data)}`);
        
        const isConnected = directResponse.data?.instance?.state === 'open' || 
                          directResponse.data?.state === 'open' || 
                          directResponse.data?.connected;
        
        if (isConnected) {
          console.log("🟢 CONECTADO (via alternativa): Estado 'open' detectado");
          return res.status(200).json({
            connected: true,
            lastUpdated: new Date()
          });
        }
      } catch (altError) {
        console.log(`Erro também no endpoint alternativo: ${altError.message}`);
      }
      
      // Se chegou aqui, não conseguimos determinar o status ou não está conectado
      console.log("❌ DESCONECTADO: Não foi possível determinar o status");
      
      // Em desenvolvimento, forçar conexão para testes
      // return res.status(200).json({
      //   connected: true,
      //   lastUpdated: new Date()
      // });
      
      return res.status(200).json({
        connected: false,
        lastUpdated: new Date()
      });
    }
  } catch (error: any) {
    console.error(`Erro geral ao verificar status:`, error);
    
    // Em desenvolvimento, forçar conexão para testes
    // return res.status(200).json({
    //   connected: true,
    //   error: error.message,
    //   lastUpdated: new Date()
    // });
    
    return res.status(500).json({
      message: "Erro ao verificar status de conexão",
      error: error.message
    });
  }
}

/**
 * Obtém o QR Code para uma instância específica
 */
async function getQrCodeForInstance(server: any, instanceName: string, headers: any): Promise<string | null> {
  try {
    const qrResponse = await axios.get(
      `${server.apiUrl}/instance/qrcode/${instanceName}`,
      { headers }
    );
    
    if (qrResponse.data && (qrResponse.data.qrcode || qrResponse.data.qrCode)) {
      return qrResponse.data.qrcode || qrResponse.data.qrCode;
    }
    
    return null;
  } catch (qrError) {
    console.log(`Erro ao obter QR code: ${qrError.message}`);
    return null;
  }
}

/**
 * Obtém o QR Code para autenticação WhatsApp de forma mais robusta
 */
export async function getWhatsAppQrCode(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = (req.user as Express.User).id;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado" });
    }
    
    // Obter informações do servidor atual
    const userServer = await storage.getUserServers(userId);
    if (!userServer || userServer.length === 0 || !userServer[0].server) {
      return res.status(400).json({ message: "Servidor não configurado para este usuário" });
    }
    
    const server = userServer[0].server;
    const instanceName = user.username; // Usa o nome do usuário como instância
    
    // Verificar se temos as informações necessárias para conectar
    if (!server.apiUrl || !server.apiToken) {
      return res.status(400).json({ 
        message: "Configuração de API incompleta", 
        details: "URL da API ou token não configurados" 
      });
    }
    
    // Configurar headers para a requisição usando o token do servidor
    const headers = {
      'Content-Type': 'application/json',
      'apikey': server.apiToken
    };
    
    console.log(`Usando token nos headers: ${server.apiToken.substring(0, 5)}...${server.apiToken.substring(server.apiToken.length - 4)} (origem: servidor)`);
    console.log(`Headers de autenticação configurados: ${Object.keys(headers).join(', ')}`);
    
    // Primeiro precisamos criar a instância seguindo a documentação da Evolution API
    console.log(`Criando instância '${instanceName}' na Evolution API...`);
    
    try {
      // 1. Criar a instância primeiro (POST /instance/create)
      const createInstanceData = {
        instanceName: instanceName,
        token: server.apiToken,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        webhook: {
          url: "",
          byEvents: false,
          base64: true
        }
      };
      
      const createResponse = await axios.post(
        `${server.apiUrl}/instance/create`,
        createInstanceData,
        { headers }
      );
      
      console.log(`Instância '${instanceName}' criada com sucesso:`, createResponse.data);
      
      // 2. Agora conectar a instância para obter o QR Code (GET /instance/connect/{instance})
      const connectResponse = await axios.get(
        `${server.apiUrl}/instance/connect/${instanceName}`,
        { headers }
      );
      
      if (connectResponse.status === 200) {
        let qrCode = null;
        
        // Buscar QR code nos diferentes formatos possíveis de resposta
        if (connectResponse.data.qrcode) {
          qrCode = connectResponse.data.qrcode;
        } else if (connectResponse.data.qrCode) {
          qrCode = connectResponse.data.qrCode;
        } else if (connectResponse.data.code) {
          qrCode = connectResponse.data.code;
        } else if (connectResponse.data.data && connectResponse.data.data.qrcode) {
          qrCode = connectResponse.data.data.qrcode;
        } else if (typeof connectResponse.data === 'string' && connectResponse.data.includes('data:image/')) {
          qrCode = connectResponse.data; // QR code como string base64
        }
        
        if (qrCode) {
          console.log(`QR Code obtido: ${qrCode.substring(0, 100)}...`);
          return res.status(200).json({
            success: true,
            qrCode: qrCode,
            message: "Escaneie o QR Code com o seu WhatsApp"
          });
        }
      }
    } catch (qrError) {
      console.log(`Erro na rota direta de QR Code: ${qrError.message}`);
      // Continuar para tentar outras abordagens
    }
    
    // Tentar via connect
    try {
      console.log(`Tentando obter QR Code pelo endpoint connect: ${server.apiUrl}/instance/connect/${instanceName}`);
      
      const connectResponse = await axios.get(
        `${server.apiUrl}/instance/connect/${instanceName}`,
        { headers }
      );
      
      if (connectResponse.status === 200) {
        let qrCode = null;
        
        // Buscar QR code nos diferentes formatos possíveis de resposta
        if (connectResponse.data.qrcode) {
          qrCode = connectResponse.data.qrcode;
        } else if (connectResponse.data.qrCode) {
          qrCode = connectResponse.data.qrCode;
        } else if (connectResponse.data.code) {
          qrCode = connectResponse.data.code;
        } else if (connectResponse.data.data && connectResponse.data.data.qrcode) {
          qrCode = connectResponse.data.data.qrcode;
        } else if (typeof connectResponse.data === 'string' && connectResponse.data.includes('data:image/')) {
          qrCode = connectResponse.data; // QR code como string base64
        }
        
        if (qrCode) {
          console.log(`QR Code obtido via connect: ${qrCode.substring(0, 100)}...`);
          return res.status(200).json({
            success: true,
            qrCode: qrCode,
            message: "Escaneie o QR Code com o seu WhatsApp"
          });
        } else {
          console.log(`Resposta sem QR code: ${JSON.stringify(connectResponse.data)}`);
          
          // Se não obteve o QR code, mas a conexão foi estabelecida
          if (connectResponse.data.connected || 
              (connectResponse.data.instance && connectResponse.data.instance.state === 'open') ||
              connectResponse.data.state === 'open') {
            
            console.log("Conexão já estabelecida, não é necessário QR Code");
            return res.status(200).json({
              success: true,
              connected: true,
              message: "Seu WhatsApp já está conectado"
            });
          }
          
          // Tentar criar a instância e então obter o QR code
          console.log("Recebeu erro 404. Tentando criar a instância e obter QR code novamente...");
          
          // Tenta criar a instância
          try {
            console.log(`Tentando criar instância no endpoint: ${server.apiUrl}/instance/create`);
            const createInstanceData = {
              instanceName: instanceName,
              token: server.apiToken,
              webhook: null,
              webhookByEvents: false,
              integration: "WHATSAPP-BAILEYS",
              language: "pt-BR",
              qrcode: true,
              qrcodeImage: true,
              reject_call: false,
              events_message: false,
              ignore_group: false,
              ignore_broadcast: false,
              save_message: true,
              webhook_base64: true
            };
            
            console.log(`Dados enviados: ${JSON.stringify(createInstanceData)}`);
            console.log(`Usando token nos headers: ${server.apiToken.substring(0, 5)}...${server.apiToken.substring(server.apiToken.length - 4)} (origem: ambiente)`);
            console.log(`Headers de autenticação configurados: ${Object.keys(headers).join(', ')}`);
            
            const createInstance = await axios.post(
              `${server.apiUrl}/instance/create`,
              createInstanceData,
              { headers }
            );
            
            // Após criar a instância, tenta obter o QR code novamente
            const reconnectResponse = await axios.get(
              `${server.apiUrl}/instance/connect/${instanceName}`,
              { headers }
            );
            
            let qrCode = null;
            
            // Buscar QR code nos diferentes formatos possíveis de resposta
            if (reconnectResponse.data.qrcode) {
              qrCode = reconnectResponse.data.qrcode;
            } else if (reconnectResponse.data.qrCode) {
              qrCode = reconnectResponse.data.qrCode;
            } else if (reconnectResponse.data.code) {
              qrCode = reconnectResponse.data.code;
            } else if (reconnectResponse.data.data && reconnectResponse.data.data.qrcode) {
              qrCode = reconnectResponse.data.data.qrcode;
            } else if (typeof reconnectResponse.data === 'string' && reconnectResponse.data.includes('data:image/')) {
              qrCode = reconnectResponse.data; // QR code como string base64
            }
            
            if (qrCode) {
              console.log(`QR Code obtido: ${qrCode.substring(0, 100)}...`);
              return res.status(200).json({
                success: true,
                qrCode: qrCode,
                message: "Escaneie o QR Code com o seu WhatsApp"
              });
            } else {
              console.log(`Resposta sem QR code: ${JSON.stringify(reconnectResponse.data)}`);
              return res.status(500).json({
                success: false,
                error: "QR Code não encontrado na resposta",
                details: reconnectResponse.data
              });
            }
          } catch (createError: any) {
            console.log(`Erro ao criar instância: ${createError.message}`);
            
            // Tentar um endpoint alternativo
            try {
              console.log(`Tentando endpoint alternativo: ${server.apiUrl}/instance/create/${instanceName}`);
              await axios.post(
                `${server.apiUrl}/instance/create/${instanceName}`,
                {},
                { headers }
              );
              
              // Após tentar criar com o endpoint alternativo, tenta obter o QR code novamente
              const altReconnectResponse = await axios.get(
                `${server.apiUrl}/instance/connect/${instanceName}`,
                { headers }
              );
              
              let qrCode = null;
              
              // Buscar QR code nos diferentes formatos possíveis de resposta
              if (altReconnectResponse.data.qrcode) {
                qrCode = altReconnectResponse.data.qrcode;
              } else if (altReconnectResponse.data.qrCode) {
                qrCode = altReconnectResponse.data.qrCode;
              } else if (altReconnectResponse.data.code) {
                qrCode = altReconnectResponse.data.code;
              } else if (altReconnectResponse.data.data && altReconnectResponse.data.data.qrcode) {
                qrCode = altReconnectResponse.data.data.qrcode;
              } else if (typeof altReconnectResponse.data === 'string' && altReconnectResponse.data.includes('data:image/')) {
                qrCode = altReconnectResponse.data; // QR code como string base64
              }
              
              if (qrCode) {
                console.log(`QR Code obtido via alt endpoint: ${qrCode.substring(0, 100)}...`);
                return res.status(200).json({
                  success: true,
                  qrCode: qrCode,
                  message: "Escaneie o QR Code com o seu WhatsApp"
                });
              }
            } catch (altError: any) {
              console.log(`Erro no endpoint alternativo: ${altError.message}`);
            }
            
            return res.status(500).json({
              success: false,
              error: "Falha ao criar a instância",
              details: { success: false, error: "Não foi possível criar a instância após múltiplas tentativas" }
            });
          }
        }
      }
    } catch (connectError: any) {
      console.error(`Erro ao conectar: ${connectError.message}`);
      
      // Tentar criar a instância e então reconectar
      try {
        console.log("Tentando criar a instância primeiro...");
        
        // Tenta criar a instância
        const createInstance = await axios.post(
          `${server.apiUrl}/instance/create`,
          {
            instanceName: instanceName,
            token: server.apiToken,
            webhook: null
          },
          { headers }
        );
        
        // Após criar a instância, tenta obter o QR code novamente
        const reconnectResponse = await axios.get(
          `${server.apiUrl}/instance/connect/${instanceName}`,
          { headers }
        );
        
        let qrCode = null;
        
        // Buscar QR code nos diferentes formatos possíveis de resposta
        if (reconnectResponse.data.qrcode) {
          qrCode = reconnectResponse.data.qrcode;
        } else if (reconnectResponse.data.qrCode) {
          qrCode = reconnectResponse.data.qrCode;
        } else if (reconnectResponse.data.code) {
          qrCode = reconnectResponse.data.code;
        } else if (reconnectResponse.data.data && reconnectResponse.data.data.qrcode) {
          qrCode = reconnectResponse.data.data.qrcode;
        } else if (typeof reconnectResponse.data === 'string' && reconnectResponse.data.includes('data:image/')) {
          qrCode = reconnectResponse.data; // QR code como string base64
        }
        
        if (qrCode) {
          console.log(`QR Code obtido após criar instância: ${qrCode.substring(0, 100)}...`);
          return res.status(200).json({
            success: true,
            qrCode: qrCode,
            message: "Escaneie o QR Code com o seu WhatsApp"
          });
        }
      } catch (createError: any) {
        console.log(`Erro ao criar instância: ${createError.message}`);
      }
      
      return res.status(500).json({
        success: false,
        error: "Erro ao obter QR code",
        message: connectError.message
      });
    }
    
    // Se chegou aqui, todas as tentativas falharam
    throw new Error("QR Code não encontrado na resposta");
    
  } catch (error: any) {
    console.error(`Erro geral ao obter QR code:`, error);
    return res.status(500).json({
      message: "Erro ao obter QR code",
      error: error.message
    });
  }
}