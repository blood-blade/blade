
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
          // --- Avatar Centering and Cropping Logic ---
          // Instead of using <AvatarImage> with object-fit, which can be unreliable for non-square images,
          // we use a div with a background image.
          // - `backgroundSize: 'cover'` scales the image to be as large as possible without stretching,
          //   ensuring it completely fills the circular container.
          // - `backgroundPosition: 'center'` ensures the image is centered within the container.
          // This combination effectively creates a perfect, centered circular crop of the image.
          <div
            className="w-full h-full rounded-full bg-cover bg-center"
            style={{ backgroundImage: `url(${photoURL})` }}
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
