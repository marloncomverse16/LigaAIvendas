import { Request, Response } from 'express';
import { getUserServer } from './meta-api-service';

/**
 * Verifica o status da conexão com a Meta API para o usuário autenticado
 */
export async function checkMetaConnectionStatus(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: 'Não autenticado' });
  }

  try {
    const userId = req.user!.id;
    
    // Obter informações do servidor do usuário com configurações da Meta API
    const serverResult = await getUserServer(userId);
    
    // Se temos um phoneNumberId, a conexão está ativa
    const isConnected = serverResult.success && !!serverResult.phoneNumberId;
    
    return res.json({
      connected: isConnected,
      phoneNumberId: serverResult.phoneNumberId || null,
      businessId: serverResult.businessId || null,
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Erro ao verificar status da conexão Meta:', error);
    return res.status(500).json({ 
      message: 'Erro ao verificar status da conexão',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}