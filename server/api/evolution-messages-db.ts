import { Request, Response } from "express";
import axios from "axios";
import { 
  saveMessages, 
  getMessages, 
  getLastMessageTimestamp, 
  cleanupExpiredMessages 
} from "./whatsapp-messages";

// Busca mensagens do banco de dados
export async function getMessagesFromDb(req: Request, res: Response) {
  try {
    const { remoteJid, limit, before } = req.query;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    if (!remoteJid) {
      return res.status(400).json({ error: "remoteJid é obrigatório" });
    }

    const messages = await getMessages(
      remoteJid as string,
      userId,
      limit ? parseInt(limit as string) : 50,
      before ? parseInt(before as string) : undefined
    );

    return res.json(messages);
  } catch (error) {
    console.error("Erro ao buscar mensagens:", error);
    return res.status(500).json({ error: "Erro ao buscar mensagens" });
  }
}

// Sincroniza mensagens da API Evolution para o banco de dados
export async function syncMessagesWithApi(req: Request, res: Response) {
  try {
    const { remoteJid, instanceName } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    if (!remoteJid || !instanceName) {
      return res.status(400).json({
        error: "remoteJid e instanceName são obrigatórios"
      });
    }

    // Buscar configuração do usuário
    const userConfig = await getUserEvolutionConfig(userId);
    
    if (!userConfig) {
      return res.status(400).json({
        error: "Configuração da Evolution API não encontrada"
      });
    }

    // Buscar o último timestamp para saber a partir de quando buscar novas mensagens
    const lastTimestamp = await getLastMessageTimestamp(remoteJid, userId);

    // Buscar mensagens recentes da API
    const messages = await fetchMessagesFromApi(
      userConfig.apiUrl,
      userConfig.token,
      instanceName,
      remoteJid,
      lastTimestamp
    );

    if (!messages || !Array.isArray(messages)) {
      return res.json({ synced: 0, total: 0 });
    }

    // Salvar mensagens no banco de dados
    const result = await saveMessages(
      messages,
      remoteJid,
      userId,
      instanceName
    );

    return res.json({
      synced: result.inserted,
      total: result.total,
      messages: messages.length
    });
  } catch (error) {
    console.error("Erro ao sincronizar mensagens:", error);
    return res.status(500).json({ error: "Erro ao sincronizar mensagens" });
  }
}

// Limpa mensagens antigas (mais de 90 dias)
export async function cleanupMessages(req: Request, res: Response) {
  try {
    const result = await cleanupExpiredMessages();
    return res.json(result);
  } catch (error) {
    console.error("Erro ao limpar mensagens:", error);
    return res.status(500).json({ error: "Erro ao limpar mensagens" });
  }
}

// Funções auxiliares
async function getUserEvolutionConfig(userId: number) {
  try {
    // Aqui você deve buscar a configuração do usuário no banco de dados
    // Incluindo apiUrl e token para conexão com a Evolution API
    // Este é apenas um exemplo simplificado
    
    // Substitua por uma consulta real ao banco
    return {
      apiUrl: "https://api.primerastreadores.com",
      token: "4db623449606bcf2814521b73657dbc0" // Em produção, isso viria do banco de dados
    };
  } catch (error) {
    console.error("Erro ao buscar configuração:", error);
    return null;
  }
}

async function fetchMessagesFromApi(
  apiUrl: string,
  token: string,
  instanceName: string,
  remoteJid: string,
  afterTimestamp: number = 0
) {
  try {
    // Preparar o payload para buscar mensagens
    const payload = {
      where: {
        key: {
          remoteJid
        }
      },
      limit: 100,
      sort: {
        messageTimestamp: "desc"
      }
    };

    if (afterTimestamp > 0) {
      // Buscar apenas mensagens mais recentes que o último timestamp
      payload.where.messageTimestamp = { $gt: afterTimestamp };
    }

    const response = await axios.post(
      `${apiUrl}/chat/findMessages/${instanceName}`,
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "apikey": token
        }
      }
    );

    // Se a resposta contém a estrutura esperada
    if (response.data?.messages?.records) {
      return response.data.messages.records;
    }

    // Se a resposta é um array direto
    if (Array.isArray(response.data)) {
      return response.data;
    }

    return [];
  } catch (error) {
    console.error("Erro ao buscar mensagens da API:", error);
    return [];
  }
}