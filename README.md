# Study Room Reservation and Access Check

Node.js + Express + React full-stack app for managing study rooms, reservations, and entry-code checks.

## Docker Setup

Run the Node server and MySQL together with Docker Compose:

```bash
cp .env.example .env
docker compose up -d --build
```

The app will be available on:

```text
http://localhost:3000
```

Useful commands:

```bash
docker compose logs -f app
docker compose logs -f mysql
docker compose down
```

MySQL data is stored in the `mysql_data` Docker volume. To delete the database and start fresh:

```bash
docker compose down -v
```

The Docker setup uses these database values by default:

```env
DB_HOST=mysql
DB_PORT=3306
DB_USER=studyroom
DB_PASSWORD=studyroom_password
DB_NAME=studyroom_db
DB_SSL=false
```

The server starts even if MySQL is temporarily unreachable. It retries database initialization every `DB_INIT_RETRY_INTERVAL_MS` milliseconds, defaulting to `30000`.

## Local Node Setup

If you do not want to use Docker, create a MySQL database and user first. You can use `server/schema/create-database.sql` as a starting point:

```bash
mysql -u root -p < server/schema/create-database.sql
```

Then install dependencies and run the app:

```bash
npm run install:all
npm run dev
```

For production without Docker:

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
docker compose up -d --build
```

The security groups must allow:

- User browser to EC2 on the API port, usually `3000`

The MySQL container is not published to the EC2 public network. Only the app container can reach it through the Docker network.

For production, put EC2 behind a domain or load balancer with HTTPS and set `VITE_API_BASE_URL` to that HTTPS URL. Vite embeds `VITE_API_BASE_URL` during the frontend build, so rebuild and re-upload `client/dist` after changing it.

## Demo Roles

The first screen lets you choose one of three roles:

- Student
- Space manager
- Access checker

The app seeds demo users and rooms automatically on server startup when the configured database is empty.
