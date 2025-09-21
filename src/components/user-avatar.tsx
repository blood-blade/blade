
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/types';
import type { User as FirebaseUser } from 'firebase/auth';

type UserLike = Partial<User> | (FirebaseUser | null);

type UserAvatarProps = {
  user?: UserLike;
  className?: string;
  isFriend?: boolean;
};

export function UserAvatar({ user, className, isFriend }: UserAvatarProps) {
  if (!user) {
    return <Avatar className={cn('border-2 border-background bg-muted', className)} />;
  }

  const getInitials = (name: string) => {
    const names = name.split(' ');
    const initials = names.map(n => n[0]).join('');
    return initials.slice(0, 2).toUpperCase();
  }

  const name = 'name' in user ? user.name : ('displayName' in user ? user.displayName : null);
  const photoURL = 'photoURL' in user ? user.photoURL : user.photoURL;
  const status = 'status' in user ? user.status : undefined;
  
  const fallback = name ? getInitials(name) : 'U';
  
  const canDisplayImage = photoURL && (photoURL.startsWith('data:image') || photoURL.startsWith('http'));

  return (
    <div className="relative">
      <Avatar className={cn(
        'border-2 border-background', 
        isFriend && 'border-green-500',
        className
      )}>
        {canDisplayImage ? (
          <AvatarImage
            src={photoURL}
            alt={name || 'User avatar'}
            className="object-cover"
            style={{ 
              objectPosition: 'center center',
              imageRendering: 'high-quality'
            }}
          />
        ) : (
          <AvatarFallback>{fallback}</AvatarFallback>
        )}
      </Avatar>
      {status === 'online' && (
        <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 border-2 border-card" />
      )}
    </div>
  );
}
