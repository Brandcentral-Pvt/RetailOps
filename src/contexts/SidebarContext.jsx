import React, { createContext, useContext, useState, useEffect } from 'react';

const SidebarContext = createContext({
    collapsed: false,
    isOpen: true,
    toggle: () => { },
    toggleMobile: () => { },
    isMobile: false,
});

export const SidebarProvider = ({ children }) => {
    const [collapsed, setCollapsed] = useState(false);
    const [isOpen, setIsOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Check for mobile viewport — keep desktop collapsed state separate from mobile drawer
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 992;
            setIsMobile(prevMobile => {
                if (prevMobile !== mobile) {
                    // Transitioning viewport type: close drawer when entering mobile, open when entering desktop
                    setIsOpen(!mobile);
                }
                return mobile;
            });
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const toggle = () => setCollapsed(c => !c);
    const toggleMobile = () => setIsOpen(o => !o);
    const closeMobile = () => setIsOpen(false);

    // Escape closes mobile drawer
    useEffect(() => {
        if (!isMobile || !isOpen) return;
        const onKeyDown = e => {
            if (e.key === 'Escape') setIsOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isMobile, isOpen]);

    // Prevent background scroll when mobile drawer is open
    useEffect(() => {
        if (!isMobile || !isOpen) return;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isMobile, isOpen]);

    return (
        <SidebarContext.Provider value={{ collapsed, toggle, isOpen, toggleMobile, closeMobile, isMobile, setCollapsed }}>
            {children}
        </SidebarContext.Provider>
    );
};

export const useSidebar = () => useContext(SidebarContext);
