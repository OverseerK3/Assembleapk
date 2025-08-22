import { Theme } from '@/constants/Theme';
import { Tabs } from 'expo-router';
import { Calendar, House, SquarePlay, SquareUserRound } from 'lucide-react-native';
import React from 'react';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Theme.colors.primary,
        tabBarInactiveTintColor: '#A6B7E8',
        tabBarStyle: [
          { borderTopColor: Theme.colors.border, backgroundColor: Theme.colors.card },
          Platform.select({ ios: { position: 'absolute' }, default: {} }) as any,
        ],
      }}
    >
      {/* Hide leftover starter routes if present */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => {
            const Icon = House as any;
            return <Icon color={color} size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Events',
          tabBarIcon: ({ color, size }) => {
            const Icon = Calendar as any;
            return <Icon color={color} size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="reels"
        options={{
          title: 'Reels',
          tabBarIcon: ({ color, size }) => {
            const Icon = SquarePlay as any;
            return <Icon color={color} size={size} />;
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => {
            const Icon = SquareUserRound as any;
            return <Icon color={color} size={size} />;
          },
        }}
      />
    </Tabs>
  );
}
