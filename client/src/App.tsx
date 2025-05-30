import { AuthProvider } from "@/hooks/use-auth";
import { Switch, Route } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import SettingsPage from "@/pages/settings-page";
import AiAgentPage from "@/pages/ai-agent-page";
import ProspectingPage from "@/pages/prospecting-page";
import ConnectionPage from "@/pages/connection-page";
// import ChatPage from "@/pages/chat-page";
import ChatWebView from "@/pages/chat-page-new";

import WhatsappWebPage from "@/pages/whatsapp-web";
import EvolutionChatPage from "@/pages/evolution-chat";
import MessageSendingPage from "@/pages/message-sending-page";
import AdminUsersPage from "@/pages/admin-users-page";
import UserPermissionsPage from "@/pages/user-permissions-page";
import ServerManagementPage from "@/pages/server-management-page";
import ConnectionsPage from "@/pages/connections";
import WhatsAppQrCodePage from "@/pages/connections/whatsapp-qr-code";
import WhatsAppMetaPage from "@/pages/connections/whatsapp-meta";
import ConnectionsSettingsPage from "@/pages/connections-settings-page";
import ContactsPageNew from "@/pages/contacts-page-new";
import MetaTestPage from "@/pages/meta-test-page";
import ChatOtimizado from "@/pages/chat-otimizado";
import ReportsPage from "@/pages/reports-page";
import { ProtectedRoute } from "./lib/protected-route";
import { ThemeProvider } from "@/hooks/use-theme";
import { SidebarProvider } from "@/providers/sidebar-provider";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/dashboard" component={DashboardPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/ai-agent" component={AiAgentPage} />
      <ProtectedRoute path="/prospecting" component={ProspectingPage} />
      <ProtectedRoute path="/conexoes" component={ConnectionsPage} />
      <ProtectedRoute path="/conexoes/whatsapp-qr-code" component={WhatsAppQrCodePage} />
      <ProtectedRoute path="/conexoes/whatsapp-meta" component={WhatsAppMetaPage} />
      <ProtectedRoute path="/connection" component={ConnectionPage} />
      <ProtectedRoute path="/contatos" component={ContactsPageNew} />

      <ProtectedRoute path="/whatsapp-web" component={WhatsappWebPage} />
      <ProtectedRoute path="/new-chat" component={WhatsappWebPage} />
      <ProtectedRoute path="/evolution-chat" component={EvolutionChatPage} />
      <ProtectedRoute path="/message-sending" component={MessageSendingPage} />
      <ProtectedRoute path="/admin-users" component={AdminUsersPage} />
      <ProtectedRoute path="/admin-users/permissions/:userId" component={UserPermissionsPage} />
      <ProtectedRoute path="/servers" component={ServerManagementPage} />
      <Route path="/meta-test" component={MetaTestPage} />
      <ProtectedRoute path="/chat-otimizado" component={ChatOtimizado} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <SidebarProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </SidebarProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;