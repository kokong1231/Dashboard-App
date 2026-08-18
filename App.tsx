import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from '@/navigation/RootNavigator';
import SplashScreen from '@/screens/SplashScreen';

export default function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <SafeAreaProvider>
      <RootNavigator />
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
    </SafeAreaProvider>
  );
}
