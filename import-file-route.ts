// Rota para importar arquivo de leads
app.post("/api/prospecting/import", upload.single('file'), async (req, res) => {
  if (!req.isAuthenticated()) return res.status(401).json({ message: "Não autenticado" });
  
  try {
    // Verificar arquivo
    if (!req.file) {
      return res.status(400).json({ message: "Nenhum arquivo enviado" });
    }
    
    // Verificar dados obrigatórios
    if (!req.body.segment) {
      return res.status(400).json({ message: "Segmento é obrigatório" });
    }
    
    // Processar arquivo
    const file = req.file;
    const segment = req.body.segment;
    const city = req.body.city || null;
    const filters = req.body.filters || null;
    
    console.log("Processando arquivo:", file.originalname, "para o segmento:", segment);
    
    // Criar busca
    const search = await storage.createProspectingSearch({
      userId: req.user?.id as number,
      segment,
      city,
      filters,
      status: "processando",
    });
    
    // Ler dados do arquivo
    if (file.mimetype.includes('csv') || file.originalname.endsWith('.csv')) {
      // Ler conteúdo do arquivo
      const fileContent = fs.readFileSync(file.path, 'utf8');
      
      if (fileContent.trim().length < 10) {
        await storage.updateProspectingSearch(search.id, { status: "erro" });
        return res.status(400).json({ message: "Arquivo vazio ou sem dados suficientes" });
      }
      
      try {
        // Usar nosso módulo de importação otimizado
        const importResult = await importCSVContent(
          fileContent,
          search.id,
          storage
        );
        
        // Atualizar a busca com os resultados
        await storage.updateProspectingSearch(search.id, {
          leadsFound: importResult.importedLeads,
          dispatchesPending: importResult.importedLeads,
          status: importResult.importedLeads > 0 ? "concluido" : "erro"
        });
        
        return res.status(200).json({
          message: importResult.message,
          searchId: search.id,
          importedLeads: importResult.importedLeads,
          errors: importResult.errorLeads
        });
      } catch (error) {
        console.error("Erro ao processar arquivo CSV:", error);
        await storage.updateProspectingSearch(search.id, { status: "erro" });
        return res.status(500).json({ 
          message: "Erro ao processar arquivo CSV", 
          error: String(error) 
        });
      }
    } else if (file.mimetype.includes('excel') || 
              file.mimetype.includes('spreadsheet') || 
              file.originalname.endsWith('.xlsx') || 
              file.originalname.endsWith('.xls')) {
      // Implementação para processamento de arquivos Excel usando o módulo de importação
      try {
        // Ler conteúdo do arquivo Excel
        console.log("Processando arquivo Excel:", file.originalname);
        
        // Converter Excel para formato CSV para usar nosso processador existente
        const workbook = xlsx.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const csvContent = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        
        if (!csvContent || csvContent.trim().length < 10) {
          await storage.updateProspectingSearch(search.id, { status: "erro" });
          return res.status(400).json({ message: "Arquivo Excel vazio ou sem dados" });
        }
        
        // Usar o mesmo processador de CSV com o conteúdo convertido do Excel
        const importResult = await importCSVContent(
          csvContent,
          search.id,
          storage
        );
        
        // Atualizar a busca com os resultados
        await storage.updateProspectingSearch(search.id, {
          leadsFound: importResult.importedLeads,
          dispatchesPending: importResult.importedLeads,
          status: importResult.importedLeads > 0 ? "concluido" : "erro"
        });
        
        return res.status(200).json({
          message: importResult.message,
          searchId: search.id,
          importedLeads: importResult.importedLeads,
          errors: importResult.errorLeads
        });
      } catch (error) {
        console.error("Erro ao processar arquivo Excel:", error);
        await storage.updateProspectingSearch(search.id, { status: "erro" });
        return res.status(500).json({ 
          message: "Erro ao processar arquivo Excel", 
          error: String(error) 
        });
      }
    } else {
      // Formato não suportado
      fs.unlinkSync(file.path);
      await storage.updateProspectingSearch(search.id, { status: "erro" });
      return res.status(400).json({ 
        message: "Formato de arquivo não suportado. Use apenas PDF ou CSV" 
      });
    }
  } catch (error) {
    console.error("Erro ao processar upload de arquivo:", error);
    return res.status(500).json({ 
      message: "Erro interno no processamento do arquivo", 
      error: String(error) 
    });
  }
});