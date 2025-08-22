// Polyfills required by Supabase in React Native
// URL & fetch semantics
import 'react-native-url-polyfill/auto';

// crypto.getRandomValues polyfill via Expo Crypto (avoids react-native-get-random-values)
import * as Crypto from 'expo-crypto';

// Ensure global.crypto exists
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g: any = global as any;
if (!g.crypto) g.crypto = {};
if (typeof g.crypto.getRandomValues !== 'function') {
	g.crypto.getRandomValues = (array: Uint8Array) => {
		const bytes = Crypto.getRandomBytes(array.length);
		array.set(bytes);
		return array;
	};
}
