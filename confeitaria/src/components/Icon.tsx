export type IconName =
  | 'home' | 'menu' | 'cart' | 'receipt' | 'user' | 'search' | 'plus' | 'minus' | 'trash' | 'edit'
  | 'close' | 'chevronRight' | 'chevronLeft' | 'chevronDown' | 'check' | 'clock' | 'truck' | 'store'
  | 'chart' | 'box' | 'users' | 'calendar' | 'wallet' | 'settings' | 'alert' | 'star' | 'phone'
  | 'mapPin' | 'logout' | 'filter' | 'eye' | 'image' | 'sparkles' | 'arrowLeft' | 'lock' | 'bag'
  | 'grid' | 'heart' | 'cake' | 'trendUp' | 'trendDown' | 'download' | 'bell';

const paths: Record<IconName, string> = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.5V20h13V9.5M9.5 20v-6h5v6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  cart: 'M3 4h2l2.5 11.5a2 2 0 0 0 2 1.5h7.8a2 2 0 0 0 2-1.5L21 8H6.5M10 21a1 1 0 1 0 0-.01M17 21a1 1 0 1 0 0-.01',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20a7.5 7.5 0 0 1 15 0',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  edit: 'M4 20h4L19 9a2.5 2.5 0 0 0-3.5-3.5L4 16.5V20ZM14.5 6.5 17.5 9.5',
  close: 'M6 6l12 12M18 6 6 18',
  chevronRight: 'M9 5l7 7-7 7',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronDown: 'M5 9l7 7 7-7',
  check: 'M4 12.5 9.5 18 20 6.5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5.5l3.5 2',
  truck: 'M3 6h11v11H3zM14 9h4l3 3.5V17h-7M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  store: 'M4 10v10h16V10M3 10 5 4h14l2 6a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0ZM10 20v-6h4v6',
  chart: 'M4 20V4M4 20h16M8 17v-5M13 17V8M18 17v-8',
  box: 'M4 8.5 12 4l8 4.5v7L12 20l-8-4.5zM4 8.5 12 13m0 0 8-4.5M12 13v7',
  users: 'M9 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14c2.5.9 4 2.9 4 6',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  wallet: 'M4 7h13a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H6a2 2 0 0 1-2-2zM4 7a2 2 0 0 1 2-2h9M16 13.5h2',
  settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.3-2-3.4-2.2 1a7.6 7.6 0 0 0-2.6-1.5L14.2 3H9.8l-.4 2.3a7.6 7.6 0 0 0-2.6 1.5l-2.2-1-2 3.4 2 1.3a7.6 7.6 0 0 0 0 3l-2 1.3 2 3.4 2.2-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.3h4.4l.4-2.3a7.6 7.6 0 0 0 2.6-1.5l2.2 1 2-3.4z',
  alert: 'M12 3 2.5 20h19zM12 9.5v5M12 17.5v.01',
  star: 'M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z',
  phone: 'M6 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L15 12l5 2v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4 5.2 2 2 0 0 1 6 3Z',
  mapPin: 'M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11ZM12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8 6 12l4 4M6 12h11',
  filter: 'M3 5h18l-7 8v6l-4 2v-8z',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  image: 'M4 5h16v14H4zM4 16l4.5-4.5 4 4L16 12l4 4M15.5 9a1 1 0 1 0 0-.01',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM18.5 15l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z',
  arrowLeft: 'M20 12H4M10 6l-6 6 6 6',
  lock: 'M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3M12 15v2',
  bag: 'M5 8h14l1 12H4zM9 8V6a3 3 0 0 1 6 0v2',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  heart: 'M12 20s-7.5-4.7-7.5-9.6A4.4 4.4 0 0 1 12 7.6a4.4 4.4 0 0 1 7.5 2.8C19.5 15.3 12 20 12 20Z',
  cake: 'M5 21h14a1 1 0 0 0 1-1v-4.5c-1.6-1.4-2.7.9-4 .9s-2.4-2.3-4-2.3-2.7 2.3-4 2.3-2.4-2.3-4-.9V20a1 1 0 0 0 1 1ZM6 15V10h12v5M12 7.5V5M10.6 6.2 12 4l1.4 2.2',
  trendUp: 'M4 17 10 11l4 4 6-6M15 9h5v5',
  trendDown: 'M4 7l6 6 4-4 6 6M15 15h5v-5',
  download: 'M12 4v10M8 11l4 4 4-4M5 19h14',
  bell: 'M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 19a2 2 0 0 0 4 0',
};

export function Icon({ name, size = 20, className, strokeWidth = 1.7 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name]} />
    </svg>
  );
}
