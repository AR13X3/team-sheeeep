// Lucide line icons (ISC licence) behind one name map, so screens ask for "planner", not a component.
import {
  Activity, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ArrowUpDown, ArrowUpRight, BookOpen, Calendar, CalendarRange, ChartColumn, ChartLine,
  Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleCheck, CircleHelp, CircleX, Clock, CloudRain, Coins, Command, CornerDownLeft,
  Database, Download, Droplets, Ellipsis, Eye, EyeOff, FileText, Flag, Flame, Flower2, Gauge, History, House, Info, Keyboard, LandPlot, Layers,
  LayoutDashboard, Leaf, ListFilter, LoaderCircle, LocateFixed, LogOut, Map as MapIcon, MapPin, Maximize2, Menu, MessageCircle, Minus, Monitor,
  Moon, Mountain, PanelLeftClose, PanelLeftOpen, Pause, Pencil, Play, Plus, Printer, RefreshCw, Rocket, Satellite, Search, Send, Settings,
  ShieldCheck, Snowflake, Sparkles, Sprout, Sun, Table2, Target, Thermometer, Trash2, TrendingDown, TrendingUp, TriangleAlert, Undo2, Upload,
  User, Wheat, X, Zap,
} from 'lucide-react';

const ICONS = {
  // names used since the Figma build
  'arrow-back': ArrowLeft,
  'arrow-forward': ArrowRight,
  'arrow-drop-down': ChevronDown,
  search: Search,
  add: Plus,
  plus: Plus,
  check: Check,
  done: Check,
  close: X,
  menu: Menu,
  'my-location': LocateFixed,
  layers: Layers,
  fit: Maximize2,
  edit: Pencil,
  undo: Undo2,
  remove: Minus,
  delete: Trash2,
  // app shell & pages
  dashboard: LayoutDashboard,
  map: MapIcon,
  paddocks: LandPlot,
  planner: CalendarRange,
  insights: ChartLine,
  chart: ChartColumn,
  settings: Settings,
  home: House,
  satellite: Satellite,
  sprout: Sprout,
  leaf: Leaf,
  wheat: Wheat,
  flower: Flower2,
  droplets: Droplets,
  rain: CloudRain,
  frost: Snowflake,
  heat: Flame,
  thermometer: Thermometer,
  mountain: Mountain,
  gauge: Gauge,
  pin: MapPin,
  alert: TriangleAlert,
  info: Info,
  help: CircleHelp,
  'circle-check': CircleCheck,
  'circle-x': CircleX,
  sun: Sun,
  moon: Moon,
  monitor: Monitor,
  logout: LogOut,
  user: User,
  download: Download,
  upload: Upload,
  filter: ListFilter,
  sort: ArrowUpDown,
  'sort-up': ArrowUp,
  'sort-down': ArrowDown,
  'chevron-down': ChevronDown,
  'chevron-up': ChevronUp,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'arrow-up-right': ArrowUpRight,
  sparkles: Sparkles,
  send: Send,
  'panel-close': PanelLeftClose,
  'panel-open': PanelLeftOpen,
  command: Command,
  enter: CornerDownLeft,
  keyboard: Keyboard,
  history: History,
  calendar: Calendar,
  clock: Clock,
  play: Play,
  pause: Pause,
  printer: Printer,
  refresh: RefreshCw,
  spinner: LoaderCircle,
  chat: MessageCircle,
  flag: Flag,
  target: Target,
  coins: Coins,
  eye: Eye,
  'eye-off': EyeOff,
  more: Ellipsis,
  table: Table2,
  file: FileText,
  database: Database,
  shield: ShieldCheck,
  'trend-up': TrendingUp,
  'trend-down': TrendingDown,
  activity: Activity,
  rocket: Rocket,
  zap: Zap,
  book: BookOpen,
};

/** Line icon; inherits `color`. `label` makes it an image for screen readers, otherwise it's hidden. */
export default function Icon({ name, size = 18, className = '', label, strokeWidth = 2 }) {
  const Svg = ICONS[name] || CircleHelp;
  return (
    <Svg
      className={`icon ${className}`}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    />
  );
}
