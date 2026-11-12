require('dotenv').config();
if (!process.env.JWT_SECRET) { console.error('JWT_SECRET is required'); process.exit(1); }
const port = process.env.PORT || 5000;
require('./app').listen(port, () => console.log(`PaySec API on :${port}`));
