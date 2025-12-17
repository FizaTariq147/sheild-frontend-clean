import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#FFEFF2',
    padding: 20,
    justifyContent: 'center',
  },
  title: {
  fontSize: 32,
    fontWeight: 'bold',
    color: '#3D246C',
    marginBottom: 30,
  },
  input: {
   
    borderRadius: 12,
    padding: 12,
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
  signupButton: {
    backgroundColor: '#e9237fff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  signupButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  switchText: {
    color: '#5D5D5D',
    textAlign: 'center',
    marginTop: 10,
  },
});
