# MongoDB Atlas development setup

This project uses MongoDB Atlas in the browser/cloud. Do not install MongoDB Server locally.

1. Create or sign in to an Atlas account, create an organization, and create a project named `Niro Health Calculator Platform`.
2. Create a development cluster. Choose the `M0` Free tier when it is available for the project; otherwise choose the smallest tier that supports the required replica-set transactions. Choose AWS, GCP, or Azure and a region close to the development team. Name it `niro-dev`.
3. In **Database Access**, create a database user named `niro_app_dev`. Generate a long random password in a password manager. Give this user only `readWrite` on the `niro_dev` database. This database user is separate from the Atlas website account.
4. In **Network Access**, add the current development machine's public IP as a `/32` entry. Do not use `0.0.0.0/0` for normal development. Update the entry when the ISP changes the address.
5. Open **Database > Connect > Drivers**, select Node.js, and copy the SRV URI. Replace the placeholders and add the database name in the path:

   ```text
   mongodb+srv://<dbUser>:<urlEncodedPassword>@<cluster-host>/niro_dev?retryWrites=true&w=majority&appName=niro-platform
   ```

   Required pieces are the `mongodb+srv` scheme, the Atlas database username, the URL-encoded database password, the exact Atlas cluster host, the `niro_dev` database path, and the `retryWrites=true&w=majority` options. The SRV record discovers the cluster members; do not replace it with a standalone localhost URI.

6. Copy `.env.example` to the ignored root file `.env` and set:

   ```text
   MONGODB_URI=mongodb+srv://niro_app_dev:<urlEncodedPassword>@<cluster-host>/niro_dev?retryWrites=true&w=majority&appName=niro-platform
   MONGODB_DB_NAME=niro_dev
   MONGODB_SERVER_SELECTION_TIMEOUT_MS=10000
   MONGODB_MAX_POOL_SIZE=10
   ```

   If the password contains `:`, `/`, `?`, `#`, `[`, `]`, `@`, or other URI-reserved characters, URL-encode the password before placing it in `MONGODB_URI`.

7. Verify without exposing the URI:

   ```text
   npm run db:ping --workspace @niro/server
   ```

   A successful run prints only the connected database, host, and ready state. The current repository has no `.env` or Atlas credentials, so a local verification run remains intentionally blocked until the developer supplies these values.

## Troubleshooting

- `MONGODB_URI is not configured`: create the ignored root `.env` and set the URI.
- `Authentication failed`: check the Atlas **database** username/password, URL-encode special characters, and confirm the user has `readWrite` on `niro_dev`.
- `IP not allowed`: update the project's Network Access entry to the current public IP.
- SRV/DNS/TLS errors: use the exact Atlas URI, confirm the cluster is running, and check corporate DNS/firewall rules.
- Timeout or connection-pool errors: confirm the cluster is not paused and keep `MONGODB_MAX_POOL_SIZE` within the tier's limits.

Atlas SRV deployments are replica-set aware, which is required for the transaction helper in `apps/server/src/persistence/transactions.ts`. Every transaction must use the session passed to its reads and writes; the helper uses `ClientSession.withTransaction()` and ends the session in `finally`.

Never commit `.env`, `.env.local`, passwords, raw Atlas URIs, refresh tokens, JWT secrets, or database dumps. Store production values in a secrets manager/CI secret store and rotate credentials immediately if they are exposed.
