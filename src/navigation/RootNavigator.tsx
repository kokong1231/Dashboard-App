import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import DashboardScreen from '@/screens/DashboardScreen';
import WebViewScreen from '@/screens/WebViewScreen';

export type RootStackParamList = {
  Home: undefined;
  WebView: { url: string; title: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{ headerShown: false, animation: 'fade' }}
      >
        <Stack.Screen name="Home" component={DashboardScreen} />
        <Stack.Screen name="WebView" component={WebViewScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
