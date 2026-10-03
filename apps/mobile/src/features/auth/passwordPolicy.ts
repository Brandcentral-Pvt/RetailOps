export type PasswordRequirement = {
  id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'symbol' | 'safeCharacters';
  label: string;
  met: boolean;
};

export function passwordRequirements(password: string): PasswordRequirement[] {
  return [
    { id: 'length', label: 'At least 12 characters', met: password.length >= 12 },
    { id: 'uppercase', label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { id: 'lowercase', label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { id: 'number', label: 'One number', met: /[0-9]/.test(password) },
    { id: 'symbol', label: 'One symbol', met: /[^A-Za-z0-9<]/.test(password) },
    { id: 'safeCharacters', label: 'No angle brackets', met: !password.includes('<') },
  ];
}

export function passwordIsCompliant(password: string): boolean {
  return passwordRequirements(password).every((requirement) => requirement.met);
}

export function passwordStrength(password: string): { label: 'Weak' | 'Fair' | 'Good' | 'Strong'; score: number } {
  const met = passwordRequirements(password)
    .filter((requirement) => requirement.id !== 'safeCharacters' && requirement.met).length;
  const score = Math.min(4, Math.max(0, met - 1));
  const label = score === 4 ? 'Strong' : score === 3 ? 'Good' : score === 2 ? 'Fair' : 'Weak';
  return { label, score };
}
