import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding:0,
  },
logo: {
  width: 300,
  height: 300,
  resizeMode: 'contain',
  marginBottom: -10, // pulls text closer
},
title: {
  fontSize: 40,
  fontWeight: '700',
  color: '#FFFFFF',
  fontFamily: 'Inspiration',
  marginTop: -10,    // removes extra space above text
  letterSpacing: 2,
  lineHeight: 40,    // matches font size for tighter spacing
},


});

export default styles;
