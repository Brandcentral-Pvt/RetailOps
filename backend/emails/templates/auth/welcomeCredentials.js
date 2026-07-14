const { renderEmail } = require('../../core/baseTemplate');

module.exports = ({ userName, email, password, dashboardUrl, invitedBy }) =>
  renderEmail({
    theme: 'auth',
    eyebrow: 'Welcome to RetailOps',
    title: 'Your Account is Ready',
    moduleName: 'Account',
    previewText: `Welcome to RetailOps! Your account credentials are ready.`,
    greetingName: userName || 'there',
    introParagraph: 'Your RetailOps account has been created. Use the credentials below to sign in for the first time.',
    dataRows: [
      { label: 'Email Address', value: email },
      { label: 'Temporary Password', value: password, nowrap: true },
      { label: 'Dashboard URL', value: dashboardUrl || 'https://data.brandcentral.in' },
      { label: 'Invited By', value: invitedBy || 'Administrator' },
    ],
    dataTitle: 'Your Login Credentials',
    alert: { 
      title: 'Important: Change your password', 
      text: 'For security, you will be required to change your temporary password after your first login. Please do not share these credentials with anyone.' 
    },
    cta: { label: 'Sign In to RetailOps', url: dashboardUrl || 'https://data.brandcentral.in/login', accent: true },
    contextNote: 'You received this because an account was created for you on the RetailOps platform.',
  });
