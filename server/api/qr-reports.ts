import { Request, Response } from 'express';
import { Pool } from '@neondatabase/serverless';
import { pool } from '../db';

// Buscar relatórios de conversas do QR Code
export async function getQRConversationReports(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    console.log('📊 Buscando relatórios de conversas QR Code para usuário:', userId);

    const query = `
      SELECT 
        c.phone_number,
        c.name,
        COUNT(DISTINCT DATE(c.last_message_time)) as conversation_days,
        COUNT(*) as total_messages,
        MIN(c.last_message_time) as first_contact,
        MAX(c.last_message_time) as last_contact,
        c.source
      FROM contacts c
      WHERE c.user_id = $1 
        AND c.source = 'qr_code'
        AND c.last_message_time BETWEEN $2 AND $3
      GROUP BY c.phone_number, c.name, c.source
      ORDER BY last_contact DESC
    `;

    const { rows } = await pool.query(query, [userId, startDate, endDate]);
    
    console.log('📊 Encontradas', rows.length, 'conversas QR Code no período');
    res.json(rows);

  } catch (error: any) {
    console.error('❌ Erro ao buscar relatórios de conversas QR Code:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message 
    });
  }
}

// Buscar relatórios de mensagens do QR Code
export async function getQRMessageReports(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    console.log('📊 Buscando relatórios de mensagens QR Code para usuário:', userId);

    // Buscar mensagens do banco local (se existir tabela)
    // Como o QR Code usa API externa, vamos simular com dados de contatos
    const query = `
      SELECT 
        c.phone_number,
        c.name,
        'Mensagem via QR Code' as message_type,
        'sent' as status,
        c.last_message_time as sent_at,
        c.source
      FROM contacts c
      WHERE c.user_id = $1 
        AND c.source = 'qr_code'
        AND c.last_message_time BETWEEN $2 AND $3
      ORDER BY c.last_message_time DESC
    `;

    const { rows } = await pool.query(query, [userId, startDate, endDate]);
    
    console.log('📊 Encontradas', rows.length, 'mensagens QR Code no período');
    res.json(rows);

  } catch (error: any) {
    console.error('❌ Erro ao buscar relatórios de mensagens QR Code:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message 
    });
  }
}

// Buscar relatórios de contatos do QR Code
export async function getQRContactReports(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    console.log('📊 Buscando relatórios de contatos QR Code para usuário:', userId);

    const query = `
      SELECT 
        c.phone_number,
        c.name,
        c.profile_picture,
        c.last_message_time,
        c.is_active,
        c.created_at,
        c.source,
        CASE 
          WHEN c.last_message_time >= NOW() - INTERVAL '24 hours' THEN 'Ativo'
          WHEN c.last_message_time >= NOW() - INTERVAL '7 days' THEN 'Recente'
          ELSE 'Inativo'
        END as activity_status
      FROM contacts c
      WHERE c.user_id = $1 
        AND c.source = 'qr_code'
        AND c.created_at BETWEEN $2 AND $3
      ORDER BY c.last_message_time DESC
    `;

    const { rows } = await pool.query(query, [userId, startDate, endDate]);
    
    console.log('📊 Encontrados', rows.length, 'contatos QR Code no período');
    res.json(rows);

  } catch (error: any) {
    console.error('❌ Erro ao buscar relatórios de contatos QR Code:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message 
    });
  }
}