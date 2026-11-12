import { createContext } from 'react';

export type Role = 'admin' | 'user';

export interface User {
  id: string;
  username: string;
  role: Role;
  email: string;
}

export interface AuthContextType {
  currentUser: User | null;
  users: User[];
  login: () => Promise<boolean>;
  logout: () => Promise<void>;
  addUser: (email: string, role?: Role) => Promise<boolean>;
  removeUser: (id: string) => Promise<void>;
  loading: boolean;
  authError: string;
}

export const AuthContext = createContext<AuthContextType | null>(null);
