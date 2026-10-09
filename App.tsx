import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar, Alert, Switch } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAudioPlayer } from 'expo-audio';
import Svg, { Circle } from 'react-native-svg';

import { SPEED_LIMIT_KMH, MAX_SPEED_SCALE } from './src/constants/config';

const CIRCLE_SIZE = 240;
const STROKE_WIDTH = 10;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const FULL_CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_LENGTH = FULL_CIRCUMFERENCE * 0.75;

export default function App() {
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Press Start to begin tracking');
  const [isChimeEnabled, setIsChimeEnabled] = useState<boolean>(true);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const hasChimedRef = useRef<boolean>(false);
  const chimePlayer = useAudioPlayer(require('./assets/ae86_chime.mp3'));

  const clampedSpeed = Math.min(currentSpeed, MAX_SPEED_SCALE);
  const strokeDashoffset = ARC_LENGTH - (clampedSpeed / MAX_SPEED_SCALE) * ARC_LENGTH;
  const isOverLimit = currentSpeed >= SPEED_LIMIT_KMH;

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
          if (!hasChimedRef.current && isChimeEnabled) {
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
    Alert.alert(
      'Stop Trip?',
      'Are you sure you want to end your speed tracking session?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Stop',
          style: 'destructive',
          onPress: () => {
            if (locationSubscription.current) {
              locationSubscription.current.remove();
              locationSubscription.current = null;
            }
            setIsTracking(false);
            setCurrentSpeed(0);
            hasChimedRef.current = false;
            setStatusMessage('Tracking stopped');
          },
        },
      ],
      { cancelable: true }
    );
  }

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
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Kin-Kon Chime</Text>
            <Text style={styles.headerSubtitle}>Speed Warning System</Text>
          </View>

          <View style={styles.headerToggleContainer}>
            <Text style={styles.toggleLabel}>Chime</Text>
            <Switch
              value={isChimeEnabled}
              onValueChange={setIsChimeEnabled}
              trackColor={{ false: '#333333', true: '#34c759' }}
              thumbColor={'#ffffff'}
              style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
            />
          </View>
        </View>

        <View style={styles.speedometerContainer}>
          <Svg height={CIRCLE_SIZE} width={CIRCLE_SIZE} style={styles.svgRing}>
            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke="#2a2a2a"
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${ARC_LENGTH} ${FULL_CIRCUMFERENCE}`}
              strokeLinecap="round"
              fill="none"
              rotation="135"
              origin={`${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2}`}
            />

            <Circle
              cx={CIRCLE_SIZE / 2}
              cy={CIRCLE_SIZE / 2}
              r={RADIUS}
              stroke={isOverLimit ? '#ff3b30' : '#ffffff'}
              strokeWidth={STROKE_WIDTH}
              strokeDasharray={`${ARC_LENGTH} ${FULL_CIRCUMFERENCE}`}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="none"
              rotation="135"
              origin={`${CIRCLE_SIZE / 2}, ${CIRCLE_SIZE / 2}`}
            />
          </Svg>

          <View style={styles.speedContent}>
            <Text style={[styles.speedValue, isOverLimit && styles.textAlert]}>
              {currentSpeed}
            </Text>
            <Text style={[styles.speedUnit, isOverLimit && styles.textAlert]}>
              KM/H
            </Text>
            <Text style={styles.thresholdText}>Limit: {SPEED_LIMIT_KMH} KM/H</Text>
          </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    marginTop: 10,
    paddingHorizontal: 4,
  },
  headerTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    paddingVertical: 4,
    paddingLeft: 10,
    paddingRight: 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    flexShrink: 0,
  },
  toggleLabel: {
    color: '#aaaaaa',
    fontSize: 12,
    fontWeight: '600',
    marginRight: 4,
    textTransform: 'uppercase',
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
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: '#1e1e1e',
    position: 'relative',
  },
  svgRing: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  speedContent: {
    alignItems: 'center',
    justifyContent: 'center',
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
  textAlert: {
    color: '#ff3b30',
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