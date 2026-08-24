import { motion } from 'framer-motion';
import { Building2, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Workspace {
  id: string;
  name: string;
  code: string;
  role: string;
}

interface WorkspaceSelectorProps {
  userName: string;
  workspaces: Workspace[];
  onSelectWorkspace: (workspaceId: string) => void;
}

export function WorkspaceSelector({ userName, workspaces, onSelectWorkspace }: WorkspaceSelectorProps) {
  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-black text-foreground">Welcome back, {userName} 👋</h2>
        <p className="text-xs text-muted-foreground">
          You have access to multiple hostel workspaces. Select the branch to launch:
        </p>
      </div>

      <div className="space-y-3">
        {workspaces.map((ws) => (
          <motion.div
            key={ws.id}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectWorkspace(ws.id)}
            className="cursor-pointer bg-card border border-border/80 hover:border-primary rounded-xl p-4 flex items-center justify-between shadow-md transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                  {ws.name}
                </h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-mono">{ws.code}</span>
                  <span>•</span>
                  <span>{ws.role}</span>
                </div>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
