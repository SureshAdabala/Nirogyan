import { AdminGate } from '../../src/admin/auth/AdminGate';
import { AdminHome } from '../../src/admin/studio/AdminHome';

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminHome />
    </AdminGate>
  );
}
