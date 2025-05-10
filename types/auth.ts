export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

export interface AuthStatus {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
}
