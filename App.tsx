import { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar, Alert, Switch, Modal } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CIRCLE_SIZE = 240;
const STROKE_WIDTH = 10;
const RADIUS = (CIRCLE_SIZE - STROKE_WIDTH) / 2;
const FULL_CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const ARC_LENGTH = FULL_CIRCUMFERENCE * 0.75;

const STORAGE_KEY_SPEED_LIMIT = '@kin_kon_speed_limit';
const STORAGE_KEY_MAX_SCALE = '@kin_kon_max_scale';

export default function App() {
  const [currentSpeed, setCurrentSpeed] = useState<number>(0);
  const [isTracking, setIsTracking] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('Press Start to begin tracking');
  const [isChimeEnabled, setIsChimeEnabled] = useState<boolean>(true);

  const [speedLimit, setSpeedLimit] = useState<number>(100);
  const [maxSpeedScale, setMaxSpeedScale] = useState<number>(180);
  const [isSettingsVisible, setIsSettingsVisible] = useState<boolean>(false);

  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const speedExceededCountRef = useRef<number>(0);
  const hasChimedRef = useRef<boolean>(false);
  const chimePlayer = useAudioPlayer(require('./assets/ae86_chime.mp3'));

  const clampedSpeed = Math.min(currentSpeed, maxSpeedScale);
  const strokeDashoffset = ARC_LENGTH - (clampedSpeed / maxSpeedScale) * ARC_LENGTH;
  const isOverLimit = currentSpeed >= speedLimit;

  useEffect(() => {
    async function loadSettings() {
      try {
        const savedLimit = await AsyncStorage.getItem(STORAGE_KEY_SPEED_LIMIT);
        const savedScale = await AsyncStorage.getItem(STORAGE_KEY_MAX_SCALE);

        if (savedLimit !== null) setSpeedLimit(Number(savedLimit));
        if (savedScale !== null) setMaxSpeedScale(Number(savedScale));
      } catch (err) {
        console.log('Failed to load settings:', err);
      }
    }
    loadSettings();

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  async function handleSpeedLimitChange(value: number) {
    setSpeedLimit(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_SPEED_LIMIT, value.toString());
    } catch (err) {
      console.log('Failed to save speed limit:', err);
    }
  }

  async function handleMaxScaleChange(value: number) {
    setMaxSpeedScale(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_MAX_SCALE, value.toString());
    } catch (err) {
      console.log('Failed to save max scale:', err);
    }
  }

  function playChime() {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      chimePlayer.seekTo(0);
      chimePlayer.play();
    } catch (err) {
      console.log('Error playing sound:', err);
    }
  }

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

        if (roundedSpeed >= speedLimit) {
          speedExceededCountRef.current += 1;

          if (speedExceededCountRef.current >= 2 && !hasChimedRef.current && isChimeEnabled) {
            playChime();
            hasChimedRef.current = true;
          }
        } else {
          speedExceededCountRef.current = 0;
          hasChimedRef.current = false;
        }
      }
    );
  }

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

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View>
              <Text style={styles.headerTitle}>Kin-Kon Chime</Text>
              <Text style={styles.headerSubtitle}>Speed Warning System</Text>
            </View>
          </View>

          <View style={styles.headerBottomRow}>
            <View style={styles.headerToggleContainer}>
              <Text style={styles.toggleLabel}>Chime Sound</Text>
              <Switch
                value={isChimeEnabled}
                onValueChange={setIsChimeEnabled}
                trackColor={{ false: '#333333', true: '#34c759' }}
                thumbColor={'#ffffff'}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
            </View>

            <TouchableOpacity
              style={styles.btnGear}
              onPress={() => setIsSettingsVisible(true)}
            >
              <Text style={styles.gearText}>⚙️</Text>
            </TouchableOpacity>
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
            <Text style={styles.thresholdText}>Limit: {speedLimit} KM/H</Text>
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

        <Modal
          visible={isSettingsVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsSettingsVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Gauge Settings</Text>

              <View style={styles.settingGroup}>
                <Text style={styles.settingTitle}>Chime speed limit</Text>
                <Text style={styles.settingSubtext}>Current limit: {speedLimit} KM/H</Text>

                <Slider
                  style={styles.slider}
                  minimumValue={40}
                  maximumValue={240}
                  step={5}
                  value={speedLimit}
                  onValueChange={handleSpeedLimitChange}
                  minimumTrackTintColor="#34c759"
                  maximumTrackTintColor="#333333"
                  thumbTintColor="#ffffff"
                />

                <View style={styles.presetRow}>
                  {[100, 120, 140, 180, 220].map((value) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.btnPreset, speedLimit === value && styles.btnPresetActive]}
                      onPress={() => handleSpeedLimitChange(value)}
                    >
                      <Text style={[styles.presetText, speedLimit === value && styles.presetTextActive]}>
                        {value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.settingGroup}>
                <Text style={styles.settingTitle}>Max speed scale</Text>
                <Text style={styles.settingSubtext}>Gauge peak: {maxSpeedScale} KM/H</Text>

                <Slider
                  style={styles.slider}
                  minimumValue={100}
                  maximumValue={400}
                  step={10}
                  value={maxSpeedScale}
                  onValueChange={handleMaxScaleChange}
                  minimumTrackTintColor="#34c759"
                  maximumTrackTintColor="#333333"
                  thumbTintColor="#ffffff"
                />

                <View style={styles.presetRow}>
                  {[180, 240, 320, 400].map((value) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.btnPreset, maxSpeedScale === value && styles.btnPresetActive]}
                      onPress={() => handleMaxScaleChange(value)}
                    >
                      <Text style={[styles.presetText, maxSpeedScale === value && styles.presetTextActive]}>
                        {value}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={styles.btnCloseModal}
                onPress={() => setIsSettingsVisible(false)}
              >
                <Text style={styles.closeModalText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
    width: '90%',
    marginTop: 10,
  },
  headerTopRow: {
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    flex: 1,
    marginRight: 10,
    justifyContent: 'space-between',
  },
  toggleLabel: {
    color: '#dddddd',
    fontSize: 13,
    fontWeight: '600',
  },
  btnGear: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  gearText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
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
    textTransform: 'capitalize',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#181818',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 30,
    textAlign: 'center',
    letterSpacing: 1,
  },
  settingGroup: {
    marginBottom: 25,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  settingSubtext: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 10,
  },
  slider: {
    width: '100%',
    height: 40,
    marginBottom: 5,
  },
  presetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  btnPreset: {
    flex: 1,
    backgroundColor: '#222222',
    paddingVertical: 8,
    marginHorizontal: 3,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333333',
  },
  btnPresetActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  presetText: {
    color: '#aaaaaa',
    fontWeight: '600',
    fontSize: 13,
  },
  presetTextActive: {
    color: '#000000',
  },
  btnCloseModal: {
    backgroundColor: '#34c759',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  closeModalText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});