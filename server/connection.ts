import axios from "axios";
import { Request, Response } from "express";
import { storage } from "./storage";

// Status de conexão do WhatsApp por usuário
export const connectionStatus: Record<number, any> = {};

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
    
    // Verificar se o webhook foi configurado
    if (!user.whatsappWebhookUrl) {
      return res.status(400).json({ 
        message: "URL de webhook não configurada", 
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
      
      // Log detalhado da resposta
      console.log("Resposta do webhook estrutura completa:", JSON.stringify(webhookResponse));
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
            for (const key in obj) {
              if (typeof obj[key] === 'string' && obj[key].startsWith('data:image')) {
                return obj[key];
              } else if (typeof obj[key] === 'object') {
                const found = deepCheckQrCode(obj[key], maxDepth, depth + 1);
                if (found) return found;
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
            // Verificar status real da conexão via webhook - tentar POST primeiro, depois GET
            if (!user.whatsappWebhookUrl) throw new Error("Webhook URL não configurada");
            
            try {
              // Primeiro tentar com POST
              console.log("Verificando status via POST...");
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
                name: statusResponse.data.name || "WhatsApp Conectado",
                phone: statusResponse.data.phone || "N/A",
                lastUpdated: new Date()
              };
            } else {
              // Se o webhook retornou resposta mas não indica que está conectado
              // Manter o status atual com o QR code até que o usuário escaneie
              console.log("Webhook não confirmou conexão, mantendo QR code visível");
            }
          } catch (webhookError: any) {
            console.error("Erro ao verificar status via webhook:", webhookError.message);
            // Não alteramos o status automaticamente em caso de erro
            // para manter o QR code visível
          }
        }
      }, 30000);
      
      return res.json(connectionStatus[userId]);
    } catch (webhookError: any) {
      console.error("Erro ao chamar webhook:", webhookError);
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
    
    // Verificar se o webhook foi configurado
    if (user.whatsappWebhookUrl) {
      try {
        // Tentar chamar o webhook para desconectar - tentar POST primeiro, depois GET
        try {
          // Primeiro tentar com POST
          console.log("Tentando desconectar via POST...");
          await axios.post(user.whatsappWebhookUrl, {
            action: "disconnect",
            userId: userId,
            username: user.username,
            email: user.email,
            name: user.name,
            company: user.company,
            phone: user.phone
          });
          console.log("Desconexão via POST bem-sucedida");
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
          console.log("Desconexão via GET bem-sucedida");
        }
      } catch (webhookError: any) {
        console.error("Erro ao chamar webhook para desconexão:", webhookError.message);
      }
    }
    
    // Atualizar status de desconexão
    connectionStatus[userId] = {
      connected: false,
      lastUpdated: new Date()
    };
    
    res.json(connectionStatus[userId]);
  } catch (error) {
    console.error("Erro ao desconectar:", error);
    res.status(500).json({ message: "Erro ao desconectar" });
  }
}