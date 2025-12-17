// constants/Theme.ts
export const Theme = {
  colors: {
    primary: '#e9237f', // Pink
    secondary: '#3D246C', // Purple
    background: '#FFEFF2', // Light pink background
    surface: '#fff',
    
    // Alert types
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#e9237f', // Matches primary
    
    // Text
    textPrimary: '#3D246C',
    textSecondary: '#5D5D5D',
    textLight: '#999',
    
    // States
    disabled: 'rgba(233, 35, 127, 0.6)',
  },
  
  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.25,
      shadowRadius: 20,
      elevation: 15,
    },
    button: {
      shadowColor: '#e9237f',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
  },
  
  borderRadius: {
    small: 8,
    medium: 12,
    large: 16,
    extraLarge: 24,
    circle: 50,
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
};