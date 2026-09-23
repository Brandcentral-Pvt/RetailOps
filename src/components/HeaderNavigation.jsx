import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

const HeaderNavigation = ({ items = [] }) => {
    const [openDropdown, setOpenDropdown] = useState(null);
    const location = useLocation();
    const navRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (navRef.current && !navRef.current.contains(event.target)) {
                setOpenDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDropdownToggle = (label) => {
        setOpenDropdown(openDropdown === label ? null : label);
    };

    return (
        <div className="header-nav-container d-none d-lg-flex" ref={navRef}>
            <ul className="header-nav-list mb-0">
                {items.map((item) => {
                    const hasSubItems = item.items && item.items.length > 0;
                    const isActive = location.pathname === item.href ||
                        item.items?.some(sub => location.pathname === sub.href);

                    if (hasSubItems) {
                        return (
                            <li key={item.label} className={`nav-item-dropdown ${isActive ? 'active' : ''}`}>
                                <button
                                    className="nav-link-btn"
                                    onClick={() => handleDropdownToggle(item.label)}
                                    aria-expanded={openDropdown === item.label}
                                >
                                    {item.label}
                                    <ChevronDown size={14} className={`chevron ${openDropdown === item.label ? 'up' : ''}`} />
                                </button>
                                {openDropdown === item.label && (
                                    <div className="dropdown-panel glass-panel">
                                        <ul className="dropdown-list">
                                            {item.items.map((subItem) => (
                                                <li key={subItem.label}>
                                                    <NavLink
                                                        to={subItem.href}
                                                        className={({ isActive }) => `dropdown-item ${isActive || subItem.current ? 'active' : ''}`}
                                                        onClick={() => setOpenDropdown(null)}
                                                    >
                                                        {subItem.label}
                                                    </NavLink>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </li>
                        );
                    }

                    return (
                        <li key={item.label} className="nav-item">
                            <NavLink
                                to={item.href}
                                className={({ isActive }) => `nav-link-btn ${isActive ? 'active' : ''}`}
                            >
                                {item.label}
                            </NavLink>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default HeaderNavigation;
