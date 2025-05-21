/**
 * API simulada do WhatsApp para demonstração
 * 
 * Este arquivo contém os endpoints que retornam dados simulados para
 * demonstrar a interface de WhatsApp Web.
 */

import { Request, Response } from "express";
import { format } from "date-fns";

// Contatos simulados
export const mockContacts: any[] = [
  {
    id: "5511999998888@c.us",
    name: "Contato Simulado 1",
    pushName: "Contato 1",
    phone: "5511999998888@c.us",
    lastMessage: "Olá, como vai?",
    lastMessageTime: format(new Date(), "HH:mm"),
    unreadCount: 2
  },
  {
    id: "5511999997777@c.us",
    name: "Contato Simulado 2",
    pushName: "Contato 2",
    phone: "5511999997777@c.us",
    lastMessage: "Vamos agendar uma reunião?",
    lastMessageTime: format(new Date(Date.now() - 3600000), "HH:mm"),
    unreadCount: 0
  },
  {
    id: "5511999996666@c.us",
    name: "Contato Simulado 3",
    pushName: "Contato 3",
    phone: "5511999996666@c.us",
    lastMessage: "Enviando informações solicitadas.",
    lastMessageTime: format(new Date(Date.now() - 7200000), "HH:mm"),
    unreadCount: 1
  }
];

// Mensagens simuladas para cada contato
export const mockMessages: Record<string, any[]> = {
  "5511999998888@c.us": [
    {
      id: "msg-001",
      content: "Olá, tudo bem?",
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      fromMe: false,
      status: "read"
    },
    {
      id: "msg-002",
      content: "Sim, tudo ótimo! E com você?",
      timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(),
      fromMe: true,
      status: "read"
    },
    {
      id: "msg-003",
      content: "Estou bem também, obrigado!",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      fromMe: false,
      status: "read"
    },
    {
      id: "msg-004",
      content: "Olá, como vai?",
      timestamp: new Date(Date.now() - 1800000).toISOString(),
      fromMe: false,
      status: "delivered"
    }
  ],
  "5511999997777@c.us": [
    {
      id: "msg-011",
      content: "Bom dia!",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      fromMe: false,
      status: "read"
    },
    {
      id: "msg-012",
      content: "Bom dia! Como posso ajudar?",
      timestamp: new Date(Date.now() - 7000000).toISOString(),
      fromMe: true,
      status: "read"
    },
    {
      id: "msg-013",
      content: "Gostaria de agendar uma reunião",
      timestamp: new Date(Date.now() - 6800000).toISOString(),
      fromMe: false,
      status: "read"
    },
    {
      id: "msg-014",
      content: "Claro, que tal amanhã às 10h?",
      timestamp: new Date(Date.now() - 6600000).toISOString(),
      fromMe: true,
      status: "read"
    },
    {
      id: "msg-015",
      content: "Vamos agendar uma reunião?",
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      fromMe: false,
      status: "delivered"
    }
  ],
  "5511999996666@c.us": [
    {
      id: "msg-021",
      content: "Preciso de algumas informações",
      timestamp: new Date(Date.now() - 10800000).toISOString(),
      fromMe: false,
      status: "read"
    },
    {
      id: "msg-022",
      content: "Quais informações você precisa?",
      timestamp: new Date(Date.now() - 10700000).toISOString(),
      fromMe: true,
      status: "read"
    },
    {
      id: "msg-023",
      content: "Sobre os novos produtos",
      timestamp: new Date(Date.now() - 10600000).toISOString(),
      fromMe: false,
      status: "read"
    },
    {
      id: "msg-024",
      content: "Vou preparar e enviar para você",
      timestamp: new Date(Date.now() - 10500000).toISOString(),
      fromMe: true,
      status: "read"
    },
    {
      id: "msg-025",
      content: "Enviando informações solicitadas.",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      fromMe: false,
      status: "delivered"
    }
  ]
};

/**
 * Verifica o status da conexão com o WhatsApp
 */
export function checkStatus(req: Request, res: Response) {
  // Simula uma conexão bem-sucedida
  return res.status(200).json({
    success: true,
    connected: true,
    state: "open",
    data: {
      state: "open",
      connected: true
    }
  });
}

/**
 * Retorna lista de contatos simulados
 */
export function getContacts(req: Request, res: Response) {
  return res.status(200).json(mockContacts);
}

/**
 * Retorna mensagens simuladas para o contato especificado
 */
export function getMessages(req: Request, res: Response) {
  const { contactId } = req.params;
  
  if (!contactId) {
    return res.status(400).json({
      success: false,
      message: "ID do contato não fornecido"
    });
  }
  
  // Verifica se temos mensagens para este contato
  if (mockMessages[contactId]) {
    return res.status(200).json(mockMessages[contactId]);
  } else {
    // Retorna um array vazio para contatos sem mensagens
    return res.status(200).json([]);
  }
}

/**
 * Simula o envio de uma mensagem
 */
export function sendMessage(req: Request, res: Response) {
  const { to, message } = req.body;
  
  if (!to || !message) {
    return res.status(400).json({
      success: false,
      message: "Destinatário e/ou mensagem não fornecidos"
    });
  }
  
  // Simula o envio com sucesso
  return res.status(200).json({
    success: true,
    message: "Mensagem enviada com sucesso",
    data: {
      id: `msg-${Date.now()}`,
      status: "sent"
    }
  });
}