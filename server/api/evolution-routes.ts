/**
 * Rotas da API Evolution para o novo Chat WhatsApp Web
 */

import { Router } from "express";
import { getContacts, getWhatsAppQrCode, getMessages, sendMessage } from "./evolution-chat";

const router = Router();

// Rota para obter QR Code para autenticação WhatsApp
router.get("/qrcode", getWhatsAppQrCode);

// Rota para obter contatos do WhatsApp
router.get("/contacts", getContacts);

// Rota para obter mensagens de um chat específico
router.get("/messages", getMessages);

// Rota para enviar mensagem
router.post("/send-message", sendMessage);

export default router;