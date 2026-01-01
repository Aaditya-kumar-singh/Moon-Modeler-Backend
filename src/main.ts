import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server } from 'socket.io';
import { SocketHandler } from './gateway/socket.handler';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3002', 10);

console.log('🚀 Starting SchemaFlow Backend...');
console.log(`📍 Environment: ${dev ? 'development' : 'production'}`);
console.log(`📍 Port: ${port}`);

// Initialize Next.js app
console.log('⏳ Initializing Next.js...');
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
    console.log('✅ Next.js ready');
    console.log('⏳ Creating HTTP server...');

    const server = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url!, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error occurred handling', req.url, err);
            res.statusCode = 500;
            res.end('internal server error');
        }
    });

    console.log('⏳ Initializing Socket.IO...');
    // Initialize Socket.io on the same HTTP server
    const io = new Server(server, {
        path: '/api/socket/io',
        addTrailingSlash: false,
        cors: {
            origin: '*', // Allow all in dev. Restrict in prod
            methods: ["GET", "POST"]
        }
    });

    // Initialize our Socket Handler
    new SocketHandler(io);
    console.log('✅ Socket.IO ready');

    server.listen(port, () => {
        console.log('');
        console.log('🎉 ================================');
        console.log(`✅ Server ready on http://${hostname}:${port}`);
        console.log(`✅ Socket.IO ready on /api/socket/io`);
        console.log('🎉 ================================');
        console.log('');
    });
}).catch((err) => {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
});
