import React, { useRef, memo } from 'react';
import { PageBlock, BlockLayout, TextStyle } from '../types';
import { Icons } from './Icons';
import TextToolbar from './TextToolbar';

interface BlockRendererProps {
  block: PageBlock;
  onUpdate: (id: string, updates: Partial<PageBlock>) => void;
  onDelete: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  isFirst: boolean;
  isLast: boolean;
}

// Optimization: Separate props interface for clarity
interface LayoutButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}

// Optimization: Wrapped in memo to prevent re-renders when typing in the textarea.
// Added comparison function to ignore function reference changes if active state is same.
const LayoutButton = memo(({
  active,
  onClick,
  children,
  label
}: LayoutButtonProps) => (
  <button
    type="button" // Critical Fix: Prevent form submission default behavior
    onClick={onClick}
    aria-pressed={active}
    className={`
      flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all duration-200
      ${active
        ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm ring-1 ring-blue-500/20'
        : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
      }
    `}
    title={label}
  >
    {children}
  </button>
), (prev, next) => {
  // Only re-render if active state or label changes. 
  // We ignore onClick changes to prevent useless renders during parent state updates.
  return prev.active === next.active && prev.label === next.label;
});

LayoutButton.displayName = 'LayoutButton';

const BlockRenderer: React.FC<BlockRendererProps> = ({
  block,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLayoutChange = (layout: BlockLayout) => {
    onUpdate(block.id, { layout });
  };

  const handleTextChange = (text: string) => {
    onUpdate(block.id, {
      content: { ...block.content, text }
    });
  };

  const handleStyleChange = (textStyle: TextStyle) => {
    onUpdate(block.id, {
      content: { ...block.content, textStyle }
    });
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error('Upload failed');

        const data = await res.json();
        const mediaType = file.type.startsWith('video') ? 'video' : 'image';

        onUpdate(block.id, {
          content: {
            ...block.content,
            mediaUrl: data.url,
            mediaType
          }
        });
      } catch (error) {
        console.error('Error uploading file:', error);
        alert('Failed to upload file');
      }
    }
  };

  const getFontFamily = (family: string) => {
    switch (family) {
      case 'serif': return 'font-serif';
      case 'mono': return 'font-mono';
      default: return 'font-sans';
    }
  };

  const getFontSize = (size: string) => {
    switch (size) {
      case 'sm': return 'text-sm';
      case 'lg': return 'text-lg';
      case 'xl': return 'text-xl';
      case '2xl': return 'text-2xl';
      case '4xl': return 'text-4xl';
      default: return 'text-base';
    }
  };

  const textEditor = (
    <div className="flex flex-col w-full h-full min-h-[150px] transition-all overflow-hidden">
      <TextToolbar style={block.content.textStyle} onChange={handleStyleChange} />
      <textarea
        value={block.content.text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="Type your content here..."
        className={`w-full h-full p-4 bg-transparent border border-dashed border-gray-300 rounded-lg hover:border-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-y min-h-[200px]
          ${getFontFamily(block.content.textStyle.family)}
          ${getFontSize(block.content.textStyle.size)}
          ${block.content.textStyle.bold ? 'font-bold' : 'font-normal'}
          ${block.content.textStyle.italic ? 'italic' : 'not-italic'}
        `}
        style={{
          textAlign: block.content.textStyle.align,
          color: block.content.textStyle.color,
        }}
      />
    </div>
  );

  const mediaPlaceholder = (
    <div
      className="group relative flex flex-col items-center justify-center w-full min-h-[200px] md:min-h-[250px] bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer overflow-hidden"
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*,video/*"
        onChange={handleMediaUpload}
      />

      {block.content.mediaUrl ? (
        block.content.mediaType === 'video' ? (
          <video src={block.content.mediaUrl} controls className="w-full h-full object-cover" />
        ) : (
          <img src={block.content.mediaUrl} alt="Block media" className="w-full h-full object-cover" />
        )
      ) : (
        <>
          <Icons.Image className="text-gray-400 mb-2 group-hover:text-gray-600" size={32} />
          <span className="text-gray-500 font-medium text-sm text-center px-2">Click to upload Media</span>
        </>
      )}

      {block.content.mediaUrl && (
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-white font-medium bg-black/50 px-3 py-1 rounded-full">Change Media</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="group/block relative bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300 p-4 md:p-6 mb-6 overflow-hidden">

      {/* Header: Layout Label, Options & Controls 
          Using flex-wrap and order classes to handle responsive layout:
          Mobile: Label (1) | Controls (2) 
                  Buttons (3 - full width)
          Desktop: Label (1) | Buttons (2) | Controls (3 - ml-auto)
      */}
      <div className="flex flex-wrap md:flex-nowrap items-center gap-4 mb-6 border-b border-gray-100 pb-4">

        {/* Label - Order 1 */}
        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 order-1">
          <Icons.Layout size={18} className="text-gray-400" />
          <span>Layout</span>
        </div>

        {/* Controls - Order 2 (mobile) / Order 3 (desktop) */}
        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-100 shadow-sm p-1 order-2 md:order-3 ml-auto">
          <button
            type="button"
            onClick={() => !isFirst && onMoveUp(block.id)}
            disabled={isFirst}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-30 transition-colors"
          >
            <Icons.Up size={16} />
          </button>
          <button
            type="button"
            onClick={() => !isLast && onMoveDown(block.id)}
            disabled={isLast}
            className="p-1.5 hover:bg-gray-100 rounded text-gray-500 disabled:opacity-30 transition-colors"
          >
            <Icons.Down size={16} />
          </button>
          <div className="w-px h-4 bg-gray-200 mx-1"></div>
          <button
            type="button"
            onClick={() => onDelete(block.id)}
            className="p-1.5 hover:bg-red-50 text-red-500 rounded transition-colors"
          >
            <Icons.Delete size={16} />
          </button>
        </div>

        {/* Layout Selection Buttons - Order 3 (mobile) / Order 2 (desktop) */}
        <div className="flex flex-wrap gap-2 order-3 md:order-2 w-full md:w-auto">
          <LayoutButton
            active={block.layout === 'media-left'}
            onClick={() => handleLayoutChange('media-left')}
            label="Media Left"
          >
            <Icons.Image size={16} />
            <Icons.Left size={16} />
          </LayoutButton>

          <LayoutButton
            active={block.layout === 'media-right'}
            onClick={() => handleLayoutChange('media-right')}
            label="Media Right"
          >
            <Icons.Left size={16} />
            <Icons.Image size={16} />
          </LayoutButton>

          <LayoutButton
            active={block.layout === 'media-only'}
            onClick={() => handleLayoutChange('media-only')}
            label="Media Only"
          >
            <Icons.Image size={16} />
          </LayoutButton>

          <LayoutButton
            active={block.layout === 'text-only'}
            onClick={() => handleLayoutChange('text-only')}
            label="Text Only"
          >
            <Icons.Left size={16} />
          </LayoutButton>
        </div>

      </div>

      {/* Dynamic Content Grid */}
      <div className={`grid gap-6 ${block.layout === 'media-left' ? 'grid-cols-1 md:grid-cols-2' :
        block.layout === 'media-right' ? 'grid-cols-1 md:grid-cols-2' :
          'grid-cols-1'
        }`}>

        {/* Render Order Logic */}
        {block.layout === 'media-left' && (
          <>
            <div className="order-1">{mediaPlaceholder}</div>
            <div className="order-2">{textEditor}</div>
          </>
        )}

        {block.layout === 'media-right' && (
          <>
            <div className="order-2 md:order-1">{textEditor}</div>
            <div className="order-1 md:order-2">{mediaPlaceholder}</div>
          </>
        )}

        {block.layout === 'media-only' && (
          <div className="w-full max-w-4xl mx-auto">{mediaPlaceholder}</div>
        )}

        {block.layout === 'text-only' && (
          <div className="w-full max-w-4xl mx-auto">{textEditor}</div>
        )}

      </div>
    </div>
  );
};

export default BlockRenderer;