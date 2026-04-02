const express = require("express");
const { apiRouter } = require("./routes/api.routes");
const { uiRouter } = require("./features/ui/ui.routes");
const { notFound } = require("./shared/middlewares/notFound.middleware");
const { errorHandler } = require("./shared/middlewares/error.middleware");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, status: "up" });
});

app.use(uiRouter);
app.use("/api", apiRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = { app };
