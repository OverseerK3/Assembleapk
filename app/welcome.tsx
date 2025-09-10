import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import { ImageBackground, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function WelcomeScreen() {
  async function proceed(path: string) {
    await AsyncStorage.setItem('onboarded_v1', '1');
    router.replace(path as any);
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
  <ImageBackground source={require('../assets/images/download.png')} style={{ flex: 1 }} resizeMode="cover">
        <LinearGradient colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.85)"]} style={StyleSheet.absoluteFill} />
        <View style={S.content}>
          <Text style={S.brand}>Assemble</Text>
          <Text style={S.headline}>Discover tech events, join teams, and grow faster.</Text>
          <Text style={S.sub}>All the best hackathons, meetups and workshops in one place.</Text>

          <View style={{ height: 12 }} />
          <TouchableOpacity onPress={() => proceed('/(auth)/sign-up')} style={[S.btn, S.btnPrimary]} activeOpacity={0.9}>
            <Text style={S.btnTextPrimary}>Create account</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => proceed('/(auth)/sign-in')} style={[S.btn, S.btnGhost]} activeOpacity={0.9}>
            <Text style={S.btnTextGhost}>Log in</Text>
          </TouchableOpacity>
          <Text style={S.tiny}>By continuing, you agree to our Terms and Privacy.</Text>
        </View>
      </ImageBackground>
    </View>
  );
}

const S = StyleSheet.create({
  content: { flex: 1, justifyContent: 'flex-end', padding: 24 },
  brand: { color: '#fff', fontSize: 36, fontWeight: '800', letterSpacing: 0.4, marginBottom: 8, fontFamily: 'Urbanist_800ExtraBold' },
  headline: { color: '#fff', fontSize: 22, fontWeight: '800', lineHeight: 30, fontFamily: 'Urbanist_800ExtraBold' },
  sub: { color: '#E5EAF5', marginTop: 6, lineHeight: 20, fontFamily: 'Urbanist_600SemiBold' },
  btn: { paddingVertical: 14, alignItems: 'center', borderRadius: 12, borderWidth: 1, marginTop: 12 },
  btnPrimary: { backgroundColor: '#1E5BFF', borderColor: '#1E5BFF' },
  btnGhost: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.15)' },
  btnTextPrimary: { color: '#fff', fontWeight: '800', fontSize: 16, fontFamily: 'Urbanist_800ExtraBold' },
  btnTextGhost: { color: '#fff', fontWeight: '700', fontFamily: 'Urbanist_700Bold' },
  tiny: { color: '#A9B7D9', fontSize: 12, textAlign: 'center', marginTop: 10, marginBottom: 8, fontFamily: 'Urbanist_400Regular' },
});
