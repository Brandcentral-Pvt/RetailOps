import React, { createContext, useContext, useState, useCallback } from 'react';

const RefreshContext = createContext();

export const useRefresh = () => {
    const context = useContext(RefreshContext);
    if (!context) {
        throw new Error('useRefresh must be used within a RefreshProvider');
    }
    return context;
};

export const RefreshProvider = ({ children }) => {
    const [refreshCount, setRefreshCount] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const triggerRefresh = useCallback(() => {
        setRefreshCount(prev => prev + 1);
        setIsRefreshing(true);
        // Reset refreshing state after a short delay (visual feedback)
        setTimeout(() => setIsRefreshing(false), 1000);
    }, []);

    return (
        <RefreshContext.Provider value={{ refreshCount, triggerRefresh, isRefreshing }}>
            {children}
        </RefreshContext.Provider>
    );
};
