import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFEFF2',
    padding: 20,
    justifyContent: 'center',
  },
  arrowButton: {
    position: 'absolute',
    top: 40,
    right: 20,
  },
  arrowText: {
    fontSize: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3D246C',
    marginBottom: 30,
  },
  input: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 15,
    backgroundColor: '#fff',
    opacity: 0.9,
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    // Android shadow
    elevation: 5,
  },
  forgotPassword: {
    color: '#5D5D5D',
    marginBottom: 25,
    textAlign: 'left',
  },
  loginButton: {
    backgroundColor: '#e9237fff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  divider: {
    textAlign: 'center',
    marginBottom: 20,
    color: '#999',
  },
  googleButton: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#fff',
    opacity: 0.9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    // Android shadow
    elevation: 5,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleText: {
    color: '#999',
  },
  signUpButton: {
    backgroundColor: '#b549fa',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  signUpButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
