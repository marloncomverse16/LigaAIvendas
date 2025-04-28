import { useTheme } from "@/hooks/use-theme";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Moon, Sun, Loader2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const colorSchema = z.object({
  primaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: "Deve ser uma cor hexadecimal válida (ex: #047857)",
  }),
  secondaryColor: z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: "Deve ser uma cor hexadecimal válida (ex: #4f46e5)",
  }),
});

type ColorFormValues = z.infer<typeof colorSchema>;

export function ThemeSelector() {
  const { theme, toggleTheme, primaryColor, secondaryColor, updateColors } = useTheme();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  
  const form = useForm<ColorFormValues>({
    resolver: zodResolver(colorSchema),
    defaultValues: {
      primaryColor,
      secondaryColor,
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (data: ColorFormValues) => {
      const res = await apiRequest("PUT", "/api/settings", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Configurações atualizadas",
        description: "As cores do tema foram atualizadas com sucesso."
      });
      
      // Update theme colors
      updateColors({
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar configurações",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      setSubmitting(false);
    }
  });
  
  const onSubmit = (data: ColorFormValues) => {
    setSubmitting(true);
    updateSettingsMutation.mutate(data);
  };
  
  // Helper for theme preview
  const getThemePreviewClasses = (currentTheme: string, previewTheme: string) => {
    return currentTheme === previewTheme 
      ? "border-2 border-primary" 
      : "border border-border hover:border-primary/50 cursor-pointer";
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aparência</CardTitle>
        <CardDescription>
          Personalize o tema e as cores da interface
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div>
          <h3 className="text-lg font-medium mb-4">Tema</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <div 
              className={`rounded-lg p-4 flex-1 ${getThemePreviewClasses(theme, 'light')}`}
              onClick={() => theme === 'dark' && toggleTheme()}
            >
              <div className="bg-white rounded-md p-3 shadow-sm mb-3">
                <div className="w-full h-4 bg-gray-100 rounded mb-2"></div>
                <div className="w-2/3 h-4 bg-gray-100 rounded"></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Claro</span>
                <Sun className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
            
            <div 
              className={`rounded-lg p-4 flex-1 ${getThemePreviewClasses(theme, 'dark')}`}
              onClick={() => theme === 'light' && toggleTheme()}
            >
              <div className="bg-gray-800 rounded-md p-3 shadow-sm mb-3">
                <div className="w-full h-4 bg-gray-700 rounded mb-2"></div>
                <div className="w-2/3 h-4 bg-gray-700 rounded"></div>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">Escuro</span>
                <Moon className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center space-x-2">
            <Switch 
              id="theme-toggle" 
              checked={theme === 'dark'}
              onCheckedChange={() => toggleTheme()}
            />
            <label htmlFor="theme-toggle" className="text-sm cursor-pointer">
              {theme === 'dark' ? 'Modo escuro ativado' : 'Modo claro ativado'}
            </label>
          </div>
        </div>
        
        <div>
          <h3 className="text-lg font-medium mb-4">Cores Personalizadas</h3>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor Primária</FormLabel>
                      <div className="flex">
                        <div 
                          className="w-10 h-10 rounded-l-md border border-border"
                          style={{ backgroundColor: field.value }}
                        ></div>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="rounded-l-none" 
                          />
                        </FormControl>
                      </div>
                      <FormDescription>
                        Usado para botões, links e elementos de destaque
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="secondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor Secundária</FormLabel>
                      <div className="flex">
                        <div 
                          className="w-10 h-10 rounded-l-md border border-border"
                          style={{ backgroundColor: field.value }}
                        ></div>
                        <FormControl>
                          <Input 
                            {...field} 
                            className="rounded-l-none" 
                          />
                        </FormControl>
                      </div>
                      <FormDescription>
                        Usado para elementos complementares e destaques secundários
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="pt-2">
                <div className="p-4 bg-card border border-muted rounded-lg mb-4">
                  <h4 className="font-medium mb-2">Prévia das cores</h4>
                  <div className="flex flex-wrap gap-2">
                    <div 
                      className="h-8 w-24 rounded flex items-center justify-center text-white text-sm"
                      style={{ backgroundColor: form.watch('primaryColor') }}
                    >
                      Primária
                    </div>
                    <div 
                      className="h-8 w-24 rounded flex items-center justify-center text-white text-sm"
                      style={{ backgroundColor: form.watch('secondaryColor') }}
                    >
                      Secundária
                    </div>
                  </div>
                </div>
                
                <Button 
                  type="submit" 
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Salvar alterações
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </CardContent>
    </Card>
  );
}
