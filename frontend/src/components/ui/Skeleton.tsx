'use client';

export const Skeleton = ({ 
  className, 
  active = true,
  paragraph = { rows: 3 },
  title = { width: '40%' },
  avatar = false,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> & {
  active?: boolean;
  paragraph?: false | { rows: number; width?: string };
  title?: false | { width: string };
  avatar?: boolean | { size: number | 'large' | 'small' | 'default' };
}) => {
  return <div className="ant-skeleton" {...props} />;
};

export default Skeleton;