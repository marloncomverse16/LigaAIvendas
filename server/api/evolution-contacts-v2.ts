/**
 * Implementação atualizada para buscar contatos usando os endpoints corretos
 * Baseado na documentação oficial da Evolution API
 */

import { Request, Response } from 'express';
import axios from 'axios';

/**
 * Busca contatos usando o endpoint correto da Evolution API
 * Baseado na documentação oficial: POST /chat/findContacts/{instance}
 */
export async function getContactsV2(req: Request, res: Response) {
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

    const instanceId = server.instanceId || 'admin';
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;

    // Tentar obter contatos usando quatro métodos diferentes
    console.log('🔄 Iniciando busca robusta de contatos com múltiplos métodos...');

    let contactsData = null;
    let method = '';
    let error = null;

    // Método 1: POST findContacts com objeto vazio (obter todos)
    try {
      console.log(`Método 1: POST /chat/findContacts/${instanceId} (obter todos)`);
      const response = await axios.post(
        `${apiUrl}/chat/findContacts/${instanceId}`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiToken
          },
          timeout: 8000
        }
      );
      
      if (response.status === 200 && response.data) {
        contactsData = response.data;
        method = 'findContacts (todos)';
        console.log('✅ Método 1 bem-sucedido!');
      }
    } catch (err) {
      console.log('❌ Método 1 falhou:', err.message);
      error = err;
    }

    // Método 2: POST fetchProfile para um número conhecido (+55)
    if (!contactsData) {
      try {
        console.log(`Método 2: POST /chat/fetchProfile/${instanceId} (número de teste)`);
        const response = await axios.post(
          `${apiUrl}/chat/fetchProfile/${instanceId}`,
          { number: "5511999887766" },
          {
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiToken
            },
            timeout: 8000
          }
        );
        
        if (response.status === 200 && response.data) {
          contactsData = [response.data]; // Coloca o perfil em um array
          method = 'fetchProfile (único)';
          console.log('✅ Método 2 bem-sucedido!');
        }
      } catch (err) {
        console.log('❌ Método 2 falhou:', err.message);
        if (!error) error = err;
      }
    }

    // Método 3: Tentar com a versão completa da URL da documentação
    if (!contactsData) {
      try {
        console.log(`Método 3: POST ${apiUrl}/chat/findContacts/${instanceId} (URL completa de documentação)`);
        const fullUrl = `${apiUrl}/chat/findContacts/${instanceId}`;
        
        const response = await axios({
          method: 'post',
          url: fullUrl,
          headers: {
            'Content-Type': 'application/json',
            'apikey': apiToken,
            'Authorization': `Bearer ${apiToken}`
          },
          data: { where: {} }, // sintaxe conforme documentação
          timeout: 8000
        });
        
        if (response.status === 200 && response.data) {
          contactsData = response.data;
          method = 'findContacts (URL completa)';
          console.log('✅ Método 3 bem-sucedido!');
        }
      } catch (err) {
        console.log('❌ Método 3 falhou:', err.message);
        if (!error) error = err;
      }
    }

    // Método 4: Tentar usando o endpoint alternativo da versão anterior
    if (!contactsData) {
      try {
        console.log(`Método 4: GET ${apiUrl}/instance/fetchContacts/${instanceId} (endpoint antigo)`);
        
        const response = await axios.get(
          `${apiUrl}/instance/fetchContacts/${instanceId}`,
          {
            headers: {
              'Content-Type': 'application/json',
              'apikey': apiToken,
              'Authorization': `Bearer ${apiToken}`
            },
            timeout: 8000
          }
        );
        
        if (response.status === 200 && response.data) {
          contactsData = response.data;
          method = 'fetchContacts (GET antigo)';
          console.log('✅ Método 4 bem-sucedido!');
        }
      } catch (err) {
        console.log('❌ Método 4 falhou:', err.message);
        if (!error) error = err;
      }
    }

    // Tratar resultado
    if (contactsData) {
      console.log(`📋 Contatos obtidos via método: ${method}`);
      
      // Processar e retornar contatos
      return res.json({
        success: true,
        contacts: contactsData,
        method: method,
        total: Array.isArray(contactsData) ? contactsData.length : 1
      });
    } else {
      // Nenhum método funcionou
      console.error('❌ Todos os métodos falharam para obter contatos');
      return res.status(500).json({
        success: false,
        message: 'Não foi possível obter contatos do WhatsApp',
        error: error ? (error.message || 'Erro desconhecido') : 'Todos os métodos falharam',
        methods: ['findContacts', 'fetchProfile', 'findContacts (URL completa)', 'fetchContacts (GET)']
      });
    }

  } catch (error) {
    console.error('Erro ao buscar contatos (V2):', error);
    return res.status(500).json({
      success: false,
      message: 'Erro interno ao buscar contatos',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Busca as informações do servidor do usuário
 */
async function getUserServer(userId: number) {
  try {
    // Importar o pool diretamente para evitar problemas com o ORM
    const { pool } = await import('../db');
    
    // Consulta direta para buscar as informações necessárias
    const query = `
      SELECT 
        us.id, 
        us.user_id as userId, 
        us.server_id as serverId,
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