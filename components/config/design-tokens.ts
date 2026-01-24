export const colors = {
  primary: '#FF0099',
  secondary: '#00ABFF',
  accent: '#FFDE00',
  purple: '#7B008B',
  success: '#25D366',
  warning: '#F59E0B',
  error: '#EF4444',

  background: {
    primary: '#0a0a0a',
    secondary: '#1a1a1a',
    tertiary: '#2a2a2a',
  },

  border: {
    default: 'rgb(55 65 81)', // gray-700
    subtle: 'rgb(31 41 55)', // gray-800
  },

  text: {
    primary: '#ffffff',
    secondary: 'rgb(156 163 175)', // gray-400
    muted: 'rgb(107 114 128)', // gray-500
  },
};

export const spacing = {
  bottomNavHeight: 64, // px
  sidebarWidth: 224, // px (14rem)
  sidebarCollapsed: 64, // px (4rem)
  headerHeight: 56, // px
  contentMaxWidth: 1280, // px (max-w-7xl)
};

export const buttonSizes = {
  sm: { height: 32, padding: '0 12px', fontSize: 12 },
  md: { height: 40, padding: '0 16px', fontSize: 14 },
  lg: { height: 48, padding: '0 24px', fontSize: 16 },
};

export const iconButtonSizes = {
  sm: 32,
  md: 40,
  lg: 48,
};

export const zIndex = {
  bottomNav: 50,
  sidebar: 40,
  header: 30,
  modal: 60,
  toast: 70,
};
