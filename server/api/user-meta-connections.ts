/**
 * Controladores para conexão direta com a Meta API para WhatsApp Cloud API
 * Usando configurações específicas do usuário em vez do servidor
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { MetaWhatsAppAPI } from '../meta-whatsapp-api';
import userSettingsService from '../user-settings-service';
import * as metaApiService from '../meta-api-service';

// Schema de validação para conexão da Meta API
const metaConnectionSchema = z.object({
  phoneNumberId: z.string().min(10).max(50)
});

// Schema para atualização das configurações da Meta API
const metaSettingsSchema = z.object({
  whatsappMetaToken: z.string().min(10).optional(),
  whatsappMetaBusinessId: z.string().min(5).optional(),
  whatsappMetaApiVersion: z.string().min(3).optional()
});

// Armazenamento temporário para status de conexão por usuário
const metaConnections: Record<number, { 
  connected: boolean, 
  phoneNumberId?: string,
  businessId?: string,
  businessName?: string,
  businessPhoneNumber?: string,
  apiVersion?: string,
  lastChecked?: Date 
}> = {};

/**
 * Controller para atualizar configurações da Meta API
 */
export async function updateMetaSettings(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Não autenticado' });
  }

  try {
    const userId = req.user!.id;
    const validatedData = metaSettingsSchema.parse(req.body);

    // Atualizar configurações
    const updateResult = await userSettingsService.updateWhatsAppMetaSettings(
      userId,
      validatedData
    );

    if (!updateResult.success) {
      return res.status(400).json({
        message: 'Não foi possível atualizar as configurações',
        error: updateResult.error
      });
    }

    // Remover dados sensíveis antes de retornar
    const settings = updateResult.data;
    if (settings?.whatsappMetaToken) {
      settings.whatsappMetaToken = settings.whatsappMetaToken.substring(0, 5) + '...';
    }

    return res.json({
      success: true,
      message: 'Configurações atualizadas com sucesso',
      settings
    });
  } catch (error: any) {
    console.error('Erro ao atualizar configurações da Meta API:', error);
    return res.status(500).json({
      message: 'Erro ao atualizar configurações',
      error: error.message
    });
  }
}

/**
 * Controller para obter configurações da Meta API
 */
export async function getMetaSettings(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Não autenticado' });
  }

  try {
    const userId = req.user!.id;
    const settingsResult = await userSettingsService.getUserSettings(userId);

    if (!settingsResult.success) {
      return res.status(400).json({
        message: 'Não foi possível obter as configurações',
        error: settingsResult.error
      });
    }

    const settings = settingsResult.data;
    
    // Remover dados sensíveis antes de retornar
    if (settings?.whatsappMetaToken) {
      settings.whatsappMetaToken = settings.whatsappMetaToken.substring(0, 5) + '...';
    }

    return res.json({
      success: true,
      settings
    });
  } catch (error: any) {
    console.error('Erro ao obter configurações da Meta API:', error);
    return res.status(500).json({
      message: 'Erro ao obter configurações',
      error: error.message
    });
  }
}

/**
 * Controller para conectar com a API da Meta usando configurações do usuário
 */
export async function connectWhatsAppMeta(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Não autenticado' });
  }

  try {
    const userId = req.user!.id;
    const validatedData = metaConnectionSchema.parse(req.body);
    const { phoneNumberId } = validatedData;

    // Obter configurações do usuário
    const settingsResult = await userSettingsService.getUserSettings(userId);
    
    if (!settingsResult.success || !settingsResult.data) {
      return res.status(404).json({ 
        message: 'Configurações não encontradas'
      });
    }

    const settings = settingsResult.data;

    // Verificar se o usuário tem as configurações necessárias para Meta API
    if (!settings.whatsappMetaToken || !settings.whatsappMetaBusinessId) {
      return res.status(400).json({
        message: 'Configurações da API da Meta não encontradas. Configure o token e ID de negócio nas configurações.'
      });
    }

    const apiVersion = settings.whatsappMetaApiVersion || 'v18.0';
    console.log(`Conectando com Meta API. Token: ${settings.whatsappMetaToken.substring(0, 5)}... BusinessID: ${settings.whatsappMetaBusinessId}, PhoneID: ${phoneNumberId}, APIVersion: ${apiVersion}`);
    
    // Criar cliente da Meta API
    const metaClient = new MetaWhatsAppAPI(
      settings.whatsappMetaToken,
      settings.whatsappMetaBusinessId,
      phoneNumberId, 
      apiVersion
    );

    // Tentar conectar
    const connectionResult = await metaClient.connect(phoneNumberId);
    
    if (!connectionResult.connected) {
      return res.status(400).json({
        message: connectionResult.error || 'Não foi possível conectar à Meta API',
        error: connectionResult.error
      });
    }

    // Armazenar status de conexão
    metaConnections[userId] = {
      connected: true,
      phoneNumberId: connectionResult.phoneNumberId,
      businessId: connectionResult.businessId,
      businessName: connectionResult.businessName,
      businessPhoneNumber: connectionResult.businessPhoneNumber,
      apiVersion: connectionResult.apiVersion,
      lastChecked: new Date()
    };

    // Atualizar o phoneNumberId no banco de dados usando nosso serviço dedicado
    const updateResult = await metaApiService.updateMetaPhoneNumberId(userId, phoneNumberId);
    
    if (!updateResult.success) {
      console.error('Erro ao atualizar meta_phone_number_id:', updateResult.error);
    }

    res.json({
      success: true,
      message: 'Conectado com sucesso à Meta API',
      ...connectionResult
    });

  } catch (error: any) {
    console.error('Erro ao conectar com Meta API:', error);
    res.status(500).json({ 
      message: 'Erro ao conectar com Meta API',
      error: error.message || 'Erro desconhecido'
    });
  }
}

/**
 * Controller para verificar status da conexão com a Meta API
 */
export async function checkMetaConnectionStatus(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Não autenticado' });
  }

  try {
    const userId = req.user!.id;
    
    // Verificar se já existe um status de conexão em cache
    // e se foi atualizado há menos de 30 segundos
    const existingStatus = metaConnections[userId];
    const now = new Date();
    
    if (existingStatus && existingStatus.lastChecked && 
        (now.getTime() - existingStatus.lastChecked.getTime() < 30000)) {
      return res.json(existingStatus);
    }
    
    // Obter configurações do usuário
    const settingsResult = await userSettingsService.getUserSettings(userId);
    
    if (!settingsResult.success || !settingsResult.data) {
      return res.json({ 
        connected: false,
        message: 'Configurações não encontradas'
      });
    }

    const settings = settingsResult.data;

    // Verificar configurações da Meta API
    if (!settings.whatsappMetaToken || !settings.whatsappMetaBusinessId) {
      return res.json({ 
        connected: false,
        message: 'API da Meta não configurada nas configurações'
      });
    }

    // Obter ID do número de telefone usando nosso serviço dedicado
    const metaPhoneResult = await metaApiService.getMetaPhoneNumberId(userId);
    
    if (!metaPhoneResult.success || !metaPhoneResult.phoneNumberId) {
      return res.json({
        connected: false,
        message: 'ID do número de telefone não configurado'
      });
    }
    
    const phoneNumberId = metaPhoneResult.phoneNumberId;

    // Criar cliente da Meta API e verificar conexão
    const metaClient = new MetaWhatsAppAPI(
      settings.whatsappMetaToken,
      settings.whatsappMetaBusinessId,
      phoneNumberId,
      settings.whatsappMetaApiVersion || 'v18.0'
    );

    const connectionStatus = await metaClient.checkConnection();
    
    // Atualizar cache
    metaConnections[userId] = {
      ...connectionStatus,
      lastChecked: new Date()
    };

    res.json(connectionStatus);
  } catch (error: any) {
    console.error('Erro ao verificar status da Meta API:', error);
    res.status(500).json({
      connected: false,
      message: 'Erro ao verificar status da conexão',
      error: error.message
    });
  }
}

/**
 * Controller para desconectar da Meta API
 */
export async function disconnectWhatsAppMeta(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Não autenticado' });
  }

  try {
    const userId = req.user!.id;
    
    // Remover PhoneNumberID da tabela user_servers usando nosso serviço dedicado
    const resetResult = await metaApiService.resetMetaConnection(userId);
    
    if (!resetResult.success) {
      console.error('Erro ao resetar conexão Meta:', resetResult.error);
    }
    
    // Limpar cache
    if (metaConnections[userId]) {
      delete metaConnections[userId];
    }

    res.json({
      success: true,
      message: 'Desconectado com sucesso da Meta API'
    });
  } catch (error: any) {
    console.error('Erro ao desconectar da Meta API:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao desconectar',
      error: error.message
    });
  }
}

/**
 * Controller para enviar mensagem pelo WhatsApp usando a Meta API
 */
export async function sendMetaWhatsAppMessage(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Não autenticado' });
  }

  try {
    const userId = req.user!.id;
    const { to, message, type = 'text' } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({ 
        message: 'Destinatário (to) e mensagem (message) são obrigatórios'
      });
    }

    // Obter configurações do usuário
    const settingsResult = await userSettingsService.getUserSettings(userId);
    
    if (!settingsResult.success || !settingsResult.data) {
      return res.status(404).json({ 
        message: 'Configurações não encontradas'
      });
    }

    const settings = settingsResult.data;

    // Verificar configurações da Meta API
    if (!settings.whatsappMetaToken || !settings.whatsappMetaBusinessId) {
      return res.status(400).json({ 
        message: 'API da Meta não configurada nas configurações'
      });
    }

    // Obter ID do número de telefone usando nosso serviço dedicado
    const metaPhoneResult = await metaApiService.getMetaPhoneNumberId(userId);
    
    if (!metaPhoneResult.success || !metaPhoneResult.phoneNumberId) {
      return res.status(400).json({
        message: 'ID do número de telefone não configurado'
      });
    }
    
    const phoneNumberId = metaPhoneResult.phoneNumberId;

    // Criar cliente da Meta API
    const metaClient = new MetaWhatsAppAPI(
      settings.whatsappMetaToken,
      settings.whatsappMetaBusinessId,
      phoneNumberId,
      settings.whatsappMetaApiVersion || 'v18.0'
    );

    // Formatar a mensagem de acordo com o tipo
    let whatsappMessage: any = { to };
    
    if (type === 'text') {
      whatsappMessage = {
        to,
        type: 'text',
        text: {
          body: message
        }
      };
    } else if (type === 'template') {
      whatsappMessage = {
        to,
        type: 'template',
        template: {
          name: message.template,
          language: {
            code: message.language || 'pt_BR'
          },
          components: message.components
        }
      };
    }

    // Enviar mensagem
    const response = await metaClient.sendMessage(whatsappMessage);
    
    res.json({
      success: true,
      message: 'Mensagem enviada com sucesso',
      messageId: response.messages?.[0]?.id,
      response
    });
  } catch (error: any) {
    console.error('Erro ao enviar mensagem pelo WhatsApp:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar mensagem',
      error: error.message
    });
  }
}