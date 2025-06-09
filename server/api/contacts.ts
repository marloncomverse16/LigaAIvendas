import { Request, Response } from "express";
import { db } from "../db";
import { whatsappContacts, insertWhatsappContactSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import { EvolutionApiClient } from "../evolution-api";
import { storage } from "../storage";

/**
 * Lista todos os contatos para o usuário autenticado
 */
export async function listContacts(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ success: false, message: "Não autenticado" });
  }

  try {
    const userId = req.user.id;
    
    // Buscar contatos do banco de dados
    const contacts = await db.select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.userId, userId))
      .orderBy(whatsappContacts.name);

    return res.json({
      success: true,
      contacts
    });
  } catch (error: any) {
    console.error("Erro ao listar contatos:", error);
    return res.status(500).json({ 
      success: false, 
      message: error?.message || "Erro ao listar contatos" 
    });
  }
}

/**
 * Sincroniza contatos com a Evolution API e salva no banco de dados
 */
export async function syncContacts(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ success: false, message: "Não autenticado" });
  }

  try {
    const userId = req.user.id;
    
    // Obter o servidor para o usuário
    const userServerRelation = await storage.getUserServers(userId);
    
    if (!userServerRelation || !userServerRelation.length) {
      console.log("Nenhum servidor configurado para o usuário");
      return res.status(404).json({
        success: false,
        message: "Nenhum servidor configurado"
      });
    }
    
    const serverRelation = userServerRelation[0];
    const server = serverRelation?.server;
    
    if (!server) {
      console.log("Relação de servidor existe mas não tem servidor associado");
      return res.status(404).json({
        success: false,
        message: "Servidor não encontrado"
      });
    }
    
    const apiUrl = server.apiUrl;
    const apiToken = server.apiToken;
    
    if (!apiUrl || !apiToken) {
      console.log("Servidor encontrado mas sem URL da API ou token configurados");
      return res.status(404).json({
        success: false,
        message: "Servidor não configurado corretamente (URL da API ou token faltando)"
      });
    }
    
    console.log(`Usando nome do usuário (${req.user.username}) como instância para sincronizar contatos`);
    const instanceName = req.user.username;
    
    // Criar cliente da API Evolution
    const evolutionClient = new EvolutionApiClient(
      apiUrl,
      apiToken,
      instanceName
    );
    
    // Primeiro verificar se a instância existe, caso contrário criar
    console.log(`Verificando e criando instância se necessário: ${instanceName}`);
    
    try {
      // Tentar verificar status da instância primeiro
      const connectionStatus = await evolutionClient.checkConnectionStatus();
      
      if (!connectionStatus.success && 
          (connectionStatus.error?.includes("not found") || 
           connectionStatus.error?.includes("404") ||
           connectionStatus.error?.includes("não existe"))) {
        
        console.log(`Instância ${instanceName} não encontrada. Criando instância...`);
        
        // Criar a instância
        const createResult = await evolutionClient.createInstance();
        if (!createResult.success) {
          console.error(`Erro ao criar instância: ${createResult.error}`);
          return res.status(500).json({
            success: false,
            message: `Erro ao criar instância: ${createResult.error}`
          });
        }
        
        console.log(`Instância ${instanceName} criada com sucesso`);
        
        // Aguardar um momento para a instância ser processada
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (instanceError) {
      console.log(`Erro ao verificar/criar instância: ${instanceError.message}`);
    }
    
    // Buscar contatos da Evolution API
    console.log(`Sincronizando contatos da Evolution API: ${apiUrl}/instances/${instanceName}/contacts`);
    const result = await evolutionClient.getContacts();
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || "Erro ao obter contatos da Evolution API"
      });
    }
    
    const contactsFromAPI = result.contacts || [];
    
    console.log(`Obtidos ${contactsFromAPI.length} contatos da Evolution API`);
    
    // Criar um array para armazenar resultados da importação
    const importResults = {
      created: 0,
      updated: 0,
      skipped: 0,
      total: contactsFromAPI.length,
      errors: [] as string[]
    };
    
    // Para cada contato da API, inserir ou atualizar no banco
    for (const contact of contactsFromAPI) {
      try {
        // Normalizar dados do contato
        const contactId = contact.id || contact.jid || contact.wa_id || contact.number;
        if (!contactId) {
          importResults.skipped++;
          importResults.errors.push(`Contato sem ID: ${JSON.stringify(contact)}`);
          continue;
        }
        
        const normalizedContact = {
          userId,
          contactId: contactId.toString(),
          name: contact.name || contact.displayName || contact.pushname || '',
          number: contact.number || (contact.jid ? contact.jid.replace(/@.*$/, '') : ''),
          profilePicture: contact.profilePicture || contact.avatarUrl || null,
          isGroup: contact.isGroup || contact.type === 'group' || false,
          lastActivity: new Date(),
          lastMessageContent: '',
          unreadCount: 0
        };
        
        // Verificar se o contato já existe
        const existingContact = await db.select()
          .from(whatsappContacts)
          .where(eq(whatsappContacts.userId, userId))
          .where(eq(whatsappContacts.contactId, normalizedContact.contactId))
          .limit(1);
        
        if (existingContact.length > 0) {
          // Atualizar contato existente
          await db.update(whatsappContacts)
            .set({
              name: normalizedContact.name,
              number: normalizedContact.number,
              profilePicture: normalizedContact.profilePicture,
              isGroup: normalizedContact.isGroup,
              updatedAt: new Date()
            })
            .where(eq(whatsappContacts.id, existingContact[0].id));
          importResults.updated++;
        } else {
          // Criar novo contato
          await db.insert(whatsappContacts).values(normalizedContact);
          importResults.created++;
        }
      } catch (error: any) {
        console.error(`Erro ao processar contato:`, error);
        importResults.errors.push(`Erro ao processar contato: ${error.message}`);
        importResults.skipped++;
      }
    }
    
    // Buscar a lista atualizada de contatos
    const updatedContacts = await db.select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.userId, userId))
      .orderBy(whatsappContacts.name);
    
    return res.json({
      success: true,
      importResults,
      contacts: updatedContacts
    });
  } catch (error: any) {
    console.error("Erro ao sincronizar contatos:", error);
    return res.status(500).json({ 
      success: false, 
      message: error?.message || "Erro ao sincronizar contatos" 
    });
  }
}

/**
 * Exporta contatos para CSV
 */
export async function exportContacts(req: Request, res: Response) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ success: false, message: "Não autenticado" });
  }

  try {
    const userId = req.user.id;
    
    // Buscar contatos do banco de dados
    const contacts = await db.select()
      .from(whatsappContacts)
      .where(eq(whatsappContacts.userId, userId))
      .orderBy(whatsappContacts.name);

    // Converter para CSV
    const headers = ["Nome", "Número", "Tipo", "Última Atividade"];
    
    const rows = contacts.map(contact => [
      contact.name || "",
      contact.number || "",
      contact.isGroup ? "Grupo" : "Contato",
      contact.lastActivity ? new Date(contact.lastActivity).toLocaleString('pt-BR') : ""
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Configurar cabeçalhos para download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=contatos_${new Date().toISOString().split('T')[0]}.csv`);
    
    return res.send(csvContent);
  } catch (error: any) {
    console.error("Erro ao exportar contatos:", error);
    return res.status(500).json({ 
      success: false, 
      message: error?.message || "Erro ao exportar contatos" 
    });
  }
}