'use client';

import { cn } from '@/lib/utils';

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {}

const Avatar = ({ className, ...props }: AvatarProps) => {
  return <div className={cn('ant-avatar', className)} {...props} />;
};

const AvatarImage = ({ className, src, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => {
  if (!src) {
    return null;
  }

  return <img className={cn('ant-avatar-image', className)} src={src} {...props} />;
};

const AvatarFallback = ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div className={cn('ant-avatar-string', className)} style={{ fontSize: '12px', fontWeight: 600 }} {...props}>
      {children}
    </div>
  );
};

export { Avatar, AvatarImage, AvatarFallback };
export default Avatar;