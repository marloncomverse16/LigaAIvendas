/**
 * Módulo específico para importação de arquivos CSV
 * Com detecção automática de separador e colunas
 */
import { IStorage } from "./storage";
import fs from "fs";

/**
 * Detecta o melhor separador para um arquivo CSV (vírgula ou ponto e vírgula)
 * @param content Conteúdo do arquivo CSV
 * @returns O separador detectado (',' ou ';')
 */
function detectSeparator(content: string): string {
  const lines = content.split('\n');
  if (lines.length < 2) return ',';
  
  const testLine = lines[1];
  
  // Verifica qual separador aparece com mais frequência
  if (testLine.indexOf(';') > -1 && 
      (testLine.indexOf(',') === -1 || testLine.split(';').length > testLine.split(',').length)) {
    console.log("Detectado separador de CSV como ponto e vírgula (;)");
    return ';';
  }
  
  console.log("Usando separador de CSV padrão como vírgula (,)");
  return ',';
}

/**
 * Encontra o índice de uma coluna específica nos cabeçalhos
 * @param headers Lista de cabeçalhos do CSV
 * @param fieldType Tipo de campo a ser encontrado (name, email, phone, etc)
 * @returns Índice da coluna ou -1 se não encontrado
 */
function findColumnIndex(headers: string[], fieldType: string): number {
  // Mapeia diferentes variações de nomes de colunas comumente usados
  const nameMappings: {[key: string]: string[]} = {
    'name': ['nome', 'name', 'cliente', 'razão social', 'razao social', 'razaosocial', 'empresa', 'contato', 'responsável', 'responsavel'],
    'email': ['email', 'e-mail', 'correio', 'correio eletrônico', 'mail'],
    'phone': ['telefone', 'phone', 'celular', 'tel', 'contato', 'whatsapp', 'telefone 1', 'tel1', 'fone'],
    'address': ['endereco', 'endereço', 'address', 'logradouro', 'local'],
    'cidade': ['cidade', 'city', 'município', 'municipio'],
    'estado': ['estado', 'state', 'uf', 'província', 'provincia'],
    'site': ['site', 'website', 'web', 'pagina', 'página', 'url', 'link'],
    'type': ['tipo', 'type', 'category', 'categoria', 'segmento', 'ramo']
  };
  
  const possibleNames = nameMappings[fieldType] || [fieldType];
  
  // Primeiro tenta encontrar uma correspondência exata
  for (const possibleName of possibleNames) {
    const index = headers.findIndex(h => h === possibleName);
    if (index !== -1) {
      console.log(`Campo ${fieldType} encontrado exatamente como "${headers[index]}" no índice ${index}`);
      return index;
    }
  }
  
  // Em seguida, tenta correspondência parcial
  for (const possibleName of possibleNames) {
    const index = headers.findIndex(h => 
      h.includes(possibleName) || 
      possibleName.includes(h));
    if (index !== -1) {
      console.log(`Campo ${fieldType} encontrado parcialmente como "${headers[index]}" usando "${possibleName}" no índice ${index}`);
      return index;
    }
  }
  
  // Tenta uma abordagem mais genérica para encontrar strings similares
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    for (const possibleName of possibleNames) {
      // Verifica se alguma das strings contém partes da outra
      if (possibleName.length > 2 && header.includes(possibleName.substring(0, 3))) {
        console.log(`Campo ${fieldType} encontrado por similaridade usando "${possibleName}" no índice ${i} (cabeçalho: "${header}")`);
        return i;
      }
    }
  }
  
  console.log(`Campo ${fieldType} NÃO encontrado em nenhum cabeçalho`);
  return -1;
}

/**
 * Importa dados de um arquivo CSV para o sistema de prospecção
 * @param fileContent Conteúdo do arquivo CSV como string
 * @param searchId ID da busca de prospecção
 * @param storage Instância do armazenamento
 * @returns Dados processados e número de leads importados
 */
export async function importCSVContent(
  fileContent: string, 
  searchId: number,
  storage: IStorage
): Promise<{ importedLeads: number, errorLeads: number, message: string }> {
  try {
    const lines = fileContent.split('\n');
    
    if (lines.length < 2) {
      return { 
        importedLeads: 0, 
        errorLeads: 0, 
        message: "Arquivo vazio ou sem dados suficientes" 
      };
    }
    
    // Detectar separador ideal para este arquivo
    const separator = detectSeparator(fileContent);
    
    // Obter e processar cabeçalhos
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());
    
    // Identificar índices de colunas
    const nameIndex = findColumnIndex(headers, 'name');
    const emailIndex = findColumnIndex(headers, 'email');
    const phoneIndex = findColumnIndex(headers, 'phone');
    
    // Estratégia para resolver problema de não conseguir identificar colunas:
    // Se não encontrarmos nenhuma coluna automaticamente, vamos utilizar
    // as primeiras colunas do arquivo como nome, email e telefone (se disponíveis)
    let nameIdx = nameIndex;
    let emailIdx = emailIndex;
    let phoneIdx = phoneIndex;
    
    // Se não temos nenhum campo detectado automaticamente, vamos usar um mapeamento forçado
    const needsForceMapping = nameIndex === -1 && emailIndex === -1 && phoneIndex === -1;
    
    if (needsForceMapping) {
      console.log("AVISO: Nenhuma coluna mapeada automaticamente. Tentando mapeamento forçado...");
      
      // Usa as primeiras colunas disponíveis assumindo uma ordem comum
      if (headers.length > 0) nameIdx = 0;  // Primeira coluna como nome
      if (headers.length > 1) emailIdx = 1; // Segunda coluna como email
      if (headers.length > 2) phoneIdx = 2; // Terceira coluna como telefone
      
      console.log("Mapeamento forçado:", {
        nome: headers[nameIdx] || "indisponível",
        email: emailIdx >= 0 ? headers[emailIdx] : "indisponível",
        telefone: phoneIdx >= 0 ? headers[phoneIdx] : "indisponível"
      });
    }
    
    // Obter índices de todas as colunas possíveis
    const addressIdx = findColumnIndex(headers, 'address');
    const cidadeIdx = findColumnIndex(headers, 'cidade');
    const estadoIdx = findColumnIndex(headers, 'estado');
    const siteIdx = findColumnIndex(headers, 'site');
    const typeIdx = findColumnIndex(headers, 'type');
    
    let importedLeads = 0;
    let errorLeads = 0;
    
    // Processar linhas
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = lines[i].split(separator).map(v => v.trim());
      
      // Aceita linhas mesmo que não tenham todas as colunas
      if (values.length < 1) continue;
      
      // Preparar objeto com a estrutura esperada pela interface InsertProspectingResult
      const lead: Partial<{
        searchId: number;
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        address?: string | null;
        cidade?: string | null;
        estado?: string | null;
        site?: string | null;
        type?: string | null;
      }> = { 
        searchId: searchId 
      };
      
      // Adiciona campos usando os índices identificados
      if (nameIdx !== -1 && values[nameIdx]) lead.name = values[nameIdx];
      if (emailIdx !== -1 && values[emailIdx]) lead.email = values[emailIdx];
      if (phoneIdx !== -1 && values[phoneIdx]) lead.phone = values[phoneIdx];
      if (addressIdx !== -1 && values[addressIdx]) lead.address = values[addressIdx];
      if (cidadeIdx !== -1 && values[cidadeIdx]) lead.cidade = values[cidadeIdx];
      if (estadoIdx !== -1 && values[estadoIdx]) lead.estado = values[estadoIdx];
      if (siteIdx !== -1 && values[siteIdx]) lead.site = values[siteIdx];
      if (typeIdx !== -1 && values[typeIdx]) lead.type = values[typeIdx];
      
      // Certifica que ao menos um dos campos principais tem valor
      if (!lead.name && !lead.email && !lead.phone) {
        console.log(`Linha ${i+1} ignorada: nenhum campo principal preenchido`);
        errorLeads++;
        continue;
      }
      
      try {
        await storage.createProspectingResult(lead);
        importedLeads++;
      } catch (err) {
        console.error(`Erro ao salvar linha ${i+1}:`, err);
        errorLeads++;
      }
    }
    
    return {
      importedLeads,
      errorLeads,
      message: `Importação concluída: ${importedLeads} leads adicionados, ${errorLeads} erros`
    };
  } catch (error) {
    console.error("Erro ao processar arquivo CSV:", error);
    return {
      importedLeads: 0,
      errorLeads: 0,
      message: `Erro ao processar arquivo: ${error}`
    };
  }
}