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
import MessageSendingPage from "@/pages/message-sending-page";
import AdminUsersPage from "@/pages/admin-users-page";
import UserPermissionsPage from "@/pages/user-permissions-page";
import { ProtectedRoute } from "./lib/protected-route";
import { ThemeProvider } from "@/hooks/use-theme";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/dashboard" component={DashboardPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/ai-agent" component={AiAgentPage} />
      <ProtectedRoute path="/prospecting" component={ProspectingPage} />
      <ProtectedRoute path="/connection" component={ConnectionPage} />
      <ProtectedRoute path="/message-sending" component={MessageSendingPage} />
      <ProtectedRoute path="/admin-users" component={AdminUsersPage} />
      <ProtectedRoute path="/admin-users/permissions/:userId" component={UserPermissionsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
