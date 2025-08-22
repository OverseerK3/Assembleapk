import LottieView from 'lottie-react-native';
import React from 'react';
import { ViewStyle } from 'react-native';

export default function SplashLottie({ data, style }: { data: any; style?: ViewStyle }) {
  return (
    <LottieView
      source={data}
      autoPlay
      loop={false}
  style={[{ width: '100%', height: '100%' } as any, style]}
    />
  );
}
