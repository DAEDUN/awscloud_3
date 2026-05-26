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

## S3 Frontend and EC2 API

When the React frontend is hosted on S3 static website hosting and the API runs on EC2, build the frontend with the EC2 API URL:

```bash
cd client
cp .env.example .env
npm run build
```

Set `VITE_API_BASE_URL` in `client/.env` before building:

```env
VITE_API_BASE_URL=http://your-ec2-public-ip:3000
```

Upload `client/dist` to the S3 bucket configured for static website hosting.

On the EC2 instance, set `CORS_ORIGIN` to the S3 static website URL:

```env
CORS_ORIGIN=http://your-bucket.s3-website.ap-northeast-2.amazonaws.com
```

Then run the API server on EC2:

```bash
npm start
```

The server starts even if RDS is temporarily unreachable. It retries database initialization every `DB_INIT_RETRY_INTERVAL_MS` milliseconds, defaulting to `30000`.

The security groups must allow:

- User browser to EC2 on the API port, usually `3000`
- EC2 to RDS on MySQL port `3306`

For production, put EC2 behind a domain or load balancer with HTTPS and set `VITE_API_BASE_URL` to that HTTPS URL. Vite embeds `VITE_API_BASE_URL` during the frontend build, so rebuild and re-upload `client/dist` after changing it.

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

### Connecting through an SSH tunnel

If the RDS instance is private, connect through an EC2 instance in the same VPC. Keep this SSH tunnel running in a separate terminal:

```bash
ssh -i /path/to/key.pem \
  -L 3307:your-rds-endpoint.ap-northeast-2.rds.amazonaws.com:3306 \
  ec2-user@your-ec2-public-ip
```

Then point the app to the local tunnel:

```env
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=studyroom
DB_PASSWORD=studyroom_password
DB_NAME=studyroom_db
DB_SSL=true
DB_SSL_ALLOW_UNAUTHORIZED=false
```

When the app runs on an EC2 instance in the same VPC as RDS, an SSH tunnel is usually not needed. Set `DB_HOST` to the RDS endpoint and allow the EC2 security group to access the RDS security group on port `3306`.

## Demo Roles

The first screen lets you choose one of three roles:

- Student
- Space manager
- Access checker

The app seeds demo users and rooms automatically on server startup when the configured database is empty.
