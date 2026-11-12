const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const c = require('../controllers');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler: h } = require('../middleware/error');
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true });

router.post('/auth/register', authLimiter, h(c.register));
router.post('/auth/login', authLimiter, h(c.login));
router.use(authenticate);                                     // everything below requires a valid JWT
router.get('/users/me', h(c.me));
router.put('/users/me', h(c.updateProfile));
router.get('/dashboard', h(c.dashboard));
router.post('/payments/request', h(c.requestPayment));
router.get('/transactions', h(c.listTransactions));
router.get('/transactions/export.csv', h(c.exportCsv));
router.get('/transactions/:id', h(c.getTransaction));
router.get('/approvals/pending', h(c.pendingApprovals));
router.post('/approvals/:id/approve', h(c.decide('APPROVE')));
router.post('/approvals/:id/reject', h(c.decide('REJECT')));
router.get('/limits', h(c.getLimits));
router.put('/limits', h(c.updateLimits));
router.get('/merchants', h(c.listMerchants));
router.patch('/merchants/:id/status', h(c.setMerchantStatus));
router.post('/agent/run', h(c.agentRun));
router.get('/notifications', h(c.notifications));
router.get('/audit-logs', requireRole('admin'), h(c.auditLogs));
module.exports = router;
