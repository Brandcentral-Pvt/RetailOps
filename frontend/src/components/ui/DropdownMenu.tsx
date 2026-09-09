'use client';

import * as React from 'react';

interface DropdownMenuProps {
  trigger?: 'click' | 'hover' | 'contextMenu';
  overlay?: React.ReactElement;
  children: React.ReactNode;
  placement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';
  align?: 'start' | 'end';
  getPopupContainer?: () => HTMLElement;
}

export const DropdownMenu = ({
  children,
  overlay,
  trigger = 'click',
  placement = 'bottomRight',
  align = 'end',
  ...props
}: DropdownMenuProps) => {
  return (
    <div className="ant-dropdown-trigger" {...props}>
      {children}
      {overlay && (
        <div className={`ant-dropdown-menu-hidden ant-dropdown-placement-${placement} ${align === 'start' ? 'ant-dropdown-align-start' : 'ant-dropdown-align-end'}`}>
          {overlay}
        </div>
      )}
    </div>
  );
};

export const DropdownMenuTrigger = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return <div {...props}>{children}</div>;
};

export const DropdownMenuContent = ({ children, className, align = 'end', ...props }: React.HTMLAttributes<HTMLDivElement> & { align?: 'start' | 'end' }) => {
  return <div className={`ant-dropdown-menu ${align === 'start' ? 'ant-dropdown-align-start' : 'ant-dropdown-align-end'}`} {...props}>{children}</div>;
};

export const DropdownMenuItem = ({ 
  children, 
  onClick, 
  disabled,
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement> & { disabled?: boolean; onClick?: () => void }) => {
  return (
    <div 
      className="ant-dropdown-menu-item"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      {...props}
    >
      {children}
    </div>
  );
};

export const DropdownMenuSeparator = () => (
  <div className="ant-dropdown-divider" />
);