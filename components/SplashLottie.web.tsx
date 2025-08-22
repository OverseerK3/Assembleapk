import Lottie from 'lottie-react';
import React, { CSSProperties } from 'react';

export default function SplashLottie({ data, style }: { data: any; style?: CSSProperties }) {
  return (
    <Lottie
      animationData={data}
      autoplay
      loop={false}
  style={{ width: '100%', height: '100%', objectFit: 'contain', ...style }}
    />
  );
}
