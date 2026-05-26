import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiRouter } from './routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(helmet({
    contentSecurityPolicy: false
  }));
  app.use(cors());
  app.use(express.json());

  app.use('/api', apiRouter);

  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  app.use((err, req, res, next) => {
    const status = err.status || 500;
    if (status >= 500) {
      console.error(err);
    }
    res.status(status).json({ message: err.message || '서버 오류가 발생했습니다.' });
  });

  return app;
}
