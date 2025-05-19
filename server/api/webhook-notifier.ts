/**
 * Módulo para notificar webhooks externos quando eventos importantes ocorrerem
 * Por exemplo, quando um QR Code for gerado com sucesso
 */

import axios from 'axios';
import { db } from "../db";
import { servers } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Envia uma notificação GET para o webhook de contatos configurado no servidor
 * @param serverId ID do servidor
 * @param userId ID do usuário
 * @param username Nome do usuário
 * @param eventType Tipo de evento (ex: 'qrcode_generated', 'connected', etc)
 * @param details Detalhes adicionais do evento
 */
export async function notifyContactsWebhook(
  serverId: number,
  userId: number,
  username: string,
  eventType: string,
  details?: any
): Promise<boolean> {
  try {
    // Buscar as informações do servidor, incluindo a URL do webhook
    console.log(`Buscando informações do servidor ${serverId} para webhook de contatos`);
    
    const [server] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, serverId));
    
    if (!server) {
      console.log(`Servidor ${serverId} não encontrado`);
      return false;
    }
    
    console.log(`Webhook de contatos configurado: ${server.contactsWebhookUrl}`);
    
    if (!server.contactsWebhookUrl) {
      console.log(`Webhook de contatos não configurado para o servidor ${serverId}`);
      return false;
    }
    
    // Preparar os parâmetros da requisição GET
    const params = new URLSearchParams({
      event: eventType,
      user_id: userId.toString(),
      username,
      server_id: serverId.toString(),
      server_name: server.name || 'Unknown',
      timestamp: new Date().toISOString(),
      system_url: process.env.PUBLIC_URL || 'https://liguia.replit.app',
      // Adicionar detalhes específicos do evento, se fornecidos
      ...(details ? { details: JSON.stringify(details) } : {})
    });
    
    // Formatar a URL do webhook corretamente
    let webhookUrl = server.contactsWebhookUrl;
    
    // Certificar que a URL tem um protocolo
    if (!webhookUrl.startsWith('http://') && !webhookUrl.startsWith('https://')) {
      webhookUrl = 'https://' + webhookUrl;
    }
    
    // Adicionar os parâmetros de consulta
    const separator = webhookUrl.includes('?') ? '&' : '?';
    const fullUrl = `${webhookUrl}${separator}${params.toString()}`;
    
    console.log(`Enviando requisição GET para webhook de contatos: ${fullUrl}`);
    
    // Fazer a requisição GET para o webhook
    try {
      const response = await axios.get(fullUrl, {
        timeout: 8000, // 8 segundos de timeout
        headers: {
          'User-Agent': 'LiguIA-Webhook-Notifier/1.0',
          'Accept': 'application/json, text/plain, */*'
        }
      });
      
      console.log(`Resposta do webhook de contatos (${response.status}):`, 
                  typeof response.data === 'object' ? JSON.stringify(response.data).substring(0, 200) : String(response.data).substring(0, 200));
      
      return response.status >= 200 && response.status < 300;
    } catch (requestError: any) {
      // Log mais detalhado do erro da requisição
      console.error('Erro ao fazer requisição para o webhook:', {
        error: requestError.message,
        status: requestError.response?.status,
        data: requestError.response?.data,
        url: fullUrl
      });
      
      // Verificar possíveis erros de certificado ou conexão
      if (requestError.code === 'ENOTFOUND') {
        console.log(`Domínio não encontrado: ${webhookUrl}`);
      } else if (requestError.code === 'ECONNREFUSED') {
        console.log(`Conexão recusada pelo servidor: ${webhookUrl}`);
      } else if (requestError.code === 'CERT_HAS_EXPIRED') {
        console.log(`Certificado expirado no servidor: ${webhookUrl}`);
      }
      
      return false;
    }
  } catch (error: any) {
    console.error('Erro ao preparar notificação de webhook:', error.message);
    return false;
  }
}