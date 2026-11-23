const { renderEmail } = require('../../core/baseTemplate');

module.exports = ({ userName, daysUntilExpiry, changePasswordUrl, ipAddress }) =>
  renderEmail({
    theme: 'warning',
    eyebrow: 'Security Notice',
    title: `Your Password Expires in ${daysUntilExpiry} Day${daysUntilExpiry !== 1 ? 's' : ''}`,
    moduleName: 'Security',
    previewText: `Your RetailOps password expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}`,
    greetingName: userName || 'there',
    introParagraph: `Your current password will expire in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? 's' : ''}. Please update your password to maintain uninterrupted access to your account.`,
    cta: { label: 'Change Password Now', url: changePasswordUrl, accent: true },
    alert: { title: 'Action Required', text: 'If you do not update your password before it expires, you will be required to reset it on your next login.' },
    dataRows: [
      { label: 'Days Remaining', value: String(daysUntilExpiry) },
      { label: 'IP Address', value: ipAddress || 'Unknown' },
      { label: 'Time', value: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }
    ],
    dataTitle: 'Expiry Details',
    contextNote: 'You received this because your RetailOps account password is approaching its expiration date.',
  });