import { useFocusEffect } from '@react-navigation/native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Play } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, ListRenderItemInfo, Platform, StatusBar, StyleSheet, Text, TouchableOpacity, View, ViewToken } from 'react-native';

const { height, width } = Dimensions.get('window');

type Reel = { id: string; source: any; caption?: string };

const REELS: Reel[] = [
  { id: 'r1', source: require('../../assets/videos/v1.mp4'), caption: 'Event Highlights' },
  { id: 'r2', source: require('../../assets/videos/v2.mp4'), caption: 'Behind the Scenes' },
  { id: 'r3', source: require('../../assets/videos/v3.mp4'), caption: 'Speaker Snippets' },
  { id: 'r4', source: require('../../assets/videos/v4.mp4'), caption: 'Crowd Moments' },
];

function ReelItem({ item, active, screenActive }: { item: Reel; active: boolean; screenActive: boolean }) {
  const player = useVideoPlayer(item.source, (p) => {
    // initial setup
    p.loop = true;
    p.muted = false;
  });
  const [manPaused, setManPaused] = useState(false);

  useEffect(() => {
    const p: any = player as any;
    if (!screenActive || !active || manPaused) {
      p.pause?.();
      p.muted = true;
    } else {
      p.muted = false;
      p.play?.();
    }
  }, [active, player, manPaused, screenActive]);

  useEffect(() => {
    // Safety: pause & mute on unmount
    return () => {
      const p: any = player as any;
      try {
        p.pause?.();
        p.muted = true;
      } catch {}
    };
  }, [player]);

  const onToggle = () => {
    if (manPaused) {
      setManPaused(false);
      if (active && screenActive) {
        const p: any = player as any;
        p.muted = false;
        p.play?.();
      }
    } else {
      setManPaused(true);
      const p: any = player as any;
      p.pause?.();
      p.muted = true;
    }
  };

  const IconPlay = Play as any;

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player as any}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        contentFit="cover"
      />
      {/* Tap overlay to toggle play/pause */}
      <TouchableOpacity activeOpacity={1} onPress={onToggle} style={styles.tapOverlay}>
        {manPaused && (
          <View style={styles.playBadge}>
            <IconPlay size={36} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function ReelsScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<Reel>>(null);
  const [screenActive, setScreenActive] = useState(true);

  // Pause when leaving the screen
  useFocusEffect(
    useCallback(() => {
      setScreenActive(true);
      return () => {
        setScreenActive(false);
        setActiveIndex(-1);
      };
    }, [])
  );

  const onViewableItemsChanged = useRef((info: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
    const first = info.viewableItems[0];
    if (first && typeof first.index === 'number') setActiveIndex(first.index);
  }).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;

  const renderItem = ({ item, index }: ListRenderItemInfo<Reel>) => {
    const isActive = index === activeIndex;
  return (
      <View style={styles.page}>
    <ReelItem item={item} active={isActive} screenActive={screenActive} />

        {/* Overlay UI */}
        <View style={styles.overlayTop}>
          <Text style={styles.header}>Reels</Text>
        </View>
        <View style={styles.overlayBottom}>
          <View style={{ flex: 1 }}>
            <Text style={styles.caption}>{item.caption}</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionBtn}><Text style={styles.actionText}>♥︎</Text></TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}><Text style={styles.actionText}>💬</Text></TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn}><Text style={styles.actionText}>↗︎</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={REELS}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToAlignment="start"
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  page: { width, height, backgroundColor: 'black' },
  tapOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playBadge: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 999, padding: 12 },
  overlayTop: { position: 'absolute', top: 52 + ((Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0)), left: 16, right: 16, zIndex: 2 },
  overlayBottom: { position: 'absolute', bottom: 40, left: 16, right: 16, flexDirection: 'row', alignItems: 'flex-end' },
  header: { color: '#fff', fontSize: 20, fontFamily: 'Urbanist_800ExtraBold' },
  caption: { color: '#fff', fontSize: 16, marginRight: 12, fontFamily: 'Urbanist_600SemiBold' },
  actions: { width: 56, alignItems: 'center' },
  actionBtn: { paddingVertical: 6, marginBottom: 12 },
  actionText: { color: '#fff', fontSize: 22 },
});
