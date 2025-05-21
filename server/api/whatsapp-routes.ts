/**
 * Rotas da API do WhatsApp para a nova interface estilo WhatsApp Web
 */

import { Router } from "express";
import { mockContacts, mockMessages } from "./whatsapp-mock";

const router = Router();

/**
 * Verifica o status da conexão com o WhatsApp
 */
router.get("/status", (req, res) => {
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
});

/**
 * Obtém a lista de contatos do WhatsApp
 */
router.get("/contacts", (req, res) => {
  // Retorna os contatos simulados
  return res.status(200).json(mockContacts);
});

/**
 * Obtém as mensagens de um chat específico
 */
router.get("/messages/:contactId", (req, res) => {
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
});

/**
 * Envia uma mensagem de texto
 */
router.post("/send", (req, res) => {
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
});

export default router;