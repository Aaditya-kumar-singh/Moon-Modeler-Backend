import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { SocketHandler } from './gateway/socket.handler';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3002', 10);

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    const server = createServer(async (req, res) => {
        try {
            // Be sure to pass true as the second argument to url.parse.
            // This tells it to parse the query portion of the URL.
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    // Initialize Socket.io on the same HTTP server
    const io = new Server(server, {
        path: '/api/socket/io', // Use a distinct path
        addTrailingSlash: false,
        cors: {
            origin: '*', // Allow all in dev. Restrict in prod
            methods: ["GET", "POST"]
        }
    });

    // Initialize our Socket Handler
    new SocketHandler(io);

    server.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port} (Custom Server with Socket.io)`);
        console.log(`> Socket.io listening on /api/socket/io`);
    });
});
