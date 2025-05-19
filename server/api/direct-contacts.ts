/**
 * Implementação alternativa para busca de contatos do WhatsApp
 * Utiliza múltiplos endpoints da Evolution API e implementa fallbacks
 */

import { Request, Response } from 'express';
import axios from 'axios';

/**
 * Função para obter contatos do WhatsApp diretamente da Evolution API
 * Tenta múltiplos endpoints conhecidos da API Evolution
 */
export async function getDirectContacts(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ 
      success: false, 
      message: 'Não autenticado' 
    });
  }

  try {
    // Obter ID do usuário autenticado
    const userId = (req.user as Express.User).id;
    
    // Importar o pool diretamente para evitar problemas com o ORM
    const { pool } = await import('../db');
    
    // Consulta SQL para obter dados do servidor
    const query = `
      SELECT 
        us.id, 
        us.user_id as userid, 
        us.server_id as serverid,
        s.api_url as apiurl, 
        s.api_token as apitoken,
        s.instance_id as instanceid
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
      return res.status(404).json({
        success: false,
        message: 'Nenhum servidor configurado para este usuário'
      });
    }
    
    const serverData = result.rows[0];
    const { apiurl, apitoken, instanceid } = serverData;
    
    // Verificar se temos todas as informações necessárias
    if (!apiurl || !apitoken || !instanceid) {
      return res.status(400).json({
        success: false,
        message: 'Configuração incompleta do servidor WhatsApp'
      });
    }
    
    // Formatar a URL base para a API
    const baseUrl = apiurl.replace(/\/+$/, "");
    const instance = instanceid || 'admin';
    
    console.log(`Buscando contatos para a instância "${instance}" na URL: ${baseUrl}`);
    
    // Lista de URLs de endpoints para tentar (em ordem de prioridade)
    const endpoints = [
      `/instance/fetchContacts/${instance}`,
      `/instance/getContacts/${instance}`,
      `/chat/fetchContacts/${instance}`,
      `/chat/getAllContacts/${instance}`,
      `/instances/${instance}/contacts`,
      `/instance/${instance}/contacts`,
      `/instance/contacts/${instance}`,
      `/instance/chats/${instance}`,
      `/chat/contacts/${instance}`
    ];
    
    // Função para formatar contatos de acordo com a estrutura esperada pela interface
    const formatContacts = (data: any) => {
      // Verificar se é um array
      if (Array.isArray(data)) {
        return data.map(contact => {
          return {
            id: contact.id || contact.jid || contact.wid || 'unknown',
            name: contact.name || contact.pushname || contact.displayName || 'Desconhecido',
            phone: contact.id || contact.jid || contact.wid || 'unknown',
            profilePicture: contact.imgUrl || contact.profilePictureUrl || '',
            lastSeen: contact.lastSeen || new Date().toISOString(),
            isGroup: contact.isGroup || (contact.id?.endsWith('@g.us') || contact.jid?.endsWith('@g.us')) || false
          };
        }).filter(contact => {
          // Filtrar apenas contatos válidos (não grupos, a menos que isso mude no futuro)
          return !contact.isGroup && contact.id !== 'status@broadcast';
        });
      }
      
      // Se não for um array mas tiver uma propriedade de contatos
      if (data.contacts && Array.isArray(data.contacts)) {
        return formatContacts(data.contacts);
      }
      
      // Se tiver propriedade data que contém os contatos
      if (data.data && Array.isArray(data.data)) {
        return formatContacts(data.data);
      }
      
      // Se tiver chats que podemos extrair como contatos
      if (data.chats && Array.isArray(data.chats)) {
        return formatContacts(data.chats);
      }
      
      // Se não for reconhecido em nenhum formato
      console.warn('Formato de resposta desconhecido:', data);
      return [];
    }
    
    // Tentar cada endpoint até encontrar um que funcione
    let contactsData = null;
    let successEndpoint = '';
    
    // Headers para requisições
    const headers = {
      'Content-Type': 'application/json',
      'apikey': apitoken,
      'Authorization': `Bearer ${apitoken}`
    };
    
    // Tentar cada endpoint em sequência
    for (const endpoint of endpoints) {
      try {
        console.log(`Tentando endpoint: ${baseUrl}${endpoint}`);
        
        const response = await axios.get(`${baseUrl}${endpoint}`, { headers });
        
        if (response.status === 200 && response.data) {
          contactsData = response.data;
          successEndpoint = endpoint;
          console.log(`Sucesso com endpoint: ${endpoint}`);
          break;
        }
      } catch (error) {
        // Apenas logar o erro e continuar para o próximo endpoint
        console.log(`Falha no endpoint ${endpoint}: ${(error as any).message || 'Erro desconhecido'}`);
      }
    }
    
    // Se encontrou dados em algum endpoint
    if (contactsData) {
      console.log(`Contatos obtidos com sucesso via endpoint: ${successEndpoint}`);
      
      // Processar os contatos para o formato esperado pela interface
      const formattedContacts = formatContacts(contactsData);
      
      return res.json({
        success: true,
        contacts: formattedContacts,
        metadata: {
          total: formattedContacts.length,
          source: successEndpoint
        }
      });
    }
    
    // Se nenhum endpoint funcionou
    console.log('Todos os endpoints falharam. Fornecendo mensagem de erro adequada.');
    return res.status(503).json({
      success: false,
      message: 'Não foi possível obter contatos do WhatsApp. Verifique a conexão do WhatsApp.'
    });
    
  } catch (error) {
    console.error('Erro ao buscar contatos:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar contatos'
    });
  }
}