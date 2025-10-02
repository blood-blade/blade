import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '../user-avatar';
import { Mic, MicOff } from 'lucide-react';

interface VoiceParticipantProps {
  name: string;
  photoURL?: string;
  isSpeaking?: boolean;
  isMuted?: boolean;
  isCurrentUser?: boolean;
}

export function VoiceParticipant({
  name,
  photoURL,
  isSpeaking,
  isMuted,
  isCurrentUser,
}: VoiceParticipantProps) {
  const [speakingAnimation, setSpeakingAnimation] = useState(false);

  useEffect(() => {
    if (isSpeaking) {
      setSpeakingAnimation(true);
    } else {
      setSpeakingAnimation(false);
    }
  }, [isSpeaking]);

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg transition-all',
        'bg-background/50 backdrop-blur-sm',
        isSpeaking && 'bg-accent/50 ring-2 ring-primary/50',
        'hover:bg-accent/30'
      )}
    >
      <div className="relative">
        <UserAvatar
          user={{ name, photoURL }}
          className={cn(
            'h-10 w-10 transition-shadow duration-300',
            speakingAnimation && 'shadow-glow'
          )}
        />
        <div
          className={cn(
            'absolute -bottom-1 -right-1 p-1 rounded-full bg-background',
            isMuted ? 'text-destructive' : 'text-primary'
          )}
        >
          {isMuted ? (
            <MicOff className="h-3 w-3" />
          ) : (
            <Mic className="h-3 w-3" />
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">
          {isCurrentUser ? 'You' : name}
        </p>
        <p className="text-xs text-muted-foreground">
          {isMuted ? 'Muted' : isSpeaking ? 'Speaking' : 'Connected'}
        </p>
      </div>
    </div>
  );
}