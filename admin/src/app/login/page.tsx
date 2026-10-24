import type { Metadata } from 'next';

import { LoginScreen } from './login-form';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return <LoginScreen />;
}
