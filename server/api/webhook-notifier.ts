/**
 * Módulo para notificar webhooks externos quando eventos importantes ocorrerem
 * Por exemplo, quando um QR Code for gerado com sucesso
 */

import axios from 'axios';
import { db } from "../db";
import { servers } from "@shared/schema";
import { eq } from "drizzle-orm";
import https from 'https';
import http from 'http';
import url from 'url';

/**
 * Envia uma notificação GET para o webhook de configuração da instância Evolution configurado no servidor
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
    console.log(`Buscando informações do servidor ${serverId} para Webhook de Configuração Instancia Evolution`);
    
    const [server] = await db
      .select()
      .from(servers)
      .where(eq(servers.id, serverId));
    
    if (!server) {
      console.log(`Servidor ${serverId} não encontrado`);
      return false;
    }
    
    console.log(`Webhook de Configuração Instancia Evolution configurado: ${server.contactsWebhookUrl}`);
    
    if (!server.contactsWebhookUrl) {
      console.log(`Webhook de Configuração Instancia Evolution não configurado para o servidor ${serverId}`);
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
    
    console.log(`Enviando requisição GET para Webhook de Configuração Instancia Evolution: ${fullUrl}`);
    
    // Fazer a requisição GET para o webhook usando módulos nativos
    // Isso contorna possíveis problemas com TLS/certificados que o Axios pode ter
    return new Promise((resolve) => {
      try {
        console.log(`Tentando notificar webhook usando módulo nativo: ${fullUrl}`);
        
        // Parsear a URL para determinar o protocolo
        const parsedUrl = url.parse(fullUrl);
        const isHttps = parsedUrl.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        // Configurar a requisição
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || (isHttps ? 443 : 80),
          path: parsedUrl.path,
          method: 'GET',
          headers: {
            'User-Agent': 'LigAI-Webhook-Notifier/1.0',
            'Accept': 'application/json, text/plain, */*'
          },
          timeout: 10000, // 10 segundos de timeout
          rejectUnauthorized: false // Ignora erros de certificado (importante para testes)
        };
        
        // Criar e enviar a requisição
        const req = httpModule.request(options, (res) => {
          let responseData = '';
          
          // Coletar dados da resposta
          res.on('data', (chunk) => {
            responseData += chunk;
          });
          
          // Processar resposta completa
          res.on('end', () => {
            console.log(`Webhook notificado com sucesso! Status: ${res.statusCode}`);
            console.log(`Resposta do webhook: ${responseData.substring(0, 200)}`);
            
            // Se a resposta foi bem-sucedida (2xx)
            resolve(res.statusCode! >= 200 && res.statusCode! < 300);
          });
        });
        
        // Configurar timeout
        req.setTimeout(10000, () => {
          console.error('Timeout ao enviar webhook');
          req.destroy(new Error('Timeout'));
          resolve(false);
        });
        
        // Tratar erros
        req.on('error', (err) => {
          console.error('Erro ao enviar webhook:', err.message);
          
          if (err.message.includes('ENOTFOUND')) {
            console.log(`Domínio não encontrado: ${webhookUrl}`);
          } else if (err.message.includes('ECONNREFUSED')) {
            console.log(`Conexão recusada pelo servidor: ${webhookUrl}`);
          } else if (err.message.includes('CERT_HAS_EXPIRED')) {
            console.log(`Certificado expirado no servidor: ${webhookUrl}`);
          } else if (err.message.includes('UNABLE_TO_VERIFY_LEAF_SIGNATURE')) {
            console.log(`Problemas com certificado: ${webhookUrl}`);
          }
          
          resolve(false);
        });
        
        // Finalizar a requisição
        req.end();
        
      } catch (nativeError: any) {
        console.error('Erro durante criação da requisição nativa:', nativeError.message);
        resolve(false);
      }
    });
  } catch (error: any) {
    console.error('Erro ao preparar notificação de webhook:', error.message);
    return false;
  }
}