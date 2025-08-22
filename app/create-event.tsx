import { useAuth } from '@/app/_layout';
import { Theme } from '@/constants/Theme';
import { createEvent, EventCategory, uploadBannerAsync } from '@/lib/events';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

type Mode = 'In-Person' | 'Virtual' | 'Hybrid';

export default function CreateEventScreen() {
  const { role, user } = useAuth();
  const router = useRouter();
  const isOrg = role === 'organization';

  const [title, setTitle] = useState('');
  // simplified event type fields are removed in backend; keep local if needed in future
  const [desc, setDesc] = useState('');

  const [startAt, setStartAt] = useState<Date | null>(null);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState<null | { which: 'start' | 'end'; mode: 'date' | 'time' }>(null);

  const [mode, setMode] = useState<Mode>('In-Person');
  const [venue, setVenue] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [links, setLinks] = useState<string[]>(['']);

  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  // Category selector for filtering and tags
  const categories: EventCategory[] = useMemo(() => ['hackathon','tech event','workshop','projects','tech meetup'], []);
  const [category, setCategory] = useState<EventCategory>('hackathon');

  const [teamBased, setTeamBased] = useState(false);
  const [minTeam, setMinTeam] = useState('2');
  const [maxTeam, setMaxTeam] = useState('4');
  const [teamInfo, setTeamInfo] = useState('');

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (!desc.trim()) return false;
    if (!startAt || !endAt) return false;
  if (mode === 'In-Person' && (!venue.trim() || !city.trim() || !address.trim())) return false;
    return true;
  }, [title, desc, startAt, endAt, mode, venue, city, address]);

  function updateLink(i: number, val: string) {
    setLinks((prev) => prev.map((v, idx) => (idx === i ? val : v)));
  }
  function addLink() {
    setLinks((prev) => [...prev, '']);
  }
  function removeLink(i: number) {
    setLinks((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSave() {
    if (!user?.id || saving) return;
    if (!startAt || !endAt) return;
    if (endAt <= startAt) return;
    setSaving(true);
    try {
      let banner_url: string | null = null;
      if (bannerUri) {
        console.log('🔄 Uploading banner...', bannerUri);
        banner_url = await uploadBannerAsync(bannerUri, user.id);
        console.log('✅ Banner uploaded:', banner_url);
      }
      const payload = {
        organization_id: user.id,
        title: title.trim(),
        description: desc.trim(),
        starts_at: startAt.toISOString(),
        ends_at: endAt.toISOString(),
        is_online: mode !== 'In-Person',
  category,
        location: mode === 'In-Person' ? `${venue.trim()}, ${city.trim()}${address ? ', ' + address.trim() : ''}` : null,
        website: links.find((l) => !!l.trim())?.trim() || null,
        banner_url,
        min_team_size: teamBased && minTeam ? Number(minTeam) : null,
        max_team_size: teamBased && maxTeam ? Number(maxTeam) : null,
      } as const;
      await createEvent(payload as any);
      router.back();
    } catch (e: any) {
      console.log('❌ Create event error:', e);
      alert(`Failed to create event: ${e?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  }
  async function onPickBanner() {
    if (pickerBusy) return;
    try {
      setPickerBusy(true);
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission required to access media library.');
        return;
      }
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [16, 9] });
      if (!res.canceled && res.assets?.length) {
        setBannerUri(res.assets[0].uri);
      }
    } finally {
      setPickerBusy(false);
    }
  }

  if (!isOrg) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={styles.muted}>Only organizations can create events.</Text>
        <TouchableOpacity onPress={() => router.back()} style={[styles.btn, styles.btnGhost]}>
          <Text style={[styles.btnText, { color: Theme.colors.text }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Theme.colors.bg }}>
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
  <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 96 }}>
        <Text style={styles.title}>Create Event</Text>

        {/* 1. Basic Details */}
  <Section title="Basic Details">
          <Field label="Event Title">
            <Input value={title} onChangeText={setTitle} placeholder="e.g., Hackathon 2025" />
          </Field>
          <Field label="Description">
            <Input multiline value={desc} onChangeText={setDesc} placeholder="Describe the event" style={{ height: 120, textAlignVertical: 'top' }} />
          </Field>
        </Section>

        {/* 2. Date & Time */}
        <Section title="Date & Time">
          <Row>
            <View style={{ flex: 1 }}>
              <Label>Start</Label>
              <Row>
                <Pressable style={[styles.pickerBtn]} onPress={() => setShowPicker({ which: 'start', mode: 'date' })}>
                  <Text style={styles.pickerBtnText}>{startAt ? formatDate(startAt) : 'Pick date'}</Text>
                </Pressable>
                <Pressable style={[styles.pickerBtn]} onPress={() => setShowPicker({ which: 'start', mode: 'time' })}>
                  <Text style={styles.pickerBtnText}>{startAt ? formatTime(startAt) : 'Pick time'}</Text>
                </Pressable>
              </Row>
            </View>
            <View style={{ width: 12 }} />
            <View style={{ flex: 1 }}>
              <Label>End</Label>
              <Row>
                <Pressable style={[styles.pickerBtn]} onPress={() => setShowPicker({ which: 'end', mode: 'date' })}>
                  <Text style={styles.pickerBtnText}>{endAt ? formatDate(endAt) : 'Pick date'}</Text>
                </Pressable>
                <Pressable style={[styles.pickerBtn]} onPress={() => setShowPicker({ which: 'end', mode: 'time' })}>
                  <Text style={styles.pickerBtnText}>{endAt ? formatTime(endAt) : 'Pick time'}</Text>
                </Pressable>
              </Row>
            </View>
          </Row>
          <Text style={[styles.helper]}>Use the buttons to select date and time. End must be after start.</Text>
          {!!(startAt && endAt && endAt <= startAt) && (
            <Text style={styles.errorText}>End time must be after start time.</Text>
          )}
        </Section>

        {/* 3. Location & Format */}
        <Section title="Location & Format">
          <Row>
            {(['In-Person','Virtual','Hybrid'] as const).map((m) => (
              <Chip key={m} active={mode === m} onPress={() => setMode(m)}>{m}</Chip>
            ))}
          </Row>
          <View style={{ height: 8 }} />
          <Field label="Category">
            <Row style={{ flexWrap: 'wrap' }}>
              {categories.map((c) => (
                <Chip key={c} active={category === c} onPress={() => setCategory(c)}>
                  {c === 'tech event' ? 'Tech event' : c === 'tech meetup' ? 'Tech meetup' : c.charAt(0).toUpperCase() + c.slice(1)}
                </Chip>
              ))}
            </Row>
          </Field>
          {mode === 'In-Person' ? (
            <>
              <Field label="Venue Name"><Input value={venue} onChangeText={setVenue} placeholder="e.g., Tech Park Hall A" /></Field>
              <Field label="City"><Input value={city} onChangeText={setCity} placeholder="e.g., Pune" /></Field>
              <Field label="Address"><Input value={address} onChangeText={setAddress} placeholder="Street, Area, PIN" /></Field>
            </>
          ) : (
            <Field label="Event Link(s)">
              {links.map((l, i) => (
                <Row key={i}>
                  <View style={{ flex: 1 }}>
                    <Input value={l} onChangeText={(v: string) => updateLink(i, v)} placeholder="https://..." autoCapitalize="none" />
                  </View>
                  <View style={{ width: 8 }} />
                  {links.length > 1 && (
                    <TouchableOpacity onPress={() => removeLink(i)} style={[styles.btn, styles.btnGhost]}>
                      <Text style={[styles.btnText, { color: Theme.colors.text }]}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </Row>
              ))}
              <TouchableOpacity onPress={addLink} style={[styles.btn, styles.btnGhost]}>
                <Text style={[styles.btnText, { color: Theme.colors.text }]}>+ Add link</Text>
              </TouchableOpacity>
            </Field>
          )}
        </Section>

        {/* 4. Visuals & Resources */}
        <Section title="Visuals & Resources">
          <Field label="Event Banner / Image">
            <TouchableOpacity style={[styles.uploadBox]} activeOpacity={0.85} onPress={onPickBanner} disabled={pickerBusy}>
              {bannerUri ? (
                <Text style={styles.muted}>Image selected ✓</Text>
              ) : (
                <Text style={styles.muted}>{pickerBusy ? 'Opening…' : 'Tap to upload/select image'}</Text>
              )}
            </TouchableOpacity>
            {bannerUri && (
              <TouchableOpacity onPress={() => setBannerUri(null)} style={[styles.btn, styles.btnGhost, { marginTop: 8, alignSelf: 'flex-start' }]}>
                <Text style={[styles.btnText, { color: Theme.colors.text }]}>Remove image</Text>
              </TouchableOpacity>
            )}
          </Field>
          <Field label="External Resources (optional)">
            {links.map((l, i) => (
              <Row key={`ext-${i}`}>
                <View style={{ flex: 1 }}>
                  <Input value={l} onChangeText={(v: string) => updateLink(i, v)} placeholder="https://registration or repo link" autoCapitalize="none" />
                </View>
                <View style={{ width: 8 }} />
                {links.length > 1 && (
                  <TouchableOpacity onPress={() => removeLink(i)} style={[styles.btn, styles.btnGhost]}>
                    <Text style={[styles.btnText, { color: Theme.colors.text }]}>Remove</Text>
                  </TouchableOpacity>
                )}
              </Row>
            ))}
            <TouchableOpacity onPress={addLink} style={[styles.btn, styles.btnGhost, { alignSelf: 'flex-start' }]}>
              <Text style={[styles.btnText, { color: Theme.colors.text }]}>+ Add link</Text>
            </TouchableOpacity>
            <Text style={styles.helper}>Add registration page, GitHub repo, ticketing, docs, etc.</Text>
          </Field>
        </Section>

        {/* 5. Participation Details */}
        <Section title="Participation Details">
          <Row style={{ alignItems: 'center' }}>
            <Text style={[styles.label, { marginRight: 10 }]}>Team-Based?</Text>
            <Switch value={teamBased} onValueChange={setTeamBased} thumbColor={Theme.colors.primary} />
          </Row>
          {teamBased ? (
            <Row>
              <View style={{ flex: 1 }}>
                <Label>Min Team Size</Label>
                <Input value={minTeam} onChangeText={setMinTeam} keyboardType="numeric" />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Label>Max Team Size</Label>
                <Input value={maxTeam} onChangeText={setMaxTeam} keyboardType="numeric" />
              </View>
            </Row>
          ) : (
            <Text style={styles.muted}>Individual participation</Text>
          )}
          {teamBased && (
            <Field label="Team Formation Info">
              <Input multiline value={teamInfo} onChangeText={setTeamInfo} placeholder="Guidelines, team channels, etc." style={{ height: 100, textAlignVertical: 'top' }} />
            </Field>
          )}
        </Section>

        {/* 6. Submission Controls (spacer keeps content above sticky bar) */}
        <View style={{ height: 12 }} />
  </ScrollView>
      <View style={styles.footerBar}>
        <TouchableOpacity disabled={saving} style={[styles.btn, styles.btnGhost, styles.footerBtn]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: Theme.colors.text }]}>Cancel</Text>
        </TouchableOpacity>
        <View style={{ width: 8 }} />
        <TouchableOpacity disabled={!!(saving || !canSubmit || (startAt && endAt && endAt <= startAt))} style={[styles.btn, (saving || !canSubmit || (startAt && endAt && endAt <= startAt)) ? styles.btnDisabled : styles.btnPrimary, styles.footerBtn]} onPress={onSave}>
          <Text style={[styles.btnText, { color: '#fff' }]}>{saving ? 'Saving…' : 'Create'}</Text>
        </TouchableOpacity>
      </View>
      {/* Native Date/Time Picker overlay */}
      {showPicker && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowPicker(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>
                {showPicker.which === 'start' ? 'Select Start' : 'Select End'} {showPicker.mode === 'date' ? 'Date' : 'Time'}
              </Text>
              <DateTimePicker
                value={(showPicker.which === 'start' ? startAt : endAt) ?? new Date()}
                mode={showPicker.mode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                textColor={Platform.OS === 'ios' ? Theme.colors.text : undefined as any}
                onChange={(_, selected) => {
                  if (!selected) { setShowPicker(null); return; }
                  if (showPicker.which === 'start') {
                    setStartAt((prev) => applyPart(prev, selected, showPicker.mode));
                  } else {
                    setEndAt((prev) => applyPart(prev, selected, showPicker.mode));
                  }
                  setShowPicker(null);
                }}
                minimumDate={showPicker.which === 'end' && startAt ? startAt : undefined}
              />
              <TouchableOpacity style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]} onPress={() => setShowPicker(null)}>
                <Text style={[styles.btnText, { color: '#fff' }]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Label>{label}</Label>
      {children}
    </View>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}
function Row({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[{ flexDirection: 'row', gap: 8 }, style]}>{children}</View>;
}
function Chip({ children, active, onPress }: { children: React.ReactNode; active?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{children}</Text>
    </TouchableOpacity>
  );
}
function Input(props: any) {
  return (
    <TextInput
      {...props}
      style={[
        styles.input,
        props.multiline && { height: 100 },
        props.style,
      ]}
      placeholderTextColor={Theme.colors.muted}
    />
  );
}

function pad(n: number) { return n.toString().padStart(2, '0'); }
function formatDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatTime(d: Date) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function applyPart(prev: Date | null, picked: Date, part: 'date' | 'time') {
  const base = prev ?? new Date();
  const out = new Date(base);
  if (part === 'date') {
    out.setFullYear(picked.getFullYear());
    out.setMonth(picked.getMonth());
    out.setDate(picked.getDate());
  } else {
    out.setHours(picked.getHours());
    out.setMinutes(picked.getMinutes());
    out.setSeconds(0);
    out.setMilliseconds(0);
  }
  return out;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Theme.colors.bg, padding: 16 },
  title: { color: Theme.colors.text, fontSize: 24, fontFamily: 'Urbanist_800ExtraBold', marginBottom: 12 },
  section: { backgroundColor: Theme.colors.card, borderRadius: 16, borderWidth: 1, borderColor: Theme.colors.border, padding: 14, marginBottom: 12 },
  sectionTitle: { color: Theme.colors.text, fontFamily: 'Urbanist_700Bold', marginBottom: 10, fontSize: 16 },
  label: { color: Theme.colors.text, fontFamily: 'Urbanist_600SemiBold', marginBottom: 6 },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: Theme.colors.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Theme.colors.text,
  },
  chip: { backgroundColor: '#F0F4FF', borderColor: Theme.colors.border, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  chipActive: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  chipText: { color: Theme.colors.text, fontFamily: 'Urbanist_600SemiBold' },
  chipTextActive: { color: '#FFFFFF' },
  btn: { backgroundColor: Theme.colors.card, borderColor: Theme.colors.border, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, alignItems: 'center' },
  btnPrimary: { backgroundColor: Theme.colors.primary, borderColor: Theme.colors.primary },
  btnGhost: { backgroundColor: '#F0F4FF' },
  btnDisabled: { opacity: 0.6 },
  btnText: { fontFamily: 'Urbanist_700Bold' },
  uploadBox: { height: undefined, aspectRatio: 16/9, borderRadius: 12, borderWidth: 1, borderColor: Theme.colors.border, backgroundColor: '#F8FAFF', alignItems: 'center', justifyContent: 'center' },
  muted: { color: Theme.colors.muted },
  pickerBtn: { flex: 1, backgroundColor: '#F0F4FF', borderColor: Theme.colors.border, borderWidth: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  pickerBtnText: { color: Theme.colors.text, fontFamily: 'Urbanist_600SemiBold' },
  helper: { color: Theme.colors.subtle, marginTop: 6 },
  errorText: { color: '#D64545', marginTop: 6 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modalCard: { backgroundColor: Theme.colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Theme.colors.border, width: '100%' },
  modalTitle: { color: Theme.colors.text, fontFamily: 'Urbanist_700Bold', fontSize: 16, marginBottom: 8 },
  footerBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: 'rgba(255,255,255,0.94)', borderTopWidth: 1, borderTopColor: Theme.colors.border, flexDirection: 'row' },
  footerBtn: { flex: 1 },
});
