/**
 * Módulo para gerenciar conexões com a WhatsApp Cloud API (Meta)
 * Conecta diretamente com a API do Facebook Meta sem intermediários
 */

import { Request, Response } from 'express';
import { storage } from '../storage';

/**
 * Verifica o status da conexão WhatsApp Cloud API
 */
export async function checkMetaConnectionStatus(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const userId = req.user.id;
    
    // Buscar configurações do usuário
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se tem as configurações necessárias
    const hasMetaToken = user.metaApiToken && user.metaApiToken.length > 0;
    const hasBusinessId = user.metaBusinessAccountId && user.metaBusinessAccountId.length > 0;
    const hasPhoneId = user.metaPhoneNumberId && user.metaPhoneNumberId.length > 0;

    if (!hasMetaToken || !hasBusinessId || !hasPhoneId) {
      return res.json({
        connected: false,
        status: 'not_configured',
        message: 'Configurações da Meta API não encontradas. Configure nas Integrações.',
        hasMetaToken,
        hasBusinessId,
        hasPhoneId
      });
    }

    // Testar conexão com a Meta API
    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${user.metaBusinessAccountId}`, {
        headers: {
          'Authorization': `Bearer ${user.metaApiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const businessInfo = await response.json();
        return res.json({
          connected: true,
          status: 'connected',
          message: 'WhatsApp Cloud API conectado com sucesso',
          businessInfo: {
            id: businessInfo.id,
            name: businessInfo.name
          },
          phoneNumberId: user.metaPhoneNumberId
        });
      } else {
        const errorData = await response.json();
        return res.json({
          connected: false,
          status: 'connection_error',
          message: 'Erro ao conectar com a Meta API',
          error: errorData.error?.message || 'Erro desconhecido'
        });
      }
    } catch (apiError: any) {
      return res.json({
        connected: false,
        status: 'connection_error',
        message: 'Falha na conexão com a Meta API',
        error: apiError.message || 'Erro de rede'
      });
    }

  } catch (error: any) {
    console.error('Erro ao verificar status da Meta API:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
}

/**
 * Conecta com a WhatsApp Cloud API
 */
export async function connectMetaWhatsApp(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const userId = req.user.id;
    
    // Buscar configurações do usuário
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Verificar se tem as configurações necessárias
    if (!user.metaApiToken || !user.metaBusinessAccountId || !user.metaPhoneNumberId) {
      return res.status(400).json({
        error: 'Configurações da Meta API incompletas',
        message: 'Configure o Token, Business Account ID e Phone Number ID nas Integrações'
      });
    }

    // Testar conexão fazendo uma chamada simples para verificar o phone number
    try {
      const response = await fetch(`https://graph.facebook.com/v18.0/${user.metaPhoneNumberId}`, {
        headers: {
          'Authorization': `Bearer ${user.metaApiToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const phoneInfo = await response.json();
        
        // Atualizar status da conexão Meta no usuário
        await storage.updateUser(userId, {
          metaConnected: true,
          metaConnectedAt: new Date()
        });

        return res.json({
          connected: true,
          status: 'connected',
          message: 'WhatsApp Cloud API conectado com sucesso!',
          phoneInfo: {
            id: phoneInfo.id,
            display_phone_number: phoneInfo.display_phone_number,
            verified_name: phoneInfo.verified_name
          }
        });
      } else {
        const errorData = await response.json();
        return res.status(400).json({
          connected: false,
          error: 'Falha na conexão',
          message: errorData.error?.message || 'Erro ao conectar com a Meta API'
        });
      }
    } catch (apiError: any) {
      return res.status(500).json({
        connected: false,
        error: 'Erro de conexão',
        message: 'Não foi possível conectar com a Meta API',
        details: apiError.message
      });
    }

  } catch (error: any) {
    console.error('Erro ao conectar Meta WhatsApp:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
}

/**
 * Desconecta da WhatsApp Cloud API
 */
export async function disconnectMetaWhatsApp(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    const userId = req.user.id;
    
    // Atualizar status da conexão Meta no usuário
    await storage.updateUser(userId, {
      metaConnected: false,
      metaConnectedAt: null
    });

    res.json({
      connected: false,
      status: 'disconnected',
      message: 'WhatsApp Cloud API desconectado com sucesso'
    });

  } catch (error: any) {
    console.error('Erro ao desconectar Meta WhatsApp:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
}