// Entry point for Vercel. Vercel treats any file under /api as a
// serverless function — it calls the exported function with (req, res) on
// every request. An Express app is already callable with that exact
// signature, so we can hand it over as-is; no rewrite of app.js needed.
const app = require('../app');

module.exports = app;
