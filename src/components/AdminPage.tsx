import { AdminDashboard } from './AdminDashboard';

interface AdminPageProps {
  onBackHome: () => void;
  onOpenWorkspace: () => void;
}

export function AdminPage({ onBackHome, onOpenWorkspace }: AdminPageProps) {
  return <AdminDashboard onBackHome={onBackHome} onOpenWorkspace={onOpenWorkspace} />;
}
