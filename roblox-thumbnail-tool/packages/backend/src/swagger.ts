import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Application } from 'express';
import { env } from './config/env';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Roblox Thumbnail Dataset API',
      version: '1.0.0',
      description: 'API for managing Roblox thumbnail collection jobs and datasets.',
    },
    servers: [
      {
        url: `http://localhost:${env.APP_PORT}`,
        description: 'Development Server',
      },
    ],
  },
  apis: ['./src/routes/*.ts'], // Path to the API docs in route files
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Application): void {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, { explorer: true }));
}
