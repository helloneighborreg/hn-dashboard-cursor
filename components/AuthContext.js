import { createContext, useContext, useMemo } from 'react';
import { isAdmin, isCleaner } from '../lib/roles';

const AuthContext = createContext({ user: null, isAdmin: false, isCleaner: false });

export function AuthProvider({ user, children }) {
	const value = useMemo(
		() => ({
			user: user || null,
			isAdmin: isAdmin(user),
			isCleaner: isCleaner(user),
		}),
		[user],
	);
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	return useContext(AuthContext);
}
