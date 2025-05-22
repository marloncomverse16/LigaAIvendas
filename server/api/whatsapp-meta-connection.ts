/**
 * Módulo para gerenciar conexões com a WhatsApp Cloud API (Meta)
 * Usando a mesma lógica que funciona na aba Conexões
 */

import { Request, Response } from 'express';

/**
 * Verifica o status da conexão WhatsApp Cloud API
 * Usa exatamente a mesma lógica da aba Conexões que está funcionando
 */
export async function checkMetaConnectionStatus(req: Request, res: Response) {
  try {
    // Usar a mesma rota que funciona na aba Conexões
    const { checkMetaConnectionStatus: originalCheck } = await import('./user-meta-connections');
    return await originalCheck(req, res);
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
 * Usa a mesma lógica que funciona na aba Conexões
 */
export async function connectMetaWhatsApp(req: Request, res: Response) {
  try {
    // Usar a mesma rota que funciona na aba Conexões
    const { connectToMeta } = await import('./user-meta-connections');
    return await connectToMeta(req, res);
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
 * Usa a mesma lógica que funciona na aba Conexões
 */
export async function disconnectMetaWhatsApp(req: Request, res: Response) {
  try {
    // Usar a mesma rota que funciona na aba Conexões
    const { disconnectFromMeta } = await import('./user-meta-connections');
    return await disconnectFromMeta(req, res);
  } catch (error: any) {
    console.error('Erro ao desconectar Meta WhatsApp:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      details: error.message 
    });
  }
}