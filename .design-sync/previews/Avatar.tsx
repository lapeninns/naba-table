import { Avatar, AvatarImage, AvatarFallback } from 'nabatable-platform';

export const Initials = () => (
  <div className="flex items-center gap-3">
    <Avatar><AvatarFallback>PN</AvatarFallback></Avatar>
    <Avatar><AvatarFallback>JD</AvatarFallback></Avatar>
    <Avatar className="size-12"><AvatarFallback>AK</AvatarFallback></Avatar>
  </div>
);

export const Stack = () => (
  <div className="flex -space-x-2">
    <Avatar className="ring-2 ring-background"><AvatarFallback>A</AvatarFallback></Avatar>
    <Avatar className="ring-2 ring-background"><AvatarFallback>B</AvatarFallback></Avatar>
    <Avatar className="ring-2 ring-background"><AvatarFallback>C</AvatarFallback></Avatar>
    <Avatar className="ring-2 ring-background"><AvatarFallback>+5</AvatarFallback></Avatar>
  </div>
);
