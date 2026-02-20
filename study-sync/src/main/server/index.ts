import { createLogger } from '@aryazos/ts-base/logging';
import { Server } from 'http';
import { createApp } from './app';

const logger = createLogger('com.aryazos.study-sync.server');
let server: Server | null = null;

export function startServer(port: number): void {
    const app = createApp();

    server = app.listen(port, () => {
        logger.info('REST API listening', {
            port,
            url: `http://localhost:${port}`,
        });
        logger.info('Swagger UI available', {
            url: `http://localhost:${port}/docs`,
        });
    });
}

export function stopServer(): void {
    if (server) {
        server.close();
        server = null;
        logger.info('Server stopped');
    }
}
