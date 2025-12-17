// hooks/useThemeAlert.ts
import { useState, useCallback } from 'react';

interface AlertConfig {
  type?: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
}

export const useThemeAlert = () => {
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertConfig>({
    title: '',
    message: '',
    type: 'info',
  });

  const showAlert = useCallback((config: AlertConfig) => {
    setAlertConfig({
      type: 'info',
      ...config,
    });
    setAlertVisible(true);
  }, []);

  const hideAlert = useCallback(() => {
    setAlertVisible(false);
  }, []);

  return {
    alertVisible,
    alertConfig,
    showAlert,
    hideAlert,
  };
};