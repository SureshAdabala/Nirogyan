import { connectDatabase, disconnectDatabase } from '../apps/server/src/db/connection';
import { loadEnvironment, loadProjectEnvironment } from '../apps/server/src/config/env';
import { hashPassword } from '../apps/server/src/auth/service';
import {
  AdminUserModel,
  ADMIN_ROLES,
  type AdminRole,
} from '../apps/server/src/persistence/models/admin-user';

async function main(): Promise<void> {
  loadProjectEnvironment();
  const environment = loadEnvironment();
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const roleValue = process.env.ADMIN_BOOTSTRAP_ROLE ?? 'admin';
  if (!email || !password)
    throw new Error(
      'ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD are required for the one-time bootstrap.',
    );
  if (!ADMIN_ROLES.includes(roleValue as AdminRole))
    throw new Error(`ADMIN_BOOTSTRAP_ROLE must be one of: ${ADMIN_ROLES.join(', ')}.`);
  if (!/^\S+@\S+\.\S+$/.test(email))
    throw new Error('ADMIN_BOOTSTRAP_EMAIL must be a valid email address.');
  await connectDatabase({ environment });
  try {
    const passwordHash = await hashPassword(password);
    const user = await AdminUserModel.findOneAndUpdate(
      { email },
      {
        $setOnInsert: {
          email,
          passwordHash,
          role: roleValue,
          status: 'active',
          failedLoginCount: 0,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (!user) throw new Error('Admin bootstrap did not return a user.');
    console.log(
      JSON.stringify({ status: 'ok', email: user.email, role: user.role, createdOrExisting: true }),
    );
  } finally {
    await disconnectDatabase();
  }
}

void main().catch(async (error: unknown) => {
  await disconnectDatabase();
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
