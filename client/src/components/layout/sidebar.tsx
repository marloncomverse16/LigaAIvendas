import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  UsersRound,
  Calendar,
  UserSearch,
  PhoneCall,
  MessageSquare,
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  User,
  Bot,
  Send,
  MessagesSquare,
  Server
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSidebar } from "@/providers/sidebar-provider";

export function Sidebar() {
  const { user, logoutMutation } = useAuth();
  const { logoUrl } = useTheme();
  const [location] = useLocation();
  const { collapsed, toggleCollapsed } = useSidebar();
  
  const getInitials = (name?: string | null) => {
    if (!name) return "U";
    return name.charAt(0).toUpperCase();
  };
  
  const menuItems = [
    // 1 - Dashboard
    { 
      path: "/dashboard", 
      label: "Dashboard", 
      icon: <LayoutDashboard size={collapsed ? 24 : 20} />,
      permissionKey: "accessDashboard"
    },
    // 2 - Conexões
    { 
      path: "/conexoes", 
      label: "Conexões", 
      icon: <MessageSquare size={collapsed ? 24 : 20} />, 
      permissionKey: "accessWhatsapp"
    },
    // 3 - Prospecção
    { 
      path: "/prospecting", 
      label: "Prospecção", 
      icon: <UserSearch size={collapsed ? 24 : 20} />, 
      permissionKey: "accessProspecting"
    },
    // 4 - Envio de Mensagens
    { 
      path: "/message-sending", 
      label: "Envio de Mensagens", 
      icon: <Send size={collapsed ? 24 : 20} />, 
      permissionKey: "accessWhatsapp"
    },
    // 5 - Agente de IA
    { 
      path: "/ai-agent", 
      label: "Agente de IA", 
      icon: <Bot size={collapsed ? 24 : 20} />,
      permissionKey: "accessAiAgent"
    },
    // 6-9 - Bloco CHAT, Leads, Agendamentos, Contatos
    { 
      path: "/chat-otimizado", 
      label: "CHAT", 
      icon: <MessagesSquare size={collapsed ? 24 : 20} />, 
      permissionKey: "accessWhatsapp"
    },
    { 
      path: "/leads", 
      label: "Leads", 
      icon: <Users size={collapsed ? 24 : 20} />, 
      permissionKey: "accessLeads"
    },
    { 
      path: "/appointments", 
      label: "Agendamentos", 
      icon: <Calendar size={collapsed ? 24 : 20} />, 
      permissionKey: "accessScheduling"
    },
    { 
      path: "/contatos", 
      label: "Contatos", 
      icon: <PhoneCall size={collapsed ? 24 : 20} />, 
      permissionKey: "accessContacts"
    },
    // 10 - Relatórios
    { 
      path: "/reports", 
      label: "Relatórios", 
      icon: <Users size={collapsed ? 24 : 20} />, 
      permissionKey: "accessReports"
    },
    // 11 - Gerenciar Usuários
    { 
      path: "/admin-users", 
      label: "Gerenciar Usuários", 
      icon: <UsersRound size={collapsed ? 24 : 20} />, 
      permissionKey: "isAdmin"  // Somente administradores
    },
    // 12 - Gerenciar Servidores
    { 
      path: "/servers", 
      label: "Gerenciar Servidores", 
      icon: <Server size={collapsed ? 24 : 20} />, 
      permissionKey: "isAdmin"  // Somente administradores
    },
    // 13 - Configurações
    { 
      path: "/settings", 
      label: "Configurações", 
      icon: <Settings size={collapsed ? 24 : 20} />, 
      permissionKey: "accessSettings"
    },
  ];
  
  return (
    <aside className={cn(
      "fixed left-0 top-0 z-20 h-screen bg-sidebar transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex h-full flex-col justify-between">
        <div className="flex flex-col">
          {/* Logo */}
          <div className={cn(
            "flex items-center p-4",
            collapsed ? "justify-center" : "justify-start"
          )}>
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-10" />
            ) : (
              <div className="flex items-center justify-center w-10 h-10 bg-sidebar-primary text-white font-bold rounded-md">L</div>
            )}
            {/* Nome da aplicação removido conforme solicitado */}
          </div>
          
          {/* Toggle button */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute -right-3 top-6 h-6 w-6 rounded-full bg-sidebar-primary text-white border border-sidebar-border" 
            onClick={toggleCollapsed}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </Button>
          
          {/* Navigation */}
          <ScrollArea className="flex-1 pt-4">
            <ul className="space-y-1 px-2">
              {menuItems.map((item) => {
                // Verificar permissão do usuário para este item
                const hasPermission = item.permissionKey === "isAdmin" 
                  ? user?.isAdmin 
                  : user?.[item.permissionKey as keyof typeof user] !== false;
                
                // Não renderizar o item se o usuário não tiver permissão
                if (!hasPermission) return null;
                
                return (
                  <li key={item.path}>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link 
                            href={item.path} 
                            className={cn(
                              "flex items-center px-4 py-3 rounded-md relative group",
                              collapsed ? "justify-center" : "justify-start",
                              location === item.path 
                                ? "bg-sidebar-primary text-white" 
                                : "text-white/80 hover:text-white hover:bg-sidebar-primary"
                            )}
                          >
                            <span className="flex-shrink-0">{item.icon}</span>
                            {!collapsed && <span className="ml-3">{item.label}</span>}
                          </Link>
                        </TooltipTrigger>
                        {collapsed && (
                          <TooltipContent side="right">
                            {item.label}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </div>
        
        {/* User profile */}
        <div className="p-4 border-t border-sidebar-border">
          <div className={cn(
            "flex items-center",
            collapsed ? "justify-center" : "justify-start"
          )}>
            <Avatar className="h-10 w-10 border-2 border-sidebar-border">
              <AvatarFallback className="bg-sidebar-primary text-white">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            
            {!collapsed && (
              <div className="ml-3">
                <p className="text-white font-medium">{user?.name || user?.username}</p>
                <p className="text-white/70 text-sm">{user?.company || "Minha conta"}</p>
              </div>
            )}
            
            {!collapsed && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="ml-auto text-white/80 hover:text-white hover:bg-sidebar-primary" 
                onClick={() => logoutMutation.mutate()}
              >
                <LogOut size={18} />
              </Button>
            )}
          </div>
          
          {collapsed && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="mt-2 w-full text-white/80 hover:text-white hover:bg-sidebar-primary" 
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut size={18} />
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
