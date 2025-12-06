export type EventType = 'business' | 'wedding' | 'party';

export type BlockLayout = 'media-left' | 'media-right' | 'media-only' | 'text-only';

export type TextAlign = 'left' | 'center' | 'right' | 'justify';
export type FontFamily = 'sans' | 'serif' | 'mono';
export type FontSize = 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '4xl';

export interface TextStyle {
  align: TextAlign;
  size: FontSize;
  family: FontFamily;
  bold: boolean;
  italic: boolean;
  color: string;
}

export interface BlockContent {
  text: string;
  textStyle: TextStyle;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
}

export interface PageBlock {
  id: string;
  layout: BlockLayout;
  content: BlockContent;
}

export interface PageState {
  title: string;
  eventType: EventType;
  blocks: PageBlock[];
}
