(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/contexts/AuthContext.jsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthProvider",
    ()=>AuthProvider,
    "useAuth",
    ()=>useAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$react$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/shared/dist/runtime/react/index.mjs [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
;
;
const AuthContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
const useAuth = ()=>{
    _s();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
_s(useAuth, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
const AuthProvider = ({ children })=>{
    _s1();
    const { user: clerkUser, isLoaded: userLoaded } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$react$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"])();
    const { signOut } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$react$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClerk"])();
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AuthProvider.useEffect": ()=>{
            if (userLoaded) {
                if (clerkUser) {
                    // Map Clerk user to your app's user format
                    const mappedUser = {
                        _id: clerkUser.id,
                        id: clerkUser.id,
                        name: clerkUser.fullName || clerkUser.username || clerkUser.emailAddresses[0].emailAddress,
                        email: clerkUser.emailAddresses[0].emailAddress,
                        role: clerkUser.publicMetadata.role || {
                            name: 'user'
                        },
                        isActive: true
                    };
                    setUser(mappedUser);
                    localStorage.setItem('user', JSON.stringify(mappedUser));
                } else {
                    setUser(null);
                    localStorage.removeItem('user');
                }
                setLoading(false);
            }
        }
    }["AuthProvider.useEffect"], [
        clerkUser,
        userLoaded
    ]);
    const login = async ()=>{
        console.warn('Manual login called while using Clerk. Use Clerk components instead.');
        return {
            success: false,
            error: 'Use Clerk for authentication'
        };
    };
    const register = async ()=>{
        console.warn('Manual register called while using Clerk. Use Clerk components instead.');
        return {
            success: false,
            error: 'Use Clerk for authentication'
        };
    };
    const logout = async ()=>{
        await signOut();
        setUser(null);
        localStorage.removeItem('user');
    };
    const value = {
        user,
        loading,
        error: null,
        login,
        register,
        logout,
        isAuthenticated: !!user
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AuthContext.Provider, {
        value: value,
        children: children
    }, void 0, false, {
        fileName: "[project]/src/contexts/AuthContext.jsx",
        lineNumber: 69,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0));
};
_s1(AuthProvider, "MMzItZldb898OqsfwmlfFU+tzEQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$react$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useUser"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$shared$2f$dist$2f$runtime$2f$react$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useClerk"]
    ];
});
_c = AuthProvider;
var _c;
__turbopack_context__.k.register(_c, "AuthProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/contexts/SocketContext.jsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SocketProvider",
    ()=>SocketProvider,
    "useSocket",
    ()=>useSocket
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/socket.io-client/build/esm/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$contexts$2f$AuthContext$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/contexts/AuthContext.jsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
;
;
;
const SocketContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])();
const useSocket = ()=>{
    _s();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(SocketContext);
};
_s(useSocket, "gDsCjeeItUuvgOWf1v4qoK9RF6k=");
const SocketProvider = ({ children })=>{
    _s1();
    const { user } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$contexts$2f$AuthContext$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    const [socket, setSocket] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "SocketProvider.useEffect": ()=>{
            if (user) {
                const newSocket = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$socket$2e$io$2d$client$2f$build$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["io"])('http://localhost:3001', {
                    transports: [
                        'websocket'
                    ],
                    autoConnect: true
                });
                setSocket(newSocket);
                newSocket.emit('join', user._id || user.id);
                return ({
                    "SocketProvider.useEffect": ()=>newSocket.close()
                })["SocketProvider.useEffect"];
            } else if (socket) {
                socket.close();
                setSocket(null);
            }
        }
    }["SocketProvider.useEffect"], [
        user
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SocketContext.Provider, {
        value: socket,
        children: children
    }, void 0, false, {
        fileName: "[project]/src/contexts/SocketContext.jsx",
        lineNumber: 31,
        columnNumber: 9
    }, ("TURBOPACK compile-time value", void 0));
};
_s1(SocketProvider, "c0GeYONYPmJcrsO8fGxrlhAsUo8=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$contexts$2f$AuthContext$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = SocketProvider;
var _c;
__turbopack_context__.k.register(_c, "SocketProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/services/api.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "asinApi",
    ()=>asinApi,
    "authApi",
    ()=>authApi,
    "dashboardApi",
    ()=>dashboardApi,
    "default",
    ()=>__TURBOPACK__default__export__,
    "revenueApi",
    ()=>revenueApi,
    "roleApi",
    ()=>roleApi,
    "seedApi",
    ()=>seedApi,
    "sellerApi",
    ()=>sellerApi,
    "settingsApi",
    ()=>settingsApi,
    "userApi",
    ()=>userApi
]);
const API_BASE = 'http://localhost:3001/api';
// Auth helper functions
const getAuthHeader = ()=>{
    const token = localStorage.getItem('authToken');
    return token ? {
        'Authorization': `Bearer ${token}`
    } : {};
};
const authApi = {
    login: async (email, password)=>{
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password
            })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Login failed');
        }
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('authToken', data.data.accessToken);
            localStorage.setItem('refreshToken', data.data.refreshToken);
            localStorage.setItem('user', JSON.stringify(data.data.user));
        }
        return data;
    },
    register: async (userData)=>{
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Registration failed');
        }
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('authToken', data.data.accessToken);
            localStorage.setItem('refreshToken', data.data.refreshToken);
            localStorage.setItem('user', JSON.stringify(data.data.user));
        }
        return data;
    },
    logout: async ()=>{
        const res = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            }
        });
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        return res.json();
    },
    getMe: async ()=>{
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to get user info');
        return res.json();
    },
    updateProfile: async (data)=>{
        const res = await fetch(`${API_BASE}/auth/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update profile');
        const result = await res.json();
        if (result.success) {
            localStorage.setItem('user', JSON.stringify(result.data));
        }
        return result;
    },
    changePassword: async (currentPassword, newPassword)=>{
        const res = await fetch(`${API_BASE}/auth/change-password`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to change password');
        }
        return res.json();
    },
    refreshToken: async ()=>{
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        const res = await fetch(`${API_BASE}/auth/refresh-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refreshToken
            })
        });
        if (!res.ok) throw new Error('Failed to refresh token');
        const data = await res.json();
        if (data.success) {
            localStorage.setItem('authToken', data.data.accessToken);
            localStorage.setItem('refreshToken', data.data.refreshToken);
        }
        return data;
    },
    getCurrentUser: ()=>{
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    },
    isAuthenticated: ()=>{
        return !!localStorage.getItem('authToken');
    }
};
const seedApi = {
    seedAll: async ()=>{
        const res = await fetch(`${API_BASE}/seed/seed-all`, {
            method: 'POST'
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to seed demo data');
        }
        return res.json();
    },
    getDashboard: async ()=>{
        const res = await fetch(`${API_BASE}/seed/dashboard`);
        if (!res.ok) throw new Error('Failed to get dashboard data');
        return res.json();
    }
};
const userApi = {
    getAll: async (params = {})=>{
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/users?${query}`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to fetch users');
        return res.json();
    },
    getById: async (id)=>{
        const res = await fetch(`${API_BASE}/users/${id}`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to fetch user');
        return res.json();
    },
    create: async (data)=>{
        const res = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to create user');
        }
        return res.json();
    },
    update: async (id, data)=>{
        const res = await fetch(`${API_BASE}/users/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update user');
        return res.json();
    },
    delete: async (id)=>{
        const res = await fetch(`${API_BASE}/users/${id}`, {
            method: 'DELETE',
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to delete user');
        return res.json();
    },
    toggleStatus: async (id)=>{
        const res = await fetch(`${API_BASE}/users/${id}/toggle-status`, {
            method: 'POST',
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to toggle user status');
        return res.json();
    },
    resetPassword: async (id, newPassword)=>{
        const res = await fetch(`${API_BASE}/users/${id}/reset-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                newPassword
            })
        });
        if (!res.ok) throw new Error('Failed to reset password');
        return res.json();
    }
};
const roleApi = {
    getAll: async (params = {})=>{
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/roles?${query}`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to fetch roles');
        return res.json();
    },
    getById: async (id)=>{
        const res = await fetch(`${API_BASE}/roles/${id}`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to fetch role');
        return res.json();
    },
    getPermissions: async ()=>{
        const res = await fetch(`${API_BASE}/roles/permissions`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to fetch permissions');
        return res.json();
    },
    create: async (data)=>{
        const res = await fetch(`${API_BASE}/roles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.message || 'Failed to create role');
        }
        return res.json();
    },
    update: async (id, data)=>{
        const res = await fetch(`${API_BASE}/roles/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update role');
        return res.json();
    },
    delete: async (id)=>{
        const res = await fetch(`${API_BASE}/roles/${id}`, {
            method: 'DELETE',
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to delete role');
        return res.json();
    }
};
const sellerApi = {
    getAll: async (params = {})=>{
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/sellers?${query}`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to fetch sellers');
        return res.json();
    },
    getById: async (id)=>{
        const res = await fetch(`${API_BASE}/sellers/${id}`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to fetch seller');
        return res.json();
    },
    create: async (data)=>{
        const res = await fetch(`${API_BASE}/sellers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to create seller');
        }
        return res.json();
    },
    update: async (id, data)=>{
        const res = await fetch(`${API_BASE}/sellers/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update seller');
        return res.json();
    },
    delete: async (id)=>{
        const res = await fetch(`${API_BASE}/sellers/${id}`, {
            method: 'DELETE',
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to delete seller');
        return res.json();
    },
    import: async (sellers)=>{
        const res = await fetch(`${API_BASE}/sellers/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                sellers
            })
        });
        if (!res.ok) throw new Error('Failed to import sellers');
        return res.json();
    },
    seedDemo: async ()=>{
        const res = await fetch(`${API_BASE}/sellers/seed`, {
            method: 'POST',
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to seed demo data');
        return res.json();
    }
};
const asinApi = {
    getAll: async (params = {})=>{
        const query = new URLSearchParams(params).toString();
        const res = await fetch(`${API_BASE}/asins?${query}`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to fetch ASINs');
        return res.json();
    },
    getBySeller: async (sellerId)=>{
        const res = await fetch(`${API_BASE}/asins/seller/${sellerId}`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to fetch ASINs');
        return res.json();
    },
    getById: async (id)=>{
        const res = await fetch(`${API_BASE}/asins/${id}`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to fetch ASIN');
        return res.json();
    },
    create: async (data)=>{
        const res = await fetch(`${API_BASE}/asins`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to create ASIN');
        }
        return res.json();
    },
    createBulk: async (asins)=>{
        const res = await fetch(`${API_BASE}/asins/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                asins
            })
        });
        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.error || 'Failed to create ASINs');
        }
        return res.json();
    },
    update: async (id, data)=>{
        const res = await fetch(`${API_BASE}/asins/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error('Failed to update ASIN');
        return res.json();
    },
    delete: async (id)=>{
        const res = await fetch(`${API_BASE}/asins/${id}`, {
            method: 'DELETE',
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to delete ASIN');
        return res.json();
    }
};
const REVENUE_API_BASE = 'http://localhost:3001/api/revenue';
const dashboardApi = {
    getSummary: async (period = '30d')=>{
        const res = await fetch(`${API_BASE}/dashboard?period=${period}`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to fetch dashboard data');
        return res.json();
    }
};
const revenueApi = {
    // Auth
    login: async (email, password)=>{
        const res = await fetch(`${REVENUE_API_BASE}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password
            })
        });
        if (!res.ok) throw new Error('Login failed');
        return res.json();
    },
    // Fees
    getFees: async (type)=>{
        const res = await fetch(`${REVENUE_API_BASE}/fees/${type}`);
        if (!res.ok) throw new Error(`Failed to fetch ${type} fees`);
        return res.json();
    },
    saveFee: async (type, fee)=>{
        const res = await fetch(`${REVENUE_API_BASE}/fees/${type}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(fee)
        });
        if (!res.ok) throw new Error(`Failed to save ${type} fee`);
        return res.json();
    },
    deleteFee: async (type, id)=>{
        const res = await fetch(`${REVENUE_API_BASE}/fees/${type}/${id}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error(`Failed to delete ${type} fee`);
        return res.json();
    },
    // Mappings
    getCategoryMappings: async ()=>{
        const res = await fetch(`${REVENUE_API_BASE}/mappings`);
        if (!res.ok) throw new Error('Failed to fetch category mappings');
        return res.json();
    },
    saveCategoryMapping: async (mapping)=>{
        const res = await fetch(`${REVENUE_API_BASE}/mappings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(mapping)
        });
        if (!res.ok) throw new Error('Failed to save category mapping');
        return res.json();
    },
    getNodeMaps: async ()=>{
        const res = await fetch(`${REVENUE_API_BASE}/nodemaps`);
        if (!res.ok) throw new Error('Failed to fetch node maps');
        return res.json();
    },
    saveNodeMap: async (nodeMap)=>{
        const res = await fetch(`${REVENUE_API_BASE}/nodemaps`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(nodeMap)
        });
        if (!res.ok) throw new Error('Failed to save node map');
        return res.json();
    },
    // ASINs
    getAsins: async ()=>{
        const res = await fetch(`${REVENUE_API_BASE}/asins`);
        if (!res.ok) throw new Error('Failed to fetch ASINs');
        return res.json();
    },
    addAsinsBulk: async (asins)=>{
        const res = await fetch(`${REVENUE_API_BASE}/asins/bulk`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(asins)
        });
        if (!res.ok) throw new Error('Failed to add ASINs');
        return res.json();
    },
    updateAsin: async (id, updates)=>{
        const res = await fetch(`${REVENUE_API_BASE}/asins/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update ASIN');
        return res.json();
    },
    deleteAsin: async (id)=>{
        const res = await fetch(`${REVENUE_API_BASE}/asins/${id}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete ASIN');
        return res.json();
    },
    deleteAllAsins: async ()=>{
        const res = await fetch(`${REVENUE_API_BASE}/asins`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete all ASINs');
        return res.json();
    },
    // Health check
    healthCheck: async ()=>{
        const res = await fetch(`${REVENUE_API_BASE}/health`);
        if (!res.ok) throw new Error('Health check failed');
        return res.json();
    }
};
const settingsApi = {
    getAll: async (group)=>{
        const query = group ? `?group=${group}` : '';
        const res = await fetch(`${API_BASE}/settings${query}`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
    },
    update: async (settings, group = 'general')=>{
        const res = await fetch(`${API_BASE}/settings/update`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify({
                settings,
                group
            })
        });
        if (!res.ok) throw new Error('Failed to update settings');
        return res.json();
    },
    getByKey: async (key)=>{
        const res = await fetch(`${API_BASE}/settings/${key}`, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error('Failed to fetch setting');
        return res.json();
    }
};
// Generic API Client
const api = {
    get: async (endpoint, params = {})=>{
        const query = new URLSearchParams(params).toString();
        const url = `${API_BASE}${endpoint}${query ? `?${query}` : ''}`;
        const res = await fetch(url, {
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error(`Request failed: ${res.statusText}`);
        return res.json();
    },
    post: async (endpoint, data)=>{
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`Request failed: ${res.statusText}`);
        return res.json();
    },
    put: async (endpoint, data)=>{
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeader()
            },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`Request failed: ${res.statusText}`);
        return res.json();
    },
    delete: async (endpoint)=>{
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'DELETE',
            headers: {
                ...getAuthHeader()
            }
        });
        if (!res.ok) throw new Error(`Request failed: ${res.statusText}`);
        return res.json();
    },
    // Namespaced APIs
    authApi,
    seedApi,
    dashboardApi,
    userApi,
    roleApi,
    sellerApi,
    asinApi,
    revenueApi,
    settingsApi
};
const __TURBOPACK__default__export__ = api;
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/services/octoparseService.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "cancelScrapeTask",
    ()=>cancelScrapeTask,
    "default",
    ()=>__TURBOPACK__default__export__,
    "deleteScrapeTask",
    ()=>deleteScrapeTask,
    "getScrapeTasks",
    ()=>getScrapeTasks,
    "getSettings",
    ()=>getSettings,
    "getTaskResults",
    ()=>getTaskResults,
    "getTaskStatus",
    ()=>getTaskStatus,
    "isConfigured",
    ()=>isConfigured,
    "startScrapeTask",
    ()=>startScrapeTask
]);
// Octoparse Cloud API Service
// Replaces Keepa API for Amazon product data scraping
const OCTOPARSE_API_BASE = 'https://cloudapi.octoparse.com/api';
const getSettings = ()=>{
    const savedSettings = localStorage.getItem('seller_hub_settings');
    return savedSettings ? JSON.parse(savedSettings) : {};
};
const isConfigured = ()=>{
    const settings = getSettings();
    return !!(settings.octoparseApiKey && settings.octoparseTaskId);
};
const startScrapeTask = async (asins, marketplace = 'amazon.in')=>{
    const settings = getSettings();
    if (!settings.octoparseApiKey || !settings.octoparseTaskId) {
        throw new Error('Octoparse API not configured. Please add your API credentials in Settings.');
    }
    // Simulate Octoparse API call
    // In production, this would call:
    // POST https://cloudapi.octoparse.com/api/scrape/start
    // with headers: { 'Authorization': settings.octoparseApiKey }
    const executionId = `EXEC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Store scrape task
    const scrapeTask = {
        executionId,
        taskId: settings.octoparseTaskId,
        asins,
        marketplace,
        status: 'RUNNING',
        progress: 0,
        startedAt: new Date().toISOString(),
        completedAt: null,
        error: null,
        errorMessage: null,
        resultsCount: 0,
        successCount: 0,
        failedCount: 0
    };
    // Save to localStorage for demo
    const existingTasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
    existingTasks.unshift(scrapeTask);
    localStorage.setItem('scrapeTasks', JSON.stringify(existingTasks));
    // Simulate async scraping
    simulateScrapeProgress(executionId);
    return {
        executionId,
        status: 'RUNNING',
        message: 'Scrape task started successfully'
    };
};
const simulateScrapeProgress = (executionId)=>{
    let progress = 0;
    const interval = setInterval(()=>{
        progress += Math.random() * 20;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            // Mark as completed
            const tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
            const taskIndex = tasks.findIndex((t)=>t.executionId === executionId);
            if (taskIndex >= 0) {
                tasks[taskIndex].status = 'COMPLETED';
                tasks[taskIndex].progress = 100;
                tasks[taskIndex].completedAt = new Date().toISOString();
                tasks[taskIndex].resultsCount = Math.floor(Math.random() * 5) + 1;
                tasks[taskIndex].successCount = tasks[taskIndex].resultsCount;
                tasks[taskIndex].failedCount = 0;
                localStorage.setItem('scrapeTasks', JSON.stringify(tasks));
            }
        } else {
            // Update progress
            const tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
            const taskIndex = tasks.findIndex((t)=>t.executionId === executionId);
            if (taskIndex >= 0) {
                tasks[taskIndex].progress = Math.round(progress);
                localStorage.setItem('scrapeTasks', JSON.stringify(tasks));
            }
        }
    }, 1000);
};
const getTaskStatus = async (executionId)=>{
    const tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
    const task = tasks.find((t)=>t.executionId === executionId);
    if (!task) {
        throw new Error('Scrape task not found');
    }
    return {
        executionId: task.executionId,
        status: task.status,
        progress: task.progress,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        error: task.error
    };
};
const getTaskResults = async (executionId)=>{
    const tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
    const task = tasks.find((t)=>t.executionId === executionId);
    if (!task) {
        throw new Error('Scrape task not found');
    }
    if (task.status !== 'COMPLETED') {
        return {
            results: [],
            count: 0,
            status: task.status,
            progress: task.progress
        };
    }
    // Generate mock results based on ASINs
    const results = task.asins.map((asinCode, idx)=>({
            asin: asinCode,
            title: `Product ${asinCode} - Scraped from Amazon`,
            price: Math.round((30 + Math.random() * 100) * 100) / 100,
            rating: Math.round((3.5 + Math.random() * 1.5) * 10) / 10,
            reviews: Math.floor(Math.random() * 2000),
            rank: Math.floor(Math.random() * 5000) + 100,
            marketplace: task.marketplace,
            scrapedAt: task.completedAt
        }));
    return {
        results,
        count: results.length,
        status: task.status,
        executionId: task.executionId
    };
};
const getScrapeTasks = async (page = 1, limit = 10)=>{
    const tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
    const start = (page - 1) * limit;
    const end = start + limit;
    return {
        tasks: tasks.slice(start, end),
        pagination: {
            page,
            limit,
            total: tasks.length,
            totalPages: Math.ceil(tasks.length / limit)
        }
    };
};
const cancelScrapeTask = async (executionId)=>{
    const tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
    const taskIndex = tasks.findIndex((t)=>t.executionId === executionId);
    if (taskIndex >= 0) {
        tasks[taskIndex].status = 'FAILED';
        tasks[taskIndex].error = 'Cancelled by user';
        tasks[taskIndex].completedAt = new Date().toISOString();
        localStorage.setItem('scrapeTasks', JSON.stringify(tasks));
    }
    return {
        success: true,
        message: 'Task cancelled'
    };
};
const deleteScrapeTask = async (executionId)=>{
    let tasks = JSON.parse(localStorage.getItem('scrapeTasks') || '[]');
    tasks = tasks.filter((t)=>t.executionId !== executionId);
    localStorage.setItem('scrapeTasks', JSON.stringify(tasks));
    return {
        success: true,
        message: 'Task deleted'
    };
};
const __TURBOPACK__default__export__ = {
    getSettings,
    isConfigured,
    startScrapeTask,
    getTaskStatus,
    getTaskResults,
    getScrapeTasks,
    cancelScrapeTask,
    deleteScrapeTask
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/services/db.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "db",
    ()=>db,
    "initializeDatabase",
    ()=>initializeDatabase
]);
const __TURBOPACK__import$2e$meta__ = {
    get url () {
        return `file://${__turbopack_context__.P("src/services/db.js")}`;
    }
};
// Database service for Revenue Calculator
// Calls the backend API for all operations
const API_BASE = ("TURBOPACK compile-time value", "object") !== 'undefined' && __TURBOPACK__import$2e$meta__.env?.VITE_API_URL || 'http://localhost:3001/api';
const initializeDatabase = async ()=>{
    console.log('[DB] Remote mode: MongoDB backend via API');
};
/**
 * Database Service Class
 */ class DatabaseService {
    /**
   * Make API request
   */ async request(path, options = {}, fallback = null) {
        try {
            const token = localStorage.getItem('authToken');
            const headers = {
                'Content-Type': 'application/json',
                ...token && {
                    'Authorization': `Bearer ${token}`
                },
                ...options.headers
            };
            const res = await fetch(`${API_BASE}${path}`, {
                ...options,
                headers
            });
            if (!res.ok) {
                if (res.status === 401) {
                    localStorage.removeItem('authToken');
                    window.location.href = '/login';
                }
                throw new Error(`HTTP ${res.status}`);
            }
            return await res.json();
        } catch (error) {
            console.error(`[DB] Request failed for ${path}:`, error);
            return fallback;
        }
    }
    // --- Auth & Config ---
    async login(email, password) {
        const user = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email,
                password
            })
        }, null);
        if (user) {
            localStorage.setItem('user', JSON.stringify(user));
            return user;
        }
        return null;
    }
    logout() {
        localStorage.removeItem('user');
    }
    getUser() {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
    }
    getKeepaKey() {
        return localStorage.getItem('fba_keepa_key') || '';
    }
    saveKeepaKey(key) {
        localStorage.setItem('fba_keepa_key', key);
    }
    saveUser(user) {
        const existing = this.getUser();
        const merged = {
            ...existing || {},
            ...user
        };
        localStorage.setItem('user', JSON.stringify(merged));
    }
    // --- Referral Fees ---
    /**
   * @returns {Promise<ReferralFee[]>}
   */ async getReferralFees() {
        return this.request('/fees/referral', {}, []);
    }
    /**
   * @param {ReferralFee | Omit<ReferralFee, 'id'>} fee
   */ async saveReferralFee(fee) {
        const data = {
            ...fee,
            id: fee.id || crypto.randomUUID()
        };
        await this.request('/fees/referral', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    /**
   * @param {Omit<ReferralFee, 'id'>[]} fees
   */ async saveReferralFeesBulk(fees) {
        for (const fee of fees){
            await this.saveReferralFee(fee);
        }
    }
    async deleteReferralFee(id) {
        await this.request(`/fees/referral/${id}`, {
            method: 'DELETE'
        }, null);
    }
    async clearReferralFees() {
        await this.request('/fees/referral/all', {
            method: 'DELETE'
        }, null);
    }
    // --- Closing Fees ---
    /**
   * @returns {Promise<ClosingFee[]>}
   */ async getClosingFees() {
        return this.request('/fees/closing', {}, []);
    }
    /**
   * @param {ClosingFee | Omit<ClosingFee, 'id'>} fee
   */ async saveClosingFee(fee) {
        const data = {
            ...fee,
            id: fee.id || crypto.randomUUID()
        };
        await this.request('/fees/closing', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    /**
   * @param {Omit<ClosingFee, 'id'>[]} fees
   */ async saveClosingFeesBulk(fees) {
        for (const fee of fees){
            await this.saveClosingFee(fee);
        }
    }
    async deleteClosingFee(id) {
        await this.request(`/fees/closing/${id}`, {
            method: 'DELETE'
        }, null);
    }
    async clearClosingFees() {
        await this.request('/fees/closing/all', {
            method: 'DELETE'
        }, null);
    }
    // --- Shipping Fees ---
    /**
   * @returns {Promise<ShippingFee[]>}
   */ async getShippingFees() {
        return this.request('/fees/shipping', {}, []);
    }
    /**
   * @param {ShippingFee | Omit<ShippingFee, 'id'>} fee
   */ async saveShippingFee(fee) {
        const data = {
            ...fee,
            id: fee.id || crypto.randomUUID()
        };
        await this.request('/fees/shipping', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    /**
   * @param {Omit<ShippingFee, 'id'>[]} fees
   */ async saveShippingFeesBulk(fees) {
        for (const fee of fees){
            await this.saveShippingFee(fee);
        }
    }
    async deleteShippingFee(id) {
        await this.request(`/fees/shipping/${id}`, {
            method: 'DELETE'
        }, null);
    }
    async clearShippingFees() {
        await this.request('/fees/shipping/all', {
            method: 'DELETE'
        }, null);
    }
    // --- Storage Fees ---
    /**
   * @returns {Promise<StorageFee[]>}
   */ async getStorageFees() {
        return this.request('/fees/storage', {}, []);
    }
    /**
   * @param {StorageFee | Omit<StorageFee, 'id'>} fee
   */ async saveStorageFee(fee) {
        const data = {
            ...fee,
            id: fee.id || crypto.randomUUID()
        };
        await this.request('/fees/storage', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    async deleteStorageFee(id) {
        await this.request(`/fees/storage/${id}`, {
            method: 'DELETE'
        }, null);
    }
    // --- Category Mapping ---
    /**
   * @returns {Promise<CategoryMap[]>}
   */ async getCategoryMappings() {
        return this.request('/mappings', {}, []);
    }
    /**
   * @param {CategoryMap | Omit<CategoryMap, 'id'>} map
   */ async saveCategoryMapping(map) {
        const data = {
            ...map,
            id: map.id || crypto.randomUUID()
        };
        await this.request('/mappings', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    async deleteCategoryMapping(id) {
        await this.request(`/mappings/${id}`, {
            method: 'DELETE'
        }, null);
    }
    async clearCategoryMappings() {
        await this.request('/mappings/all', {
            method: 'DELETE'
        }, null);
    }
    // --- Node Map ---
    /**
   * @returns {Promise<NodeMap[]>}
   */ async getNodeMaps() {
        return this.request('/nodemaps', {}, []);
    }
    /**
   * @param {NodeMap | Omit<NodeMap, 'id'>} map
   */ async saveNodeMap(map) {
        const data = {
            ...map,
            id: map.id || crypto.randomUUID()
        };
        await this.request('/nodemaps', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    async deleteNodeMap(id) {
        await this.request(`/nodemaps/${id}`, {
            method: 'DELETE'
        }, null);
    }
    async clearNodeMaps() {
        await this.request('/nodemaps/all', {
            method: 'DELETE'
        }, null);
    }
    // --- ASINs ---
    /**
   * @returns {Promise<AsinItem[]>}
   */ async getAsins(params = {}) {
        return this.request('/asins', {
            params
        }, []);
    }
    /**
   * @param {{ asin: string; stapleLevel: any }[]} items
   */ async addAsinsBulk(items) {
        const payload = items.map((item)=>({
                ...item,
                status: 'pending',
                stepLevel: 'Standard',
                createdAt: new Date().toISOString()
            }));
        await this.request('/asins/bulk', {
            method: 'POST',
            body: JSON.stringify(payload)
        }, null);
    }
    async updateMissingStepLevels() {
        const items = await this.getAsins();
        const missing = items.filter((i)=>!i.stepLevel);
        for (const item of missing){
            await this.updateAsin(item.id, {
                stepLevel: 'Standard'
            });
        }
        return missing.length;
    }
    /**
   * @param {string} id
   * @param {Partial<AsinItem>} updates
   */ async updateAsin(id, updates) {
        await this.request(`/asins/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        }, null);
    }
    async clearAsins() {
        await this.request('/asins', {
            method: 'DELETE'
        }, null);
    }
    async deleteAsin(id) {
        await this.request(`/asins/${id}`, {
            method: 'DELETE'
        }, null);
    }
    // --- Refund Fees ---
    /**
   * @returns {Promise<RefundFee[]>}
   */ async getRefundFees() {
        return this.request('/fees/refund', {}, []);
    }
    /**
   * @param {RefundFee | Omit<RefundFee, 'id'>} fee
   */ async saveRefundFee(fee) {
        const data = {
            ...fee,
            id: fee.id || crypto.randomUUID()
        };
        await this.request('/fees/refund', {
            method: 'POST',
            body: JSON.stringify(data)
        }, null);
    }
    async deleteRefundFee(id) {
        await this.request(`/fees/refund/${id}`, {
            method: 'DELETE'
        }, null);
    }
    async clearRefundFees() {
        await this.request('/fees/refund/all', {
            method: 'DELETE'
        }, null);
    }
    // --- Calculation ---
    async calculateProfits(asinIds = []) {
        await this.request('/revenue/calculate', {
            method: 'POST',
            body: JSON.stringify({
                asinIds
            })
        }, null);
    }
    // --- ASINs ---
    /**
   * Get all ASINs
   * @returns {Promise<ASIN[]>}
   */ async getAsins(params = {}) {
        return this.request('/asins', {
            params
        }, []);
    }
    /**
   * Get single ASIN
   * @param {string} id
   * @returns {Promise<ASIN>}
   */ async getAsin(id) {
        return this.request(`/asins/${id}`, {}, null);
    }
    /**
   * Create or Update ASIN
   * @param {Partial<ASIN>} asin
   */ async saveAsin(asin) {
        if (asin.id || asin._id) {
            const id = asin.id || asin._id;
            return this.request(`/asins/${id}`, {
                method: 'PUT',
                body: JSON.stringify(asin)
            }, null);
        } else {
            return this.request('/asins', {
                method: 'POST',
                body: JSON.stringify(asin)
            }, null);
        }
    }
    /**
   * Delete ASIN
   * @param {string} id
   */ async deleteAsin(id) {
        return this.request(`/asins/${id}`, {
            method: 'DELETE'
        }, null);
    }
    // --- Actions ---
    /**
   * Get all actions
   * @returns {Promise<Action[]>}
   */ async getActions() {
        return this.request('/actions', {}, []);
    }
    /**
   * Create a new action
   * @param {Partial<Action>} action
   */ async createAction(action) {
        return this.request('/actions', {
            method: 'POST',
            body: JSON.stringify(action)
        }, null);
    }
    /**
   * Update an action
   * @param {string} id
   * @param {Partial<Action>} updates
   */ async updateAction(id, updates) {
        return this.request(`/actions/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        }, null);
    }
    /**
   * Delete an action
   * @param {string} id
   */ async deleteAction(id) {
        return this.request(`/actions/${id}`, {
            method: 'DELETE'
        }, null);
    }
    /**
   * Add a message to an action
   * @param {string} actionId
   * @param {string} content
   */ async addMessage(actionId, content) {
        return this.request(`/actions/${actionId}/messages`, {
            method: 'POST',
            body: JSON.stringify({
                content
            })
        }, null);
    }
    /**
   * Get all users (for assignment)
   * @returns {Promise<User[]>}
   */ async getUsers() {
        return this.request('/users', {}, []);
    }
    /**
   * Get all sellers
   * @returns {Promise<Seller[]>}
   */ async getSellers() {
        return this.request('/sellers', {}, []);
    }
    // --- NEW: Workflow Actions ---
    /**
   * Start a task
   * @param {string} actionId
   */ async startAction(actionId) {
        return this.request(`/actions/${actionId}/start`, {
            method: 'POST'
        }, null);
    }
    /**
   * Complete a task
   * @param {string} actionId
   * @param {object} completionData - { remarks, stage, recurring, audioTranscript }
   */ async completeAction(actionId, completionData) {
        return this.request(`/actions/${actionId}/complete`, {
            method: 'POST',
            body: JSON.stringify(completionData)
        }, null);
    }
    /**
   * Upload audio for task completion
   * @param {string} actionId
   * @param {Blob} audioBlob
   * @param {string} transcript
   */ async uploadAudio(actionId, audioBlob, transcript) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        if (transcript) {
            formData.append('transcript', transcript);
        }
        try {
            const res = await fetch(`${API_BASE}/actions/${actionId}/upload-audio`, {
                method: 'POST',
                body: formData
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (error) {
            console.error(`[DB] Audio upload failed:`, error);
            return null;
        }
    }
    /**
   * Get action history (stage transitions)
   * @param {string} actionId
   */ async getActionHistory(actionId) {
        return this.request(`/actions/${actionId}/history`, {}, null);
    }
    /**
   * Analyze ASIN and get suggested actions
   * @param {string} asinId
   */ async analyzeAsin(asinId) {
        return this.request(`/actions/analyze-asin/${asinId}`, {
            method: 'POST'
        }, null);
    }
    /**
   * Create actions from ASIN analysis
   * @param {string} asinId
   */ async createActionsFromAnalysis(asinId) {
        return this.request(`/actions/create-from-analysis/${asinId}`, {
            method: 'POST'
        }, null);
    }
    /**
   * Get overdue actions
   */ async getOverdueActions() {
        return this.request('/actions/reports/overdue', {}, []);
    }
    /**
   * Get Goal vs Achievement report
   */ async getGoalAchievementReport() {
        return this.request('/actions/reports/goal-achievement', {}, null);
    }
    // --- Action Review Workflow ---
    async startAction(id) {
        return this.request(`/actions/${id}/start`, {
            method: 'POST'
        }, null);
    }
    async submitActionForReview(id, formData) {
        // Check if formData is instance of FormData (for audio uploads)
        const isFormData = formData instanceof FormData;
        const options = {
            method: 'POST',
            body: isFormData ? formData : JSON.stringify(formData)
        };
        // If it's FormData, let the browser set the boundary header
        if (isFormData) {
            const token = localStorage.getItem('authToken');
            options.headers = {
                ...token && {
                    'Authorization': `Bearer ${token}`
                }
            };
            // Important: Remove default Content-Type to let fetch set it with boundary
            return fetch(`${API_BASE}/actions/${id}/submit-review`, options).then((res)=>res.json()).catch((err)=>{
                console.error('[DB] Submit for review failed:', err);
                return null;
            });
        }
        return this.request(`/actions/${id}/submit-review`, options, null);
    }
    async reviewAction(id, decision, comments) {
        return this.request(`/actions/${id}/review-action`, {
            method: 'POST',
            body: JSON.stringify({
                decision,
                comments
            })
        }, null);
    }
    // --- OKR Methods ---
    /**
   * Get all objectives
   */ async getObjectives() {
        return this.request('/objectives', {}, []);
    }
    /**
   * Get all task templates
   */ async getTaskTemplates() {
        return this.request('/actions/templates', {}, []);
    }
    /**
   * Create a new task template
   * @param {object} template
   */ async createTemplate(template) {
        return this.request('/actions/templates', {
            method: 'POST',
            body: JSON.stringify(template)
        }, null);
    }
    /**
   * Update a task template
   * @param {string} id
   * @param {object} updates
   */ async updateTemplate(id, updates) {
        return this.request(`/actions/templates/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        }, null);
    }
    /**
   * Delete a task template
   * @param {string} id
   */ async deleteTemplate(id) {
        return this.request(`/actions/templates/${id}`, {
            method: 'DELETE'
        }, null);
    }
    /**
   * Create a new objective
   * @param {object} objective
   */ async createObjective(objective) {
        return this.request('/objectives', {
            method: 'POST',
            body: JSON.stringify(objective)
        }, null);
    }
    /**
   * Create a new key result
   * @param {object} keyResult
   */ async createKeyResult(keyResult) {
        return this.request('/objectives/key-results', {
            method: 'POST',
            body: JSON.stringify(keyResult)
        }, null);
    }
    /**
   * Update an objective
   */ async updateObjective(id, objective) {
        return this.request(`/objectives/${id}`, {
            method: 'PUT',
            body: JSON.stringify(objective)
        }, null);
    }
    /**
   * Delete an objective
   */ async deleteObjective(id) {
        return this.request(`/objectives/${id}`, {
            method: 'DELETE'
        }, null);
    }
    /**
   * Update a key result
   */ async updateKeyResult(id, keyResult) {
        return this.request(`/objectives/key-results/${id}`, {
            method: 'PUT',
            body: JSON.stringify(keyResult)
        }, null);
    }
    /**
   * Delete a key result
   */ async deleteKeyResult(id) {
        return this.request(`/objectives/key-results/${id}`, {
            method: 'DELETE'
        }, null);
    }
    // --- AI Methods ---
    /**
   * Generate OKR structure using AI
   * @param {object} params - { prompt, type, industry }
   */ async generateAIOKR(params) {
        return this.request('/ai/generate-okr', {
            method: 'POST',
            body: JSON.stringify(params)
        }, null);
    }
    /**
   * Get AI suggestions for tasks
   * @param {string} context - Goal or KR context
   */ /**
   * Get AI suggestions for tasks
   * @param {string} context - Goal or KR context
   */ async getAISuggestions(context) {
        return this.request('/ai/suggest-tasks', {
            method: 'POST',
            body: JSON.stringify({
                context
            })
        }, null);
    }
    /**
   * Get all system settings
   * @param {string} group - Optional group to filter by
   */ async getSettings(group) {
        const data = await this.request(`/settings${group ? `?group=${group}` : ''}`, {}, {
            success: true,
            data: {}
        });
        return data.data;
    }
    /**
   * Update system settings
   * @param {object} settings - Key-value pair of settings
   * @param {string} group - Group name
   */ async updateSettings(settings, group = 'general') {
        return this.request('/settings/update', {
            method: 'POST',
            body: JSON.stringify({
                settings,
                group
            })
        }, null);
    }
    /**
   * Get setting by key
   * @param {string} key
   */ async getSettingByKey(key) {
        const data = await this.request(`/settings/${key}`, {}, {
            success: true,
            data: null
        });
        return data.data;
    }
    /**
   * Get system activity logs
   */ async getSystemLogs() {
        return this.request('/logs', {
            method: 'GET'
        }, null);
    }
}
const db = new DatabaseService();
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/services/engine.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "calculateProfits",
    ()=>calculateProfits,
    "fetchKeepaData",
    ()=>fetchKeepaData
]);
// Profit calculation engine for Revenue Calculator
// Refactored to use backend API
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/services/db.js [app-client] (ecmascript)");
;
const delay = (ms)=>new Promise((resolve)=>setTimeout(resolve, ms));
const fetchKeepaData = async (asins, forceRefresh = false)=>{
    // Keeping fetchKeepaData client-side for now as it uses the user's local API key
    // This logic is complex but works well client-side to avoid sharing API keys with server if privacy is concern
    // Or we can move this to backend later if we want centralized key management
    const targets = forceRefresh ? asins : asins.filter((a)=>a.status === 'pending' || a.status === 'error');
    if (targets.length === 0) return;
    const apiKey = __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].getKeepaKey().trim();
    if (!apiKey) {
        console.warn("Skipping Keepa Fetch: Missing API Key.");
        return;
    }
    const chunkSize = 100;
    for(let i = 0; i < targets.length; i += chunkSize){
        const chunk = targets.slice(i, i + chunkSize);
        const validAsins = chunk.map((a)=>a.asin.trim()).filter((a)=>/^[A-Z0-9]{10}$/i.test(a));
        if (validAsins.length === 0) {
            for (const item of chunk)await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].updateAsin(item.id, {
                status: 'error',
                errorMessage: 'Invalid ASIN format'
            });
            continue;
        }
        const asinList = validAsins.join(',');
        let attempts = 0;
        const maxAttempts = 5;
        let success = false;
        console.log(`[Keepa] Fetching chunk ${i / chunkSize + 1} (${validAsins.length} items): ${asinList}`);
        while(attempts < maxAttempts && !success){
            try {
                const url = `https://api.keepa.com/product?key=${apiKey}&domain=10&asin=${asinList}&stats=1&history=0&offersSuccessful=1`;
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                if (response.status === 429) {
                    attempts++;
                    const waitTime = 5000 * Math.pow(2, attempts);
                    await delay(waitTime);
                    continue;
                }
                if (!response.ok) throw new Error(`API Error: ${response.status}`);
                const textResponse = await response.text();
                const data = JSON.parse(textResponse);
                if (data.error) {
                    if (data.error.message && data.error.message.toLowerCase().includes('token')) {
                        attempts++;
                        const waitTime = 5000 * Math.pow(2, attempts);
                        await delay(waitTime);
                        continue;
                    }
                    throw new Error(data.error.message);
                }
                const products = data.products || [];
                for (const item of chunk){
                    const product = products.find((p)=>p.asin.toUpperCase() === item.asin.toUpperCase());
                    if (product) {
                        let rawPrice = -1;
                        const stats = product.stats;
                        if (stats && stats.current) {
                            const buyBox = stats.buyBoxPrice;
                            const newPrice = stats.current[1];
                            const amazonPrice = stats.current[0];
                            if (typeof buyBox === 'number' && buyBox > 0) rawPrice = buyBox;
                            else if (typeof newPrice === 'number' && newPrice > 0) rawPrice = newPrice;
                            else if (typeof amazonPrice === 'number' && amazonPrice > 0) rawPrice = amazonPrice;
                        }
                        const price = rawPrice > 0 ? rawPrice / 100 : 0;
                        const itemWeight = product.itemWeight || 0;
                        const packageWeight = product.packageWeight || 0;
                        const l = product.packageLength || 0;
                        const w = product.packageWidth || 0;
                        const h = product.packageHeight || 0;
                        const lCm = l / 10;
                        const wCm = w / 10;
                        const hCm = h / 10;
                        const volumetricWeight = Math.round(lCm * wCm * hCm / 5000);
                        let finalWeight = 0;
                        if (packageWeight > 0) finalWeight = packageWeight;
                        else finalWeight = volumetricWeight;
                        const title = product.title || `ASIN ${item.asin}`;
                        const brand = product.brand || 'Unknown';
                        const image = product.imagesCSV ? `https://images-na.ssl-images-amazon.com/images/I/${product.imagesCSV.split(',')[0]}` : '';
                        let category = 'Uncategorized';
                        let categoryPath = '';
                        let categoryId = '';
                        if (product.categoryTree && product.categoryTree.length > 0) {
                            const leaf = product.categoryTree[product.categoryTree.length - 1];
                            category = leaf.name;
                            categoryPath = product.categoryTree.map((c)=>c.name).join(' > ');
                            categoryId = String(leaf.catId);
                        } else if (product.categories && product.categories.length > 0) {
                            categoryId = String(product.categories[product.categories.length - 1]);
                        }
                        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].updateAsin(item.id, {
                            title,
                            brand,
                            category,
                            categoryPath,
                            categoryId,
                            image,
                            price,
                            weight: finalWeight,
                            volumetricWeight,
                            dimensions: `${lCm.toFixed(1)}x${wCm.toFixed(1)}x${hCm.toFixed(1)} cm`,
                            status: 'fetched'
                        });
                    } else {
                        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].updateAsin(item.id, {
                            status: 'error',
                            errorMessage: 'ASIN not found in Keepa return data'
                        });
                    }
                }
                success = true;
            } catch (error) {
                if (error.message.includes('403') || error.message.includes('key')) {
                    for (const item of chunk)await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].updateAsin(item.id, {
                        status: 'error',
                        errorMessage: 'Invalid API Key'
                    });
                    return;
                }
                attempts++;
                await delay(5000);
                if (attempts >= maxAttempts) {
                    for (const item of chunk)await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].updateAsin(item.id, {
                        status: 'error',
                        errorMessage: error.message
                    });
                }
            }
        }
        await delay(2000);
    }
};
const calculateProfits = async (asins)=>{
    try {
        console.log('[FeeCalc] Triggering backend calculation...');
        // If asins array provided, pass IDs, otherwise empty array triggers all
        const ids = asins ? asins.map((a)=>a.id).filter(Boolean) : [];
        await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$services$2f$db$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["db"].calculateProfits(ids);
        console.log('[FeeCalc] Backend calculation initiated');
    } catch (error) {
        console.error('[FeeCalc] Calculation error:', error);
        throw error;
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/utils/lqs.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Calculate LQS (Listing Quality Score) for an ASIN
 * @param {Object} asin
 * @returns {number} Score between 0 and 100
 */ __turbopack_context__.s([
    "calculateLQS",
    ()=>calculateLQS,
    "getLQSIssues",
    ()=>getLQSIssues
]);
const calculateLQS = (asin)=>{
    let score = 100;
    // Title completeness (max 15 points)
    const title = asin.title || '';
    if (title.length < 50) score -= 10;
    else if (title.length < 80) score -= 5;
    // Images (max 20 points)
    // Check both imagesCount and imagesCSV
    let imagesCount = asin.imagesCount || 0;
    if (!imagesCount && asin.imagesCSV) {
        imagesCount = asin.imagesCSV.split(',').length;
    }
    if (imagesCount === 0) score -= 20;
    else if (imagesCount < 5) score -= 10;
    // Price (max 15 points)
    const price = Number(asin.price || asin.currentPrice || 0);
    const mrp = Number(asin.mrp || 0);
    if (price === 0) score -= 15;
    else if (mrp > 0 && price > mrp) score -= 10;
    // Rating (max 20 points)
    const rating = Number(asin.rating || 0);
    if (rating < 3) score -= 20;
    else if (rating < 4) score -= 10;
    // Reviews (max 15 points)
    const reviews = Number(asin.reviewCount || asin.reviews || 0);
    if (reviews === 0) score -= 15;
    else if (reviews < 10) score -= 8;
    // Ranking (max 15 points)
    const rank = Number(asin.currentRank || asin.salesRank || 0);
    if (rank === 0) score -= 15; // No rank is usually bad
    else if (rank > 50000) score -= 15;
    else if (rank > 20000) score -= 8;
    else if (rank > 10000) score -= 4;
    return Math.max(0, score);
};
const getLQSIssues = (asin)=>{
    const issues = [];
    const title = asin.title || '';
    if (title.length < 50) issues.push('Title too short (< 50 chars)');
    let imagesCount = asin.imagesCount || 0;
    if (!imagesCount && asin.imagesCSV) {
        imagesCount = asin.imagesCSV.split(',').length;
    }
    if (imagesCount < 5) issues.push(`Missing images (Has ${imagesCount}, needs 5+)`);
    const rating = Number(asin.rating || 0);
    if (rating < 4) issues.push(`Low rating (${rating})`);
    const reviews = Number(asin.reviewCount || asin.reviews || 0);
    if (reviews < 10) issues.push(`Few reviews (${reviews})`);
    const rank = Number(asin.currentRank || asin.salesRank || 0);
    if (rank > 50000) issues.push(`Poor ranking (#${rank})`);
    return issues;
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/AppContent.jsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AppContent
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react-router/dist/development/chunk-JZWAC4HX.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$contexts$2f$AuthContext$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/contexts/AuthContext.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$ProtectedRoute$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/ProtectedRoute.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Header$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/Header.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$Dashboard$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/Dashboard.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$SkuReport$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/SkuReport.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$ParentAsinReport$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/ParentAsinReport.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$MonthWiseReport$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/MonthWiseReport.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$AdsReport$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/AdsReport.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$UploadExport$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/UploadExport.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$AlertsPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/AlertsPage.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$AlertRulesPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/AlertRulesPage.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$ProfitLossPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/ProfitLossPage.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$InventoryPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/InventoryPage.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$AsinManagerPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/AsinManagerPage.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$ActionsPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/ActionsPage.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$SettingsPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/SettingsPage.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$UsersPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/UsersPage.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$ScrapeTasksPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/ScrapeTasksPage.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$SellersPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/SellersPage.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$ActivityLog$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/ActivityLog.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$GoalAchievementReport$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/GoalAchievementReport.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$RevenueCalculatorPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/RevenueCalculatorPage.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$TemplateManagerPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/TemplateManagerPage.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$TasksOperationsPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/pages/TasksOperationsPage.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$chat$2f$ChatContainer$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/chat/ChatContainer.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$contexts$2f$SocketContext$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/contexts/SocketContext.jsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@clerk/nextjs/dist/esm/index.js [app-client] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$clerk$2d$react$2f$dist$2f$chunk$2d$BUI34B34$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@clerk/clerk-react/dist/chunk-BUI34B34.mjs [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
function AppRoutes() {
    _s();
    const { isAuthenticated, loading } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$contexts$2f$AuthContext$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])();
    if (loading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "d-flex justify-content-center align-items-center vh-100",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "spinner-border text-primary",
                role: "status",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "visually-hidden",
                    children: "Loading..."
                }, void 0, false, {
                    fileName: "[project]/src/AppContent.jsx",
                    lineNumber: 37,
                    columnNumber: 17
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/AppContent.jsx",
                lineNumber: 36,
                columnNumber: 13
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/AppContent.jsx",
            lineNumber: 35,
            columnNumber: 16
        }, this);
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Routes"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                path: "/login",
                element: isAuthenticated ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Navigate"], {
                    to: "/",
                    replace: true
                }, void 0, false, {
                    fileName: "[project]/src/AppContent.jsx",
                    lineNumber: 47,
                    columnNumber: 44
                }, void 0) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$clerk$2d$react$2f$dist$2f$chunk$2d$BUI34B34$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RedirectToSignIn"], {}, void 0, false, {
                    fileName: "[project]/src/AppContent.jsx",
                    lineNumber: 47,
                    columnNumber: 74
                }, void 0)
            }, void 0, false, {
                fileName: "[project]/src/AppContent.jsx",
                lineNumber: 45,
                columnNumber: 13
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                path: "/*",
                element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Fragment"], {
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["SignedIn"], {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "app-layout",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$Header$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                        fileName: "[project]/src/AppContent.jsx",
                                        lineNumber: 56,
                                        columnNumber: 33
                                    }, void 0),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                                        className: "main-content",
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                            className: "routes-container",
                                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Routes"], {
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$Dashboard$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 60,
                                                            columnNumber: 70
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 60,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/dashboard",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$Dashboard$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 61,
                                                            columnNumber: 79
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 61,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/sku-report",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$SkuReport$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 62,
                                                            columnNumber: 80
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 62,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/parent-asin-report",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$ParentAsinReport$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 63,
                                                            columnNumber: 88
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 63,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/month-wise-report",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$MonthWiseReport$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 64,
                                                            columnNumber: 87
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 64,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/ads-report",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$AdsReport$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 65,
                                                            columnNumber: 80
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 65,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/asin-tracker",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$AsinManagerPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 66,
                                                            columnNumber: 82
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 66,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/profit-loss",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$ProfitLossPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 67,
                                                            columnNumber: 81
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 67,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/inventory",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$InventoryPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 68,
                                                            columnNumber: 79
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 68,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/actions",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$ActionsPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 69,
                                                            columnNumber: 77
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 69,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/users",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$UsersPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 70,
                                                            columnNumber: 75
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 70,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/settings",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$SettingsPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 71,
                                                            columnNumber: 78
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 71,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/upload-export",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$UploadExport$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 72,
                                                            columnNumber: 83
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 72,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/alerts",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$AlertsPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 73,
                                                            columnNumber: 76
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 73,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/alert-rules",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$AlertRulesPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 74,
                                                            columnNumber: 81
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 74,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/scrape-tasks",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$ScrapeTasksPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 75,
                                                            columnNumber: 82
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 75,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/sellers",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$SellersPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 76,
                                                            columnNumber: 77
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 76,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/activity-log",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$ActivityLog$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 77,
                                                            columnNumber: 82
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 77,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/actions/templates",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$TemplateManagerPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 78,
                                                            columnNumber: 87
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 78,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/actions/achievement-report",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$GoalAchievementReport$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 79,
                                                            columnNumber: 96
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 79,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/revenue-calculator",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$pages$2f$RevenueCalculatorPage$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 80,
                                                            columnNumber: 88
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 80,
                                                        columnNumber: 45
                                                    }, void 0),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Route"], {
                                                        path: "/chat",
                                                        element: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$chat$2f$ChatContainer$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {}, void 0, false, {
                                                            fileName: "[project]/src/AppContent.jsx",
                                                            lineNumber: 81,
                                                            columnNumber: 74
                                                        }, void 0)
                                                    }, void 0, false, {
                                                        fileName: "[project]/src/AppContent.jsx",
                                                        lineNumber: 81,
                                                        columnNumber: 45
                                                    }, void 0)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/src/AppContent.jsx",
                                                lineNumber: 59,
                                                columnNumber: 41
                                            }, void 0)
                                        }, void 0, false, {
                                            fileName: "[project]/src/AppContent.jsx",
                                            lineNumber: 58,
                                            columnNumber: 37
                                        }, void 0)
                                    }, void 0, false, {
                                        fileName: "[project]/src/AppContent.jsx",
                                        lineNumber: 57,
                                        columnNumber: 33
                                    }, void 0)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/src/AppContent.jsx",
                                lineNumber: 55,
                                columnNumber: 29
                            }, void 0)
                        }, void 0, false, {
                            fileName: "[project]/src/AppContent.jsx",
                            lineNumber: 54,
                            columnNumber: 25
                        }, void 0),
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$nextjs$2f$dist$2f$esm$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$locals$3e$__["SignedOut"], {
                            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$clerk$2f$clerk$2d$react$2f$dist$2f$chunk$2d$BUI34B34$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RedirectToSignIn"], {}, void 0, false, {
                                fileName: "[project]/src/AppContent.jsx",
                                lineNumber: 88,
                                columnNumber: 29
                            }, void 0)
                        }, void 0, false, {
                            fileName: "[project]/src/AppContent.jsx",
                            lineNumber: 87,
                            columnNumber: 25
                        }, void 0)
                    ]
                }, void 0, true)
            }, void 0, false, {
                fileName: "[project]/src/AppContent.jsx",
                lineNumber: 50,
                columnNumber: 13
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/AppContent.jsx",
        lineNumber: 43,
        columnNumber: 9
    }, this);
}
_s(AppRoutes, "F3aPsg481KjBH7Z7iYl6LJifZz0=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$contexts$2f$AuthContext$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = AppRoutes;
function AppContent() {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$router$2f$dist$2f$development$2f$chunk$2d$JZWAC4HX$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BrowserRouter"], {
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$contexts$2f$AuthContext$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AuthProvider"], {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$contexts$2f$SocketContext$2e$jsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["SocketProvider"], {
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(AppRoutes, {}, void 0, false, {
                    fileName: "[project]/src/AppContent.jsx",
                    lineNumber: 102,
                    columnNumber: 21
                }, this)
            }, void 0, false, {
                fileName: "[project]/src/AppContent.jsx",
                lineNumber: 101,
                columnNumber: 17
            }, this)
        }, void 0, false, {
            fileName: "[project]/src/AppContent.jsx",
            lineNumber: 100,
            columnNumber: 13
        }, this)
    }, void 0, false, {
        fileName: "[project]/src/AppContent.jsx",
        lineNumber: 99,
        columnNumber: 9
    }, this);
}
_c1 = AppContent;
var _c, _c1;
__turbopack_context__.k.register(_c, "AppRoutes");
__turbopack_context__.k.register(_c1, "AppContent");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/AppContent.jsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/AppContent.jsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=src_6511a949._.js.map