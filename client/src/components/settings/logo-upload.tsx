import { useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import { Upload } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export function LogoUpload() {
  const { logoUrl, updateLogo, isLoading } = useTheme();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };
  
  const handleFiles = (files: FileList) => {
    const file = files[0];
    
    // Check if file is an image
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, envie apenas arquivos de imagem (JPG, PNG, SVG)",
        variant: "destructive",
      });
      return;
    }
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo permitido é 2MB",
        variant: "destructive",
      });
      return;
    }
    
    uploadFile(file);
  };
  
  const uploadFile = async (file: File) => {
    setIsUploading(true);
    
    try {
      const formData = new FormData();
      formData.append("logo", file);
      
      const response = await fetch("/api/upload/logo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao fazer upload: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        updateLogo(data.logoUrl);
        toast({
          title: "Logo atualizado com sucesso",
          description: "Seu novo logo está disponível em todo o sistema",
        });
      } else {
        throw new Error(data.message || "Erro desconhecido ao fazer upload");
      }
    } catch (error) {
      toast({
        title: "Falha ao fazer upload",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleButtonClick = () => {
    document.getElementById("logo-upload")?.click();
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Logotipo e Marca</CardTitle>
        <CardDescription>
          Personalize a identidade visual da sua empresa
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div>
          <h3 className="text-lg font-medium mb-2">Logotipo da Empresa</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Este logotipo será exibido no painel e em todas as comunicações
          </p>
          
          <div 
            className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center ${
              dragActive ? "border-primary bg-primary/5" : "border-muted"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {isLoading ? (
              <Skeleton className="h-16 w-40 mb-4" />
            ) : logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-16 mb-4" />
            ) : (
              <div className="flex items-center justify-center h-16 w-40 bg-muted mb-4 rounded">
                <span className="text-2xl font-bold text-muted-foreground">LigAI</span>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground mb-2">
              Arraste e solte um arquivo, ou
            </p>
            <Button 
              onClick={handleButtonClick}
              disabled={isUploading}
              className="flex items-center"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isUploading ? "Enviando..." : "Carregar arquivo"}
            </Button>
            <input
              id="logo-upload"
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleChange}
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground mt-2">
              PNG, JPG ou SVG (máx. 2MB)
            </p>
          </div>
        </div>
        
        <div className="mt-8">
          <h3 className="text-lg font-medium mb-2">Cores da Marca</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Personalize as cores primárias da sua marca
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Cor Primária
              </label>
              <div className="flex">
                <div className="w-10 h-10 rounded-l-md bg-primary border border-border"></div>
                <input 
                  type="text" 
                  value="#047857" 
                  readOnly
                  className="w-full rounded-r-md border border-l-0 border-border bg-background px-3"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Cor Secundária
              </label>
              <div className="flex">
                <div className="w-10 h-10 rounded-l-md bg-secondary border border-border"></div>
                <input 
                  type="text" 
                  value="#4f46e5" 
                  readOnly
                  className="w-full rounded-r-md border border-l-0 border-border bg-background px-3"
                />
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">
              Personalização avançada de cores estará disponível em breve.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
