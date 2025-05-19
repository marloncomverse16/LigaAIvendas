/**
 * Módulo específico para sincronização de contatos com a Evolution API
 * Implementa a solução recomendada usando o endpoint /chat/findContacts/{instance}
 */

import { Request, Response } from 'express';
import axios from 'axios';
import { pool } from '../db';

/**
 * Sincroniza contatos do WhatsApp usando o endpoint oficial recomendado
 * POST /chat/findContacts/{instance}
 */
export async function syncWhatsAppContacts(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ 
        success: false, 
        message: 'Não autenticado' 
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'Usuário não identificado' 
      });
    }

    // Buscar informações do servidor
    const server = await getUserServer(userId);
    if (!server) {
      return res.status(404).json({
        success: false,
        message: 'Servidor não configurado para este usuário'
      });
    }

    // Verificar se temos configurações completas
    if (!server.apiUrl || !server.apiToken) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta. Verifique a URL da API e token.'
      });
    }

    // Iniciar sincronização
    console.log('[SYNC] Iniciando sincronização de contatos do WhatsApp...');
    
    const instanceId = server.instanceId || 'admin';
    
    // Realizar solicitação POST para /chat/findContacts/{instance}
    const endpoint = `${server.apiUrl}/chat/findContacts/${instanceId}`;
    console.log(`[SYNC] Usando endpoint: ${endpoint}`);
    
    const response = await axios.post(
      endpoint, 
      {}, // Corpo vazio para obter todos os contatos
      {
        headers: {
          'Authorization': `Bearer ${server.apiToken}`,
          'apikey': server.apiToken,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // Timeout maior para operações de sincronização
      }
    );

    // Verificar se recebemos uma resposta válida
    if (!response.data) {
      return res.status(500).json({
        success: false,
        message: 'Resposta vazia do servidor'
      });
    }

    // Processar e formatar os contatos recebidos
    let contacts = [];
    
    if (Array.isArray(response.data)) {
      // Se a resposta for um array, assumimos que já são os contatos
      contacts = formatContacts(response.data);
    } else if (response.data.contacts && Array.isArray(response.data.contacts)) {
      // Se a resposta tiver um campo 'contacts', usamos ele
      contacts = formatContacts(response.data.contacts);
    } else if (response.data.response && Array.isArray(response.data.response)) {
      // Alguns endpoints retornam os contatos dentro de 'response'
      contacts = formatContacts(response.data.response);
    } else {
      // Tentar encontrar qualquer array na resposta
      const arrays = findContactArrays(response.data);
      if (arrays.length > 0) {
        // Usar o maior array encontrado
        const largestArray = arrays.reduce((a, b) => a.length > b.length ? a : b);
        contacts = formatContacts(largestArray);
      }
    }
    
    console.log(`[SYNC] Sincronizados ${contacts.length} contatos`);

    return res.json({
      success: true,
      message: `${contacts.length} contatos sincronizados com sucesso.`,
      contacts: contacts
    });

  } catch (error) {
    console.error('[SYNC] Erro na sincronização:', error);
    
    const statusCode = axios.isAxiosError(error) && error.response ? error.response.status : 500;
    const errorMessage = axios.isAxiosError(error) && error.response ? 
      `Erro ${statusCode}: ${error.message}` : 
      `Erro: ${error instanceof Error ? error.message : 'Desconhecido'}`;
    
    return res.status(statusCode).json({
      success: false,
      message: 'Não foi possível sincronizar os contatos',
      error: errorMessage
    });
  }
}

/**
 * Busca as informações do servidor do usuário
 */
async function getUserServer(userId: number) {
  try {
    // Consulta direta para buscar as informações necessárias
    const query = `
      SELECT 
        us.id, 
        us.user_id as userId, 
        us.server_id as serverId,
        s.name as name,
        s.api_url as "apiUrl", 
        s.api_token as "apiToken",
        s.instance_id as "instanceId"
      FROM 
        user_servers us
      JOIN 
        servers s ON us.server_id = s.id
      WHERE 
        us.user_id = $1
      LIMIT 1
    `;
    
    const result = await pool.query(query, [userId]);
    
    if (result.rows.length === 0) {
      console.log('Nenhum servidor encontrado para o usuário:', userId);
      return null;
    }
    
    return result.rows[0];
    
  } catch (error) {
    console.error('Erro ao buscar servidor do usuário:', error);
    return null;
  }
}

/**
 * Formata os contatos para um formato consistente
 */
function formatContacts(contactsArray: any[]) {
  if (!Array.isArray(contactsArray)) {
    console.warn('[SYNC] Formato inválido de contatos:', contactsArray);
    return [];
  }

  return contactsArray.map(contact => {
    // Tentativa de padronizar diferentes formatos de contatos
    const id = contact.id || contact.jid || contact.wa_id || contact.chatId || '';
    const name = contact.name || contact.pushName || contact.display_name || contact.displayName || contact.notifyName || 'Sem nome';
    
    // Remover caracteres não desejados do ID
    const cleanId = id.replace(/@.+$/, '');
    
    return {
      id: cleanId,
      name: name,
      phoneNumber: cleanId, // Usar o ID limpo como número
      type: getContactType(contact)
    };
  }).filter(c => c.id && c.id.length > 0); // Filtra apenas contatos com ID válido
}

/**
 * Determina o tipo de contato (grupo, lista de transmissão, contato)
 */
function getContactType(contact: any) {
  // Verificar se é um grupo
  if (
    (contact.id && contact.id.includes('@g.us')) ||
    (contact.isGroup === true) ||
    (contact.type === 'group')
  ) {
    return 'group';
  }
  
  // Verificar se é uma lista de transmissão
  if (
    (contact.id && contact.id.includes('@broadcast')) ||
    (contact.isBroadcast === true) ||
    (contact.type === 'broadcast')
  ) {
    return 'broadcast';
  }
  
  // Por padrão, considerar como contato individual
  return 'contact';
}

/**
 * Encontra arrays na resposta que possam conter contatos
 */
function findContactArrays(obj: any) {
  const arrays: any[] = [];
  
  // Função recursiva para encontrar arrays
  function findArrays(current: any, depth = 0) {
    // Limitar a profundidade para evitar loops infinitos
    if (depth > 5) return;
    
    if (Array.isArray(current)) {
      // Verificar se parece um array de contatos (objetos com id, name ou número)
      if (current.length > 0 && typeof current[0] === 'object') {
        // Assumir que é um array de contatos se pelo menos um item tiver uma dessas propriedades
        const hasContactProps = current.some((item: any) => 
          item.id || item.jid || item.wa_id || item.name || item.pushName
        );
        
        if (hasContactProps) {
          arrays.push(current);
        }
      }
    } else if (current && typeof current === 'object') {
      // Procurar arrays nos valores do objeto
      Object.values(current).forEach(value => {
        findArrays(value, depth + 1);
      });
    }
  }
  
  findArrays(obj);
  return arrays;
}