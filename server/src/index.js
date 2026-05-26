import 'dotenv/config';
import { createApp } from './app.js';
import { initializeDatabase } from './schema.js';

const port = Number(process.env.PORT || 3000);

await initializeDatabase();

createApp().listen(port, () => {
  console.log(`Study room app listening on http://localhost:${port}`);
});
