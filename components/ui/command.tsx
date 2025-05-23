import * as React from "react"
import { type DialogProps } from "@radix-ui/react-dialog"
import { Command as CommandPrimitive } from "cmdk"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent } from "@/components/ui/dialog"

type CmdkCommandActualProps = React.ComponentPropsWithoutRef<typeof CommandPrimitive>;

export interface CommandProps extends Omit<React.HTMLAttributes<HTMLDivElement>, keyof CmdkCommandActualProps | 'value'>, CmdkCommandActualProps {
  value?: string;
  onValueChange?: (value: string) => void;
  filter?: (value: string, search: string) => number;
  shouldFilter?: boolean;
  label?: string;
  loop?: boolean;
  children?: React.ReactNode;
}

export interface CommandProps extends Omit<React.ComponentPropsWithoutRef<typeof CommandPrimitive>, 'ref' | 'children'> {
  className?: string;
  children?: React.ReactNode;
}

const Command = React.forwardRef<
  HTMLDivElement, 
  CommandProps
>(({ className, ...props }, ref) => (
  <div
    ref={ref} 
    className={cn(
      "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
      className 
    )}
  {...props} 
  />
));
Command.displayName = "Command";

interface CommandDialogCustomProps extends DialogProps {
    children?: React.ReactNode;
    commandProps?: Omit<CommandProps, 'children' | 'className'>;
    commandClassName?: string;
}

const CommandDialog = ({ children, commandProps, commandClassName, ...dialogProps }: CommandDialogCustomProps) => {
  return (
    <Dialog {...dialogProps}>
      <DialogContent className="overflow-hidden p-0 shadow-lg">
        <Command
          {...commandProps}
          className={cn(
            "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5",
            commandClassName
          )}
        >
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

export interface CommandInputProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input> {
    className?: string;
}
const CommandInput = React.forwardRef<HTMLInputElement, React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>>( 
  ({ className, ...props }, ref) => (
  <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

export interface CommandListProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.List> {}
const CommandList = React.forwardRef<
  HTMLDivElement, 
  CommandListProps
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

export interface CommandEmptyProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty> {}
const CommandEmpty = React.forwardRef<
  HTMLDivElement,
  CommandEmptyProps
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className={cn("py-6 text-center text-sm", props.className)}
    {...props}
  />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

interface CmdkGroupSpecificProps {
  heading?: React.ReactNode;
  value?: string; 
}

export interface CommandGroupProps extends React.HTMLAttributes<HTMLDivElement>, CmdkGroupSpecificProps {}

const CommandGroup = React.forwardRef<
  HTMLDivElement, 
  CommandGroupProps
>(({ className, heading, value, children, ...htmlProps }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className
    )}
    heading={heading}
    value={value}
     {...htmlProps}
  >
    {children}
  </CommandPrimitive.Group>
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

export interface CommandSeparatorProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator> {
}
const CommandSeparator = React.forwardRef<
  HTMLDivElement, 
  CommandSeparatorProps
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 h-px bg-border", className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

export interface CommandItemProps extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item> {}
const CommandItem = React.forwardRef<
  HTMLDivElement, 
  CommandItemProps
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled=true]:pointer-events-none data-[selected='true']:bg-accent data-[selected=true]:text-accent-foreground data-[disabled=true]:opacity-50",
      className
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => {
  return ( <span className={cn( "ml-auto text-xs tracking-widest text-muted-foreground", className )} {...props} /> );
};
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};