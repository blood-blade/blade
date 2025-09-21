
'use client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { User } from '@/lib/types';
import { UserAvatar } from './user-avatar';
import { Button } from './ui/button';
import { Separator } from './ui/separator';
import { BellOff, Ban, Bell, MessageSquareText, Shield, UserPlus, Check, UserCheck, X, UserX } from 'lucide-react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import React, from 'react';

interface UserProfileSheetProps {
  user: User;
  currentUser: User;
  chatId: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onFriendAction: (targetUserId: string, action: 'sendRequest' | 'acceptRequest' | 'declineRequest' | 'removeFriend') => void;
  onBlockUser: (targetUserId: string, isBlocked: boolean) => void;
  onMuteToggle: (conversationId: string) => void;
}

const AI_USER_ID = 'gemini-ai-chat-bot-7a4b9c1d-f2e3-4d56-a1b2-c3d4e5f6a7b8';

export function UserProfileSheet({
  user,
  currentUser,
  chatId,
  isOpen,
  onOpenChange,
  onFriendAction,
  onBlockUser,
  onMuteToggle,
}: UserProfileSheetProps) {
  const isBlockConfirmOpen = false;
  const isAiUser = user.id === AI_USER_ID;
  
  const isFriend = currentUser?.friends?.includes(user.uid);
  const hasSentRequest = currentUser?.friendRequestsSent?.includes(user.uid);
  const hasReceivedRequest = currentUser?.friendRequestsReceived?.includes(user.uid);
  const isBlocked = currentUser?.blockedUsers?.includes(user.uid);
  const isMuted = currentUser?.mutedConversations?.includes(chatId);

  const handleFriendAction = (action: 'sendRequest' | 'acceptRequest' | 'declineRequest' | 'removeFriend') => {
    onFriendAction(user.uid, action);
  }
  
  const handleBlockAction = () => {
    onBlockUser(user.uid, !!isBlocked);
    onOpenChange(false);
  }

  const renderFriendButton = () => {
    if (isFriend) {
        return (
            <div className="space-y-2">
                 <Button variant="secondary" className="w-full justify-start">
                    <UserCheck className="mr-3 h-5 w-5"/> Friends
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => handleFriendAction('removeFriend')}>
                    <UserX className="mr-3 h-5 w-5"/> Remove Friend
                </Button>
            </div>
        )
    }
    if (hasSentRequest) {
        return (
             <Button variant="outline" disabled className="w-full justify-start">
                <UserPlus className="mr-3 h-5 w-5"/> Request Sent
            </Button>
        )
    }
    if (hasReceivedRequest) {
        return (
            <div className="space-y-2">
                 <Button variant="default" className="w-full justify-start" onClick={() => handleFriendAction('acceptRequest')}>
                    <Check className="mr-3 h-5 w-5"/> Accept Request
                </Button>
                <Button variant="outline" className="w-full justify-start" onClick={() => handleFriendAction('declineRequest')}>
                    <X className="mr-3 h-5 w-5"/> Decline Request
                </Button>
            </div>
        )
    }
    return (
         <Button variant="outline" className="w-full justify-start" onClick={() => handleFriendAction('sendRequest')}>
            <UserPlus className="mr-3 h-5 w-5"/> Add Friend
        </Button>
    )
  }
  
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md bg-background/90 backdrop-blur-lg p-0 flex flex-col">
        <SheetHeader className="p-6 pb-0 text-left">
          <SheetTitle>Contact Info</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center justify-center p-6 space-y-4 border-b">
            <Dialog>
              <DialogTrigger asChild>
                <div className="relative cursor-pointer">
                    <UserAvatar user={user} isFriend={isFriend} className="w-32 h-32 text-4xl" />
                </div>
              </DialogTrigger>
              {user.photoURL && (
                <DialogContent className="p-0 bg-transparent border-0 max-w-screen-md w-auto h-auto">
                    <DialogTitle className="sr-only">Full-size avatar for {user.name}</DialogTitle>
                    <Image
                    src={user.photoURL}
                    alt={user.name}
                    width={800}
                    height={800}
                    className="rounded-lg h-full w-full"
                    style={{objectFit: "contain"}}
                    />
                </DialogContent>
              )}
            </Dialog>
            <div className="text-center">
              <div className="flex items-center gap-2 justify-center">
                <h2 className="text-2xl font-bold">{user.name}</h2>
                {user.isPrivate && <Shield className="h-5 w-5 text-muted-foreground" title="This account is private" />}
              </div>
              <p className="text-muted-foreground">{user.email}</p>
            </div>
            {!isAiUser && (
                 <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="icon"><MessageSquareText className="h-5 w-5" /></Button>
                </div>
            )}
          </div>
          
          <div className="p-6 space-y-4">
            <h3 className="font-semibold text-card-foreground">About</h3>
            <p className="text-sm text-muted-foreground">
                {user.about || 'No bio yet.'}
            </p>
          </div>

          {!isAiUser && (
              <div className="p-6 space-y-6">
                <Separator />
                <div className="space-y-2">
                    {!isBlocked && renderFriendButton()}
                    <Button 
                        variant="ghost" 
                        className="w-full justify-start text-muted-foreground hover:text-foreground"
                        onClick={() => onMuteToggle(chatId)}
                    >
                        {isMuted ? <Bell className="mr-3 h-5 w-5 text-primary" /> : <BellOff className="mr-3 h-5 w-5" />}
                        {isMuted ? 'Unmute Notifications' : 'Mute Notifications'}
                    </Button>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive">
                                <Ban className="mr-3 h-5 w-5"/> {isBlocked ? 'Unblock' : 'Block'} {user.name}
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Are you sure?</DialogTitle>
                                <DialogDescription>
                                    {isBlocked 
                                        ? `If you unblock ${user.name}, they will be able to message you and see your profile.`
                                        : `You will no longer see messages or chats from ${user.name}. They will not be notified.`
                                    }
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline">Cancel</Button>
                                <Button variant="destructive" onClick={handleBlockAction}>{isBlocked ? 'Unblock' : 'Block'}</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
              </div>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}
