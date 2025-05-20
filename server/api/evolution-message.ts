/**
 * Módulo para envio de mensagens usando a Evolution API
 * Baseado na documentação oficial da Evolution API
 */

import { Request, Response } from 'express';
import axios from 'axios';

/**
 * Envia uma mensagem de texto via Evolution API
 * POST /message/sendText/{instance}
 */
export async function sendText(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        message: 'Não autenticado' 
      });
    }

    const userId = req.user?.id;
    const { number, message, options = {} } = req.body;

    if (!number || !message) {
      return res.status(400).json({
        success: false,
        message: 'Número e mensagem são obrigatórios'
      });
    }

    // Buscar informações do servidor
    const server = await getUserServer(userId);
    if (!server || !server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta'
      });
    }

    const instanceId = server.instanceId || 'admin';
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;

    console.log(`Enviando mensagem para ${number}`);

    // Preparar payload conforme documentação
    const payload = {
      number: number,
      options: {
        delay: options.delay || 1200,
        presence: options.presence !== false,
        ...options
      },
      textMessage: {
        text: message
      }
    };

    // Fazer a requisição para enviar a mensagem
    const response = await axios.post(
      `${apiUrl}/message/sendText/${instanceId}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'apikey': apiToken
        },
        timeout: 15000
      }
    );

    // Retornar o resultado
    return res.json({
      success: true,
      sentMessageData: response.data
    });

  } catch (error) {
    console.error('Erro ao enviar mensagem de texto:', error);
    
    const errorMessage = axios.isAxiosError(error) && error.response
      ? `Erro ${error.response.status}: ${error.message}`
      : `Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`;
    
    return res.status(500).json({
      success: false,
      message: 'Não foi possível enviar a mensagem de texto',
      error: errorMessage
    });
  }
}

/**
 * Envia uma mensagem de mídia via Evolution API
 * POST /message/sendMedia/{instance}
 */
export async function sendMedia(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        message: 'Não autenticado' 
      });
    }

    const userId = req.user?.id;
    const { number, mediaType, media, caption = "", options = {} } = req.body;

    if (!number || !mediaType || !media) {
      return res.status(400).json({
        success: false,
        message: 'Número, tipo de mídia e mídia são obrigatórios'
      });
    }

    // Validar tipo de mídia
    const validMediaTypes = ['image', 'video', 'audio', 'document'];
    if (!validMediaTypes.includes(mediaType)) {
      return res.status(400).json({
        success: false,
        message: `Tipo de mídia deve ser um dos seguintes: ${validMediaTypes.join(', ')}`
      });
    }

    // Buscar informações do servidor
    const server = await getUserServer(userId);
    if (!server || !server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta'
      });
    }

    const instanceId = server.instanceId || 'admin';
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;

    console.log(`Enviando ${mediaType} para ${number}`);

    // Preparar payload conforme documentação
    const payload = {
      number: number,
      options: {
        delay: options.delay || 1200,
        presence: options.presence !== false,
        ...options
      },
      mediaMessage: {
        mediatype: mediaType,
        media: media,
        caption: caption,
        fileName: options.fileName || `file.${getDefaultExtension(mediaType)}`
      }
    };

    // Fazer a requisição para enviar a mensagem
    const response = await axios.post(
      `${apiUrl}/message/sendMedia/${instanceId}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'apikey': apiToken
        },
        timeout: 30000 // Tempo maior para envio de mídia
      }
    );

    // Retornar o resultado
    return res.json({
      success: true,
      sentMessageData: response.data
    });

  } catch (error) {
    console.error('Erro ao enviar mensagem de mídia:', error);
    
    const errorMessage = axios.isAxiosError(error) && error.response
      ? `Erro ${error.response.status}: ${error.message}`
      : `Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`;
    
    return res.status(500).json({
      success: false,
      message: 'Não foi possível enviar a mensagem de mídia',
      error: errorMessage
    });
  }
}

/**
 * Envia um áudio no formato WhatsApp via Evolution API
 * POST /message/sendWhatsAppAudio/{instance}
 */
export async function sendWhatsAppAudio(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        message: 'Não autenticado' 
      });
    }

    const userId = req.user?.id;
    const { number, audio, options = {} } = req.body;

    if (!number || !audio) {
      return res.status(400).json({
        success: false,
        message: 'Número e áudio são obrigatórios'
      });
    }

    // Buscar informações do servidor
    const server = await getUserServer(userId);
    if (!server || !server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta'
      });
    }

    const instanceId = server.instanceId || 'admin';
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;

    console.log(`Enviando áudio WhatsApp para ${number}`);

    // Preparar payload conforme documentação
    const payload = {
      number: number,
      options: {
        delay: options.delay || 1200,
        presence: options.presence !== false,
        ...options
      },
      audioMessage: {
        audio: audio
      }
    };

    // Fazer a requisição para enviar a mensagem
    const response = await axios.post(
      `${apiUrl}/message/sendWhatsAppAudio/${instanceId}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'apikey': apiToken
        },
        timeout: 30000 // Tempo maior para envio de áudio
      }
    );

    // Retornar o resultado
    return res.json({
      success: true,
      sentMessageData: response.data
    });

  } catch (error) {
    console.error('Erro ao enviar áudio WhatsApp:', error);
    
    const errorMessage = axios.isAxiosError(error) && error.response
      ? `Erro ${error.response.status}: ${error.message}`
      : `Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`;
    
    return res.status(500).json({
      success: false,
      message: 'Não foi possível enviar o áudio WhatsApp',
      error: errorMessage
    });
  }
}

/**
 * Envia um botão interativo via Evolution API
 * POST /message/sendButtons/{instance}
 */
export async function sendButtons(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        message: 'Não autenticado' 
      });
    }

    const userId = req.user?.id;
    const { number, buttonMessage, options = {} } = req.body;

    if (!number || !buttonMessage) {
      return res.status(400).json({
        success: false,
        message: 'Número e configuração de botões são obrigatórios'
      });
    }

    // Validar configuração de botões
    if (!buttonMessage.title || !buttonMessage.description || !buttonMessage.buttons || !Array.isArray(buttonMessage.buttons)) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de botões inválida. Forneça title, description e um array de buttons'
      });
    }

    // Buscar informações do servidor
    const server = await getUserServer(userId);
    if (!server || !server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta'
      });
    }

    const instanceId = server.instanceId || 'admin';
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;

    console.log(`Enviando botões para ${number}`);

    // Preparar payload conforme documentação
    const payload = {
      number: number,
      options: {
        delay: options.delay || 1200,
        presence: options.presence !== false,
        ...options
      },
      buttonMessage: buttonMessage
    };

    // Fazer a requisição para enviar a mensagem
    const response = await axios.post(
      `${apiUrl}/message/sendButtons/${instanceId}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'apikey': apiToken
        },
        timeout: 15000
      }
    );

    // Retornar o resultado
    return res.json({
      success: true,
      sentMessageData: response.data
    });

  } catch (error) {
    console.error('Erro ao enviar botões:', error);
    
    const errorMessage = axios.isAxiosError(error) && error.response
      ? `Erro ${error.response.status}: ${error.message}`
      : `Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`;
    
    return res.status(500).json({
      success: false,
      message: 'Não foi possível enviar os botões',
      error: errorMessage
    });
  }
}

/**
 * Envia uma lista de opções via Evolution API
 * POST /message/sendList/{instance}
 */
export async function sendList(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        message: 'Não autenticado' 
      });
    }

    const userId = req.user?.id;
    const { number, listMessage, options = {} } = req.body;

    if (!number || !listMessage) {
      return res.status(400).json({
        success: false,
        message: 'Número e configuração de lista são obrigatórios'
      });
    }

    // Validar configuração de lista
    if (!listMessage.title || !listMessage.description || !listMessage.sections || !Array.isArray(listMessage.sections)) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de lista inválida. Forneça title, description e um array de sections'
      });
    }

    // Buscar informações do servidor
    const server = await getUserServer(userId);
    if (!server || !server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta'
      });
    }

    const instanceId = server.instanceId || 'admin';
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;

    console.log(`Enviando lista para ${number}`);

    // Preparar payload conforme documentação
    const payload = {
      number: number,
      options: {
        delay: options.delay || 1200,
        presence: options.presence !== false,
        ...options
      },
      listMessage: listMessage
    };

    // Fazer a requisição para enviar a mensagem
    const response = await axios.post(
      `${apiUrl}/message/sendList/${instanceId}`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
          'apikey': apiToken
        },
        timeout: 15000
      }
    );

    // Retornar o resultado
    return res.json({
      success: true,
      sentMessageData: response.data
    });

  } catch (error) {
    console.error('Erro ao enviar lista:', error);
    
    const errorMessage = axios.isAxiosError(error) && error.response
      ? `Erro ${error.response.status}: ${error.message}`
      : `Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`;
    
    return res.status(500).json({
      success: false,
      message: 'Não foi possível enviar a lista',
      error: errorMessage
    });
  }
}

/**
 * Busca as informações do servidor do usuário
 */
async function getUserServer(userId: number) {
  try {
    // Importar o pool diretamente para evitar problemas com o ORM
    const { pool } = await import('../db');
    
    // Consulta direta para buscar as informações necessárias
    const query = `
      SELECT 
        us.id, 
        us.user_id as userId, 
        us.server_id as serverId,
        s.api_url as "apiUrl", 
        s.api_token as "apiToken",
        s.instance_id as "instanceId"
      FROM 
        user_servers us
      JOIN 
        servers s ON us.server_id = s.id
      WHERE 
        us.user_id = $1
      LIMIT 1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      console.log('Nenhum servidor encontrado para o usuário:', userId);
      return null;
    }
    
    return result.rows[0];
    
  } catch (error) {
    console.error('Erro ao buscar servidor do usuário:', error);
    return null;
  }
}

/**
 * Retorna a extensão padrão para um tipo de mídia
 */
function getDefaultExtension(mediaType: string): string {
  switch (mediaType.toLowerCase()) {
    case 'image':
      return 'jpg';
    case 'video':
      return 'mp4';
    case 'audio':
      return 'mp3';
    case 'document':
    default:
      return 'pdf';
  }
}