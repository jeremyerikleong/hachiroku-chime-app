import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAudioPlayer } from 'expo-audio';

import { SPEED_LIMIT_KMH } from './src/constants/config';

export default function App() {
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Press Start to begin tracking');

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const hasChimedRef = useRef<boolean>(false);
  const chimePlayer = useAudioPlayer(require('./assets/ae86_chime.mp3'));

  function playChime() {
    try {
      chimePlayer.seekTo(0);
      chimePlayer.play();
    } catch (err) {
      console.log('Error playing sound:', err);
    }
  };

  async function startTracking() {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      setStatusMessage('Permission to access location was denied');
      return;
    }

    setIsTracking(true);
    setStatusMessage('Monitoring speed...');

    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      (location) => {
        const speedMps = location.coords.speed ?? 0;
        const speedKmh = speedMps > 0 ? speedMps * 3.6 : 0;
        const roundedSpeed = Math.round(speedKmh);

        setCurrentSpeed(roundedSpeed);

        if (roundedSpeed >= SPEED_LIMIT_KMH) {
          if (!hasChimedRef.current) {
            playChime();
            hasChimedRef.current = true;
          }
        } else {
          hasChimedRef.current = false;
        }
      }
    );
  };

  function stopTracking() {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    setIsTracking(false);
    setCurrentSpeed(0);
    hasChimedRef.current = false;
    setStatusMessage('Tracking stopped');
  };

  useEffect(() => {
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.header}>
          <Text style={styles.headerTitle}>Kin-Kon Chime</Text>
          <Text style={styles.headerSubtitle}>Speed Warning System</Text>
        </View>

        <View style={styles.speedometerContainer}>
          <Text style={styles.speedValue}>{currentSpeed}</Text>
          <Text style={styles.speedUnit}>KM/H</Text>
          <Text style={styles.thresholdText}>Limit: {SPEED_LIMIT_KMH} KM/H</Text>
        </View>

        <View style={styles.controlContainer}>
          <Text style={styles.statusText}>{statusMessage}</Text>

          {!isTracking ? (
            <TouchableOpacity style={[styles.button, styles.btnStart]} onPress={startTracking}>
              <Text style={styles.btnText}>start trip</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.button, styles.btnStop]} onPress={stopTracking}>
              <Text style={styles.btnText}>stop trip</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888888',
    marginTop: 4,
  },
  speedometerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 4,
    borderColor: '#ffffff',
    backgroundColor: '#1e1e1e',
  },
  speedValue: {
    fontSize: 72,
    fontWeight: '700',
    color: '#ffffff',
  },
  speedUnit: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 5,
  },
  thresholdText: {
    fontSize: 12,
    color: '#aaaaaa',
  },
  controlContainer: {
    width: '80%',
    alignItems: 'center',
    marginBottom: 30,
  },
  statusText: {
    color: '#bbbbbb',
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnStart: {
    backgroundColor: '#34c759',
  },
  btnStop: {
    backgroundColor: '#ff3b30',
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});