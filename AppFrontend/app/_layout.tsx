import "@/config/firebase";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";
import { StyleSheet } from "react-native";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.safeArea}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modal" options={{ presentation: "modal" }} />
        </Stack>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    paddingTop: 5,
    backgroundColor: "#fff",
  },
});
