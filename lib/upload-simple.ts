import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { getSupabase } from './supabase';

// Simplified upload using Expo FileSystem with XMLHttpRequest fallback
export async function uploadToBucketSimple(params: { bucket: string; path: string; uri: string; contentType?: string }) {
  const { bucket, path, uri, contentType = 'image/jpeg' } = params;
  console.log('🔄 Simple upload:', { bucket, path, uri: uri.substring(0, 50) + '...' });
  
  try {
    const supabase = getSupabase();
    
    // Check auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated: ' + (authError?.message || 'No user'));
    }
    console.log('👤 User authenticated:', user.id);

    // Get the session for authorization
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No access token found');
    }
    console.log('🔑 Access token obtained');

    if (Platform.OS === 'web') {
      // Web: use fetch to get Blob and use Supabase Storage upload API
      console.log('🌐 Web upload via Supabase Storage');
      const res = await fetch(uri);
      const blob = await res.blob();
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, { contentType, upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      console.log('✅ Web upload successful:', data.publicUrl);
      return data.publicUrl;
    } else {
      // Native: Use Expo FileSystem.uploadAsync for direct upload
      const uploadUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;
      console.log('📡 Upload URL:', uploadUrl);

      const uploadResult = await FileSystem.uploadAsync(uploadUrl, uri, {
        httpMethod: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': contentType,
          'x-upsert': 'true'
        },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      });

      console.log('📤 Upload result status:', uploadResult.status);
      console.log('📤 Upload result body:', uploadResult.body);

      if (uploadResult.status === 200 || uploadResult.status === 201) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        console.log('✅ Native upload successful:', data.publicUrl);
        return data.publicUrl;
      } else {
        throw new Error(`Upload failed with status ${uploadResult.status}: ${uploadResult.body}`);
      }
    }

  } catch (error) {
    console.log('💥 Simple upload error:', error);
    throw error;
  }
}
