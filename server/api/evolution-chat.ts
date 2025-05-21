/**
 * Módulo de integração com a Evolution API para funcionalidades de chat
 * Baseado na documentação oficial: https://doc.evolution-api.com
 */

import { Request, Response } from "express";
import axios from "axios";
import { storage } from "../storage";

/**
 * Obtém o QR Code para autenticação WhatsApp
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
    
    // Configurar headers para a requisição
    const headers = {
      'Content-Type': 'application/json',
      'apikey': server.apiToken,
      'Authorization': `Bearer ${server.apiToken}`,
      'AUTHENTICATION_API_KEY': server.apiToken // Para compatibilidade com diferentes versões
    };
    
    console.log(`Conectando à Evolution API em ${server.apiUrl} para obter QR Code`);
    console.log(`Usando token nos headers: ${server.apiToken.substring(0, 5)}...${server.apiToken.substring(server.apiToken.length - 4)} (origem: servidor)`);
    console.log(`Headers de autenticação configurados: ${Object.keys(headers).join(', ')}`);
    
    // Primeiro verifica se a API está online
    try {
      const versionCheck = await axios.get(`${server.apiUrl}/api/version`, { headers });
      console.log(`API Evolution online. Tentando criar a instância...`);
    } catch (apiError: any) {
      console.error(`Erro ao verificar API: ${apiError.message}`);
      return res.status(500).json({ 
        message: "API Evolution indisponível", 
        error: apiError.message 
      });
    }
    
    // Tenta criar a instância primeiro
    try {
      console.log(`Tentando criar instância no endpoint: ${server.apiUrl}/instance/create`);
      const createInstanceData = {
        instanceName: instanceName,
        token: server.apiToken,
        webhook: null, // Sem webhook na criação inicial
        webhookByEvents: false,
        integration: "WHATSAPP-BAILEYS", // Usar o padrão da Evolution API
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
      } catch (altError: any) {
        console.log(`Erro no endpoint alternativo: ${altError.message}`);
        // Continuar mesmo com erro, pois a instância pode já existir
      }
    }
    
    // Agora conectar e obter QR code
    try {
      const connectUrl = `${server.apiUrl}/instance/connect/${instanceName}`;
      console.log(`Conectando a instância: ${connectUrl}`);
      
      const connectResponse = await axios.get(connectUrl, { headers });
      
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
        } else {
          console.log(`Resposta sem QR code: ${JSON.stringify(connectResponse.data)}`);
          return res.status(500).json({
            success: false,
            error: "QR Code não encontrado na resposta",
            data: connectResponse.data
          });
        }
      } else {
        return res.status(connectResponse.status).json({
          success: false,
          error: "Erro ao conectar instância",
          data: connectResponse.data
        });
      }
    } catch (connectError: any) {
      console.error(`Erro ao conectar: ${connectError.message}`);
      
      // Tentar endpoint alternativo para conectar
      try {
        console.log(`Tentando endpoint alternativo para QR Code: ${server.apiUrl}/qrcode/${instanceName}`);
        const altQrResponse = await axios.get(`${server.apiUrl}/qrcode/${instanceName}`, { headers });
        
        if (altQrResponse.data && (altQrResponse.data.qrcode || altQrResponse.data.qrCode)) {
          return res.status(200).json({
            success: true,
            qrCode: altQrResponse.data.qrcode || altQrResponse.data.qrCode,
            message: "Escaneie o QR Code com o seu WhatsApp (via rota alternativa)"
          });
        }
      } catch (altQrError: any) {
        console.log(`Erro na rota alternativa de QR Code: ${altQrError.message}`);
      }
      
      return res.status(500).json({
        success: false,
        error: "Erro ao obter QR code",
        message: connectError.message
      });
    }
  } catch (error: any) {
    console.error(`Erro geral ao obter QR code:`, error);
    return res.status(500).json({
      message: "Erro ao obter QR code",
      error: error.message
    });
  }
}

/**
 * Obtém os contatos do WhatsApp
 */
export async function getContacts(req: Request, res: Response) {
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
      return res.status(400).json({ message: "Configuração de API incompleta" });
    }
    
    // Configurar headers para a requisição
    const headers = {
      'Content-Type': 'application/json',
      'apikey': server.apiToken,
      'Authorization': `Bearer ${server.apiToken}`
    };
    
    console.log(`Buscando contatos na Evolution API: ${server.apiUrl}/instances/${instanceName}/contacts`);
    
    // Tentar buscar contatos
    try {
      const contactsResponse = await axios.get(
        `${server.apiUrl}/instances/${instanceName}/contacts`,
        { headers }
      );
      
      if (contactsResponse.status === 200) {
        console.log(`Contatos obtidos: ${JSON.stringify(contactsResponse.data).substring(0, 200)}...`);
        
        // Processar contatos de acordo com o formato da resposta
        let contacts = [];
        
        if (Array.isArray(contactsResponse.data)) {
          contacts = contactsResponse.data;
        } else if (contactsResponse.data.contacts) {
          contacts = contactsResponse.data.contacts;
        } else if (contactsResponse.data.response) {
          contacts = contactsResponse.data.response;
        } else if (contactsResponse.data.data) {
          contacts = contactsResponse.data.data;
        }
        
        return res.status(200).json({
          success: true,
          contacts: contacts
        });
      } else {
        // Tentar contatos de demonstração
        console.log(`Erro ao buscar contatos. Código: ${contactsResponse.status}`);
        return res.status(200).json({
          success: true,
          contacts: getDemoContacts(),
          isDemoData: true
        });
      }
    } catch (contactsError: any) {
      console.error(`Erro ao buscar contatos: ${contactsError.message}`);
      
      // Tentar endpoints alternativos
      try {
        console.log(`Tentando endpoint alternativo: ${server.apiUrl}/instance/contacts/${instanceName}`);
        const altResponse = await axios.get(`${server.apiUrl}/instance/contacts/${instanceName}`, { headers });
        
        if (altResponse.status === 200) {
          let contacts = [];
          
          if (Array.isArray(altResponse.data)) {
            contacts = altResponse.data;
          } else if (altResponse.data.contacts) {
            contacts = altResponse.data.contacts;
          } else if (altResponse.data.response) {
            contacts = altResponse.data.response;
          } else if (altResponse.data.data) {
            contacts = altResponse.data.data;
          }
          
          return res.status(200).json({
            success: true,
            contacts: contacts,
            source: "alternative_endpoint"
          });
        }
      } catch (altError: any) {
        console.log(`Erro no endpoint alternativo: ${altError.message}`);
      }
      
      // Se todas as tentativas falharem, retornar contatos de demonstração
      return res.status(200).json({
        success: true,
        contacts: getDemoContacts(),
        isDemoData: true,
        error: contactsError.message
      });
    }
  } catch (error: any) {
    console.error(`Erro geral ao buscar contatos:`, error);
    return res.status(500).json({
      success: false,
      message: "Erro ao buscar contatos",
      error: error.message
    });
  }
}

/**
 * Obtém as mensagens de um chat específico
 */
export async function getMessages(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = (req.user as Express.User).id;
    const user = await storage.getUser(userId);
    const jid = req.query.jid as string;
    
    if (!jid) {
      return res.status(400).json({ message: "JID do contato não fornecido" });
    }
    
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
      return res.status(400).json({ message: "Configuração de API incompleta" });
    }
    
    // Configurar headers para a requisição
    const headers = {
      'Content-Type': 'application/json',
      'apikey': server.apiToken,
      'Authorization': `Bearer ${server.apiToken}`
    };
    
    console.log(`Buscando mensagens na Evolution API para o contato: ${jid}`);
    
    // Dados para a requisição
    const requestData = {
      jid: jid,
      count: 50 // Limitar a 50 mensagens para evitar sobrecarga
    };
    
    // Tentar buscar mensagens
    try {
      const messagesResponse = await axios.post(
        `${server.apiUrl}/instances/${instanceName}/messages`,
        requestData,
        { headers }
      );
      
      if (messagesResponse.status === 200) {
        console.log(`Mensagens obtidas: ${JSON.stringify(messagesResponse.data).substring(0, 200)}...`);
        
        // Processar mensagens de acordo com o formato da resposta
        let messages = [];
        
        if (Array.isArray(messagesResponse.data)) {
          messages = messagesResponse.data;
        } else if (messagesResponse.data.messages) {
          messages = messagesResponse.data.messages;
        } else if (messagesResponse.data.response) {
          messages = messagesResponse.data.response;
        } else if (messagesResponse.data.data) {
          messages = messagesResponse.data.data;
        }
        
        return res.status(200).json({
          success: true,
          messages: messages
        });
      } else {
        console.log(`Erro ao buscar mensagens. Código: ${messagesResponse.status}`);
        return res.status(messagesResponse.status).json({
          success: false,
          error: "Erro ao buscar mensagens",
          statusCode: messagesResponse.status
        });
      }
    } catch (messagesError: any) {
      console.error(`Erro ao buscar mensagens: ${messagesError.message}`);
      
      // Tentar endpoints alternativos
      try {
        console.log(`Tentando endpoint alternativo para buscar mensagens`);
        const altResponse = await axios.post(
          `${server.apiUrl}/instance/messages/${instanceName}`,
          requestData,
          { headers }
        );
        
        if (altResponse.status === 200) {
          let messages = [];
          
          if (Array.isArray(altResponse.data)) {
            messages = altResponse.data;
          } else if (altResponse.data.messages) {
            messages = altResponse.data.messages;
          } else if (altResponse.data.response) {
            messages = altResponse.data.response;
          } else if (altResponse.data.data) {
            messages = altResponse.data.data;
          }
          
          return res.status(200).json({
            success: true,
            messages: messages,
            source: "alternative_endpoint"
          });
        }
      } catch (altError: any) {
        console.log(`Erro no endpoint alternativo: ${altError.message}`);
      }
      
      // Se todas as tentativas falharem, retornar mensagens de demonstração
      return res.status(200).json({
        success: true,
        messages: getDemoMessages(jid),
        isDemoData: true,
        error: messagesError.message
      });
    }
  } catch (error: any) {
    console.error(`Erro geral ao buscar mensagens:`, error);
    return res.status(500).json({
      success: false,
      message: "Erro ao buscar mensagens",
      error: error.message
    });
  }
}

/**
 * Envia uma mensagem de texto
 */
export async function sendMessage(req: Request, res: Response) {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    const userId = (req.user as Express.User).id;
    const user = await storage.getUser(userId);
    const { jid, message } = req.body;
    
    if (!jid || !message) {
      return res.status(400).json({ message: "JID ou mensagem não fornecidos" });
    }
    
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
      return res.status(400).json({ message: "Configuração de API incompleta" });
    }
    
    // Configurar headers para a requisição
    const headers = {
      'Content-Type': 'application/json',
      'apikey': server.apiToken,
      'Authorization': `Bearer ${server.apiToken}`
    };
    
    console.log(`Enviando mensagem para ${jid}: ${message.substring(0, 30)}...`);
    
    // Dados para a requisição
    const requestData = {
      jid: jid,
      message: message
    };
    
    // Tentar enviar mensagem
    try {
      const sendResponse = await axios.post(
        `${server.apiUrl}/instances/${instanceName}/messages/text`,
        requestData,
        { headers }
      );
      
      if (sendResponse.status === 200 || sendResponse.status === 201) {
        console.log(`Mensagem enviada: ${JSON.stringify(sendResponse.data).substring(0, 200)}...`);
        
        return res.status(200).json({
          success: true,
          messageId: sendResponse.data.key?.id || sendResponse.data.id || Date.now().toString(),
          response: sendResponse.data
        });
      } else {
        console.log(`Erro ao enviar mensagem. Código: ${sendResponse.status}`);
        return res.status(sendResponse.status).json({
          success: false,
          error: "Erro ao enviar mensagem",
          statusCode: sendResponse.status
        });
      }
    } catch (sendError: any) {
      console.error(`Erro ao enviar mensagem: ${sendError.message}`);
      
      // Tentar endpoints alternativos
      try {
        console.log(`Tentando endpoint alternativo para enviar mensagem`);
        const altResponse = await axios.post(
          `${server.apiUrl}/instance/sendText/${instanceName}`,
          {
            number: jid.split('@')[0],
            text: message
          },
          { headers }
        );
        
        if (altResponse.status === 200 || altResponse.status === 201) {
          return res.status(200).json({
            success: true,
            messageId: altResponse.data.key?.id || altResponse.data.id || Date.now().toString(),
            response: altResponse.data,
            source: "alternative_endpoint"
          });
        }
      } catch (altError: any) {
        console.log(`Erro no endpoint alternativo: ${altError.message}`);
      }
      
      // Se todas as tentativas falharem
      return res.status(500).json({
        success: false,
        error: "Falha ao enviar mensagem",
        errorMessage: sendError.message
      });
    }
  } catch (error: any) {
    console.error(`Erro geral ao enviar mensagem:`, error);
    return res.status(500).json({
      success: false,
      message: "Erro ao enviar mensagem",
      error: error.message
    });
  }
}

/**
 * Retorna contatos de demonstração para uso quando a API não está disponível
 */
function getDemoContacts() {
  return [
    {
      id: "5511999887766@c.us",
      name: "Suporte LiguIA",
      phone: "5511999887766",
      pushname: "Suporte LiguIA",
      lastMessageTime: new Date().toISOString(),
      isGroup: false,
      profilePicture: null
    },
    {
      id: "5511987654321@c.us",
      name: "João Cliente",
      phone: "5511987654321",
      pushname: "João Cliente",
      lastMessageTime: new Date(Date.now() - 3600000).toISOString(),
      isGroup: false,
      profilePicture: null
    },
    {
      id: "5511123456789@c.us",
      name: "Maria Teste",
      phone: "5511123456789",
      pushname: "Maria Teste",
      lastMessageTime: new Date(Date.now() - 7200000).toISOString(),
      isGroup: false,
      profilePicture: null
    }
  ];
}

/**
 * Retorna mensagens de demonstração para uso quando a API não está disponível
 */
function getDemoMessages(jid: string) {
  const now = Date.now();
  const oneMinute = 60 * 1000;
  
  return [
    {
      id: "demo1",
      key: {
        remoteJid: jid,
        fromMe: false,
        id: "demo1"
      },
      message: {
        conversation: "Olá, como posso ajudar?"
      },
      messageTimestamp: Math.floor((now - 10 * oneMinute) / 1000),
      pushName: "Contato Demo",
      status: "received",
      fromMe: false
    },
    {
      id: "demo2",
      key: {
        remoteJid: jid,
        fromMe: true,
        id: "demo2"
      },
      message: {
        conversation: "Olá, estou interessado nos seus serviços."
      },
      messageTimestamp: Math.floor((now - 9 * oneMinute) / 1000),
      status: "delivered",
      fromMe: true
    },
    {
      id: "demo3",
      key: {
        remoteJid: jid,
        fromMe: false,
        id: "demo3"
      },
      message: {
        conversation: "Perfeito! Quais serviços você está buscando?"
      },
      messageTimestamp: Math.floor((now - 8 * oneMinute) / 1000),
      pushName: "Contato Demo",
      status: "received",
      fromMe: false
    },
    {
      id: "demo4",
      key: {
        remoteJid: jid,
        fromMe: true,
        id: "demo4"
      },
      message: {
        conversation: "Preciso de um sistema para gerenciar minha empresa."
      },
      messageTimestamp: Math.floor((now - 7 * oneMinute) / 1000),
      status: "read",
      fromMe: true
    },
    {
      id: "demo5",
      key: {
        remoteJid: jid,
        fromMe: false,
        id: "demo5"
      },
      message: {
        conversation: "Excelente! Temos ótimas soluções para você. Podemos agendar uma demonstração?"
      },
      messageTimestamp: Math.floor((now - 5 * oneMinute) / 1000),
      pushName: "Contato Demo",
      status: "received",
      fromMe: false
    }
  ];
}