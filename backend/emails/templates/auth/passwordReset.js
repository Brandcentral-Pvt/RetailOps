const { renderEmail } = require('../../core/baseTemplate');

module.exports = ({ userName, resetUrl, expiresInMinutes = 60, ipAddress }) =>
  renderEmail({
    theme: 'auth',
    eyebrow: 'Password Reset',
    title: 'Reset Your Password',
    moduleName: 'Security',
    previewText: 'Reset your RetailOps password',
    greetingName: userName || 'there',
    introParagraph: `We received a request to reset your password. Click the button below to create a new password. This link expires in ${expiresInMinutes} minutes.`,
    cta: { label: 'Reset Password', url: resetUrl, accent: true },
    alert: { title: 'Security notice', text: 'If you did not request this password reset, please ignore this email or contact support immediately. Your password will not be changed unless you click the link above.' },
    dataRows: [
      { label: 'IP Address', value: ipAddress || 'Unknown' },
      { label: 'Time', value: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }
    ],
    dataTitle: 'Request Details',
    contextNote: 'You received this because someone requested a password reset for your RetailOps account.',
  });
