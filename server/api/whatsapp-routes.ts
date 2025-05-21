/**
 * Rotas da API WhatsApp para a nova interface de chat
 * Baseada no modelo WhatsApp Web com integração com Evolution API
 */

import { Request, Response } from "express";
import axios from "axios";

/**
 * Obtém todos os contatos do WhatsApp
 */
export async function getContacts(req: Request, res: Response) {
  try {
    const { userId } = req.user as any;
    
    // Obter informações do servidor conectado para este usuário
    const server = await fetchUserServer(userId);
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: "Servidor não encontrado para este usuário"
      });
    }

    const { apiUrl, apiToken, instanceId } = server;
    
    if (!apiUrl || !apiToken || !instanceId) {
      return res.status(400).json({
        success: false,
        message: "Configuração do servidor incompleta. Verifique URL da API, token e instância."
      });
    }

    // Consultar a Evolution API para obter contatos
    const response = await axios.get(
      `${apiUrl}/instances/${instanceId}/contacts`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Se a API retornar contatos com sucesso
    if (response.data && response.status === 200) {
      return res.status(200).json(response.data.contacts || []);
    } else {
      // Em caso de resposta sem erro, mas sem os dados esperados
      return res.status(response.status).json({
        success: false,
        message: "Resposta inesperada da API Evolution",
        data: response.data
      });
    }
  } catch (error: any) {
    console.error("Erro ao obter contatos:", error);
    
    // Se o erro for da API Evolution (erro 4xx, 5xx)
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: `Erro da API Evolution: ${error.response.status}`,
        error: error.response.data
      });
    }
    
    // Para outros tipos de erro (rede, timeout, etc)
    return res.status(500).json({
      success: false,
      message: "Erro ao obter contatos do WhatsApp",
      error: error.message
    });
  }
}

/**
 * Obtém as mensagens de um chat específico
 */
export async function getMessages(req: Request, res: Response) {
  try {
    const { userId } = req.user as any;
    const { contactId } = req.params;
    
    if (!contactId) {
      return res.status(400).json({
        success: false,
        message: "ID do contato não fornecido"
      });
    }
    
    // Obter informações do servidor conectado para este usuário
    const server = await fetchUserServer(userId);
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: "Servidor não encontrado para este usuário"
      });
    }

    const { apiUrl, apiToken, instanceId } = server;
    
    if (!apiUrl || !apiToken || !instanceId) {
      return res.status(400).json({
        success: false,
        message: "Configuração do servidor incompleta. Verifique URL da API, token e instância."
      });
    }

    // Consultar a Evolution API para obter mensagens
    const response = await axios.get(
      `${apiUrl}/instances/${instanceId}/chat/messages/${contactId}`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Se a API retornar mensagens com sucesso
    if (response.data && response.status === 200) {
      return res.status(200).json(response.data.messages || []);
    } else {
      // Em caso de resposta sem erro, mas sem os dados esperados
      return res.status(response.status).json({
        success: false,
        message: "Resposta inesperada da API Evolution",
        data: response.data
      });
    }
  } catch (error: any) {
    console.error("Erro ao obter mensagens:", error);
    
    // Se o erro for da API Evolution (erro 4xx, 5xx)
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: `Erro da API Evolution: ${error.response.status}`,
        error: error.response.data
      });
    }
    
    // Para outros tipos de erro (rede, timeout, etc)
    return res.status(500).json({
      success: false,
      message: "Erro ao obter mensagens do WhatsApp",
      error: error.message
    });
  }
}

/**
 * Envia uma mensagem de texto
 */
export async function sendMessage(req: Request, res: Response) {
  try {
    const { userId } = req.user as any;
    const { to, message } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        message: "Destinatário e/ou mensagem não fornecidos"
      });
    }
    
    // Obter informações do servidor conectado para este usuário
    const server = await fetchUserServer(userId);
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: "Servidor não encontrado para este usuário"
      });
    }

    const { apiUrl, apiToken, instanceId } = server;
    
    if (!apiUrl || !apiToken || !instanceId) {
      return res.status(400).json({
        success: false,
        message: "Configuração do servidor incompleta. Verifique URL da API, token e instância."
      });
    }

    // Enviar mensagem utilizando a Evolution API
    const response = await axios.post(
      `${apiUrl}/instances/${instanceId}/chat/send`,
      {
        phone: to,
        message: message
      },
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Se a API enviar a mensagem com sucesso
    if (response.data && response.status === 200) {
      return res.status(200).json({
        success: true,
        message: "Mensagem enviada com sucesso",
        data: response.data
      });
    } else {
      // Em caso de resposta sem erro, mas sem os dados esperados
      return res.status(response.status).json({
        success: false,
        message: "Resposta inesperada da API Evolution",
        data: response.data
      });
    }
  } catch (error: any) {
    console.error("Erro ao enviar mensagem:", error);
    
    // Se o erro for da API Evolution (erro 4xx, 5xx)
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: `Erro da API Evolution: ${error.response.status}`,
        error: error.response.data
      });
    }
    
    // Para outros tipos de erro (rede, timeout, etc)
    return res.status(500).json({
      success: false,
      message: "Erro ao enviar mensagem pelo WhatsApp",
      error: error.message
    });
  }
}

/**
 * Verifica o status da conexão com o WhatsApp
 */
export async function checkStatus(req: Request, res: Response) {
  try {
    const { userId } = req.user as any;
    
    // Obter informações do servidor conectado para este usuário
    const server = await fetchUserServer(userId);
    
    if (!server) {
      return res.status(404).json({
        success: false,
        message: "Servidor não encontrado para este usuário",
        connected: false
      });
    }

    const { apiUrl, apiToken, instanceId } = server;
    
    if (!apiUrl || !apiToken || !instanceId) {
      return res.status(400).json({
        success: false,
        message: "Configuração do servidor incompleta",
        connected: false
      });
    }

    // Verificar status da conexão com a Evolution API
    const response = await axios.get(
      `${apiUrl}/instances/${instanceId}/connection`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Se a API retornar status com sucesso
    if (response.data && response.status === 200) {
      const connected = response.data?.state === "open" || 
                       response.data?.connected === true ||
                       response.data?.status === "connected";
      
      return res.status(200).json({
        success: true,
        connected,
        state: response.data?.state || response.data?.status,
        data: response.data
      });
    } else {
      // Em caso de resposta sem erro, mas sem os dados esperados
      return res.status(response.status).json({
        success: false,
        message: "Resposta inesperada da API Evolution",
        connected: false,
        data: response.data
      });
    }
  } catch (error: any) {
    console.error("Erro ao verificar status:", error);
    
    // Se o erro for da API Evolution (erro 4xx, 5xx)
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: `Erro da API Evolution: ${error.response.status}`,
        connected: false,
        error: error.response.data
      });
    }
    
    // Para outros tipos de erro (rede, timeout, etc)
    return res.status(500).json({
      success: false,
      message: "Erro ao verificar status do WhatsApp",
      connected: false,
      error: error.message
    });
  }
}

/**
 * Busca informações do servidor conectado ao usuário
 */
async function fetchUserServer(userId: number) {
  try {
    // Primeiro verifica se o usuário tem um servidor padrão definido
    const userServer = await db.select()
      .from(userServers)
      .where(and(
        eq(userServers.userId, userId),
        eq(userServers.isDefault, true)
      ))
      .innerJoin(servers, eq(userServers.serverId, servers.id))
      .limit(1);

    if (userServer && userServer.length > 0) {
      const server = userServer[0].servers;
      return {
        apiUrl: server.apiUrl,
        apiToken: server.apiToken,
        instanceId: server.instanceId || 'admin'  // Usa 'admin' como padrão se não houver instanceId definido
      };
    }

    // Se não encontrar um servidor padrão, busca o primeiro servidor disponível
    const anyUserServer = await db.select()
      .from(userServers)
      .where(eq(userServers.userId, userId))
      .innerJoin(servers, eq(userServers.serverId, servers.id))
      .limit(1);

    if (anyUserServer && anyUserServer.length > 0) {
      const server = anyUserServer[0].servers;
      return {
        apiUrl: server.apiUrl,
        apiToken: server.apiToken,
        instanceId: server.instanceId || 'admin'
      };
    }

    // Se não encontrar nenhum servidor, retorna null
    return null;
  } catch (error) {
    console.error("Erro ao buscar servidor do usuário:", error);
    return null;
  }
}

// Importações necessárias para acesso ao banco de dados
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { servers, userServers } from "@shared/schema";