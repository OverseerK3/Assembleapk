import { Dimensions, PixelRatio } from 'react-native';

// Simple responsive helpers without external deps
const { width, height } = Dimensions.get('window');
// Reference sizes based on typical iPhone X-ish
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

export const s = (size: number) => Math.round((width / guidelineBaseWidth) * size);
export const vs = (size: number) => Math.round((height / guidelineBaseHeight) * size);
export const ms = (size: number, factor = 0.5) => Math.round(size + (s(size) - size) * factor);

export const onePx = 1 / PixelRatio.get();
