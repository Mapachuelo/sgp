const express = require("express");
const path = require("path");
const { apiRouter } = require("./routes/api.routes");
const { uiRouter } = require("./features/ui/ui.routes");
const { notFound } = require("./shared/middlewares/notFound.middleware");
const { errorHandler } = require("./shared/middlewares/error.middleware");
const { logRequest, logger } = require("./shared/logger");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use("/ui-assets/styles", express.static(path.join(__dirname, "features/ui/styles")));
app.use("/ui-assets/scripts", express.static(path.join(__dirname, "features/ui/scripts")));

app.use(logRequest);

app.get("/health", (_req, res) => {
  res.json({ ok: true, status: "up" });
});

app.use(uiRouter);
app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);

logger.info("SGP application initialized");

module.exports = { app };
