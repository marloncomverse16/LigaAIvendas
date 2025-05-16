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
import ChatPage from "@/pages/chat-page";
import MessageSendingPage from "@/pages/message-sending-page";
import AdminUsersPage from "@/pages/admin-users-page";
import UserPermissionsPage from "@/pages/user-permissions-page";
import ServerManagementPage from "@/pages/server-management-page";
// Removemos a importação das páginas que foram excluídas
import ContactsPage from "@/pages/contacts-page";
import MetaTestPage from "@/pages/meta-test-page";
import MetaDiagnosticPage from "@/pages/meta-diagnostic-page";
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
      <ProtectedRoute path="/conexoes" component={ConnectionPage} />
      <ProtectedRoute path="/contatos" component={ContactsPage} />
      <ProtectedRoute path="/chat" component={ChatPage} />
      <ProtectedRoute path="/message-sending" component={MessageSendingPage} />
      <ProtectedRoute path="/admin-users" component={AdminUsersPage} />
      <ProtectedRoute path="/admin-users/permissions/:userId" component={UserPermissionsPage} />
      <ProtectedRoute path="/servers" component={ServerManagementPage} />
      <Route path="/meta-test" component={MetaTestPage} />
      <Route path="/meta-diagnostic" component={MetaDiagnosticPage} />
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