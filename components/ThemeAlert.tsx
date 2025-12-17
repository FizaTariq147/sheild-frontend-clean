// components/ThemeAlert.tsx
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ThemeAlertProps {
  visible: boolean;
  title: string;
  message: string;
  type?: 'info' | 'error' | 'warning' | 'success';
  buttons?: Array<{
    text: string;
    onPress?: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }>;
  onClose: () => void;
  showCloseButton?: boolean;
}

export const ThemeAlert: React.FC<ThemeAlertProps> = ({
  visible,
  title,
  message,
  type = 'info',
  buttons = [{ text: 'OK', onPress: () => {} }],
  onClose,
  showCloseButton = true,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleButtonPress = (buttonIndex: number) => {
    const button = buttons[buttonIndex];
    button.onPress?.();
    onClose();
  };

  const handleClose = () => {
    const cancelButton = buttons.find(btn => btn.style === 'cancel');
    if (cancelButton?.onPress) {
      cancelButton.onPress();
    }
    onClose();
  };

  const getIconName = () => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'close-circle';
      case 'warning': return 'warning';
      case 'info': return 'information-circle';
      default: return 'information-circle';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success': return '#10B981';
      case 'error': return '#EF4444';
      case 'warning': return '#F59E0B';
      case 'info': return '#e9237f';
      default: return '#e9237f';
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent={true}
    >
      <TouchableOpacity
        activeOpacity={1}
        style={styles.fullScreenBackdropTouchable}
        onPress={handleClose}
      >
        <Animated.View 
          style={[
            styles.fullScreenBackdrop,
            { opacity: fadeAnim }
          ]}
        />
      </TouchableOpacity>
      
      <View style={styles.modalContainer}>
        <Animated.View style={[
          styles.alertContainer,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}>
          {showCloseButton && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close-circle" size={28} color="#e9237f" />
            </TouchableOpacity>
          )}

          <View style={[styles.header, showCloseButton && styles.headerWithClose]}>
            <View style={[styles.iconContainer, { backgroundColor: getIconColor() + '20' }]}>
              <Ionicons name={getIconName()} size={28} color={getIconColor()} />
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>

          <View style={[styles.buttonContainer, buttons.length > 2 ? styles.verticalButtons : styles.horizontalButtons]}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  button.style === 'destructive' && styles.destructiveButton,
                  button.style === 'cancel' && styles.cancelButton,
                  buttons.length > 2 && styles.fullWidthButton,
                ]}
                onPress={() => handleButtonPress(index)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.buttonText,
                  button.style === 'destructive' && styles.destructiveButtonText,
                  button.style === 'cancel' && styles.cancelButtonText,
                ]}>
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenBackdropTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  fullScreenBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  alertContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 400,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  headerWithClose: {
    marginTop: 8,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3D246C',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: '#5D5D5D',
    textAlign: 'center',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
  },
  horizontalButtons: {
    justifyContent: 'flex-end',
    gap: 12,
  },
  verticalButtons: {
    flexDirection: 'column',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#e9237f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullWidthButton: {
    width: '100%',
  },
  destructiveButton: {
    backgroundColor: '#EF4444',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  destructiveButtonText: {
    color: '#fff',
  },
  cancelButtonText: {
    color: '#666',
  },
});