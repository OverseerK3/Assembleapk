import SplashLottie from '@/components/SplashLottie';
import { getSupabase } from '@/lib/supabase';
import { Urbanist_400Regular, Urbanist_600SemiBold, Urbanist_700Bold, Urbanist_800ExtraBold, useFonts } from '@expo-google-fonts/urbanist';
import { Session, User } from '@supabase/supabase-js';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-reanimated';
import '../polyfills';

type AuthContextType = { session: Session | null; user: User | null; role: 'participant' | 'organization'; loading: boolean };
const AuthContext = createContext<AuthContextType>({ session: null, user: null, role: 'participant', loading: true });
export const useAuth = () => useContext(AuthContext);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
  const { data } = await getSupabase().auth.getSession();
      if (mounted) setSession(data.session ?? null);
      setLoading(false);
    })();
  const { data: sub } = getSupabase().auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const role = (user?.user_metadata?.role as 'participant' | 'organization' | undefined) ?? 'participant';
  const value = useMemo(() => ({ session, user, role, loading }), [session, user, role, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function Gate() {
  const { session, loading } = useAuth();
  const [fontsLoaded] = useFonts({
    Urbanist_400Regular,
    Urbanist_600SemiBold,
    Urbanist_700Bold,
    Urbanist_800ExtraBold,
  });
      const [showLottie, setShowLottie] = useState(true);

  useEffect(() => {
    SplashScreen.preventAutoHideAsync();
  }, []);

  useEffect(() => {
    if (!loading && fontsLoaded) {
      // Allow a brief Lottie intro, then hide native splash
      const t = setTimeout(() => SplashScreen.hideAsync(), 100);
      return () => clearTimeout(t);
    }
  }, [loading, fontsLoaded]);

  // Hide the Lottie overlay after a short duration once fonts + auth are ready
  useEffect(() => {
    if (!loading && fontsLoaded && showLottie) {
      const t = setTimeout(() => setShowLottie(false), 1600);
      return () => clearTimeout(t);
    }
  }, [loading, fontsLoaded, showLottie]);

  if (loading || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  const AppStack = (
    <Stack>
      {session ? (
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      ) : (
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      )}
  {/** settings stack removed */}
      <Stack.Screen name="+not-found" />
    </Stack>
  );

  // Overlay the Lottie animation on top of the app during initial intro
  return (
    <View style={{ flex: 1 }}>
      {AppStack}
      {showLottie && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: '#FFFFFF',
        }}>
          <SplashLottie data={require('../assets/lotties/logoass.json')} />
        </View>
      )}
    </View>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <View style={{ flex: 1 }}>
        {/* Apply Urbanist globally via defaultTextStyle on React Native 0.73+ */}
        <Gate />
      </View>
    </AuthProvider>
  );
}
