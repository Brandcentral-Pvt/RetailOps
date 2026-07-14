const { renderEmail } = require('../../core/baseTemplate');

module.exports = ({ userName, email, password, dashboardUrl, invitedBy, role, sellers }) =>
  renderEmail({
    theme: 'auth',
    eyebrow: 'Welcome to RetailOps',
    title: 'Your Account Has Been Created',
    moduleName: 'Account',
    previewText: `Welcome to RetailOps, ${userName}! Your account credentials are ready.`,
    greetingName: userName || 'there',
    introParagraph: `Your RetailOps account has been created by ${invitedBy || 'your administrator'}. You can now access the platform using the credentials below.`,
    
    dataRows: [
      { label: 'Email Address', value: email },
      { label: 'Temporary Password', value: password || 'Set on first login', nowrap: true },
      { label: 'Dashboard URL', value: dashboardUrl || 'https://data.brandcentral.in' },
      { label: 'Role', value: role || 'Team Member' },
      { label: 'Invited By', value: invitedBy || 'Administrator' },
    ],
    dataTitle: 'Your Login Credentials',
    
    alert: { 
      title: 'Security: Change Your Password', 
      text: 'For security purposes, you will be required to change your temporary password after your first login. Please do not share these credentials with anyone.' 
    },
    
    checklist: [
      { text: 'Sign in with your email and temporary password' },
      { text: 'Change your password immediately after first login' },
      { text: 'Review your assigned sellers and permissions' },
      { text: 'Complete your profile setup' },
    ],
    
    cta: { label: 'Sign In to RetailOps', url: `${dashboardUrl || 'https://data.brandcentral.in'}/login`, accent: true },
    
    secondaryLink: { label: 'Visit RetailOps Website', url: dashboardUrl || 'https://data.brandcentral.in' },
    
    contextNote: `You received this because an account was created for you on the RetailOps platform by ${invitedBy || 'your administrator'}. If you did not expect this email, please contact support.`,
  });
