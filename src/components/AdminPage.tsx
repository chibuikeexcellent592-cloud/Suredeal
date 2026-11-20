import { AdminDashboard } from './AdminDashboard';

interface AdminPageProps {
  onBackHome: () => void;
  onOpenWorkspace: () => void;
  onPreviewMaintenance?: () => void;
}

export function AdminPage({ onBackHome, onOpenWorkspace, onPreviewMaintenance }: AdminPageProps) {
  return (
    <AdminDashboard
      onBackHome={onBackHome}
      onOpenWorkspace={onOpenWorkspace}
      onPreviewMaintenance={onPreviewMaintenance}
    />
  );
}
