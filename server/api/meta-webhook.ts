/**
 * Webhook para receber mensagens do WhatsApp Cloud API da Meta
 * Este webhook será chamado automaticamente quando mensagens forem recebidas
 */
import { Request, Response } from 'express';
import { pool } from '../db';
import axios from 'axios';
import { db } from '../db';
import { userServers, servers, userAiAgents } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// Token de verificação do webhook (deve ser configurado no Meta Developer Console)
const WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN || 'meu_token_webhook_123';

/**
 * Verificação do webhook (chamado pela Meta para validar o endpoint)
 */
export async function verifyWebhook(req: Request, res: Response) {
  try {
    // Aceitar tanto query params quanto body params
    const mode = req.query['hub.mode'] || req.body?.['hub.mode'];
    const token = req.query['hub.verify_token'] || req.body?.['hub.verify_token'];
    const challenge = req.query['hub.challenge'] || req.body?.['hub.challenge'];

    console.log('=== VERIFICAÇÃO WEBHOOK META ===');
    console.log('Query params:', req.query);
    console.log('Body params:', req.body);
    console.log('Mode:', mode);
    console.log('Token recebido:', token);
    console.log('Token esperado:', WEBHOOK_VERIFY_TOKEN);
    console.log('Challenge:', challenge);
    console.log('=================================');

    // Verificar se é uma requisição de verificação
    if (mode === 'subscribe') {
      if (token === WEBHOOK_VERIFY_TOKEN) {
        console.log('✅ Webhook Meta verificado com sucesso');
        // Retornar challenge sem modificação
        return res.status(200).send(challenge);
      } else {
        console.log('❌ Token inválido');
        return res.status(403).send('Forbidden');
      }
    }

    // Se não é verificação, pode ser uma mensagem normal
    console.log('📨 Possível mensagem recebida');
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Erro na verificação do webhook:', error);
    res.status(500).send('Internal Server Error');
  }
}

/**
 * Recebe mensagens do WhatsApp Cloud API
 */
export async function receiveWebhook(req: Request, res: Response) {
  try {
    console.log('Webhook Meta recebido:', JSON.stringify(req.body, null, 2));

    const body = req.body;

    // Verificar se é uma notificação de mensagem
    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            await processMessageChange(change.value);
          }
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Erro ao processar webhook Meta:', error);
    res.status(500).send('Internal Server Error');
  }
}

/**
 * Processa uma mudança de mensagem recebida do webhook
 */
async function processMessageChange(value: any) {
  try {
    console.log('Processando mudança de mensagem:', JSON.stringify(value, null, 2));

    // Processar mensagens recebidas
    if (value.messages) {
      for (const message of value.messages) {
        await saveIncomingMessage(message, value.metadata);
      }
    }

    // Processar status de mensagens enviadas
    if (value.statuses) {
      for (const status of value.statuses) {
        await updateMessageStatus(status);
      }
    }
  } catch (error) {
    console.error('Erro ao processar mudança de mensagem:', error);
  }
}

/**
 * Salva uma mensagem recebida no banco de dados e encaminha para o agente de IA
 */
async function saveIncomingMessage(message: any, metadata: any) {
  try {
    const contactPhone = message.from;
    const messageId = message.id;
    const timestamp = new Date(parseInt(message.timestamp) * 1000);
    const phoneNumberId = metadata?.phone_number_id;

    console.log(`✅ Salvando mensagem recebida de ${contactPhone}`);

    // Extrair conteúdo da mensagem baseado no tipo
    let content = '';
    let messageType = 'text';

    if (message.text) {
      content = message.text.body;
      messageType = 'text';
    } else if (message.image) {
      content = message.image.caption || '[Imagem]';
      messageType = 'image';
    } else if (message.audio) {
      content = '[Áudio]';
      messageType = 'audio';
    } else if (message.video) {
      content = message.video.caption || '[Vídeo]';
      messageType = 'video';
    } else if (message.document) {
      content = `[Documento] ${message.document.filename || 'Arquivo'}`;
      messageType = 'document';
    } else {
      content = '[Mensagem não suportada]';
      messageType = 'unknown';
    }

    // Encontrar o usuário baseado no phone_number_id
    const userInfo = await findUserByPhoneNumberId(phoneNumberId);
    if (!userInfo) {
      console.log(`⚠️ Usuário não encontrado para phone_number_id: ${phoneNumberId}`);
      return;
    }

    const { userId, userName, userUsername, aiAgentWebhookUrl, aiAgentName } = userInfo;

    // Salvar mensagem usando SQL nativo para evitar problemas do ORM
    const query = `
      INSERT INTO meta_chat_messages 
      (user_id, contact_phone, message_content, meta_message_id, from_me, message_type, created_at) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    
    await pool.query(query, [
      userId,
      contactPhone,
      content,
      messageId,
      false,
      messageType,
      new Date()
    ]);

    console.log(`🎉 Mensagem salva com sucesso: "${content.substring(0, 50)}..."`);

    // Encaminhar mensagem para o agente de IA se configurado
    if (aiAgentWebhookUrl && messageType === 'text') {
      await forwardMessageToAI(contactPhone, content, aiAgentWebhookUrl, aiAgentName, message, metadata, userId, userName || null, userUsername || null);
    }

  } catch (error) {
    console.error('❌ Erro ao salvar mensagem recebida:', error);
  }
}

/**
 * Encontra o usuário baseado no phone_number_id do Meta
 */
async function findUserByPhoneNumberId(phoneNumberId: string) {
  try {
    if (!phoneNumberId) {
      console.log('⚠️ phone_number_id não fornecido');
      return null;
    }

    console.log(`🔍 Buscando usuário para phone_number_id: ${phoneNumberId}`);

    // Buscar usuário que possui este phone_number_id e o agente específico associado
    // Priorizar cloudWebhookUrl para mensagens Cloud API, fallback para webhookUrl
    const userAgentQuery = `
      SELECT 
        us.user_id,
        u.name as user_name,
        u.username as user_username,
        COALESCE(sa.cloud_webhook_url, sa.webhook_url) as ai_agent_webhook_url,
        sa.cloud_webhook_url,
        sa.webhook_url,
        sa.name as ai_agent_name
      FROM user_servers us
      JOIN users u ON us.user_id = u.id
      JOIN user_ai_agents ua ON us.user_id = ua.user_id
      JOIN server_ai_agents sa ON ua.agent_id = sa.id
      WHERE us.meta_phone_number_id = $1
        AND us.meta_connected = true
        AND sa.active = true
      LIMIT 1
    `;

    const result = await pool.query(userAgentQuery, [phoneNumberId]);

    if (result.rows.length === 0) {
      console.log(`⚠️ Nenhum usuário ou agente encontrado para phone_number_id: ${phoneNumberId}`);
      
      // Fallback: buscar apenas o usuário sem agente específico
      const userOnlyQuery = `
        SELECT 
          us.user_id,
          u.name as user_name,
          u.username as user_username,
          null as ai_agent_webhook_url,
          null as ai_agent_name
        FROM user_servers us
        JOIN users u ON us.user_id = u.id
        WHERE us.meta_phone_number_id = $1
          AND us.meta_connected = true
        LIMIT 1
      `;
      
      const fallbackResult = await pool.query(userOnlyQuery, [phoneNumberId]);
      
      if (fallbackResult.rows.length === 0) {
        console.log(`⚠️ Nenhum usuário encontrado para phone_number_id: ${phoneNumberId}`);
        return null;
      }
      
      const fallbackRow = fallbackResult.rows[0];
      console.log(`⚠️ Usuário encontrado mas sem agente configurado: ${fallbackRow.user_id}`);
      
      return {
        userId: fallbackRow.user_id,
        userName: fallbackRow.user_name,
        userUsername: fallbackRow.user_username,
        aiAgentWebhookUrl: null,
        aiAgentName: null,
        cloudWebhookUrl: null,
        webhookUrl: null
      };
    }

    const row = result.rows[0];
    console.log(`✅ Usuário encontrado: ${row.user_id}, AI Agent: ${row.ai_agent_name || 'Não configurado'}`);
    
    // Log detalhado dos webhooks disponíveis
    if (row.cloud_webhook_url) {
      console.log(`🌐 Webhook Cloud configurado: ${row.cloud_webhook_url}`);
      console.log(`✅ Usando Webhook Cloud para mensagens Cloud API`);
    } else if (row.webhook_url) {
      console.log(`🔗 Webhook padrão disponível: ${row.webhook_url}`);
      console.log(`⚠️ Webhook Cloud não configurado, usando webhook padrão`);
    } else {
      console.log(`❌ Nenhum webhook configurado no agente`);
    }
    
    console.log(`📍 Webhook final selecionado: ${row.ai_agent_webhook_url || 'Não configurado'}`);

    return {
      userId: row.user_id,
      userName: row.user_name,
      userUsername: row.user_username,
      aiAgentWebhookUrl: row.ai_agent_webhook_url,
      aiAgentName: row.ai_agent_name,
      cloudWebhookUrl: row.cloud_webhook_url,
      webhookUrl: row.webhook_url
    };

  } catch (error) {
    console.error('❌ Erro ao buscar usuário por phone_number_id:', error);
    return null;
  }
}

/**
 * Encaminha mensagem para o webhook do agente de IA
 */
async function forwardMessageToAI(
  contactPhone: string, 
  content: string, 
  webhookUrl: string, 
  agentName: string,
  originalMessage: any,
  metadata: any,
  userId: number,
  userName: string,
  userUsername: string
) {
  try {
    if (!webhookUrl) {
      console.log('⚠️ Webhook do agente de IA não configurado');
      return;
    }

    console.log(`🤖 Encaminhando mensagem para agente de IA: ${agentName || 'Sem nome'}`);
    console.log(`📍 Webhook URL: ${webhookUrl}`);
    console.log(`👤 Usuário: ${userName || userUsername || 'Sem nome'} (ID: ${userId})`);

    // Payload padronizado para o agente de IA com informações completas do usuário
    const payload = {
      user_id: userId, // ID do usuário conectado
      user_name: userName, // Nome do usuário
      user_username: userUsername, // Username do usuário
      source: 'whatsapp_cloud',
      from: contactPhone,
      message: content,
      messageType: 'text',
      timestamp: new Date().toISOString(),
      metadata: {
        messageId: originalMessage.id,
        phoneNumberId: metadata?.phone_number_id,
        agentName: agentName,
        platform: 'whatsapp_business_cloud',
        userId: userId, // ID do usuário também nos metadados
        userName: userName, // Nome do usuário nos metadados
        userUsername: userUsername // Username nos metadados
      },
      originalPayload: {
        message: originalMessage,
        metadata: metadata
      }
    };

    // Fazer requisição para o webhook do agente de IA
    const response = await axios.post(webhookUrl, payload, {
      timeout: 10000, // 10 segundos
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LigAI-WhatsApp-Cloud/1.0',
        'X-User-ID': userId.toString(),
        'X-User-Name': userName || userUsername || 'Sem nome'
      }
    });

    console.log(`✅ Mensagem encaminhada com sucesso para agente de IA`);
    console.log(`📊 Status de resposta: ${response.status}`);

    // Log da resposta do agente de IA (se houver)
    if (response.data) {
      console.log(`🤖 Resposta do agente: ${JSON.stringify(response.data)}`);
    }

  } catch (error) {
    console.error('❌ Erro ao encaminhar mensagem para agente de IA:', error);
    
    if (axios.isAxiosError(error)) {
      console.error(`📡 Status: ${error.response?.status}`);
      console.error(`📡 Dados: ${JSON.stringify(error.response?.data)}`);
    }
  }
}

/**
 * Atualiza o status de uma mensagem enviada
 */
async function updateMessageStatus(status: any) {
  try {
    console.log(`Atualizando status da mensagem ${status.id} para ${status.status}`);

    // Atualizar usando SQL nativo
    const query = `
      UPDATE meta_chat_messages 
      SET status = $1, updated_at = $2
      WHERE meta_message_id = $3
    `;
    
    await pool.query(query, [status.status, new Date(), status.id]);

  } catch (error) {
    console.error('Erro ao atualizar status da mensagem:', error);
  }
}