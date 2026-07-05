// Entry point for Railway or running locally — starts the shared app
// (app.js) as a normal always-on server. Vercel doesn't use this file; see
// api/index.js for that.
const app = require('./app');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Artwork server listening on :${PORT}`));
