// src/helpers/authHeaders.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem("accessToken"); // consistent key
  return {
    "Content-Type": "application/json",
    Authorization: token ? `Bearer ${token}` : "",
  };
};

export default getAuthHeaders;
