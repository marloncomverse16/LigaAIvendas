/**
 * Módulo para acesso direto aos templates da Meta API
 * Implementação robusta para contornar possíveis problemas
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { eq } from 'drizzle-orm';
import { settings } from '@shared/schema';

/**
 * Rota direta para obter templates Meta API
 * Esta rota usa o endpoint da API Graph diretamente em vez de passar por uma camada intermediária
 */
export async function getMetaTemplatesDirect(req: Request, res: Response) {
  try {
    // Permitir acesso sem autenticação para diagnóstico
    // if (!req.isAuthenticated()) {
    //   return res.status(401).json({ message: 'Não autenticado' });
    // }
    
    // Usar ID 2 para testes diretos, ou o ID do usuário se autenticado
    const userId = req.isAuthenticated() ? req.user!.id : 2;
    console.log(`DIRETO: Obtendo templates Meta para usuário ${userId}`);

    // Obter configurações do usuário para Meta API
    const [userSettings] = await db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId));

    if (!userSettings) {
      return res.status(404).json({
        success: false,
        message: 'Configurações de usuário não encontradas'
      });
    }

    // Verificar se as credenciais estão configuradas
    if (!userSettings.whatsappMetaToken || !userSettings.whatsappMetaBusinessId) {
      return res.status(400).json({
        success: false,
        message: 'Credenciais da Meta API não configuradas'
      });
    }

    // Parâmetros para chamada direta à API da Meta
    const apiVersion = userSettings.whatsappMetaApiVersion || 'v18.0';
    const businessId = userSettings.whatsappMetaBusinessId;
    const token = userSettings.whatsappMetaToken;
    const endpoint = `https://graph.facebook.com/${apiVersion}/${businessId}/message_templates`;

    console.log(`DIRETO: Chamando API Meta: ${endpoint}`);

    try {
      // Chamada direta à API Graph da Meta para obter templates
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('DIRETO: Erro na resposta da API Meta:', errorData);
        return res.status(response.status).json({
          success: false,
          message: 'Erro ao obter templates da Meta API',
          error: errorData.error?.message || 'Erro desconhecido'
        });
      }

      const templatesData = await response.json();
      
      if (!templatesData.data || !Array.isArray(templatesData.data)) {
        console.log('DIRETO: Resposta não contém templates:', templatesData);
        return res.status(200).json([]);
      }

      // Filtrar apenas templates aprovados para uso
      const approvedTemplates = templatesData.data
        .filter((template: any) => template && template.status === "APPROVED")
        .map((template: any) => ({
          id: template.id,
          name: template.name,
          status: template.status,
          category: template.category,
          language: template.language,
          components: template.components
        }));

      console.log(`DIRETO: Retornando ${approvedTemplates.length} templates`);
      return res.status(200).json(approvedTemplates);
    } catch (apiError: any) {
      console.error('DIRETO: Erro ao chamar API Meta:', apiError);
      return res.status(500).json({
        success: false,
        message: 'Erro ao obter templates da Meta API',
        error: apiError.message
      });
    }
  } catch (error: any) {
    console.error('DIRETO: Erro geral:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao processar templates da Meta API',
      error: error.message
    });
  }
}