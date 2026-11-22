import { createWhiteboardServer } from "./server";

const port = Number(process.env.PORT ?? 3001);
const { http } = createWhiteboardServer({
  staticDir: process.env.STATIC_DIR, // set in Docker to serve the built React app
  corsOrigin: process.env.CORS_ORIGIN, // e.g. http://localhost:5173 in development
});

http.listen(port, () => console.log(`Whiteboard server on http://localhost:${port}`));
