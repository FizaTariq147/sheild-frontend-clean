
import React from "react";
import { View, StyleSheet } from "react-native";

type Props = {
  total: 6;   
  current: number;
};

export default function Dots({ total, current }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index === current && styles.activeDot, // highlight current dot
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
        marginTop: 240,
        backgroundColor: "#ccc",
        width: 80,
        paddingTop:5,
        paddingBottom:5,
        borderRadius: 50,
    },
  dot: {
    width:6,
    height: 6,
    borderRadius: 6,
    backgroundColor: "#8c8a8aff",
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: "#f48fa3ff",
  },
});
