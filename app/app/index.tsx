/**
 * Root index — redirects to the right screen based on auth + household state.
 */
import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";

export default function Index() {
  const { session, loading: authLoading } = useAuth();
  const { household, loading: hhLoading }  = useHousehold();

  useEffect(() => {
    if (authLoading || hhLoading) return;

    if (!session) {
      router.replace("/(auth)/login");
    } else if (!household) {
      router.replace("/(home)/household");
    } else {
      router.replace("/(home)/lists");
    }
  }, [authLoading, hhLoading, session, household]);

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color="#1a1a1a" />
    </View>
  );
}
