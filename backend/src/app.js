const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const env = require('./config/env');
const errorMiddleware = require('./shared/middlewares/error.middleware');
const notFoundMiddleware = require('./shared/middlewares/notFound.middleware');
const apiRoutes = require('./routes/api.routes');
const logger = require('./shared/logger');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.viteApiUrl,
    credentials: true,
  })
);
app.use(express.json());

app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.url }, 'Solicitud recibida');
  next();
});

app.use('/api', apiRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
