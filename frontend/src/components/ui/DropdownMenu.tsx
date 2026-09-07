'use client';

interface DropdownMenuProps {
  trigger?: 'click' | 'hover' | 'contextMenu';
  overlay: React.ReactElement;
  children: React.ReactNode;
  placement?: 'bottomLeft' | 'bottomRight' | 'topLeft' | 'topRight';
  getPopupContainer?: () => HTMLElement;
}

export const DropdownMenu = ({
  children,
  overlay,
  trigger = 'click',
  placement = 'bottomRight',
  ...props
}: DropdownMenuProps) => {
  return (
    <div className="ant-dropdown-trigger">
      {children}
      <div className="ant-dropdown-menu-hidden">
        {overlay}
      </div>
    </div>
  );
};

export const DropdownMenuTrigger = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return <div {...props}>{children}</div>;
};

export const DropdownMenuContent = ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return <div className="ant-dropdown-menu" {...props}>{children}</div>;
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