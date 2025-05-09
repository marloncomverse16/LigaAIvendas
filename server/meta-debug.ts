/**
 * Módulo temporário para diagnóstico da API Meta
 */

import { Request, Response } from 'express';
import { getMetaApiTemplates } from './meta-whatsapp-api';
import { db } from './db';
import { settings } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Rota de diagnóstico para verificar a conexão com a Meta API
 * Este endpoint não requer autenticação para fins de depuração
 */
export async function checkMetaApiConnection(req: Request, res: Response) {
  try {
    const userId = parseInt(req.query.userId as string) || 2; // Default para usuário ID 2
    
    console.log(`DIAGNÓSTICO: Verificando conexão com Meta API para usuário ${userId}`);
    
    // Buscar configurações do usuário
    const [userSettings] = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId));
    
    if (!userSettings) {
      return res.status(404).json({
        success: false,
        message: 'Configurações do usuário não encontradas'
      });
    }
    
    // Verificar se o usuário tem as configurações necessárias
    const hasToken = !!userSettings.whatsappMetaToken;
    const hasBusinessId = !!userSettings.whatsappMetaBusinessId;
    const apiVersion = userSettings.whatsappMetaApiVersion || 'v18.0';
    
    console.log(`DIAGNÓSTICO: Configurações: hasToken=${hasToken}, hasBusinessId=${hasBusinessId}, apiVersion=${apiVersion}`);
    
    if (!hasToken || !hasBusinessId) {
      return res.status(400).json({
        success: false,
        message: 'Configurações incompletas da Meta API'
      });
    }
    
    // Tentar uma chamada direta para a API Graph do Facebook para verificar as credenciais
    try {
      const testEndpoint = `https://graph.facebook.com/${apiVersion}/${userSettings.whatsappMetaBusinessId}`;
      console.log(`DIAGNÓSTICO: Verificando conexão com endpoint: ${testEndpoint}`);
      
      const businessResponse = await fetch(testEndpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${userSettings.whatsappMetaToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!businessResponse.ok) {
        const errorData = await businessResponse.json();
        return res.status(400).json({
          success: false,
          message: 'Erro ao verificar conta de negócio',
          error: errorData.error?.message || 'Erro desconhecido',
          status: businessResponse.status,
          response: errorData
        });
      }
      
      const businessData = await businessResponse.json();
      
      // Se a verificação da conta de negócio foi bem-sucedida, tentar obter os templates
      try {
        console.log(`DIAGNÓSTICO: Obtendo templates da Meta API`);
        const templatesResult = await getMetaApiTemplates(
          userSettings.whatsappMetaToken,
          userSettings.whatsappMetaBusinessId,
          apiVersion
        );
        
        if (!templatesResult.success) {
          return res.status(400).json({
            success: false,
            message: 'Erro ao obter templates',
            error: templatesResult.error,
            businessData
          });
        }
        
        return res.json({
          success: true,
          message: 'Conexão com Meta API verificada com sucesso',
          businessData,
          templates: templatesResult.templates,
          templatesCount: templatesResult.templates?.length || 0
        });
      } catch (templatesError: any) {
        return res.status(500).json({
          success: false,
          message: 'Erro ao obter templates',
          error: templatesError.message,
          businessData
        });
      }
    } catch (businessError: any) {
      return res.status(500).json({
        success: false,
        message: 'Erro ao verificar conta de negócio',
        error: businessError.message
      });
    }
  } catch (error: any) {
    console.error('DIAGNÓSTICO: Erro geral:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar conexão com Meta API',
      error: error.message
    });
  }
}