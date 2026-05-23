import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/store/authStore';
import { COLORS } from '../../src/constants';

export default function AppLayout() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, router]);

  const handleLogout = () => {
    logout();
    router.replace('/(auth)/login');
  };

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerRight: () => (
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        ),
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'My Classes',
          headerLeft: () => (
            <View style={styles.headerLeft}>
              <View style={styles.headerLogo}>
                <Text style={styles.headerLogoText}>STA</Text>
              </View>
            </View>
          ),
        }}
      />
      <Stack.Screen
        name="classes/[classId]"
        options={{ title: 'Sections' }}
      />
      <Stack.Screen
        name="attendance/[sectionId]"
        options={{
          title: 'Voice Attendance',
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  logoutBtn: {
    padding: 8,
    marginRight: 4,
  },
  headerLeft: {
    marginLeft: 4,
  },
  headerLogo: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  headerLogoText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
});
