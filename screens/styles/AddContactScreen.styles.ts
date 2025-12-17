import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
   backgroundColor: "#FFEFF2",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: '#3D246C',
    marginBottom: 20,
    textAlign: "center",
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
  saveButton: {
     backgroundColor: '#df4869ff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonText: {
      color: '#fff',
    fontWeight: 'bold',
  },
});
