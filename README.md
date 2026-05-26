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

## Amazon RDS MySQL Setup

The app can use Amazon RDS for MySQL without changing the schema.

1. Create an Amazon RDS database with the MySQL engine.
2. Allow inbound TCP traffic on port `3306` from the machine or EC2 instance running this app.
3. Create the app database on RDS:

```bash
mysql -h your-rds-endpoint.ap-northeast-2.rds.amazonaws.com -P 3306 -u admin -p \
  < server/schema/create-database.sql
```

4. Copy `.env.example` to `.env` and update these values:

```env
DB_HOST=your-rds-endpoint.ap-northeast-2.rds.amazonaws.com
DB_PORT=3306
DB_USER=studyroom
DB_PASSWORD=studyroom_password
DB_NAME=studyroom_db
DB_SSL=true
DB_SSL_ALLOW_UNAUTHORIZED=false
DB_SSL_CA_PATH=
```

If your RDS instance does not require SSL, set `DB_SSL=false`. Keep `DB_SSL_ALLOW_UNAUTHORIZED=false` unless you are debugging a local certificate issue. If certificate verification fails, download the AWS RDS CA bundle and set `DB_SSL_CA_PATH` to the local certificate file path.

## Demo Roles

The first screen lets you choose one of three roles:

- Student
- Space manager
- Access checker

The app seeds demo users and rooms automatically on server startup when the configured database is empty.
