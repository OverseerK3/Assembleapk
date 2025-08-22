// Supabase Storage Upload Troubleshooting
// Add this to any component to test upload functionality

import { getSupabase } from '@/lib/supabase';
import { uploadToBucketSimple } from '@/lib/upload-simple';
import * as ImagePicker from 'expo-image-picker';

export const testUploadFunction = async () => {
  console.log('🧪 Starting upload tests...');
  
  try {
    // Test 1: Check Supabase connection
    const supabase = getSupabase();
    console.log('✅ Supabase client created');
    
    // Test 2: Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('❌ Auth failed:', authError);
      return;
    }
    console.log('✅ User authenticated:', user.id);
    
    // Test 3: Check bucket access
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    console.log('📦 Available buckets:', buckets?.map(b => b.name), bucketError);
    
    // Test 4: Test file picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    
    if (result.canceled) {
      console.log('📷 Image picker canceled');
      return;
    }
    
    const imageUri = result.assets[0].uri;
    console.log('📷 Image selected:', imageUri.substring(0, 50) + '...');
    
    // Test 5: Test upload
    const testPath = `events/${user.id}/test-${Date.now()}.jpg`;
    console.log('📁 Testing upload to path:', testPath);
    
  const publicUrl = await uploadToBucketSimple({
      bucket: 'event-banners',
      path: testPath,
      uri: imageUri,
      contentType: 'image/jpeg'
    });
    
    console.log('🎉 Upload test successful!', publicUrl);
    alert('Upload test successful! Check console for details.');
    
  } catch (error: any) {
    console.log('💥 Upload test failed:', error);
    alert(`Upload test failed: ${error?.message || 'Unknown error'}`);
  }
};

// Usage: Add a button in your component that calls testUploadFunction()
