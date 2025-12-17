import React, { useEffect } from 'react';
import {  Image, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';   
import styles from './styles/SplashScreen';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { RootStackParamList } from "../navigation/AuthNavigator";


type SplashScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Splash'
>;

const SplashScreen = () => {
  const navigation = useNavigation<SplashScreenNavigationProp>();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('S');
    }, 5000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
<LinearGradient
          colors={[ "#f35f89ff","#e9237fff", "#b549fa"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.container}
>
      <Image source={require('../assets/logo.png')} style={styles.logo} />
      <Text style={styles.title}>SHEILD</Text>
    </LinearGradient>
  );
};

export default SplashScreen;
