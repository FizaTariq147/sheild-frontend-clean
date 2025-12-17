// utils/alertUtils.ts
import React from 'react';
import { ThemeAlert } from '../components/ThemeAlert';

// Simple singleton pattern to manage alert state
let currentAlert: any = null;
let alertChangeListener: ((alert: any) => void) | null = null;

export const showThemeAlert = (
  title: string,
  message: string,
  buttons: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }> = [{ text: 'OK' }],
  type: 'info' | 'error' | 'warning' | 'success' = 'info'
) => {
  const alert = {
    visible: true,
    title,
    message,
    buttons,
    type,
  };
  
  currentAlert = alert;
  alertChangeListener?.(alert);
  
  // Return an object with hide method (optional)
  return {
    hide: () => {
      currentAlert = null;
      alertChangeListener?.(null);
    }
  };
};

export const useThemeAlert = () => {
  const [alertState, setAlertState] = React.useState<any>(null);

  React.useEffect(() => {
    alertChangeListener = setAlertState;
    return () => {
      alertChangeListener = null;
    };
  }, []);

  const hideAlert = () => {
    currentAlert = null;
    setAlertState(null);
  };

  return {
    alert: alertState,
    hideAlert,
    showThemeAlert, // Also expose the function
  };
};