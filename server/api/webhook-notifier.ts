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
    const [server] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, serverId));
    
    if (!server || !server.contactsWebhookUrl) {
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
    
    // Construir a URL com os parâmetros
    const webhookUrl = `${server.contactsWebhookUrl}?${params.toString()}`;
    
    console.log(`Notificando webhook de contatos: ${webhookUrl}`);
    
    // Fazer a requisição GET para o webhook
    const response = await axios.get(webhookUrl, {
      timeout: 5000 // 5 segundos de timeout
    });
    
    console.log(`Resposta do webhook de contatos: ${response.status}`, response.data);
    
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.error('Erro ao notificar webhook de contatos:', error);
    return false;
  }
}