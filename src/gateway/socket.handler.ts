import { Server, Socket } from 'socket.io';
import { logSafe } from '@/common/lib/logger';
import { DiagramEvent } from '@/types/events';

// Define helper type for runtime extensions if needed
type DiagramEventPayload = DiagramEvent & {
    // Backend specific extensions if any
};

export class SocketHandler {
    private io: Server;

    constructor(io: Server) {
        this.io = io;
        this.setup();
    }

    private setup() {
        this.io.on('connection', (socket: Socket) => {
            logSafe('info', `Socket connected: ${socket.id}`);

            socket.on('join-room', (projectId: string) => {
                socket.join(projectId);
                logSafe('info', `Socket ${socket.id} joined room ${projectId}`);
            });

            socket.on('leave-room', (projectId: string) => {
                socket.leave(projectId);
            });

            socket.on('diagram-event', (event: DiagramEvent) => {
                // 1. Zod Validation (Ideal)
                // const validated = DiagramEventSchema.parse(event);

                // 2. Broadcast to others in room
                const { projectId } = event;
                if (!projectId) return;

                // Broadcast to everyone in room EXCEPT sender
                socket.to(projectId).emit('remote-event', event);

                // 3. (Optional) Ephemeral State / Persistence Queue
                // In a real system, push to Redis/BullMQ here
            });

            socket.on('cursor-move', (data: { projectId: string; x: number; y: number; userId: string; color: string }) => {
                const { projectId } = data;
                socket.to(projectId).emit('remote-cursor', data);
            });

            socket.on('disconnect', () => {
                // handle disconnect
            });
        });
    }
}
