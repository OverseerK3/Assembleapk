import * as FileSystem from 'expo-file-system';
import { getSupabase } from './supabase';

// Alternative upload method using FormData (better for mobile)
export async function uploadToBucketFormData(params: { bucket: string; path: string; uri: string; contentType?: string }) {
  const { bucket, path, uri, contentType = 'image/jpeg' } = params;
  console.log('🔄 FormData upload:', { bucket, path, uri: uri.substring(0, 50) + '...' });
  
  try {
    const supabase = getSupabase();
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated: ' + (authError?.message || 'No user'));
    }
    console.log('👤 User authenticated:', user.id);

    // Read file as base64
    const base64 = await FileSystem.readAsStringAsync(uri, { 
      encoding: FileSystem.EncodingType.Base64 
    });
    console.log('📄 File read, base64 length:', base64.length);
    
    // Convert base64 to binary
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create blob
    const blob = new Blob([bytes], { type: contentType });
    console.log('✅ Blob created, size:', blob.size);
    
    // Upload using the blob
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { 
        upsert: true, 
        contentType: contentType,
        duplex: 'half' // This can help with mobile uploads
      });
      
    if (error) {
      console.log('❌ Upload error:', error);
      throw error;
    }
    
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    console.log('✅ Upload successful, URL:', data.publicUrl);
    return data.publicUrl;
    
  } catch (error) {
    console.log('💥 FormData upload error:', error);
    throw error;
  }
}
