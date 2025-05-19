/**
 * Módulo específico para sincronizar contatos da Evolution API
 * Usando o endpoint POST /chat/findContacts/{instance}
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// Middleware para verificar autenticação
function requireAuth(req: Request, res: Response, next: Function) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ success: false, message: 'Não autenticado' });
  }
  next();
}

// Função para criar headers de autenticação com todos os possíveis formatos
function createAuthHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'apikey': token,
    'AUTHENTICATION_API_KEY': token
  };
}

// Buscar o servidor para o usuário atual
async function getUserServer(userId: number) {
  try {
    // Importar o pool diretamente para evitar problemas com o ORM
    const { pool } = await import('../db');
    
    // Primeira consulta para obter o username do usuário
    const userQuery = `SELECT username FROM users WHERE id = $1`;
    const userResult = await pool.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      console.log('Usuário não encontrado:', userId);
      return null;
    }
    
    const username = userResult.rows[0].username;
    console.log(`Nome do usuário encontrado: ${username}`);
    
    // Consulta para buscar informações do servidor
    const query = `
      SELECT 
        us.id, 
        us.user_id as userid, 
        us.server_id as serverid,
        s.api_url as apiurl, 
        s.api_token as apitoken,
        $1 as instancename
      FROM 
        user_servers us
      JOIN 
        servers s ON us.server_id = s.id
      WHERE 
        us.user_id = $2
      LIMIT 1
    `;
    
    const result = await pool.query(query, [username, userId]);
    
    if (result.rows.length === 0) {
      console.log('Nenhum servidor encontrado para o usuário:', userId);
      return null;
    }
    
    console.log('Servidor encontrado:', result.rows[0]);
    
    return result.rows[0];
    
  } catch (error) {
    console.error('Erro ao buscar servidor do usuário:', error);
    return null;
  }
}

// Endpoint para sincronizar contatos
router.post('/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuário não identificado' });
    }
    
    // Buscar informações do servidor do usuário
    const server = await getUserServer(userId);
    if (!server) {
      return res.status(404).json({ 
        success: false, 
        message: 'Servidor não configurado para este usuário'
      });
    }
    
    // Verificar se temos as informações necessárias
    if (!server.apiurl || !server.apitoken || !server.instancename) {
      return res.status(400).json({
        success: false,
        message: 'Configuração de servidor incompleta. Verifique a URL da API, token e nome de usuário.'
      });
    }
    
    console.log('Sincronizando contatos da Evolution API usando POST request');
    
    try {
      // Usar o endpoint correto com método POST - usando nome de usuário como instância
      const endpoint = `${server.apiurl}/chat/findContacts/${server.instancename}`;
      console.log(`Tentando buscar contatos via POST: ${endpoint} (Instância: ${server.instancename})`);
      
      const response = await axios.post(endpoint, {
        // Não passar where para obter todos os contatos
        // Se necessário, podemos adicionar filtros aqui posteriormente
      }, {
        headers: createAuthHeaders(server.apitoken),
        timeout: 15000
      });
      
      if (response.status === 200 && response.data) {
        console.log('Contatos obtidos com sucesso do endpoint POST');
        
        // Extrair contatos da resposta
        let contacts = [];
        
        if (Array.isArray(response.data)) {
          contacts = response.data;
        } else if (response.data.contacts && Array.isArray(response.data.contacts)) {
          contacts = response.data.contacts;
        } else if (response.data.result && Array.isArray(response.data.result)) {
          contacts = response.data.result;
        } else if (typeof response.data === 'object') {
          // Se não tivermos uma estrutura esperada, tentar extrair qualquer array
          for (const key in response.data) {
            if (Array.isArray(response.data[key])) {
              contacts = response.data[key];
              break;
            }
          }
        }
        
        console.log(`Encontrados ${contacts.length} contatos`);
        
        if (contacts.length > 0) {
          // Formatar contatos para o modelo da aplicação
          const formattedContacts = contacts.map((contact: any) => {
            // Extrair número do formato JID (exemplo: 5511999999999@c.us) ou remoteJid (5511999999999@s.whatsapp.net)
            const jid = contact.remoteJid || contact.id || contact.jid || '';
            const phone = jid.replace(/[@:].+$/, '').replace(/\D/g, '') || contact.number || '';
            
            return {
              id: jid,
              name: contact.name || contact.pushName || phone || 'Contato',
              phone: phone,
              pushname: contact.pushName || contact.name || '',
              lastMessageTime: contact.updatedAt || contact.createdAt || contact.lastMessageTime || new Date().toISOString(),
              isGroup: jid.includes('@g.us'),
              profilePicture: contact.profilePicUrl || contact.profilePictureUrl || null
            };
          });
          
          // Inserir ou atualizar contatos no banco de dados
          await saveContactsToDatabase(formattedContacts, userId);
          
          return res.json({
            success: true,
            importResults: {
              created: formattedContacts.length,
              updated: 0,
              total: formattedContacts.length
            },
            contacts: formattedContacts
          });
        }
      }
      
      return res.json({
        success: true,
        importResults: {
          created: 0,
          updated: 0,
          total: 0
        },
        message: 'Nenhum contato encontrado na API Evolution'
      });
      
    } catch (error: any) {
      console.error('Erro ao sincronizar contatos:', error.message);
      
      return res.status(500).json({
        success: false,
        message: 'Erro ao sincronizar contatos da Evolution API',
        error: error.message
      });
    }
  } catch (error: any) {
    console.error('Erro na rota de sincronização:', error.message);
    
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao processar a requisição',
      error: error.message
    });
  }
});

// Função para salvar contatos no banco de dados
async function saveContactsToDatabase(contacts: any[], userId: number) {
  try {
    // Importar o pool para operações diretas no banco de dados
    const { pool } = await import('../db');
    
    let created = 0;
    let updated = 0;
    
    // Para cada contato, inserir ou atualizar no banco de dados
    for (const contact of contacts) {
      try {
        // Verificar se o contato já existe
        const checkQuery = `
          SELECT id FROM contacts 
          WHERE number = $1
        `;
        
        const checkResult = await pool.query(checkQuery, [contact.phone]);
        
        if (checkResult.rows.length === 0) {
          // Inserir novo contato
          const insertQuery = `
            INSERT INTO contacts 
            (contact_id, name, number, profile_picture, is_group, 
             last_activity, user_id, last_message_content)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `;
          
          await pool.query(insertQuery, [
            contact.id || contact.phone,
            contact.name || null,
            contact.phone,
            contact.profilePicture || null,
            contact.isGroup || false,
            new Date(),
            userId,
            'Sincronizado'
          ]);
          
          console.log(`Contato salvo: ${contact.phone}`);
          created++;
        } else {
          // Atualizar contato existente
          const updateQuery = `
            UPDATE contacts
            SET name = $2, profile_picture = $3, is_group = $4, 
                last_activity = $5, user_id = $6, last_message_content = $7,
                updated_at = CURRENT_TIMESTAMP
            WHERE number = $1
          `;
          
          await pool.query(updateQuery, [
            contact.phone,
            contact.name || null,
            contact.profilePicture || null,
            contact.isGroup || false,
            new Date(),
            userId,
            'Atualizado'
          ]);
          
          console.log(`Contato atualizado: ${contact.phone}`);
          updated++;
        }
      } catch (contactError) {
        console.error(`Erro ao salvar contato ${contact.phone}:`, contactError);
      }
    }
    
    return { created, updated };
  } catch (dbError) {
    console.error('Erro no banco de dados:', dbError);
    throw dbError;
  }
}

export default router;