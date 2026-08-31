import { AdminAnalyticsDashboard } from '../../../src/admin/analytics/AdminAnalyticsDashboard';
import { AdminGate } from '../../../src/admin/auth/AdminGate';

export default function AdminAnalyticsPage() {
  return (
    <AdminGate>
      <AdminAnalyticsDashboard />
    </AdminGate>
  );
}
