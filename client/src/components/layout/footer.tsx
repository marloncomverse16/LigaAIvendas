import { cn } from "@/lib/utils";

export function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-card p-4 border-t border-border text-center text-sm text-muted-foreground">
      &copy; {currentYear} LiguIA. Todos os direitos reservados.
    </footer>
  );
}
