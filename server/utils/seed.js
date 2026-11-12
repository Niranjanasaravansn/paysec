require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
(async () => {
  const hash = await bcrypt.hash('Demo@1234', 12);
  await pool.query(`INSERT IGNORE INTO users (id,name,email,password_hash,role) VALUES (1,'Demo User','demo@paysec.dev',?, 'user'),(2,'Admin','admin@paysec.dev',?, 'admin'),(3,'Other User','other@paysec.dev',?, 'user')`, [hash, hash, hash]);
  await pool.query(`INSERT IGNORE INTO user_spending_limits (user_id,max_transaction,daily_limit,monthly_limit) VALUES (1,50000,80000,200000),(2,50000,80000,200000),(3,50000,80000,200000)`);
  await pool.query(`INSERT IGNORE INTO merchants (id,merchant_code,name,category,trust_score,status) VALUES
    (1,'M-AMZ','Amazon India','Retail',96,'TRUSTED'),(2,'M-FLK','Flipkart','Retail',92,'TRUSTED'),(3,'M-CRM','Croma','Electronics',88,'TRUSTED'),
    (4,'M-SHD','ShadyDeals','Retail',35,'UNVERIFIED'),(5,'M-FRD','QuickCashOffers','Unknown',8,'BLOCKED')`);
  console.log('Seeded. Login: demo@paysec.dev / Demo@1234 (admin@paysec.dev, other@paysec.dev share the password)');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
