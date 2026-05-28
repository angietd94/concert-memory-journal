import { StatusBar } from 'expo-status-bar';
import { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, SafeAreaView, TouchableOpacity,
  FlatList, Modal, TextInput, Alert, ScrollView,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Concert = {
  id: string;
  artist: string;
  venue: string;
  date: string;
  rating: number;
  notes: string;
};

const STORAGE_KEY = '@cmj:concerts';
const PREMIUM_KEY = '@cmj:isPremium';
const FREE_TIER_LIMIT = 3;

export default function App() {
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [draft, setDraft] = useState<Omit<Concert, 'id'>>({
    artist: '', venue: '', date: '', rating: 0, notes: '',
  });

  // Load saved state on app start
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) { try { setConcerts(JSON.parse(raw)); } catch {} }
    });
    AsyncStorage.getItem(PREMIUM_KEY).then((raw) => {
      if (raw === 'true') setIsPremium(true);
    });
  }, []);

  // Persist concerts
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(concerts));
  }, [concerts]);

  // Persist premium status
  useEffect(() => {
    AsyncStorage.setItem(PREMIUM_KEY, isPremium ? 'true' : 'false');
  }, [isPremium]);

  function resetDraft() {
    setDraft({ artist: '', venue: '', date: '', rating: 0, notes: '' });
  }

  function handleAddPress() {
    // PAYWALL GATE: free users limited to FREE_TIER_LIMIT concerts.
    // In A.2 we'll replace this with a real check against RevenueCat
    // (or react-native-iap getAvailablePurchases) on app launch.
    if (!isPremium && concerts.length >= FREE_TIER_LIMIT) {
      setPaywallVisible(true);
      return;
    }
    setModalVisible(true);
  }

  function handleSave() {
    if (!draft.artist.trim() || !draft.venue.trim() || !draft.date.trim() || draft.rating === 0) {
      Alert.alert('Missing info', 'Artist, venue, date, and rating are required.');
      return;
    }
    setConcerts([{ id: Date.now().toString(), ...draft }, ...concerts]);
    resetDraft();
    setModalVisible(false);
  }

  // STUBS for Phase A.2 — when real react-native-iap is wired up, these
  // call requestSubscription / requestPurchase / getAvailablePurchases.
  function stubPurchase(productId: string) {
    Alert.alert(
      'Phase A.1 stub',
      `Would purchase "${productId}".\nIn A.2 this calls react-native-iap.requestSubscription({ sku }).`,
      [{ text: 'Pretend it worked', onPress: () => { setIsPremium(true); setPaywallVisible(false); } }],
    );
  }
  function stubRestore() {
    Alert.alert(
      'Phase A.1 stub',
      'Would call react-native-iap.getAvailablePurchases() and reconcile against active subscriptions.',
      [{ text: 'Pretend you had premium', onPress: () => { setIsPremium(true); setPaywallVisible(false); } }],
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Concert Memory Journal</Text>
          <Text style={styles.subtitle}>
            Letterboxd for live music {isPremium ? '· Premium' : `· ${concerts.length}/${FREE_TIER_LIMIT} free`}
          </Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {concerts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>🎤</Text>
          <Text style={styles.emptyTitle}>No concerts logged yet</Text>
          <Text style={styles.emptySubtitle}>Tap the + button to log your first show.</Text>
        </View>
      ) : (
        <FlatList
          data={concerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardArtist}>{item.artist}</Text>
              <Text style={styles.cardVenue}>{item.venue}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.cardDate}>{item.date}</Text>
                <Text style={styles.cardRating}>
                  {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                </Text>
              </View>
              {item.notes ? <Text style={styles.cardNotes}>{item.notes}</Text> : null}
            </View>
          )}
        />
      )}

      {/* ADD CONCERT MODAL */}
      <Modal animationType="slide" presentationStyle="pageSheet" visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { resetDraft(); setModalVisible(false); }}>
                <Text style={styles.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Concert</Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={styles.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 60 }}>
              <Text style={styles.label}>Artist</Text>
              <TextInput style={styles.input} placeholder="e.g. Phoebe Bridgers" value={draft.artist} onChangeText={(t) => setDraft({ ...draft, artist: t })} />
              <Text style={styles.label}>Venue</Text>
              <TextInput style={styles.input} placeholder="e.g. The Greek Theatre" value={draft.venue} onChangeText={(t) => setDraft({ ...draft, venue: t })} />
              <Text style={styles.label}>Date</Text>
              <TextInput style={styles.input} placeholder="YYYY-MM-DD" value={draft.date} onChangeText={(t) => setDraft({ ...draft, date: t })} />
              <Text style={styles.label}>Rating</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <TouchableOpacity key={n} onPress={() => setDraft({ ...draft, rating: n })}>
                    <Text style={styles.star}>{n <= draft.rating ? '★' : '☆'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.label}>Notes</Text>
              <TextInput style={[styles.input, styles.textArea]} placeholder="What stood out about this show?" multiline numberOfLines={4} value={draft.notes} onChangeText={(t) => setDraft({ ...draft, notes: t })} />
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>

      {/* PAYWALL MODAL */}
      <Modal animationType="slide" presentationStyle="pageSheet" visible={paywallVisible} onRequestClose={() => setPaywallVisible(false)}>
        <SafeAreaView style={styles.paywallContainer}>
          <ScrollView contentContainerStyle={styles.paywallBody}>
            <Text style={styles.paywallEmoji}>🎟️</Text>
            <Text style={styles.paywallHeadline}>You're out of free concerts</Text>
            <Text style={styles.paywallSub}>
              Upgrade to Premium for unlimited entries, photo attachments, and stats.
            </Text>

            <TouchableOpacity style={[styles.product, styles.productHighlight]} onPress={() => stubPurchase('cmj.premium.annual')}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productTitle}>Premium Annual</Text>
                <Text style={styles.productSub}>$19.99 / year · 7-day free trial</Text>
              </View>
              <Text style={styles.productBadge}>BEST VALUE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.product} onPress={() => stubPurchase('cmj.premium.monthly')}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productTitle}>Premium Monthly</Text>
                <Text style={styles.productSub}>$2.99 / month</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.product} onPress={() => stubPurchase('cmj.premium.lifetime')}>
              <View style={{ flex: 1 }}>
                <Text style={styles.productTitle}>Premium Lifetime</Text>
                <Text style={styles.productSub}>$49.99 once</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity onPress={stubRestore}>
              <Text style={styles.restoreLink}>Restore Purchases</Text>
            </TouchableOpacity>

            <Text style={styles.legal}>
              Subscriptions auto-renew. Cancel anytime in Settings. (Apple requires this disclaimer — A.2 pain log entry.)
            </Text>

            <TouchableOpacity onPress={() => setPaywallVisible(false)}>
              <Text style={styles.closeLink}>Maybe later</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 24, fontWeight: '700', color: '#111' },
  subtitle: { fontSize: 13, color: '#888', marginTop: 2 },
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#fff', fontSize: 26, lineHeight: 28, fontWeight: '300' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '600', color: '#222', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#888', textAlign: 'center', lineHeight: 22 },

  list: { padding: 16 },
  card: { backgroundColor: '#f7f7f7', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardArtist: { fontSize: 18, fontWeight: '600', color: '#111' },
  cardVenue: { fontSize: 14, color: '#666', marginTop: 2 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cardDate: { fontSize: 13, color: '#888' },
  cardRating: { fontSize: 14, color: '#f59e0b' },
  cardNotes: { fontSize: 14, color: '#444', marginTop: 8, lineHeight: 20 },

  modalContainer: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalTitle: { fontSize: 17, fontWeight: '600' },
  modalCancel: { fontSize: 16, color: '#888' },
  modalSave: { fontSize: 16, fontWeight: '600', color: '#007aff' },
  modalBody: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#444', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  starsRow: { flexDirection: 'row', gap: 8 },
  star: { fontSize: 32, color: '#f59e0b' },

  paywallContainer: { flex: 1, backgroundColor: '#fff' },
  paywallBody: { padding: 24, paddingTop: 40, alignItems: 'center' },
  paywallEmoji: { fontSize: 48, marginBottom: 16 },
  paywallHeadline: { fontSize: 24, fontWeight: '700', textAlign: 'center', color: '#111', marginBottom: 8 },
  paywallSub: { fontSize: 15, textAlign: 'center', color: '#666', marginBottom: 24, lineHeight: 22 },
  product: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 16, marginBottom: 12, width: '100%' },
  productHighlight: { borderColor: '#111', borderWidth: 2 },
  productTitle: { fontSize: 17, fontWeight: '600', color: '#111' },
  productSub: { fontSize: 13, color: '#666', marginTop: 2 },
  productBadge: { fontSize: 11, fontWeight: '700', color: '#fff', backgroundColor: '#111', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  restoreLink: { fontSize: 14, color: '#007aff', marginTop: 16, fontWeight: '500' },
  legal: { fontSize: 11, color: '#999', textAlign: 'center', marginTop: 24, lineHeight: 16, paddingHorizontal: 8 },
  closeLink: { fontSize: 14, color: '#888', marginTop: 24 },
});