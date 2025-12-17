// components/ThemeToast.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ThemeToastProps {
  visible: boolean;
  type?: ToastType;
  message: string;
  title?: string;
  duration?: number;
  onClose: () => void;
}

export const ThemeToast: React.FC<ThemeToastProps> = ({
  visible,
  type = 'info',
  message,
  title,
  duration = 4000,
  onClose,
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Slide in
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 100,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const getIconName = () => {
    switch (type) {
      case 'success':
        return 'checkmark-circle';
      case 'error':
        return 'close-circle';
      case 'warning':
        return 'warning';
      case 'info':
        return 'information-circle';
      default:
        return 'information-circle';
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'rgba(16, 185, 129, 0.95)';
      case 'error':
        return 'rgba(239, 68, 68, 0.95)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.95)';
      case 'info':
        return 'rgba(233, 35, 127, 0.95)'; // Pink theme
      default:
        return 'rgba(233, 35, 127, 0.95)';
    }
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toastContainer,
        {
          transform: [{ translateY }],
          opacity,
          backgroundColor: getBackgroundColor(),
        },
      ]}
    >
      <TouchableOpacity style={styles.toastContent} onPress={hideToast}>
        <Ionicons name={getIconName()} size={24} color="#fff" style={styles.toastIcon} />
        <View style={styles.toastTextContainer}>
          {title && <Text style={styles.toastTitle}>{title}</Text>}
          <Text style={styles.toastMessage}>{message}</Text>
        </View>
        <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
          <Ionicons name="close" size={20} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 9999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toastIcon: {
    marginRight: 12,
  },
  toastTextContainer: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  toastMessage: {
    fontSize: 13,
    color: '#fff',
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});