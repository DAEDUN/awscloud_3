# Study Room Reservation and Access Check

Node.js + Express + React full-stack app for managing study rooms, reservations, and entry-code checks.

## Local Setup

1. Create a MySQL database and user.
   You can use `server/schema/create-database.sql` as a starting point:

```bash
mysql -u root -p < server/schema/create-database.sql
```

   If local root login fails with `ERROR 1045`, reset or recover your local MySQL root password first. On macOS Oracle MySQL installs, this is commonly done from System Settings or the MySQL preference pane by stopping MySQL and restarting it after password recovery.

2. Copy `.env.example` to `.env` and update the DB settings.
3. Install dependencies:

```bash
npm run install:all
```

4. Run in development:

```bash
npm run dev
```

5. Build and run as a single Node server:

```bash
npm run build
npm start
```

The production server serves both `/api/*` and the React build from `client/dist`.

## RDS Migration

The app uses standard MySQL connection environment variables. To move from MySQL on EC2 to Amazon RDS, keep the schema the same and update `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`.

## Demo Roles

The first screen lets you choose one of three roles:

- Student
- Space manager
- Access checker

The app seeds demo users and rooms automatically on server startup when the configured database is empty.
