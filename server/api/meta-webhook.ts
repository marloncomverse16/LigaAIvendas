/**
 * Webhook para receber mensagens do WhatsApp Cloud API da Meta
 * Este webhook será chamado automaticamente quando mensagens forem recebidas
 */
import { Request, Response } from 'express';
import { pool } from '../db';

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
 * Salva uma mensagem recebida no banco de dados
 */
async function saveIncomingMessage(message: any, metadata: any) {
  try {
    const contactPhone = message.from;
    const messageId = message.id;
    const timestamp = new Date(parseInt(message.timestamp) * 1000);

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

    // Usuário admin (ID: 2) - pode ser configurado posteriormente
    const userId = 2;

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

  } catch (error) {
    console.error('❌ Erro ao salvar mensagem recebida:', error);
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