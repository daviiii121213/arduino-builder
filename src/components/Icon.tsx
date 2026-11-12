// Ícones SVG locais (lucide-react, empacotados no aplicativo).
import {
  Home, User, Users, CalendarDays, CheckSquare, FolderKanban, Target, Wallet, GraduationCap, FileText, ShoppingCart,
  BarChart3, LifeBuoy, Settings, Search, Bell, Plus, X, Pencil, Trash2, Share2, Undo2, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Check, Clock, MapPin, Flag, Repeat, Paperclip, History, Lock, LogOut, Sun, Moon, Monitor,
  Flame, ListChecks, BookOpen, Library, Languages, Timer, HeartPulse, Network, Briefcase, Microscope, StickyNote, Notebook,
  Gift, Star, Package, Boxes, UtensilsCrossed, ChefHat, PartyPopper, Cake, Megaphone, MessageCircle, Vote, Plane, Image,
  Camera, GitFork, Wrench, Receipt, PiggyBank, ArrowUpRight, ArrowDownRight, Download, Upload, Shield, Database, Keyboard,
  HelpCircle, Info, AlertTriangle, AlertCircle, CheckCircle2, LayoutGrid, List, Columns3, GripVertical, Eye, EyeOff, Copy,
  RotateCcw, Play, Pause, SkipForward, Sparkles, Zap, KeyRound, UserPlus, Crown, DoorOpen, Mail, Filter, Calendar,
  ExternalLink, FolderOpen, Archive, Tag, Pin, PinOff, Link2, Minus, Square, Coffee, Moon as MoonIcon, Hourglass, Palette,
  Maximize2, Minimize2, MoreHorizontal, Inbox, Layers, Building2,
} from "lucide-react";
import type { LucideProps } from "lucide-react";

const MAP = {
  Home, User, Users, CalendarDays, CheckSquare, FolderKanban, Target, Wallet, GraduationCap, FileText, ShoppingCart,
  BarChart3, LifeBuoy, Settings, Search, Bell, Plus, X, Pencil, Trash2, Share2, Undo2, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, Check, Clock, MapPin, Flag, Repeat, Paperclip, History, Lock, LogOut, Sun, Moon, Monitor,
  Flame, ListChecks, BookOpen, Library, Languages, Timer, HeartPulse, Network, Briefcase, Microscope, StickyNote, Notebook,
  Gift, Star, Package, Boxes, UtensilsCrossed, ChefHat, PartyPopper, Cake, Megaphone, MessageCircle, Vote, Plane, Image,
  Camera, GitFork, Wrench, Receipt, PiggyBank, ArrowUpRight, ArrowDownRight, Download, Upload, Shield, Database, Keyboard,
  HelpCircle, Info, AlertTriangle, AlertCircle, CheckCircle2, LayoutGrid, List, Columns3, GripVertical, Eye, EyeOff, Copy,
  RotateCcw, Play, Pause, SkipForward, Sparkles, Zap, KeyRound, UserPlus, Crown, DoorOpen, Mail, Filter, Calendar,
  ExternalLink, FolderOpen, Archive, Tag, Pin, PinOff, Link2, Minus, Square, Coffee, MoonIcon, Hourglass, Palette,
  Maximize2, Minimize2, MoreHorizontal, Inbox, Layers, Building2,
};

export type IconName = keyof typeof MAP;

export function Icon({ name, size = 18, label, ...rest }: { name: IconName; size?: number; label?: string } & LucideProps) {
  const C = MAP[name] ?? HelpCircle;
  return <C size={size} aria-hidden={label ? undefined : true} aria-label={label} role={label ? "img" : undefined} strokeWidth={1.9} {...rest} />;
}
