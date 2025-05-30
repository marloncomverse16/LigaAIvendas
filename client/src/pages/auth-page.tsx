import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";

import { Loader2, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function AuthPage() {
  const { loginMutation, user, isLoading } = useAuth();
  const { theme, toggleTheme, logoUrl } = useTheme();
  const [, navigate] = useLocation();
  
  // If user is already logged in, redirect to dashboard
  if (user) {
    navigate("/dashboard");
    return null;
  }
  
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
  });
  
  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({
      email: data.email,
      password: data.password,
    });
  };
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="w-full md:w-1/2 bg-card flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="flex justify-center mb-4">
              <Logo size="lg" />
            </div>
            <p className="text-muted-foreground mt-2">Plataforma inteligente de comunicação e prospecção</p>
          </div>
          
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="seu@email.com" 
                        type="email" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>Senha</FormLabel>
                      <Button variant="link" className="p-0 h-auto text-xs">
                        Esqueceu a senha?
                      </Button>
                    </div>
                    <FormControl>
                      <Input 
                        placeholder="••••••••" 
                        type="password" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={loginForm.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Checkbox 
                        checked={field.value} 
                        onCheckedChange={field.onChange} 
                      />
                    </FormControl>
                    <FormLabel className="text-sm cursor-pointer">Lembrar de mim</FormLabel>
                  </FormItem>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600 text-white border-0" 
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Entrar
              </Button>
            </form>
          </Form>
          
          <div className="mt-6 flex justify-center">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={toggleTheme}
              className="text-xs text-muted-foreground flex items-center"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="mr-1 h-4 w-4" />
                  <span>Modo claro</span>
                </>
              ) : (
                <>
                  <Moon className="mr-1 h-4 w-4" />
                  <span>Modo escuro</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
      
      <div className="hidden md:block md:w-1/2 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/90 to-yellow-500/90 flex items-center justify-center">
          <div className="text-white p-8 max-w-lg text-center">
            <h2 className="text-3xl font-bold mb-4">Potencialize seu negócio com automação inteligente</h2>
            <p className="text-lg mb-8">Gerencie leads, prospecções e disparos de mensagens em um só lugar de forma eficiente.</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-white/10 rounded-lg">
                <div className="text-2xl mb-2">🚀</div>
                <p>Automação de disparos</p>
              </div>
              <div className="p-4 bg-white/10 rounded-lg">
                <div className="text-2xl mb-2">🎯</div>
                <p>Gestão de leads</p>
              </div>
              <div className="p-4 bg-white/10 rounded-lg">
                <div className="text-2xl mb-2">📊</div>
                <p>Análise de métricas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
