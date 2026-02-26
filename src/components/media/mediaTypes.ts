export interface MediaItem {
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  name?: string;
  mimeType?: string;
}
