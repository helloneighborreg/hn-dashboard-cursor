import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { isAdmin, isCleaner } from '../lib/roles';
import { getDefaultNavPermissions } from '../lib/navPermissions';

const AuthContext = createContext({
	user: null,
	isAdmin: false,
	isCleaner: false,
	navPermissions: getDefaultNavPermissions(),
	setNavPermissions: () => {},
});

export function AuthProvider({ user, navPermissions: initialNavPermissions, children }) {
	const [navPermissions, setNavPermissionsState] = useState(
		initialNavPermissions || getDefaultNavPermissions(),
	);

	useEffect(() => {
		setNavPermissionsState(initialNavPermissions || getDefaultNavPermissions());
	}, [initialNavPermissions]);

	const setNavPermissions = useCallback((next) => {
		setNavPermissionsState(next || getDefaultNavPermissions());
	}, []);

	const value = useMemo(
		() => ({
			user: user || null,
			isAdmin: isAdmin(user),
			isCleaner: isCleaner(user),
			navPermissions,
			setNavPermissions,
		}),
		[user, navPermissions, setNavPermissions],
	);
	return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
	return useContext(AuthContext);
}
